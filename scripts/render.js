const fs = require('fs');
const path = require('path');
const { renderMarkdown } = require('./presets/base');
const { getPreset } = require('./presets/index');

function main() {
  const args = process.argv.slice(2);
  let mdPath = null;
  let presetId = null;
  let outputBody = null;
  let outputPreview = null;
  let assetDirs = [];
  let title = '文章预览';
  let headingOffset = 0;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--md': mdPath = args[++i]; break;
      case '--preset': presetId = args[++i]; break;
      case '--output-body': outputBody = args[++i]; break;
      case '--output-preview': outputPreview = args[++i]; break;
      case '--asset-dir': assetDirs.push(args[++i]); break;
      case '--title': title = args[++i]; break;
      case '--heading-offset': headingOffset = parseInt(args[++i]) || 0; break;
      default:
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

  const md = fs.readFileSync(mdPath, 'utf-8');

  const absAssetDirs = assetDirs.map(d => path.resolve(d));
  const mdDir = path.dirname(path.resolve(mdPath));
  if (!absAssetDirs.includes(mdDir)) absAssetDirs.push(mdDir);

  const publishHtml = renderMarkdown(md, preset, {
    useLocalImgPath: false,
    assetDirs: absAssetDirs,
    headingOffset,
    assetOutputDir: absAssetDirs[0],
  });

  const previewHtml = renderMarkdown(md, preset, {
    useLocalImgPath: true,
    assetDirs: absAssetDirs,
    headingOffset,
    assetOutputDir: absAssetDirs[0],
  });

  const bodyPath = outputBody || path.join(path.dirname(mdPath), 'article-body.html');
  const previewPath = outputPreview || path.join(path.dirname(mdPath), 'article-preview.html');

  fs.writeFileSync(bodyPath, publishHtml);
  console.log('发布版 HTML:', bodyPath, '(' + publishHtml.length + ' bytes)');

  const fullPreview = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body {
    max-width: 680px;
    margin: 20px auto;
    padding: 0 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #fff;
  }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${previewHtml}
</body>
</html>`;

  fs.writeFileSync(previewPath, fullPreview);
  console.log('预览版 HTML:', previewPath, '(' + fullPreview.length + ' bytes)');
}

main();
