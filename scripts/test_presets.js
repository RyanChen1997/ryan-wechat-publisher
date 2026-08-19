const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderMarkdown } = require('./presets/base');
const { PRESETS } = require('./presets/index');
const { buildAssetInventory } = require('./clone/asset_inventory');
const { analyzeStyle } = require('./clone/analyze_style');
const { buildVisualReview } = require('./clone/build_visual_review');
const { checkSvgFonts } = require('./clone/check_svg_fonts');

const PRESETS_DIR = path.join(__dirname, 'presets');
const FIXTURE = `# 第一章：包结构测试

这是一段包含 **加粗**、*斜体* 和 \`行内代码\` 的正文。

## 二级标题

### 三级标题

> 引用内容

- 第一项
- 第二项

---

\`\`\`js
const answer = 42;
\`\`\`

# 第二章：计数器测试

第二段正文。`;

function extractImageSources(html) {
  return [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
}

function assertLocalImagesExist(html, outputRoot) {
  for (const src of extractImageSources(html)) {
    if (/^(https?:|data:)/.test(src)) continue;
    const resolved = path.isAbsolute(src) ? src : path.join(outputRoot, src);
    assert(fs.existsSync(resolved), `missing preview image: ${resolved}`);
  }
}

function listPackageFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? listPackageFiles(target) : [path.relative(PRESETS_DIR, target)];
  }).sort();
}

function assertSemanticMatch(md, html, outputRoot, name) {
  const mdPath = path.join(outputRoot, `${name}.md`);
  const htmlPath = path.join(outputRoot, `${name}.html`);
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(htmlPath, html);
  const result = spawnSync('python3', [path.join(__dirname, 'compare_visible_text.py'), mdPath, htmlPath], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, `${name}: semantic mismatch\n${result.stdout}\n${result.stderr}`);
}

function runPython(scriptName, args, name) {
  const result = spawnSync('python3', [path.join(__dirname, scriptName), ...args], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, `${name}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

const legacyFiles = fs.readdirSync(PRESETS_DIR)
  .filter((name) => name.endsWith('.js') && !['base.js', 'index.js'].includes(name));
assert.deepStrictEqual(legacyFiles, [], `legacy single-file presets found: ${legacyFiles.join(', ')}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ryan-wechat-preset-test-'));
const packageFilesBefore = listPackageFiles(PRESETS_DIR);

try {
  for (const [id, preset] of Object.entries(PRESETS)) {
    const packageDir = path.join(PRESETS_DIR, id);
    const entryFile = path.join(packageDir, 'index.js');
    assert(fs.existsSync(entryFile), `${id}: missing package entry index.js`);
    assert.strictEqual(preset.id, id, `${id}: registry key and preset.id differ`);
    assert(preset.STYLES && preset.decorations, `${id}: incomplete preset export`);

    const outputRoot = path.join(tempRoot, id);
    const assetDir = path.join(outputRoot, 'assets');
    fs.mkdirSync(assetDir, { recursive: true });

    const publishHtml = renderMarkdown(FIXTURE, preset, {
      useLocalImgPath: false,
      assetOutputDir: assetDir,
    });
    const previewHtml = renderMarkdown(FIXTURE, preset, {
      useLocalImgPath: true,
      assetOutputDir: assetDir,
    });

    assert(publishHtml.length > 500, `${id}: publish HTML unexpectedly short`);
    assert(previewHtml.length > 500, `${id}: preview HTML unexpectedly short`);
    assert(!/<(?:script|style|iframe|form|svg|ul|ol|li)\b/i.test(publishHtml), `${id}: forbidden HTML tag found`);
    assert(!/data:image\/svg\+xml/i.test(publishHtml), `${id}: base64 SVG found`);
    assertLocalImagesExist(previewHtml, outputRoot);
    const publishAgain = renderMarkdown(FIXTURE, preset, {
      useLocalImgPath: false,
      assetOutputDir: assetDir,
    });
    const previewAgain = renderMarkdown(FIXTURE, preset, {
      useLocalImgPath: true,
      assetOutputDir: assetDir,
    });
    assert.strictEqual(publishAgain, publishHtml, `${id}: publish render is not deterministic`);
    assert.strictEqual(previewAgain, previewHtml, `${id}: preview render is not deterministic`);
    assertSemanticMatch(FIXTURE, publishHtml, outputRoot, `${id}-semantic`);
    const publishPath = path.join(outputRoot, `${id}-wechat.html`);
    fs.writeFileSync(publishPath, publishHtml);
    runPython('validate_wechat_html.py', [publishPath], `${id}: WeChat validation failed`);

    const fontCheck = checkSvgFonts(packageDir);
    assert.notStrictEqual(fontCheck.status, 'fail', `${id}: ${fontCheck.reason}`);

    console.log(`PASS ${id}`);
  }

  const boundaryTitles = ['短标题', '八个中文字标题测试呀', '十四个中文字标题用于边界测试检查', '这是一个包含二十四个中文字左右的超长标题用于检查自动缩放与换行边界'];
  const boundaryMd = Array.from({ length: 12 }, (_, index) => `# ${boundaryTitles[index % boundaryTitles.length]} ${index + 1}\n\n正文包含 **高亮 ${index + 1}**。`).join('\n\n');
  const childlike = PRESETS['childlike-doodle'];
  const childlikeRoot = path.join(tempRoot, 'childlike-boundary');
  const childlikeAssets = path.join(childlikeRoot, 'assets');
  fs.mkdirSync(childlikeAssets, { recursive: true });
  const boundaryHtml = renderMarkdown(boundaryMd, childlike, {
    useLocalImgPath: false,
    assetOutputDir: childlikeAssets,
    assetUrlPrefix: 'generated',
  });
  assert(/data-src="generated\//.test(boundaryHtml), 'childlike-doodle: asset URL prefix was not applied');
  assert.strictEqual(boundaryHtml, renderMarkdown(boundaryMd, childlike, {
    useLocalImgPath: false,
    assetOutputDir: childlikeAssets,
    assetUrlPrefix: 'generated',
  }), 'childlike-doodle: boundary render is not deterministic');
  assertSemanticMatch(boundaryMd, boundaryHtml, childlikeRoot, 'childlike-boundary');
  const boundaryPath = path.join(childlikeRoot, 'boundary.html');
  fs.writeFileSync(boundaryPath, boundaryHtml);
  runPython('check_images.py', [boundaryPath, '--asset-dir', childlikeAssets, '--url-prefix', 'generated'], 'asset URL prefix image check failed');

  const referenceHtml = `<section style="text-align:center"><img src="title.gif" style="width:80px"><img src="number.jpg" style="width:60px"><img src="brush.png" style="width:420px"></section><p>正文有 <strong style="color:#f60">多色强调</strong></p><section style="border-left:3px solid #333">引用</section>`;
  const referencePath = path.join(tempRoot, 'reference.html');
  const generatedPath = path.join(tempRoot, 'generated.html');
  const inventoryPath = path.join(tempRoot, 'asset-inventory.json');
  const reviewPath = path.join(tempRoot, 'visual-review.html');
  fs.writeFileSync(referencePath, referenceHtml);
  fs.writeFileSync(generatedPath, renderMarkdown('# 标题\n\n正文有 **多色强调**\n\n> 引用', childlike, { useLocalImgPath: false, assetOutputDir: childlikeAssets }));
  const inventory = buildAssetInventory(referenceHtml, { generatedAt: 'test' });
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
  assert(inventory.image_heading_candidate_count >= 1, 'asset inventory did not flag image heading candidates');
  const styleAnalysisPath = path.join(tempRoot, 'style-source.html');
  fs.writeFileSync(styleAnalysisPath, referenceHtml);
  const analysis = analyzeStyle(styleAnalysisPath);
  assert.strictEqual(analysis.emphasis.count, 1, 'style analysis did not detect emphasis');
  buildVisualReview(referencePath, generatedPath, reviewPath, { inventoryPath });
  assert(fs.existsSync(reviewPath), 'visual review HTML was not generated');
  assert(fs.existsSync(reviewPath.replace(/\.html$/, '.json')), 'visual review manifest was not generated');

  assert.deepStrictEqual(listPackageFiles(PRESETS_DIR), packageFilesBefore, 'rendering polluted preset source packages');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`PASS ${Object.keys(PRESETS).length} preset packages`);
