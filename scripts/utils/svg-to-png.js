const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const RENDERER_CACHE_VERSION = '2';

let resvg = null;
let sharp = null;

function tryRequire(modName) {
  try {
    return require(modName);
  } catch (e) {
    return null;
  }
}

function svgHash(svgString, width, options = {}) {
  const h = crypto.createHash('md5');
  const fontSignature = (options.fontFiles || []).map((file) => {
    try {
      const stat = fs.statSync(file);
      return `${path.resolve(file)}:${stat.size}:${stat.mtimeMs}`;
    } catch (error) {
      return `${path.resolve(file)}:missing`;
    }
  }).join('|');
  h.update(`${RENDERER_CACHE_VERSION}|${svgString}|${width}|${fontSignature}`);
  return h.digest('hex').slice(0, 12);
}

function svgToPngBuffer(svgString, width, options = {}) {
  if (!resvg) {
    const mod = tryRequire('@resvg/resvg-js');
    if (mod && mod.Resvg) {
      resvg = mod;
    }
  }
  if (resvg) {
    const resvgInstance = new resvg.Resvg(svgString, {
      fitTo: { mode: 'width', value: width },
      font: {
        loadSystemFonts: options.loadSystemFonts !== false,
        fontFiles: options.fontFiles || [],
      },
    });
    return resvgInstance.render().asPng();
  }

  if ((options.fontFiles || []).length > 0) {
    throw new Error('SVG 指定了 bundled 字体，但 @resvg/resvg-js 不可用；为避免字体回退导致版式漂移，已停止渲染');
  }

  if (sharp === null) {
    sharp = tryRequire('sharp');
  }
  if (sharp) {
    const { execSync } = require('child_process');
    const svgB64 = Buffer.from(svgString).toString('base64');
    const script = `
const sharp = require('sharp');
const buf = Buffer.from('${svgB64}', 'base64');
sharp(buf).resize(${width}).png().toBuffer().then(b => {
  process.stdout.write(b);
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
`;
    try {
      return execSync(`node -e "${script.replace(/"/g, '\\"')}"`, {
        cwd: path.join(__dirname, '..', '..'),
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e) {
      // fall through
    }
  }

  try {
    const { execSync } = require('child_process');
    const tmpDir = process.env.TMPDIR || '/tmp';
    const svgPath = path.join(tmpDir, `_svgconv_${Date.now()}.svg`);
    const pngPath = path.join(tmpDir, `_svgconv_${Date.now()}.png`);
    fs.writeFileSync(svgPath, svgString);
    execSync(`convert -background none -density 288 "${svgPath}" -resize ${width} "${pngPath}"`, {
      stdio: 'pipe',
    });
    const buf = fs.readFileSync(pngPath);
    try { fs.unlinkSync(svgPath); fs.unlinkSync(pngPath); } catch(e) {}
    return buf;
  } catch (e) {
    throw new Error('SVG 转 PNG 失败：未找到可用的渲染器（@resvg/resvg-js / sharp / ImageMagick）');
  }
}

function svgToPngFile(svgString, outputDir, baseName, width, options = {}) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const hash = svgHash(svgString, width, options);
  const fileName = `${baseName}-${hash}.png`;
  const outPath = path.join(outputDir, fileName);
  if (fs.existsSync(outPath)) {
    return fileName;
  }
  const buf = svgToPngBuffer(svgString, width, options);
  fs.writeFileSync(outPath, buf);
  return fileName;
}

class DecoAssetManager {
  constructor(config = {}) {
    if (typeof config === 'string') config = { presetDir: config };
    const presetDir = path.resolve(config.presetDir || process.cwd());
    const cacheId = String(config.cacheId || path.basename(presetDir) || 'preset').replace(/[^a-z0-9_-]/gi, '-');
    this.sourceAssetDir = path.resolve(config.sourceAssetDir || path.join(presetDir, 'assets'));
    this.cacheDir = path.resolve(config.cacheDir || path.join(os.tmpdir(), 'ryan-wechat-publisher', 'svg-cache', cacheId));
    this.fontFiles = (config.fontFiles || []).map((file) => path.resolve(file));
    const missingFonts = this.fontFiles.filter((file) => !fs.existsSync(file));
    if (missingFonts.length) {
      throw new Error(`SVG 字体文件不存在: ${missingFonts.join(', ')}`);
    }
    this.loadSystemFonts = config.loadSystemFonts !== false;
    this.outputDir = null;
    this.useLocalPath = false;
    this.urlPrefix = '';
    this.cache = new Map();
  }

  setOutput(dirOrOptions, useLocal, urlPrefix = '') {
    const options = typeof dirOrOptions === 'object'
      ? dirOrOptions
      : { outputDir: dirOrOptions, useLocalPath: useLocal, urlPrefix };
    this.outputDir = path.resolve(options.outputDir);
    this.useLocalPath = Boolean(options.useLocalPath);
    this.urlPrefix = String(options.urlPrefix || '').replace(/^\/+|\/+$/g, '');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  get(svgString, baseName, width) {
    const renderOptions = { fontFiles: this.fontFiles, loadSystemFonts: this.loadSystemFonts };
    const key = `${baseName}|${width}|${svgHash(svgString, width, renderOptions)}`;
    if (this.cache.has(key)) {
      return this._resolvePath(this.cache.get(key));
    }

    const hash = svgHash(svgString, width, renderOptions);
    const fileName = `${baseName}-${hash}.png`;
    const cachePath = path.join(this.cacheDir, fileName);

    if (!fs.existsSync(cachePath)) {
      const buf = svgToPngBuffer(svgString, width, renderOptions);
      fs.writeFileSync(cachePath, buf);
    }

    this.cache.set(key, fileName);
    return this._resolvePath(fileName);
  }

  _resolvePath(fileName) {
    if (!this.outputDir) return fileName;

    const outPath = path.join(this.outputDir, fileName);
    if (!fs.existsSync(outPath)) {
      const cachePath = path.join(this.cacheDir, fileName);
      fs.copyFileSync(cachePath, outPath);
    }

    if (this.useLocalPath) {
      return outPath;
    }
    return this.urlPrefix ? path.posix.join(this.urlPrefix, fileName) : fileName;
  }

  clearCache() {
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
    }
    this.cache.clear();
  }
}

module.exports = { svgHash, svgToPngBuffer, svgToPngFile, DecoAssetManager, RENDERER_CACHE_VERSION };
