const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let resvg = null;
let sharp = null;

function tryRequire(modName) {
  try {
    return require(modName);
  } catch (e) {
    return null;
  }
}

function svgHash(svgString, width) {
  const h = crypto.createHash('md5');
  h.update(svgString + '|' + width);
  return h.digest('hex').slice(0, 12);
}

function svgToPngBuffer(svgString, width) {
  if (!resvg) {
    const mod = tryRequire('@resvg/resvg-js');
    if (mod && mod.Resvg) {
      resvg = mod;
    }
  }
  if (resvg) {
    const resvgInstance = new resvg.Resvg(svgString, {
      fitTo: { mode: 'width', value: width },
    });
    return resvgInstance.render().asPng();
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

function svgToPngFile(svgString, outputDir, baseName, width) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const hash = svgHash(svgString, width);
  const fileName = `${baseName}-${hash}.png`;
  const outPath = path.join(outputDir, fileName);
  if (fs.existsSync(outPath)) {
    return fileName;
  }
  const buf = svgToPngBuffer(svgString, width);
  fs.writeFileSync(outPath, buf);
  return fileName;
}

class DecoAssetManager {
  constructor(presetDir) {
    this.cacheDir = path.join(presetDir, 'assets');
    this.outputDir = null;
    this.useLocalPath = false;
    this.cache = new Map();
  }

  setOutput(dir, useLocal) {
    this.outputDir = dir;
    this.useLocalPath = useLocal;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  get(svgString, baseName, width) {
    const key = `${baseName}|${width}|${svgHash(svgString, width)}`;
    if (this.cache.has(key)) {
      return this._resolvePath(this.cache.get(key));
    }

    const hash = svgHash(svgString, width);
    const fileName = `${baseName}-${hash}.png`;
    const cachePath = path.join(this.cacheDir, fileName);

    if (!fs.existsSync(cachePath)) {
      const buf = svgToPngBuffer(svgString, width);
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
    return fileName;
  }
}

module.exports = { svgToPngBuffer, svgToPngFile, DecoAssetManager };
