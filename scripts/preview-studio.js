#!/usr/bin/env node
/**
 * 公众号排版预览器（Studio）生成器。
 *
 * 干什么：把「选定的预设 + 已结构化的文章」渲染成一个**自包含**的 studio.html ——
 *   左边是模板/图片/夜间体检信息，右边是排版预览，支持电脑端 / 手机端、白天 / 夜间切换，
 *   以及最重要的一键「复制到公众号」（整篇内联样式进剪贴板，粘贴到公众号编辑器不会掉样式）。
 *
 * 同时内置**校验门**：渲染完自动跑三门校验（内容一致性 / 微信兼容 / 图片存在性），
 *   日志写进 <workdir>/05-validation/，任一未通过就 exit 1（并且不会 --open），
 *   避免「没校验就打开预览器让用户确认」这种返工。不需要时用 --no-validate 关掉。
 *
 * 为什么这么做：复制粘贴的富文本、日夜映射、图片状态判断这些逻辑都写死在 assets/previewer/ 里，
 *   skill 每次任务只需要跑一条命令把模板套上去，不需要重新实现一遍预览器。
 *
 * 用法：
 *   node scripts/preview-studio.js --md <structured.md> --preset <预设ID> [选项]
 *
 * 常用：
 *   node scripts/preview-studio.js --md 02-structured/structured.md --preset purple-badge --workdir /tmp/xxx --open
 *
 * 选项：
 *   --md <路径>              结构化文章（必填）
 *   --preset <ID|路径>       预设 ID，或自定义 preset 模块路径（必填）
 *   --workdir <目录>         任务工作目录，用于推导 04-html/ 与 05-validation/ 下的默认路径
 *   --out <路径>             studio.html 输出路径（默认 <workdir>/04-html/studio.html）
 *   --output-body <路径>     发布版 HTML（默认 <out 同目录>/article-body.html）
 *   --output-preview <路径>  普通预览页（默认 <out 同目录>/article-preview.html）
 *   --asset-dir <目录>       图片搜索目录（可多次指定；默认 <workdir>/01-input/images）
 *   --asset-output-dir <目录> 动态生成图片输出目录（默认 <out 同目录>/assets）
 *   --asset-url-prefix <前缀> 发布版图片 URL 前缀（默认 assets）
 *   --copy-html <路径>       复制用的发布版 HTML（默认用本次渲染的发布版 HTML）
 *   --inline-images          把复制内容里的本地图片转成内联 base64（默认就开；见下）
 *   --no-inline-images       关闭内联，复制内容里保留本地路径
 *   --inline-max-width <N>   内联前把图片压到这个宽度（默认 1080；装不上 sharp 则用原图）
 *   --image-host <id>        图床（litterbox 为默认；none 关闭）。上传发生在预览器里点「复制到公众号」时
 *   --no-image-host          等价于 --image-host none：完全不带图床，只内联 base64
 *   --image-host-time <时长> 图床有效期 1h/12h/24h/72h（默认 72h，Litterbox 最长 72h）
 *   --image-host-min-size <KB> 只把不小于该体积的图传图床（默认 0 = 全部；其余仍走内联）
 *   --title <标题>           标注标题（默认取 structured.md frontmatter 的 title，其次第一个 # 标题，最后文件名）
 *   --heading-offset <N>     标题层级偏移（默认 0）
 *   --validate               渲染后跑三门校验（默认就开）
 *   --no-validate            跳过校验门（脚本化批处理时才用）
 *   --validation-dir <目录>  校验日志目录（默认 <workdir>/05-validation）
 *   --open                   校验通过后用系统默认浏览器打开
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const { renderArticle } = require('./render');
const { getPreset, PRESETS } = require('./presets/index');
const { simulateDark, parseColor, mapBackground } = require('./utils/dark-preview');
const { buildPreviewPage } = require('./utils/preview-page');
const { collectImageRefs, collectLocalImageRefs, replaceImageRefs } = require('./utils/image-refs');
const { extractTitle } = require('./utils/md-title');
const { getImageHost, listImageHosts, uploadWithRetry, EXPIRY_HOURS } = require('./utils/image-hosts');

const PREVIEWER_DIR = path.join(__dirname, '..', 'assets', 'previewer');
// 默认图床：复制时上传是更稳的路径（大图/动图不会把剪贴板撑爆），
// 但它是可选行为 —— 预览器里有开关，命令行用 --no-image-host 也能整个关掉。
const DEFAULT_IMAGE_HOST = 'litterbox';
// 页面里唯一 data URI 的匹配规则：Node 侧与预览器侧共用同一份，避免两边顺序对不上
const DATA_URI_PATTERN = 'data:[a-z0-9.+-]+\\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+';
const SCRIPTS_DIR = __dirname;

// ---------- 参数 ----------
function printHelp() {
  const src = fs.readFileSync(__filename, 'utf-8');
  const doc = src.match(/\/\*\*([\s\S]*?)\*\//);
  console.log(doc ? doc[1].replace(/^ \* ?/gm, '').trim() : '用法见脚本头部注释');
}

function parseArgs(argv) {
  const opts = { assetDirs: [], headingOffset: 0, open: false, validate: true };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--md': opts.md = argv[++i]; break;
      case '--preset': opts.preset = argv[++i]; break;
      case '--workdir': opts.workdir = argv[++i]; break;
      case '--out': opts.out = argv[++i]; break;
      case '--output-body': opts.outputBody = argv[++i]; break;
      case '--output-preview': opts.outputPreview = argv[++i]; break;
      case '--asset-dir': opts.assetDirs.push(argv[++i]); break;
      case '--asset-output-dir': opts.assetOutputDir = argv[++i]; break;
      case '--asset-url-prefix': opts.assetUrlPrefix = argv[++i]; break;
      case '--copy-html': opts.copyHtml = argv[++i]; break;
      case '--inline-images': opts.inlineImages = true; break;
      case '--no-inline-images': opts.noInlineImages = true; break;
      case '--inline-max-width': opts.inlineMaxWidth = parseInt(argv[++i], 10) || 1080; break;
      case '--image-host': opts.imageHost = argv[++i]; break;
      case '--no-image-host': opts.imageHost = 'none'; break;
      case '--image-host-time': opts.imageHostTime = argv[++i]; break;
      case '--image-host-min-size': opts.imageHostMinSize = parseFloat(argv[++i]) || 0; break;
      case '--title': opts.title = argv[++i]; break;
      case '--heading-offset': opts.headingOffset = parseInt(argv[++i], 10) || 0; break;
      case '--validate': opts.validate = true; break;
      case '--no-validate': opts.validate = false; break;
      case '--validation-dir': opts.validationDir = argv[++i]; break;
      case '--open': opts.open = true; break;
      case '-h': case '--help': printHelp(); process.exit(0); break;
      default:
        console.error(`未知参数: ${argv[i]}`);
        console.error('运行 `node scripts/preview-studio.js --help` 查看用法');
        process.exit(1);
    }
  }
  return opts;
}

// ---------- 内容分析 ----------
function htmlToText(html) {
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|section|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function classifyImage(src) {
  if (/^https?:\/\//i.test(src)) {
    return /^https?:\/\/mmbiz\.qpic\.cn\//i.test(src) ? 'wechat' : 'external';
  }
  if (/^data:/i.test(src)) return 'data';
  return 'local';
}

// 图片清单：<img> 与 CSS background-image 两类载体都要统计，否则装饰图会被漏报
function inspectImages(html) {
  const list = [];
  const byKind = { wechat: 0, external: 0, local: 0, data: 0 };
  const byWhere = { img: 0, css: 0 };
  for (const item of collectImageRefs(html)) {
    if (item.kind === 'other') continue;
    if (byKind[item.kind] === undefined) byKind[item.kind] = 0;
    byKind[item.kind]++;
    byWhere[item.where]++;
    list.push({ src: item.ref, kind: item.kind, where: item.where });
  }
  return { total: list.length, byKind, byWhere, list };
}

// 复制进公众号编辑器时，图片用 src 比 data-src 更稳（编辑器按 src 抓图），两个都留
function addSrcToImages(html) {
  let count = 0;
  const out = html.replace(/<img\b([^>]*)>/gi, (tag, attrs) => {
    if (/\ssrc\s*=/i.test(attrs)) return tag;
    const m = attrs.match(/\sdata-src\s*=\s*"([^"]*)"/i);
    if (!m) return tag;
    count++;
    return `<img src="${m[1]}"${attrs}>`;
  });
  return { html: out, count };
}

// ---------- 图片内联（--inline-images）----------
const IMG_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

function resolveLocalImage(src, dirs) {
  if (/^(https?:|data:)/i.test(src)) return null;
  const candidates = path.isAbsolute(src) ? [src] : dirs.map((dir) => path.join(dir, src));
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function toDataUri(filePath, maxWidth) {
  const mime = IMG_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const raw = fs.readFileSync(filePath);
  const asIs = { uri: `data:${mime};base64,${raw.toString('base64')}`, bytes: raw.length, compressed: false };

  let sharp = null;
  try { sharp = require('sharp'); } catch (err) { return asIs; }
  if (mime === 'image/gif') return asIs; // 动图不压，避免丢帧

  try {
    const isPng = mime === 'image/png';
    const resized = sharp(raw).resize({ width: maxWidth, withoutEnlargement: true });
    const out = isPng
      ? await resized.png({ compressionLevel: 9 }).toBuffer()
      : await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    if (out.length >= raw.length) return asIs;
    return {
      uri: `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${out.toString('base64')}`,
      bytes: out.length,
      compressed: true,
    };
  } catch (err) {
    return asIs;
  }
}

// ---------- 图床托管（--image-host）----------
// 复制内容里始终保留内联 base64（保证任何时候粘贴都有图）；
// 开了 --image-host 时，额外把「不小于阈值」的图片列成待上传清单，
// 由预览器在用户点「复制到公众号」那一刻才上传，拿到 https 链接后替换掉 base64。
function planHostUpload({ host, time, minSizeKb = 0, entries = [], enabled = true, html = '' }) {
  // 清单里**不复制** data URI 本体（复制会让 studio.html 大一倍），
  // 只记「它是 html 里第几个唯一 data URI」；预览器用同一个正则按同样顺序取回。
  const unique = new Map();
  const uriRe = new RegExp(DATA_URI_PATTERN, 'gi');
  let matched;
  while ((matched = uriRe.exec(html))) {
    if (!unique.has(matched[0])) unique.set(matched[0], unique.size);
  }

  const items = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.dataUri || seen.has(entry.dataUri)) continue;
    if (entry.bytes < minSizeKb * 1024) continue;
    const index = unique.get(entry.dataUri);
    if (index === undefined) continue;
    seen.add(entry.dataUri);
    items.push({ name: path.basename(entry.file || entry.ref || 'image'), bytes: entry.bytes, i: index });
  }
  return {
    available: items.length > 0,
    enabled: enabled && items.length > 0,
    uriPattern: DATA_URI_PATTERN,
    host: host.id,
    label: host.label,
    endpoint: host.endpoint,
    time: EXPIRY_HOURS[time] ? time : host.defaultTime,
    timeLabel: `${EXPIRY_HOURS[time] || EXPIRY_HOURS[host.defaultTime] || 72} 小时`,
    count: items.length,
    bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    items,
  };
}

// 把复制内容里的本地图片换成内联 base64：粘贴时微信编辑器能把 data: 图转存到自己的 CDN，
// 不需要图床、不需要本地服务器、也不需要云托管服务。
// 注意：<img> 与 CSS background-image 两类载体都要处理，否则装饰图粘贴后会裂。
async function inlineLocalImages(html, { searchDirs, maxWidth }) {
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  const cache = new Map();
  const mapping = new Map();
  let missing = 0;

  const refOfFile = new Map();
  const load = async (ref) => {
    const file = resolveLocalImage(ref, searchDirs);
    if (!file) { missing++; return null; }
    if (!refOfFile.has(file)) refOfFile.set(file, ref);
    if (!cache.has(file)) cache.set(file, await toDataUri(file, maxWidth));
    return cache.get(file);
  };

  for (const tag of tags) {
    const m = tag.match(/\s(?:data-src|src)\s*=\s*"([^"]*)"/i);
    if (!m) continue;
    const src = m[1];
    if (/^(https?:|data:)/i.test(src)) continue;
    const info = await load(src);
    if (info) mapping.set(tag, info);
  }

  let out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const info = mapping.get(tag);
    if (!info) return tag;
    // 去掉旧地址（含 data-src，避免微信读到本地路径），只留内联 src
    return tag
      .replace(/\s(?:src|data-src)\s*=\s*"[^"]*"/gi, '')
      .replace(/^<img\b/i, `<img src="${info.uri}"`);
  });

  // CSS background-image: url(...) 里的本地装饰图同样要内联
  const cssMapping = new Map();
  for (const item of collectLocalImageRefs(out)) {
    if (item.where !== 'css' || cssMapping.has(item.ref)) continue;
    const info = await load(item.ref);
    if (info) cssMapping.set(item.ref, info);
  }
  if (cssMapping.size) {
    out = replaceImageRefs(out, new Map([...cssMapping].map(([ref, info]) => [ref, info.uri])));
  }

  const entries = [...cache.entries()].map(([file, info]) => ({
    file,
    ref: refOfFile.get(file) || '',
    bytes: info.bytes,
    dataUri: info.uri,
    compressed: info.compressed,
  }));
  const stats = [...mapping.values(), ...cssMapping.values()].reduce(
    (acc, info) => ({
      count: acc.count + 1,
      bytes: acc.bytes + info.bytes,
      compressed: acc.compressed + (info.compressed ? 1 : 0),
      maxBytes: Math.max(acc.maxBytes, info.bytes),
    }),
    { count: 0, bytes: 0, compressed: 0, maxBytes: 0 }
  );
  return { html: out, ...stats, missing, cssInlined: cssMapping.size, entries };
}

const perceived = (rgb) => (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;

// 夜间体检：找出「白天是浅色、夜间被压成中灰」的背景色 —— 就是夜间马赛克的来源。
// 与 dark-preview.js 的 mp-darkmode 算法同源：var(--weui-*) 不参与映射，故跳过。
function analyzeDark(lightHtml) {
  const bgRe = /background(?:-color)?\s*:\s*([^;"']+)/g;
  const all = new Set();
  const midGray = new Set();
  let m;
  while ((m = bgRe.exec(lightHtml))) {
    const value = m[1];
    if (/var\(--weui-/.test(value) || /gradient/i.test(value)) continue;
    const parsed = parseColor(value);
    if (!parsed) continue;
    all.add(`rgba(${parsed.rgb.join(',')},${parsed.alpha})`);
    const before = perceived(parsed.rgb);
    const after = perceived(mapBackground(parsed.rgb, parsed.alpha).rgb);
    if (before > 200 && after >= 185 && after <= 195) midGray.add(`rgb(${mapBackground(parsed.rgb, parsed.alpha).rgb.join(', ')})`);
  }

  const mid = midGray.size;
  const total = all.size;
  let verdict = 'ok';
  if (mid >= 5 || total > 10) verdict = 'warn';
  else if (mid > 0) verdict = 'notice';

  const message = {
    ok: '浅色背景都走了微信变量或会被正确反色，夜间不会出现灰块马赛克。',
    notice: `有 ${mid} 处浅色背景在夜间会被压成中灰，面积大时可能显脏。`,
    warn: `有 ${mid} 处浅色背景在夜间会被压成中灰，且全文背景色种类偏多（${total} 种），建议改用 var(--weui-BG-*)。`,
  }[verdict];

  return { darkMidGray: mid, darkTotalBg: total, verdict, message };
}

// ---------- 组装 studio ----------
function buildStudio(payload) {
  const shell = fs.readFileSync(path.join(PREVIEWER_DIR, 'studio.html'), 'utf-8');
  const css = fs.readFileSync(path.join(PREVIEWER_DIR, 'studio.css'), 'utf-8');
  const js = fs.readFileSync(path.join(PREVIEWER_DIR, 'studio.js'), 'utf-8');

  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return shell
    .replace('__STUDIO_TITLE__', escapeHtml(`${payload.title} · 排版预览`))
    .replace('/*__STUDIO_CSS__*/', () => css)
    .replace('__STUDIO_PAYLOAD__', () => json)
    .replace('/*__STUDIO_JS__*/', () => js);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openInBrowser(file) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  const args = platform === 'win32' ? ['', file] : [file];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, shell: platform === 'win32' });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch (err) {
    return false;
  }
}

function resolvePreset(spec) {
  if (fs.existsSync(spec)) return require(path.resolve(spec));
  return getPreset(spec);
}

// ---------- 校验门 ----------
// 渲染完必须过的三道门。日志写进 05-validation/，任一道没过就 exit 1。
const VALIDATION_GATES = [
  {
    id: 'text',
    label: '内容一致性',
    log: 'text-compare.log',
    expect: 'MATCH',
    script: 'compare_visible_text.py',
    args: (ctx) => [ctx.mdPath, ctx.bodyPath],
    hint: '正文被增删改写，或预设引入了未被标记为装饰的文字',
  },
  {
    id: 'wechat',
    label: '微信兼容',
    log: 'wechat-compat.log',
    expect: 'PASS',
    script: 'validate_wechat_html.py',
    args: (ctx) => [ctx.bodyPath],
    hint: '黑名单标签 / CSS（<style>、<ul>、position:fixed、inline SVG …）',
  },
  {
    id: 'images',
    label: '图片存在性',
    log: 'images-check.log',
    expect: 'PASS',
    script: 'check_images.py',
    args: (ctx) => {
      const args = [ctx.bodyPath];
      for (const dir of ctx.assetDirs) args.push('--asset-dir', dir);
      if (ctx.assetUrlPrefix) args.push('--url-prefix', ctx.assetUrlPrefix);
      return args;
    },
    hint: '有人图片找不到文件，发出去会裂图（检查 --asset-dir 是否漏了素材目录）',
  },
];

function findPython() {
  for (const cmd of ['python3', 'python']) {
    const probe = spawnSync(cmd, ['--version'], { encoding: 'utf-8' });
    if (!probe.error && probe.status === 0) return cmd;
  }
  return null;
}

function runValidationGates(ctx) {
  console.log('校验门（内容一致性 / 微信兼容 / 图片存在性）');
  const python = findPython();
  if (!python) {
    console.log('  ✗ 没找到 python3 —— 三道校验门都跑不了');
    console.log('    装好 Python 3 后重跑本命令（或确知不要校验时显式加 --no-validate）');
    return { passed: false, results: [] };
  }

  fs.mkdirSync(ctx.validationDir, { recursive: true });
  const results = VALIDATION_GATES.map((gate) => {
    const run = spawnSync(python, [path.join(SCRIPTS_DIR, gate.script), ...gate.args(ctx)], {
      encoding: 'utf-8',
      cwd: SCRIPTS_DIR,
    });
    const stdout = run.stdout || '';
    const stderr = run.stderr || '';
    const logPath = path.join(ctx.validationDir, gate.log);
    fs.writeFileSync(logPath, stdout + (stderr ? `\n[stderr]\n${stderr}` : ''), 'utf-8');
    const marker = new RegExp(`^${gate.expect}\\b`, 'm').test(stdout);
    return {
      ...gate,
      passed: run.status === 0 && marker,
      head: (stdout.split('\n').filter((line) => line.trim())[0] || stderr.split('\n')[0] || '').trim(),
      logPath,
    };
  });

  for (const r of results) {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.label}  ${r.head}`);
  }
  const failed = results.filter((r) => !r.passed);
  console.log(`  日志目录: ${ctx.validationDir}`);
  if (!failed.length) {
    console.log(`校验门: ${results.length}/${results.length} 通过`);
  } else {
    console.log(`校验门: ${results.length - failed.length}/${results.length} 通过 ✗`);
    for (const r of failed) {
      console.log(`  → ${r.label}：${r.hint}`);
      console.log(`     详情: ${r.logPath}`);
    }
  }
  return { passed: !failed.length, results };
}

// ---------- 主流程 ----------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.md || !opts.preset) {
    printHelp();
    process.exit(1);
  }

  const preset = resolvePreset(opts.preset);
  if (!preset) {
    console.error(`找不到预设: ${opts.preset}`);
    console.error(`可用预设: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  const mdPath = path.resolve(opts.md);
  if (!fs.existsSync(mdPath)) {
    console.error(`找不到文章: ${mdPath}`);
    process.exit(1);
  }

  const workdir = path.resolve(opts.workdir || path.dirname(mdPath));
  const out = path.resolve(opts.out || path.join(workdir, '04-html', 'studio.html'));
  const outDir = path.dirname(out);
  const bodyPath = path.resolve(opts.outputBody || path.join(outDir, 'article-body.html'));
  const previewPath = path.resolve(opts.outputPreview || path.join(outDir, 'article-preview.html'));
  const assetOutputDir = path.resolve(opts.assetOutputDir || path.join(outDir, 'assets'));
  const assetUrlPrefix = opts.assetUrlPrefix !== undefined ? opts.assetUrlPrefix : 'assets';

  // 一律转成绝对路径：renderArticle/图片内联拿的是进程 cwd（用户目录），
  // 而校验门是在 scripts/ 目录下跑 python 的 —— 相对路径到了那边就指向 scripts/<相对路径>，
  // 会让「图片存在性」对相对 --asset-dir 误报 FAIL。
  const assetDirs = (opts.assetDirs.length
    ? opts.assetDirs
    : [path.join(workdir, '01-input', 'images')].filter((dir) => fs.existsSync(dir)))
    .map((dir) => path.resolve(dir));

  fs.mkdirSync(outDir, { recursive: true });

  const { publishHtml, previewHtml } = renderArticle({
    mdPath,
    preset,
    assetDirs,
    headingOffset: opts.headingOffset,
    assetOutputDir,
    assetUrlPrefix,
  });

  // 发布版（供复制）：默认就是本次渲染的发布版 HTML；要换成别的实现时用 --copy-html 指定。
  let copySource = { label: bodyPath, html: publishHtml };
  if (opts.copyHtml) {
    const copyPath = path.resolve(opts.copyHtml);
    if (!fs.existsSync(copyPath)) {
      console.error(`找不到复制用 HTML: ${copyPath}`);
      process.exit(1);
    }
    copySource = { label: copyPath, html: fs.readFileSync(copyPath, 'utf-8') };
  }
  const withSrc = addSrcToImages(copySource.html);
  const images = inspectImages(withSrc.html);

  // 图片策略：
  //   开了 --image-host → 先把图传图床，复制内容里放 https 链接（可加 --image-host-min-size 只传大图）
  //   剩下的本地图 → 内联 base64，粘贴时微信编辑器会把图转存到自己的 CDN
  const wantInline = !opts.noInlineImages;
  const hostSpec = opts.imageHost === undefined ? DEFAULT_IMAGE_HOST : String(opts.imageHost).toLowerCase();
  const hostDisabled = !hostSpec || hostSpec === 'none' || hostSpec === 'false';
  const imageHost = hostDisabled ? null : getImageHost(hostSpec);
  if (!hostDisabled && !imageHost) {
    console.error(`未知图床: ${opts.imageHost}`);
    console.error(`可用图床: ${listImageHosts()}（或用 none 关闭）`);
    process.exit(1);
  }

  let copyHtml = withSrc.html;
  let inlineStats = { html: copyHtml, count: 0, bytes: 0, compressed: 0, missing: 0, entries: [] };
  if (wantInline) {
    inlineStats = await inlineLocalImages(copyHtml, {
      searchDirs: [outDir, ...assetDirs],
      maxWidth: opts.inlineMaxWidth || 1080,
    });
    copyHtml = inlineStats.html;
  }

  // 图床清单：不做上传，只把「符合条件的图」列出来，等用户点「复制到公众号」时在浏览器里传。
  // 默认就带上（预览器里可随时关掉），避免「模型忘了加参数 → 能力直接没有」。
  const uploadPlan = imageHost
    ? planHostUpload({
      host: imageHost,
      time: opts.imageHostTime || imageHost.defaultTime,
      minSizeKb: opts.imageHostMinSize || 0,
      entries: inlineStats.entries || [],
      html: copyHtml,
    })
    : null;

  const localCount = images.byKind.local + images.byKind.data;
  const imageMode = inlineStats.count > 0
    ? 'inline'
    : (localCount === 0 && images.byKind.external === 0 ? 'wechat' : 'files');
  const copyReady = imageMode !== 'files' && inlineStats.missing === 0;

  const title = opts.title || extractTitle(mdPath);
  const payload = {
    title,
    preset: {
      id: preset.id,
      name: preset.name,
      tagline: preset.tagline || '',
      description: preset.description || '',
      suitableFor: preset.suitableFor || [],
      // 自定义 preset 模块路径（不在注册表里）没有分类，留空即可
      category: preset.category || '',
      categoryName: preset.categoryName || '',
    },
    headingOffset: opts.headingOffset,
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    workdir,
    html: {
      light: previewHtml,
      dark: simulateDark(previewHtml),
    },
    copy: {
      html: copyHtml,
      text: htmlToText(previewHtml),
      source: copySource.label,
      ready: copyReady,
      imgSrcAdded: withSrc.count,
      imageMode,
      inlined: inlineStats.count,
      inlinedBytes: inlineStats.bytes,
      inlinedCompressed: inlineStats.compressed,
      missingLocalImages: inlineStats.missing,
      upload: uploadPlan,
    },
    images,
    checks: analyzeDark(previewHtml),
  };

  fs.writeFileSync(out, buildStudio(payload), 'utf-8');
  fs.writeFileSync(bodyPath, publishHtml, 'utf-8');
  fs.writeFileSync(previewPath, buildPreviewPage({ title, html: previewHtml }), 'utf-8');

  // ---------- 控制台摘要 ----------
  const kindText = Object.entries(images.byKind)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${kind} ${n}`)
    .join(' / ') || '无';
  const verdictText = { ok: '✓ 无问题', notice: '! 偏多', warn: '✗ 有风险' }[payload.checks.verdict];

  console.log(`预览器已生成: ${out}`);
  console.log(`  模板: ${preset.name} (${preset.id})  标题层级偏移: ${payload.headingOffset}`);
  console.log(`  文章: ${title}`);
  console.log(`  图片: ${images.total} 张（${kindText}）→ ${copyReady ? '复制后图片可用' : '复制后图片会丢，需先处理'}`);
  console.log(`  复制来源: ${path.basename(copySource.label)}`);
  if (uploadPlan && uploadPlan.available) {
    const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
    console.log(`  图床（点击时上传，默认开）: ${uploadPlan.count} 张 → ${uploadPlan.label}（源图 ${kb(uploadPlan.bytes)}）；点「复制到公众号」才开始上传，预览器里可关掉`);
    console.log(`  ⚠ 上传后链接 ${uploadPlan.timeLabel}失效 —— 请在过期前点发布，微信会在发布时把图转存到自己服务器`);
  } else if (hostDisabled) {
    console.log('  图床: 已关闭（--no-image-host），复制内容只走内联 base64');
  }
  if (imageMode === 'inline') {
    const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
    console.log(`  图片内联: ${inlineStats.count} 张 → ${kb(inlineStats.bytes)}${inlineStats.compressed ? `（${inlineStats.compressed} 张已压缩）` : ''}，粘贴后微信自动转存`);
    if (inlineStats.missing) console.log(`  ⚠ ${inlineStats.missing} 张本地图片找不到文件，复制后会缺图`);
    if (inlineStats.bytes > 3 * 1024 * 1024) console.log('  ⚠ 内联图片总体积偏大，粘贴可能变慢，可用 --inline-max-width 调小');
    if (inlineStats.maxBytes > 300 * 1024 && !(uploadPlan && uploadPlan.enabled)) {
      console.log(`  ⚠ 有单张图内联后达 ${(inlineStats.maxBytes / 1024).toFixed(0)} KB，粘贴可能失败 —— 加 --image-host litterbox 改成传图床走 https 链接`);
    }
  }
  console.log(`  夜间体检: ${verdictText}  中灰块 ${payload.checks.darkMidGray} 种 / 背景色 ${payload.checks.darkTotalBg} 种`);
  console.log(`  发布版 HTML: ${bodyPath}`);
  if (!copyReady) {
    console.log('  ⚠ 提示: 复制内容里还有拿不到的图片；可开 --image-host litterbox，或加 --no-inline-images 自行准备公网地址。');
  }

  // ---------- 校验门 ----------
  let gateFailed = false;
  if (opts.validate) {
    const validationDir = path.resolve(opts.validationDir || path.join(workdir, '05-validation'));
    const gate = runValidationGates({
      mdPath,
      bodyPath,
      assetDirs: [assetOutputDir, ...assetDirs],
      assetUrlPrefix,
      validationDir,
    });
    gateFailed = !gate.passed;
  } else {
    console.log('校验门: 已用 --no-validate 跳过');
  }

  if (gateFailed) {
    console.log('✗ 校验门未通过：按上面的日志先修问题，再重跑本命令；修好前不要打开预览器让用户确认。');
    process.exit(1);
  }

  if (opts.open) {
    const opened = openInBrowser(out);
    console.log(opened ? '已在浏览器中打开预览器，点右上角「复制到公众号」即可粘贴。' : `请手动打开: ${out}`);
  } else {
    console.log(`下一步: 用浏览器打开 ${out}，点右上角「复制到公众号」。`);
  }
}

main().catch((err) => {
  console.error('生成预览器失败:', err.message);
  process.exit(1);
});
