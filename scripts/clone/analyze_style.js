function requireOrExit(modName, usage) {
  try {
    return require(modName);
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND') {
      console.error(`缺少依赖模块: ${modName}（${usage}）`);
      console.error('请在 skill 目录下执行: npm install');
      process.exit(1);
    }
    throw e;
  }
}

const cheerio = requireOrExit('cheerio', '复刻样式分析功能需要该模块');
const fs = require('fs');
const path = require('path');

function getStyleObj(el) {
  const styleStr = el.attribs?.style || '';
  const obj = {};
  if (!styleStr) return obj;
  styleStr.split(';').forEach(decl => {
    const [prop, val] = decl.split(':').map(s => s.trim());
    if (prop && val) obj[prop] = val;
  });
  return obj;
}

function getInheritedStyle(el) {
  const merged = {};
  let cur = el;
  while (cur && cur.type === 'tag') {
    const s = getStyleObj(cur);
    for (const k in s) {
      if (!(k in merged)) {
        merged[k] = s[k];
      }
    }
    cur = cur.parent;
  }
  return merged;
}

function getAllTextNodes($, root) {
  const nodes = [];
  function walk(el) {
    if (el.type === 'text') {
      const text = $(el).text().trim();
      if (text.length > 2) {
        const parent = el.parent;
        const style = getInheritedStyle(parent);
        nodes.push({ text, style });
      }
      return;
    }
    if (el.type === 'tag' && el.name === 'img') return;
    if (el.children) {
      el.children.forEach(walk);
    }
  }
  if (root[0]) walk(root[0]);
  return nodes;
}

function analyzeFontSizes(textNodes) {
  const sizeCount = {};
  textNodes.forEach(n => {
    const fs = n.style['font-size'] || 'inherit';
    sizeCount[fs] = (sizeCount[fs] || 0) + 1;
  });
  const sorted = Object.entries(sizeCount).sort((a, b) => b[1] - a[1]);
  return sorted;
}

function parsePx(val) {
  if (!val) return 0;
  const m = val.match(/([\d.]+)px/);
  return m ? parseFloat(m[1]) : 0;
}

function analyzeStructure($, root) {
  const children = root.children();
  const structure = [];
  children.each((i, el) => {
    const tag = el.tagName || el.type;
    const text = $(el).text().trim().substring(0, 40);
    const style = getStyleObj(el);
    structure.push({
      index: i,
      tag,
      text_preview: text,
      style_keys: Object.keys(style),
    });
  });

  let type = 'flat';
  const sectionCount = structure.filter(s => s.tag === 'section').length;
  const pCount = structure.filter(s => s.tag === 'p').length;
  if (structure.length <= 3 && sectionCount >= 1) type = 'single-wrapper';
  else if (sectionCount > pCount) type = 'nested-sections';
  else if (pCount > sectionCount) type = 'flat-paragraphs';

  return { type, top_level_count: structure.length, top_level: structure };
}

function findHeadings(textNodes) {
  const sorted = [...textNodes].sort((a, b) =>
    parsePx(b.style['font-size']) - parsePx(a.style['font-size'])
  );

  const seen = new Set();
  const headings = [];
  for (const n of sorted) {
    const fs = n.style['font-size'];
    if (!fs || seen.has(fs)) continue;
    seen.add(fs);
    const sample = textNodes.filter(t => t.style['font-size'] === fs).slice(0, 3).map(t => t.text.substring(0, 30));
    headings.push({
      font_size: fs,
      color: n.style.color || '',
      font_weight: n.style['font-weight'] || '',
      text_align: n.style['text-align'] || '',
      sample_texts: sample,
      count: textNodes.filter(t => t.style['font-size'] === fs).length,
    });
    if (headings.length >= 4) break;
  }
  return headings;
}

function findImages($, root) {
  const imgs = [];
  root.find('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    const style = getStyleObj(el);
    const width = parsePx(style.width) || null;
    const height = null;
    const parent = el.parent;
    const parentStyle = parent ? getStyleObj(parent) : {};
    const textAlign = parentStyle['text-align'] || '';

    imgs.push({
      index: i,
      src: src.substring(0, 100),
      width,
      border_radius: style['border-radius'] || '',
      box_shadow: style['box-shadow'] || '',
      parent_align: textAlign,
      is_full_width: width === null || width === '100%' || width >= 500,
    });
  });
  return imgs;
}

function analyzeColors(textNodes, images) {
  const colors = {};
  textNodes.forEach(n => {
    const c = n.style.color || 'unknown';
    colors[c] = (colors[c] || 0) + 1;
  });
  const sortedColors = Object.entries(colors).sort((a, b) => b[1] - a[1]);

  const bgColors = {};
  return {
    text_colors: sortedColors.slice(0, 5),
  };
}

function findDecorations($, root) {
  const decos = {
    title_decorations: [],
    dividers: [],
    list_bullets: [],
    quote_blocks: [],
    background_patterns: [],
  };

  root.find('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    const style = getStyleObj(el);
    const w = parsePx(style.width);
    const h = parsePx(style.height);

    if (w > 0 && h > 0) {
      const ratio = w / h;
      if (ratio > 10 || (w > 200 && h < 10)) {
        decos.dividers.push({ type: 'image-divider', width: w, height: h, src: src.substring(0, 80) });
      } else if (w < 100 && h < 100) {
        decos.title_decorations.push({ type: 'small-icon', width: w, height: h, src: src.substring(0, 80) });
      }
    }
  });

  root.find('section, p, div').each((i, el) => {
    const style = getStyleObj(el);
    const text = $(el).text().trim();
    if (text.length > 0 && text.length < 100) {
      if (style['border-left'] && style['padding-left']) {
        decos.quote_blocks.push({
          type: 'left-border-quote',
          border_left: style['border-left'],
          background: style['background-color'] || '',
          sample: text.substring(0, 50),
        });
      }
    }
    if (style['border-left'] && style['background-color'] && text.length > 0) {
      if (text.length < 200) {
        decos.quote_blocks.push({
          type: 'left-border-quote',
          border_left: style['border-left'],
          background: style['background-color'],
          sample: text.substring(0, 50),
        });
      }
    }
  });

  return decos;
}

function analyzeParagraphSpacing($, root) {
  const children = root.children();
  let emptyCount = 0;
  let paraCount = 0;
  children.each((i, el) => {
    const text = $(el).text().trim();
    const style = getStyleObj(el);
    if (text.length === 0) {
      emptyCount++;
    } else {
      paraCount++;
    }
  });

  const firstPara = children.filter((i, el) => $(el).text().trim().length > 0).first();
  let marginBottom = '';
  if (firstPara.length) {
    const s = getStyleObj(firstPara[0]);
    marginBottom = s['margin-bottom'] || '';
  }

  return {
    empty_element_count: emptyCount,
    paragraph_count: paraCount,
    uses_empty_lines: emptyCount > paraCount * 0.3,
    margin_bottom: marginBottom,
  };
}

function analyzeStyle(contentHtmlPath) {
  const html = fs.readFileSync(contentHtmlPath, 'utf-8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const root = $('body').length ? $('body') : $.root().children().first();
  const rootEl = root.length ? root : $.root();

  const textNodes = getAllTextNodes($, rootEl);
  const fontSizes = analyzeFontSizes(textNodes);
  const headings = findHeadings(textNodes);
  const structure = analyzeStructure($, rootEl);
  const images = findImages($, rootEl);
  const colors = analyzeColors(textNodes, images);
  const decorations = findDecorations($, rootEl);
  const spacing = analyzeParagraphSpacing($, rootEl);

  const bodySize = fontSizes[0]?.[0] || '16px';
  const bodyColor = colors.text_colors[0]?.[0] || '#333';

  return {
    body: {
      font_size: bodySize,
      color: bodyColor,
      line_height: textNodes[0]?.style['line-height'] || '',
      text_align: textNodes[0]?.style['text-align'] || '',
      letter_spacing: textNodes[0]?.style['letter-spacing'] || '',
    },
    headings,
    structure,
    images: {
      count: images.length,
      samples: images.slice(0, 5),
      image_style: {
        border_radius: images[0]?.border_radius || '',
        box_shadow: images[0]?.box_shadow || '',
        alignment: images[0]?.parent_align || '',
      },
    },
    colors,
    decorations,
    paragraph_spacing: spacing,
    text_node_count: textNodes.length,
    font_size_distribution: fontSizes,
  };
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error('用法: node analyze_style.js <template-content.html> [analysis.json]');
    process.exit(1);
  }

  const result = analyzeStyle(inputPath);

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log('分析结果已保存:', outputPath);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  console.log('\n=== 分析摘要 ===');
  console.log('结构类型:', result.structure.type);
  console.log('正文字号:', result.body.font_size);
  console.log('正文颜色:', result.body.color);
  console.log('标题层级数:', result.headings.length);
  result.headings.forEach((h, i) => {
    console.log(`  H${i+1}: ${h.font_size} ${h.color} ${h.font_weight} (${h.count}个)`);
  });
  console.log('图片数:', result.images.count);
  console.log('段落间距方式:', result.paragraph_spacing.uses_empty_lines ? '空行法' : 'margin法');
}

module.exports = { analyzeStyle, getInheritedStyle, getStyleObj, parsePx };
