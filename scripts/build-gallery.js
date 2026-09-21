#!/usr/bin/env node
/**
 * 模板推荐画廊生成器。
 *
 * 干什么：把「skill 内置的示例文章 + 挑好的 3 套推荐模板（+ 其余全部模板）」渲染成一个画廊页 ——
 *   左侧顶部是 3 个推荐位，下面是分类浏览器（标签 = 有模板的分类，空分类不显示），
 *   中间固定用手机版白天效果展示文章，底部一个「复制模板名称」按钮。
 *   用户看完直接点复制，把模板名粘回给 AI，选模板这一步就完成了。
 *
 * 为什么这么做：让用户"看效果选模板"，而不是看文字描述猜风格。
 *   画廊固定用示例文章渲染（assets/gallery/article.md + images/），**不用用户自己的文章**：
 *   同一篇文章过不同模板才能公平比较；也不用等用户的图片和长文加载。
 *   画廊页是自包含单文件，直接浏览器打开即可，不需要服务器。
 *
 * 用法：
 *   node scripts/build-gallery.js [--workdir <任务工作目录>] [--open]
 *   node scripts/build-gallery.js --presets wechat-blue-yellow,elegant-minimal,purple-badge --workdir <dir> --open
 *
 * 选项：
 *   --presets <id,id,id>  哪几套算「推荐」（最多 3 套，第一个 = 最推荐，默认展示）；
 *                         其余模板按分类排在「按分类浏览」里；建议 3 套来自不同分类，用户更容易分辨
 *   --workdir <目录>      任务工作目录；给了就默认输出到 <workdir>/03-style/gallery.html
 *   --out <路径>          输出路径
 *   --asset-dir <目录>    额外图片搜索目录（可多次指定；示例文章默认用 assets/gallery/images）
 *   --heading-offset <N>  标题层级偏移（默认 0）
 *   --open                生成后用系统默认浏览器打开
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { renderArticle } = require('./render');
const { getPreset, PRESETS, listCategories } = require('./presets/index');

const GALLERY_DIR = path.join(__dirname, '..', 'assets', 'gallery');
const SAMPLE_ARTICLE = path.join(GALLERY_DIR, 'article.md');
const SAMPLE_IMAGE_DIR = path.join(GALLERY_DIR, 'images');
const DEFAULT_PRESETS = ['wechat-blue-yellow', 'elegant-minimal', 'purple-badge'];
const RECOMMEND_LIMIT = 3; // 画廊「为你推荐」固定 3 个位置

function printHelp() {
  const src = fs.readFileSync(__filename, 'utf-8');
  const doc = src.match(/\/\*\*([\s\S]*?)\*\//);
  console.log(doc ? doc[1].replace(/^ \* ?/gm, '').trim() : '用法见脚本头部注释');
}

function parseArgs(argv) {
  const opts = { presetSpec: null, assetDirs: [], headingOffset: 0, open: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--presets': opts.presetSpec = argv[++i]; break;
      case '--workdir': opts.workdir = argv[++i]; break;
      case '--out': opts.out = argv[++i]; break;
      case '--asset-dir': opts.assetDirs.push(argv[++i]); break;
      case '--heading-offset': opts.headingOffset = parseInt(argv[++i], 10) || 0; break;
      case '--open': opts.open = true; break;
      case '-h': case '--help': printHelp(); process.exit(0); break;
      case '--article':
        console.error('画廊固定使用 skill 内置的示例文章（assets/gallery/article.md），不支持换成其他文章。');
        console.error('理由：所有模板渲染同一篇文章才好对比，也不必等用户长文和图片加载。');
        process.exit(1);
        break;
      default:
        console.error(`未知参数: ${argv[i]}`);
        console.error('运行 `node scripts/build-gallery.js --help` 查看用法');
        process.exit(1);
    }
  }
  return opts;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildGallery(payload) {
  const shell = fs.readFileSync(path.join(GALLERY_DIR, 'gallery.html'), 'utf-8');
  const css = fs.readFileSync(path.join(GALLERY_DIR, 'gallery.css'), 'utf-8');
  const js = fs.readFileSync(path.join(GALLERY_DIR, 'gallery.js'), 'utf-8');

  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return shell
    .replace('__GALLERY_TITLE__', escapeHtml(payload.title))
    .replace('/*__GALLERY_CSS__*/', () => css)
    .replace('__GALLERY_PAYLOAD__', () => json)
    .replace('/*__GALLERY_JS__*/', () => js);
}

const { extractTitle } = require('./utils/md-title');

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

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const articlePath = SAMPLE_ARTICLE;
  if (!fs.existsSync(articlePath)) {
    console.error(`内置示例文章缺失: ${articlePath}`);
    process.exit(1);
  }

  const recommendedIds = (opts.presetSpec ? opts.presetSpec.split(',') : DEFAULT_PRESETS)
    .map((id) => id.trim())
    .filter(Boolean);
  if (!recommendedIds.length) {
    console.error('至少要给一个推荐预设');
    process.exit(1);
  }
  if (recommendedIds.length > RECOMMEND_LIMIT) {
    console.error(`推荐位最多 ${RECOMMEND_LIMIT} 个（画廊顶部「为你推荐」只有 ${RECOMMEND_LIMIT} 个位置），当前给了 ${recommendedIds.length} 个`);
    process.exit(1);
  }

  const missing = recommendedIds.filter((id) => !PRESETS[id]);
  if (missing.length) {
    console.error(`找不到预设: ${missing.join(', ')}`);
    console.error(`可用预设: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  // 空分类不上画廊（Node 侧先滤一遍，前端还会再兜一层）
  const categories = listCategories({ nonEmptyOnly: true });
  const recommendedSet = new Set(recommendedIds);
  const categoryOrderedIds = [];
  categories.forEach((cat) => {
    cat.presets.forEach((id) => { if (!recommendedSet.has(id)) categoryOrderedIds.push(id); });
  });

  // 兜底：任何没被分到类里的预设也照样出现在画廊里，不让它凭空消失
  const leftovers = Object.keys(PRESETS).filter((id) => !recommendedSet.has(id) && !categoryOrderedIds.includes(id));
  const orderedIds = recommendedIds.concat(categoryOrderedIds, leftovers);

  const recommendedRank = {};
  recommendedIds.forEach((id, i) => { recommendedRank[id] = i; });

  const presets = orderedIds.map((id) => {
    const preset = getPreset(id);
    if (!preset) {
      console.error(`找不到预设: ${id}`);
      console.error(`可用预设: ${Object.keys(PRESETS).join(', ')}`);
      process.exit(1);
    }
    return preset;
  });

  const workdir = opts.workdir ? path.resolve(opts.workdir) : null;
  const out = path.resolve(
    opts.out || (workdir ? path.join(workdir, '03-style', 'gallery.html') : path.join(path.dirname(articlePath), 'template-gallery.html'))
  );
  const outDir = path.dirname(out);
  fs.mkdirSync(outDir, { recursive: true });

  const assetDirs = opts.assetDirs.length ? opts.assetDirs : [SAMPLE_IMAGE_DIR];

  const rendered = presets.map((preset) => {
    const { previewHtml } = renderArticle({
      mdPath: articlePath,
      preset,
      assetDirs,
      headingOffset: opts.headingOffset,
      assetOutputDir: path.join(outDir, 'gallery-assets'),
      assetUrlPrefix: 'assets',
    });
    return {
      id: preset.id,
      name: preset.name,
      tagline: preset.tagline || '',
      suitableFor: preset.suitableFor || [],
      category: preset.category,
      categoryName: preset.categoryName,
      recommended: recommendedSet.has(preset.id),
      recommendRank: recommendedSet.has(preset.id) ? recommendedRank[preset.id] : null,
      html: previewHtml,
    };
  });

  const articleTitle = extractTitle(articlePath);
  const articleLabel = `示例文章《${articleTitle}》 · 手机版白天效果`;

  const payload = {
    title: '选择排版模板',
    articleLabel,
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    // 只带有模板的分类：没有模板的分类（如动漫 / 中国风）不上页面
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      count: cat.count,
      presets: cat.presets.slice(),
    })),
    presets: rendered,
  };

  fs.writeFileSync(out, buildGallery(payload), 'utf-8');

  const hiddenCategories = listCategories().filter((cat) => cat.count === 0);

  console.log(`模板画廊已生成: ${out}`);
  console.log(`  文章: ${articleLabel}`);
  console.log(`  推荐 ${rendered.filter((p) => p.recommended).length} 套（第 1 个 = 最推荐，默认展示）:`);
  rendered.filter((p) => p.recommended).forEach((p) => {
    console.log(`    ${p.recommendRank + 1}. ${p.name}  (${p.id})  [${p.categoryName}]  ${p.tagline}`);
  });
  const recommendCategories = new Set(rendered.filter((p) => p.recommended).map((p) => p.category));
  if (recommendedIds.length > 1 && recommendCategories.size === 1) {
    const only = rendered.find((p) => p.recommended);
    console.log(`    ⚠️  3 套推荐都在「${only.categoryName}」分类里，建议换 1~2 套其它分类的，用户更容易分辨风格差异`);
  }
  console.log(`  分类（画廊标签页，仅显示有模板的分类，共 ${rendered.length} 套）:`);
  categories.forEach((cat) => {
    console.log(`    ${cat.name} ${cat.count} 套  (${cat.id})  — ${cat.description}`);
  });
  if (hiddenCategories.length) {
    console.log(`  空分类已隐藏: ${hiddenCategories.map((cat) => `${cat.name}(${cat.id})`).join('、')} —— 目录与分类桶仍在，加模板后自动出现`);
  }
  console.log('');
  console.log('  下一步: 用户点「复制「模板名」」把名称粘回来，然后按下表映射回预设 ID 继续走第 4 步。');

  if (opts.open) {
    const opened = openInBrowser(out);
    console.log(opened ? '  已在浏览器打开画廊。' : `  请手动打开: ${out}`);
  }
}

main();
