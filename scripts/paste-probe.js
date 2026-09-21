#!/usr/bin/env node
/**
 * 图片粘贴探针 —— 一次性测出「哪种图片形式能活着粘进公众号编辑器」。
 *
 * 背景：不配置微信云托管服务时，文章里的图片是本地文件。复制到公众号的 HTML 里图片要怎么表示
 * 才能让微信编辑器接住并转存？社区说法互相矛盾，所以在真机上做一次实验最快。
 *
 * 探针页会生成 4 个变体（同一张图）：
 *   A. 内联 base64（原图）
 *   B. 内联 base64（压到 1080px，看是不是体积问题）
 *   C. http://127.0.0.1:<port>/xxx.png（本地 CORS 静态服务器）
 *   D. https 公网图片（对照组：验证「微信会自动抓外链并转存」这个前提）
 *
 * 用法：
 *   node scripts/paste-probe.js --image <图片路径> [--out <探针页路径>] [--open]
 *   node scripts/paste-probe.js --image-dir <目录> [--open]     # 自动挑目录里第一张图
 *
 * 用法（结果怎么看）：
 *   打开探针页 → 点「复制全部」→ 在公众号后台新建图文消息，粘贴到正文区 → 看哪几张图留下来了。
 */

'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const CONTROL_URL = 'https://raw.githubusercontent.com/github/explore/main/topics/python/python.png';

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--image': opts.image = argv[++i]; break;
      case '--image-dir': opts.imageDir = argv[++i]; break;
      case '--out': opts.out = argv[++i]; break;
      case '--port': opts.port = parseInt(argv[++i], 10); break;
      case '--open': opts.open = true; break;
      default: console.error(`未知参数: ${argv[i]}`); process.exit(1);
    }
  }
  return opts;
}

function findFreePort(preferred) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(findFreePort(preferred + 1)));
    srv.listen(preferred, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function pickImage(opts) {
  if (opts.image) return path.resolve(opts.image);
  const dir = path.resolve(opts.imageDir || '.');
  const file = fs.readdirSync(dir).find((f) => MIME[path.extname(f).toLowerCase()]);
  if (!file) throw new Error(`目录里没有图片: ${dir}`);
  return path.join(dir, file);
}

// 有 sharp 就顺手压一版，用来区分「机制不支持」和「体积太大」
async function compress(buf, ext, maxWidth) {
  let sharp;
  try {
    sharp = require(path.join(ROOT, 'node_modules', 'sharp'));
  } catch (err) {
    return null;
  }
  const isPng = ['.png', '.gif', '.webp'].includes(ext.toLowerCase());
  const pipeline = sharp(buf).resize({ width: maxWidth, withoutEnlargement: true });
  const out = isPng
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
    : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return { buf: out, mime: isPng ? 'image/png' : 'image/jpeg', label: isPng ? 'PNG' : 'JPEG' };
}

function htmlEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function kb(n) {
  return `${(n / 1024).toFixed(0)} KB`;
}

function buildPage({ variants, imageName, pageTitle }) {
  const blocks = variants.map((v, i) => `
  <section class="blk" id="blk-${v.key}">
    <div class="blk-head">
      <div>
        <span class="tag">${v.key}</span>
        <b>${htmlEscape(v.title)}</b>
        <span class="meta">${htmlEscape(v.meta)}</span>
      </div>
      <button class="mini" data-copy="#blk-${v.key} .shot">复制本块</button>
    </div>
    <p class="hint">${htmlEscape(v.hint)}</p>
    <div class="shot"><img src="${v.src}" alt="${v.key}" /></div>
  </section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${htmlEscape(pageTitle)}</title>
<style>
  :root { --line: #e3e6ea; --text: #1f2328; --muted: #6b7280; --green: #07c160; }
  body { margin: 0; background: #f2f3f5; color: var(--text);
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 24px 20px 80px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .lead { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; }
  .card h2 { font-size: 14px; margin: 0 0 8px; }
  ol { margin: 0; padding-left: 20px; color: var(--muted); font-size: 13px; }
  ol li { margin-bottom: 2px; }
  .btn { appearance: none; border: 0; border-radius: 9px; background: var(--green); color: #fff;
    font: inherit; font-weight: 600; padding: 9px 18px; cursor: pointer; }
  .btn:hover { background: #06ad56; }
  .mini { appearance: none; border: 1px solid var(--line); background: #fff; color: var(--muted);
    font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 7px; cursor: pointer; }
  .blk { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
  .blk-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .tag { display: inline-block; min-width: 18px; text-align: center; background: #eef0f3; color: #4b5563;
    border-radius: 6px; font-weight: 700; font-size: 12px; padding: 1px 6px; margin-right: 6px; }
  .meta { color: var(--muted); font-size: 12px; margin-left: 8px; font-family: ui-monospace, Menlo, monospace; }
  .hint { color: var(--muted); font-size: 12px; margin: 6px 0 10px; }
  .shot img { max-width: 100%; border-radius: 6px; display: block; }
  .toast { position: fixed; left: 50%; bottom: 28px; transform: translate(-50%, 8px); background: rgba(24,26,30,.94);
    color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; opacity: 0; transition: opacity .2s, transform .2s; }
  .toast[data-show="1"] { opacity: 1; transform: translate(-50%, 0); }
</style>
</head>
<body>
<div class="wrap">
  <h1>图片粘贴探针</h1>
  <p class="lead">同一张图（${htmlEscape(imageName)}）的 4 种表示形式。粘进公众号编辑器后，哪几张图还在，就说明那种形式能用。</p>

  <div class="card">
    <h2>怎么用</h2>
    <ol>
      <li>点下面的「复制全部测试块」</li>
      <li>打开公众号后台 → 新建图文消息 → 正文区粘贴（⌘V）</li>
      <li>看 A / B / C / D 哪几张图留下来了（没留的会显示成空图或裂图）</li>
    </ol>
    <p style="margin:12px 0 0"><button class="btn" id="copy-all">复制全部测试块</button></p>
  </div>

${blocks}

  <div class="card">
    <h2>预期参考</h2>
    <ol>
      <li><b>A/B 内联 base64</b>：如果留下 → 最省事，图片不用上传、不用服务器</li>
      <li><b>C 本地服务器</b>：如果 A/B 挂了但 C 活着 → 需要本地起个小服务</li>
      <li><b>D 公网图片</b>：这张是"外链能不能被微信转存"的基准；如果连它都挂，说明编辑器压根不抓外链</li>
    </ol>
  </div>
</div>
<div class="toast" id="toast" hidden></div>

<script>
(function () {
  var toast = document.getElementById('toast');
  var timer = null;
  function say(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    toast.dataset.show = '1';
    clearTimeout(timer);
    timer = setTimeout(function () { toast.dataset.show = '0'; }, 3000);
  }

  function htmlOf(el) { return '<section>' + el.innerHTML + '</section>'; }

  function legacyCopy(html) {
    var holder = document.createElement('div');
    holder.setAttribute('contenteditable', 'true');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    var ok = false;
    try {
      var range = document.createRange();
      range.selectNodeContents(holder);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ok = document.execCommand('copy');
      sel.removeAllRanges();
    } catch (e) { ok = false; }
    holder.parentNode.removeChild(holder);
    return ok;
  }

  async function copyNode(node) {
    var html = node.tagName === 'SECTION' ? node.outerHTML : htmlOf(node);
    var text = node.innerText || '';
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
        return true;
      }
    } catch (e) { /* 落到兜底 */ }
    return legacyCopy(html);
  }

  document.getElementById('copy-all').addEventListener('click', async function () {
    var blocks = Array.prototype.map.call(document.querySelectorAll('.blk'), function (b) {
      return b.outerHTML;
    }).join('\\n<hr/>\\n');
    var ok = await copyNode({ tagName: 'SECTION', outerHTML: '<section>' + blocks + '</section>', innerText: document.querySelector('.wrap').innerText });
    say(ok ? '已复制全部 4 个测试块，去公众号编辑器粘贴' : '复制失败：换 Chrome/Edge，或允许剪贴板权限');
  });

  Array.prototype.forEach.call(document.querySelectorAll('button[data-copy]'), function (btn) {
    btn.addEventListener('click', async function () {
      var blk = document.querySelector(btn.dataset.copy).closest('.blk');
      var ok = await copyNode(blk);
      say(ok ? '已复制 ' + blk.id : '复制失败，换 Chrome/Edge 试试');
    });
  });
})();
</script>
</body>
</html>`;
}

function openInBrowser(file) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  const args = process.platform === 'win32' ? ['', file] : [file];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, shell: process.platform === 'win32' });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const imagePath = pickImage(opts);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const raw = fs.readFileSync(imagePath);
  const imageName = path.basename(imagePath);

  const compressed = await compress(raw, ext, 1080);

  // 本地 CORS 服务器（C 变体用）
  const port = await findFreePort(opts.port || 8791);
  const serverPath = path.join(__dirname, 'utils', 'static-server.js');
  const server = spawn(process.execPath, [serverPath, path.dirname(imagePath), '--port', String(port)], {
    detached: true,
    stdio: 'ignore',
  });
  server.unref();
  await new Promise((r) => setTimeout(r, 400));

  const variants = [
    {
      key: 'A',
      title: '内联 base64（原图）',
      meta: kb(raw.length),
      hint: '图片以 data: 形式直接写在 HTML 里，不需要任何网络',
      src: `data:${mime};base64,${raw.toString('base64')}`,
    },
  ];
  if (compressed) {
    variants.push({
      key: 'B',
      title: '内联 base64（压缩版）',
      meta: `${kb(compressed.buf.length)} · ${compressed.label}`,
      hint: '同一张图压到 1080px 宽，用来区分「机制不支持」还是「图太大」',
      src: `data:${compressed.mime};base64,${compressed.buf.toString('base64')}`,
    });
  }
  variants.push({
    key: 'C',
    title: '本地服务器 http://127.0.0.1',
    meta: `port ${port}`,
    hint: '本地起了个带 CORS 的静态服务，图片有 http 地址但不是公网',
    src: `http://127.0.0.1:${port}/${encodeURIComponent(imageName)}`,
  });
  variants.push({
    key: 'D',
    title: '公网 https 图片（对照）',
    meta: 'raw.githubusercontent.com',
    hint: '基准组：验证公众号编辑器是否会自动抓取外链图片并转存',
    src: CONTROL_URL,
  });

  const out = path.resolve(opts.out || path.join(path.dirname(imagePath), 'paste-probe.html'));
  fs.writeFileSync(out, buildPage({ variants, imageName, pageTitle: '图片粘贴探针' }), 'utf-8');

  console.log(`探针页已生成: ${out}`);
  console.log(`  测试图: ${imageName}（原图 ${kb(raw.length)}${compressed ? ` → 压缩版 ${kb(compressed.buf.length)}` : ''}）`);
  console.log(`  本地服务器: http://127.0.0.1:${port}/  （PID ${server.pid}，测试完 kill 掉即可）`);
  console.log('  变体: A 内联原图 / B 内联压缩' + (compressed ? '' : '（未装 sharp，跳过）') + ` / C 本地服务 / D 公网对照`);
  console.log('');
  console.log('  下一步: 打开探针页 → 点「复制全部测试块」→ 在公众号后台新建图文消息 → 粘贴 → 看哪几张图留下来');

  if (opts.open) {
    const opened = openInBrowser(out);
    console.log(opened ? '  已在浏览器打开探针页。' : `  请手动打开: ${out}`);
  }
}

main().catch((err) => {
  console.error('探针生成失败:', err.message);
  process.exit(1);
});
