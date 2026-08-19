const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderMarkdown } = require('./presets/base');
const { PRESETS } = require('./presets/index');

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

const legacyFiles = fs.readdirSync(PRESETS_DIR)
  .filter((name) => name.endsWith('.js') && !['base.js', 'index.js'].includes(name));
assert.deepStrictEqual(legacyFiles, [], `legacy single-file presets found: ${legacyFiles.join(', ')}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ryan-wechat-preset-test-'));

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

    console.log(`PASS ${id}`);
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`PASS ${Object.keys(PRESETS).length} preset packages`);
