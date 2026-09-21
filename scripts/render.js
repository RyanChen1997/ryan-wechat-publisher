const fs = require('fs');
const path = require('path');
const { renderMarkdown } = require('./presets/base');
const { getPreset } = require('./presets/index');
const { buildPreviewPage } = require('./utils/preview-page');

/**
 * 渲染一篇文章（发布版 + 预览版）。
 * 供 render.js 与 preview-studio.js 共用，避免两处各写一份渲染参数。
 */
function renderArticle({ mdPath, preset, assetDirs = [], headingOffset = 0, assetOutputDir = null, assetUrlPrefix = '' }) {
  const md = fs.readFileSync(mdPath, 'utf-8');

  const absAssetDirs = assetDirs.map(d => path.resolve(d));
  const mdDir = path.dirname(path.resolve(mdPath));
  if (!absAssetDirs.includes(mdDir)) absAssetDirs.push(mdDir);

  const generatedAssetDir = path.resolve(assetOutputDir || path.join(mdDir, 'assets'));
  fs.mkdirSync(generatedAssetDir, { recursive: true });

  const shared = {
    assetDirs: absAssetDirs,
    headingOffset,
    assetOutputDir: generatedAssetDir,
    assetUrlPrefix,
  };

  return {
    publishHtml: renderMarkdown(md, preset, { ...shared, useLocalImgPath: false }),
    previewHtml: renderMarkdown(md, preset, { ...shared, useLocalImgPath: true }),
    generatedAssetDir,
  };
}

function main() {
  const args = process.argv.slice(2);
  let mdPath = null;
  let presetId = null;
  let outputBody = null;
  let outputPreview = null;
  let assetDirs = [];
  let assetOutputDir = null;
  let assetUrlPrefix = '';
  let title = '文章预览';
  let headingOffset = 0;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--md': mdPath = args[++i]; break;
      case '--preset': presetId = args[++i]; break;
      case '--output-body': outputBody = args[++i]; break;
      case '--output-preview': outputPreview = args[++i]; break;
      case '--output-dark-preview':
        console.error('render.js 不再输出单独的夜间预览页。');
        console.error('要看夜间效果：预览器（preview-studio.js）右上角切「夜间」，或 node scripts/utils/dark-preview.js <预览.html>');
        process.exit(1);
        break;
      case '--asset-dir': assetDirs.push(args[++i]); break;
      case '--asset-output-dir': assetOutputDir = args[++i]; break;
      case '--asset-url-prefix': assetUrlPrefix = args[++i]; break;
      case '--title': title = args[++i]; break;
      case '--heading-offset': headingOffset = parseInt(args[++i]) || 0; break;
      default:
        if (args[i].startsWith('--')) {
          console.error(`未知参数: ${args[i]}`);
          process.exit(1);
        }
        if (!mdPath) mdPath = args[i];
        else if (!presetId) presetId = args[i];
    }
  }

  if (!mdPath || !presetId) {
    console.error('用法: node render.js --md <文章.md> --preset <预设ID> [选项]');
    console.error('');
    console.error('选项:');
    console.error('  --output-body <路径>    发布版 HTML 输出路径');
    console.error('  --output-preview <路径> 预览版 HTML 输出路径');
    console.error('  --asset-dir <目录>      图片搜索目录（可多次指定）');
    console.error('  --asset-output-dir <目录> 动态生成图片的输出目录（与源素材目录分离）');
    console.error('  --asset-url-prefix <前缀> 发布版动态图片 URL 前缀，如 assets');
    console.error('  --title <标题>          预览页标题');
    console.error('  --heading-offset <N>    标题层级偏移（-1=整体升一级，1=整体降一级）');
    process.exit(1);
  }

  const path = require('path');
  const fs = require('fs');
  let preset;
  if (fs.existsSync(presetId)) {
    preset = require(path.resolve(presetId));
  } else {
    preset = getPreset(presetId);
  }
  if (!preset) {
    console.error('找不到预设:', presetId);
    console.error('可用预设:', Object.keys(require('./presets/index').PRESETS).join(', '));
    process.exit(1);
  }

  const bodyPath = outputBody || path.join(path.dirname(mdPath), 'article-body.html');
  const previewPath = outputPreview || path.join(path.dirname(mdPath), 'article-preview.html');
  const generatedAssetDir = path.resolve(assetOutputDir || path.join(path.dirname(previewPath), 'assets'));

  const { publishHtml, previewHtml } = renderArticle({
    mdPath,
    preset,
    assetDirs,
    headingOffset,
    assetOutputDir: generatedAssetDir,
    assetUrlPrefix,
  });

  fs.writeFileSync(bodyPath, publishHtml);
  console.log('发布版 HTML:', bodyPath, '(' + publishHtml.length + ' bytes)');

  const fullPreview = buildPreviewPage({ title, html: previewHtml });

  fs.writeFileSync(previewPath, fullPreview);
  console.log('预览版 HTML:', previewPath, '(' + fullPreview.length + ' bytes)');
}

if (require.main === module) main();

module.exports = { renderArticle };
