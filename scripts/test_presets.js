const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderMarkdown } = require('./presets/base');
const { PRESETS, CATEGORY_ORDER, getPresetDir, listCategories } = require('./presets/index');
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

// ---- 分类结构回归（预设按 分类/预设 两层目录存放）----
{
  const categories = listCategories();
  assert.deepStrictEqual(categories.map((c) => c.id), [...CATEGORY_ORDER], '分类清单与 CATEGORY_ORDER 不一致');

  let counted = 0;
  for (const cat of categories) {
    const catDir = path.join(PRESETS_DIR, cat.id);
    assert(fs.existsSync(path.join(catDir, 'index.js')), `${cat.id}: 分类目录缺少分类桶 index.js（空分类也要保留）`);
    assert.strictEqual(cat.presets.length, cat.count, `${cat.id}: count 与 presets 长度不一致`);
    counted += cat.count;
    for (const id of cat.presets) {
      assert.strictEqual(path.dirname(getPresetDir(id)), catDir, `${id}: 预设包不在分类目录下`);
      assert.strictEqual(PRESETS[id].category, cat.id, `${id}: 注入的 category 不对`);
      assert.strictEqual(PRESETS[id].categoryName, cat.name, `${id}: 注入的 categoryName 不对`);
    }
  }
  assert.strictEqual(counted, Object.keys(PRESETS).length, '有预设没有被任何分类认领');

  // 空分类照旧出现在清单里，但画廊（nonEmptyOnly）不展示
  const nonEmpty = listCategories({ nonEmptyOnly: true });
  assert(nonEmpty.length <= categories.length, 'nonEmptyOnly 分类数不应多于全部分类');
  assert(nonEmpty.every((c) => c.count > 0), 'nonEmptyOnly 过滤后仍存在空分类');
  console.log(`PASS 分类结构 (${categories.length} 个分类 / ${nonEmpty.length} 个有模板 / ${counted} 套预设)`);
}

// ---- 夜间模式模拟器：属性解析回归 ----
// 真实微信文章里两类写法并存，历史上两个都踩过坑：
//   A) style 值里带未转义的内嵌引号（font-family: "PingFang SC"）
//   B) style 不是最后一个属性，且值是空（style="" src="https://…"）
// 再加上 style 值里的 HTML 实体（&quot;）本身带分号，会被当成声明分隔符。
// 任一处理不当都会把 URL 写成 `https: //…`，导致夜间预览图片全挂。
{
  const { simulateDark } = require('./utils/dark-preview');
  const url = 'https://mmbiz.qpic.cn/mmbiz_png/AAA/640?wx_fmt=png';
  const cases = [
    { html: `<img style="" src="${url}">`, label: 'C1 style 空值后跟 src', hasUrl: true },
    { html: `<img src="${url}" style="">`, label: 'C2 style 在最后', hasUrl: true },
    { html: `<section style="background-image: url(&quot;${url}&quot;)">x</section>`, label: 'C3 CSS url 用 &quot; 实体', hasUrl: true },
    { html: `<section style="font-family: "PingFang SC", system-ui; background-color: var(--weui-BG-2, rgb(255, 255, 255))">x</section>`, label: 'C4 style 内含未转义引号 + var', hasUrl: false },
    { html: `<section style="background-image:url('${url}');color:#333" data-x="1">x</section>`, label: 'C5 url 用单引号且 style 后还有属性', hasUrl: true },
  ];
  for (const { html, label, hasUrl } of cases) {
    const out = simulateDark(html);
    assert(!/https:\s+\/\//.test(out), `${label}: URL 被写坏 -> ${out.slice(0, 120)}`);
    if (hasUrl) assert(out.includes(url), `${label}: 原始 URL 丢失`);
  }
  const c4 = simulateDark(cases[3].html);
  assert(!/var\(--weui-/.test(c4), `C4: var(--weui-*) 没有被解析成夜间值 -> ${c4.slice(0, 160)}`);
  assert(/#191919|#1e1e1e|rgb\(25, 25, 25\)/i.test(c4), 'C4: 浅色背景没有被映射为夜间色');
  // 确定性
  assert.strictEqual(simulateDark(cases[3].html), c4, 'C4: simulateDark 输出不确定');
  console.log('PASS dark-preview 属性解析回归 (5 cases)');
}

// 渐变背景在夜间映射后必须仍是**合法的渐变声明**。
// 官方 wechatjs/mp-darkmode 的做法是把渐变里每个色值都换成同一个混合纯色、
// 保留 `linear-gradient(...)` 语法（视觉上退化成纯色，但声明合法）。
// 旧实现把整个值塌缩成 `rgb(...)`，在 `background-image` 上属非法值，
// 会被浏览器整条丢弃 → 夜间预览里渐变底直接消失，与真机不一致。
{
  const { simulateDark } = require('./utils/dark-preview');
  const cases = [
    {
      css: 'background-image: linear-gradient(160deg, #2b43f4 0%, #1c37c9 55%, #16299b 100%)',
      label: 'D1 background-image 上的三色渐变',
    },
    {
      css: 'background: linear-gradient(90deg, rgb(255, 154, 158) 0%, rgba(0,0,0,0) 100%)',
      label: 'D2 background 简写 + rgba 透明色停',
    },
    {
      css: 'background-image: repeating-linear-gradient(0deg, #ded8f5 0px, #ded8f5 1px, transparent 1px, transparent 20px)',
      label: 'D3 网格纹理 + transparent 关键字',
    },
  ];
  for (const { css, label } of cases) {
    const out = simulateDark(`<section style="padding: 0; ${css}; box-sizing: border-box">x</section>`);
    // 取出映射后的声明值
    const start = out.indexOf(css.split(':')[0] + ':');
    const got = out.slice(start, out.indexOf(';', start)).trim();
    assert(/gradient\(/i.test(got), `${label}: 渐变语法被破坏 -> ${got.slice(0, 140)}`);
    // 每个色停都应是同一个映射后纯色（官方 mixColors 行为），而不是残留白天色
    const stops = got.match(/rgba?\([^)]*\)/g) || [];
    assert(stops.length >= 2, `${label}: 色停数量异常（${stops.length}）-> ${got.slice(0, 140)}`);
    assert(new Set(stops).size === 1, `${label}: 色停未被统一映射为同一个纯色 -> ${got.slice(0, 140)}`);
  }
  // 显式回归：旧实现在 background-image 上会产出非法值
  const one = simulateDark('<section style="background-image: linear-gradient(#2b43f4, #1c37c9)">x</section>');
  assert(
    !/background-image\s*:\s*rgba?\(\s*\d/.test(one),
    `D4: background-image 被写成纯色（非法，浏览器会丢弃）-> ${one.slice(0, 160)}`
  );
  // 纯色底的行为不能变
  const solid = simulateDark('<section style="background-color: #ebf1dd">x</section>');
  assert(
    /background-color\s*:\s*rgb\(188, 193, 177\)/.test(solid),
    `D5: 纯色底映射行为变了 -> ${solid.slice(0, 160)}`
  );
  console.log('PASS dark-preview 渐变保留回归 (5 cases)');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ryan-wechat-preset-test-'));
const packageFilesBefore = listPackageFiles(PRESETS_DIR);

try {
  for (const [id, preset] of Object.entries(PRESETS)) {
    const packageDir = getPresetDir(id);
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
