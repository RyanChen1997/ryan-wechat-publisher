const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function requireCheerio() {
  try {
    return require('cheerio');
  } catch (error) {
    throw new Error('缺少依赖模块: cheerio（请在 skill 目录执行 npm install）');
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadDocument(filePath) {
  const cheerio = requireCheerio();
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  $('img[data-src]').each((i, el) => {
    if (!$(el).attr('src')) $(el).attr('src', $(el).attr('data-src'));
  });
  $('img[src]').each((i, el) => {
    const src = $(el).attr('src');
    if (!src || /^(https?:|data:|file:)/i.test(src)) return;
    $(el).attr('src', pathToFileURL(path.resolve(path.dirname(filePath), src)).href);
  });
  return { $, html };
}

function outerHtml($, element) {
  return element && element.length ? $.html(element.first()) : '';
}

function findBorderQuote($) {
  return $('blockquote, section[style*="border-left"], p[style*="border-left"]').first();
}

function findEmphasis($) {
  return $('strong, b, span[style*="font-weight: bold"], span[style*="font-weight:bold"]').first();
}

function referenceHeading($, inventory) {
  const candidate = inventory && inventory.assets
    ? inventory.assets.find((asset) => asset.classification && asset.classification.image_heading_candidate)
    : null;
  if (candidate && candidate.dom_path) {
    try {
      const image = $(candidate.dom_path).first();
      if (image.length) {
        const group = image.closest('section, p, div');
        return group.length ? group : image;
      }
    } catch (error) {}
  }
  return $('h1, h2, p[style*="font-size: 2"], section:has(img)').first();
}

function generatedHeading($) {
  return $('[data-semantic-role="heading-1"]').first().length
    ? $('[data-semantic-role="heading-1"]').first()
    : $('h1, h2, p[style*="font-size: 2"]').first();
}

function panel(title, left, right) {
  return `<section class="review-block">
  <h2>${escapeHtml(title)}</h2>
  <div class="pair">
    <article><h3>原文章</h3><div class="crop">${left || '<p class="missing">未自动识别，请人工定位</p>'}</div></article>
    <article><h3>生成结果</h3><div class="crop">${right || '<p class="missing">未自动识别，请人工定位</p>'}</div></article>
  </div>
  <label><input type="checkbox"> 这一项视觉一致，可以通过</label>
</section>`;
}

function buildVisualReview(referencePath, generatedPath, outputPath, options = {}) {
  const reference = loadDocument(referencePath);
  const generated = loadDocument(generatedPath);
  let inventory = options.inventory || null;
  if (!inventory && options.inventoryPath && fs.existsSync(options.inventoryPath)) {
    inventory = JSON.parse(fs.readFileSync(options.inventoryPath, 'utf8'));
  }

  const pairs = [
    ['一级标题 / 标题图片组', outerHtml(reference.$, referenceHeading(reference.$, inventory)), outerHtml(generated.$, generatedHeading(generated.$))],
    ['强调文字与颜色', outerHtml(reference.$, findEmphasis(reference.$)), outerHtml(generated.$, findEmphasis(generated.$))],
    ['引用 / 重点内容块', outerHtml(reference.$, findBorderQuote(reference.$)), outerHtml(generated.$, findBorderQuote(generated.$))],
    ['正文图片', outerHtml(reference.$, reference.$('img').last()), outerHtml(generated.$, generated.$('img').last())],
  ];

  const reviewHtml = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>复刻视觉门禁</title><style>
body{margin:0;background:#f3f4f6;color:#222;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.page{max-width:1440px;margin:auto;padding:24px}.summary,.review-block{background:#fff;border-radius:14px;padding:20px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,.06)}h1,h2,h3{margin-top:0}.pair,.frames{display:grid;grid-template-columns:1fr 1fr;gap:18px}.crop{min-height:100px;padding:18px;border:1px dashed #cbd5e1;overflow:auto;background:#fff}.crop img{max-width:100%;height:auto}.missing{color:#b45309}.frames iframe{width:100%;height:720px;border:1px solid #cbd5e1;background:#fff}label{display:block;margin-top:14px;font-weight:600}@media(max-width:800px){.pair,.frames{grid-template-columns:1fr}.page{padding:12px}}
</style></head><body><main class="page">
<section class="summary"><h1>复刻视觉门禁</h1><p>先逐项比较关键元素，再看整页。所有关键项确认后才能通过 L2；自动识别不到的元素必须人工定位，不能默认通过。</p></section>
${pairs.map(([title, left, right]) => panel(title, left, right)).join('\n')}
<section class="review-block"><h2>整页对比</h2><div class="frames"><iframe src="${pathToFileURL(path.resolve(referencePath)).href}"></iframe><iframe src="${pathToFileURL(path.resolve(generatedPath)).href}"></iframe></div></section>
</main></body></html>`;

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, reviewHtml);
  const result = {
    reference: path.resolve(referencePath),
    generated: path.resolve(generatedPath),
    output: path.resolve(outputPath),
    gates: pairs.map(([name, left, right]) => ({ name, reference_found: Boolean(left), generated_found: Boolean(right) })),
  };
  fs.writeFileSync(outputPath.replace(/\.html?$/i, '.json'), JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  const [referencePath, generatedPath, outputPath, inventoryPath] = process.argv.slice(2);
  if (!referencePath || !generatedPath || !outputPath) {
    console.error('用法: node build_visual_review.js <template-content.html> <article-preview.html> <visual-review.html> [asset-inventory.json]');
    process.exit(1);
  }
  const result = buildVisualReview(referencePath, generatedPath, outputPath, { inventoryPath });
  console.log(`视觉门禁已生成: ${result.output}`);
}

module.exports = { buildVisualReview };
