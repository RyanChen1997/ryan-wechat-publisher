const fs = require('fs');
const path = require('path');
const { renderMarkdown } = require('./presets/base');
const { getPreset } = require('./presets/index');
const { simulateDark } = require('./utils/dark-preview');

function main() {
  const args = process.argv.slice(2);
  let mdPath = null;
  let presetId = null;
  let outputBody = null;
  let outputPreview = null;
  let outputDarkPreview = null;
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
      case '--output-dark-preview': outputDarkPreview = args[++i]; break;
      case '--asset-dir': assetDirs.push(args[++i]); break;
      case '--asset-output-dir': assetOutputDir = args[++i]; break;
      case '--asset-url-prefix': assetUrlPrefix = args[++i]; break;
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
  console.error('  --output-dark-preview <路径> 夜间模式预览 HTML 输出路径（模拟微信 mp-darkmode 算法）');
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

  const md = fs.readFileSync(mdPath, 'utf-8');

  const absAssetDirs = assetDirs.map(d => path.resolve(d));
  const mdDir = path.dirname(path.resolve(mdPath));
  if (!absAssetDirs.includes(mdDir)) absAssetDirs.push(mdDir);
  const bodyPath = outputBody || path.join(path.dirname(mdPath), 'article-body.html');
  const previewPath = outputPreview || path.join(path.dirname(mdPath), 'article-preview.html');
  const generatedAssetDir = path.resolve(assetOutputDir || path.join(path.dirname(previewPath), 'assets'));
  fs.mkdirSync(generatedAssetDir, { recursive: true });

  const publishHtml = renderMarkdown(md, preset, {
    useLocalImgPath: false,
    assetDirs: absAssetDirs,
    headingOffset,
    assetOutputDir: generatedAssetDir,
    assetUrlPrefix,
  });

  const previewHtml = renderMarkdown(md, preset, {
    useLocalImgPath: true,
    assetDirs: absAssetDirs,
    headingOffset,
    assetOutputDir: generatedAssetDir,
    assetUrlPrefix,
  });

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

  if (outputDarkPreview) {
    const darkHtml = simulateDark(previewHtml);
    const darkPreview = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}（夜间模式预览）</title>
<style>
  body {
    max-width: 680px;
    margin: 20px auto;
    padding: 0 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #191919;
    color: #a3a3a3;
  }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${darkHtml}
</body>
</html>`;
    fs.writeFileSync(outputDarkPreview, darkPreview);
    console.log('夜间预览版 HTML:', outputDarkPreview, '(' + darkPreview.length + ' bytes)');
  }
}

main();
