const fs = require('fs');
const path = require('path');

function requireCheerio() {
  try {
    return require('cheerio');
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('缺少依赖模块: cheerio（请在 skill 目录执行 npm install）');
    }
    throw error;
  }
}

function parseCssSize(style, property) {
  const match = String(style || '').match(new RegExp(`${property}\\s*:\\s*([\\d.]+)px`, 'i'));
  return match ? Number(match[1]) : null;
}

function numericAttr(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function imageFormat(src) {
  const value = String(src || '');
  const wechatFormat = value.match(/[?&](?:wx_fmt|format)=([a-z0-9]{2,5})/i);
  if (wechatFormat) return wechatFormat[1].toLowerCase().replace('jpeg', 'jpg');
  const match = value.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : null;
}

function domPath($, el) {
  const parts = [];
  let current = el;
  while (current && current.type === 'tag' && parts.length < 6) {
    const siblings = current.parent && current.parent.children
      ? current.parent.children.filter((node) => node.type === 'tag' && node.name === current.name)
      : [];
    const index = siblings.indexOf(current);
    parts.unshift(`${current.name}${siblings.length > 1 ? `:nth-of-type(${index + 1})` : ''}`);
    current = current.parent;
  }
  return parts.join(' > ');
}

function nearestContext($, el) {
  let current = el.parent;
  while (current && current.type === 'tag') {
    const text = cleanText($(current).clone().find('img').remove().end().text());
    const imageCount = $(current).find('img').length;
    if (text || imageCount > 1) {
      return { text, image_count: imageCount, tag: current.name || null };
    }
    current = current.parent;
  }
  return { text: '', image_count: 1, tag: null };
}

function classifyImage(asset) {
  const width = asset.display.width;
  const height = asset.display.height;
  const ratio = width && height ? width / height : null;
  const emptyContext = !asset.context.text;
  const grouped = asset.context.image_count >= 2;
  const centered = /center/i.test(asset.parent_align || '');
  const hasSemanticAlt = Boolean(asset.alt && !/^(图片|image|img|gif)$/i.test(asset.alt));
  const likelyDivider = Boolean(ratio && (ratio >= 8 || (width >= 200 && height <= 16)));
  const likelySmallDecoration = Boolean(width && height && width <= 120 && height <= 120 && !hasSemanticAlt);
  const imageHeadingCandidate = Boolean(
    hasSemanticAlt
    || (emptyContext && centered && grouped)
    || (emptyContext && centered && asset.index < 12)
    || (emptyContext && grouped && asset.index < 12)
  );

  return {
    animated: asset.format === 'gif',
    likely_divider: likelyDivider,
    likely_decoration: likelyDivider || likelySmallDecoration,
    image_heading_candidate: imageHeadingCandidate,
    requires_visual_review: imageHeadingCandidate || !asset.format || grouped,
  };
}

function buildAssetInventory(html, options = {}) {
  const cheerio = requireCheerio();
  const $ = cheerio.load(html, { decodeEntities: false });
  const root = $('#js_content').length ? $('#js_content') : ($('body').length ? $('body') : $.root());
  const assets = [];

  root.find('img').each((index, el) => {
    const node = $(el);
    const src = node.attr('data-src') || node.attr('src') || node.attr('data-original') || '';
    const style = node.attr('style') || '';
    const parentStyle = node.parent().attr('style') || '';
    const display = {
      width: numericAttr(node.attr('width')) || numericAttr(node.attr('data-w')) || parseCssSize(style, 'width'),
      height: numericAttr(node.attr('height')) || numericAttr(node.attr('data-h')) || parseCssSize(style, 'height'),
    };
    const asset = {
      index,
      src,
      alt: cleanText(node.attr('alt')),
      format: imageFormat(src),
      display,
      parent_align: (/text-align\s*:\s*([^;]+)/i.exec(parentStyle) || [])[1] || '',
      dom_path: domPath($, el),
      context: nearestContext($, el),
      local_path: null,
      download_error: null,
    };
    asset.classification = classifyImage(asset);
    assets.push(asset);
  });

  return {
    source_url: options.sourceUrl || null,
    generated_at: options.generatedAt || new Date().toISOString(),
    asset_count: assets.length,
    image_heading_candidate_count: assets.filter((asset) => asset.classification.image_heading_candidate).length,
    animated_count: assets.filter((asset) => asset.classification.animated).length,
    requires_visual_review: assets.some((asset) => asset.classification.requires_visual_review),
    assets,
  };
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || 'asset-inventory.json';
  if (!inputPath) {
    console.error('用法: node asset_inventory.js <template-content.html> [asset-inventory.json]');
    process.exit(1);
  }
  const html = fs.readFileSync(inputPath, 'utf8');
  const inventory = buildAssetInventory(html);
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2));
  console.log(`资产清单已保存: ${outputPath}`);
  console.log(`图片 ${inventory.asset_count} 张，图片标题候选 ${inventory.image_heading_candidate_count} 处，GIF ${inventory.animated_count} 张`);
}

module.exports = { buildAssetInventory, classifyImage, imageFormat };
