const fs = require('fs');
const path = require('path');

function renderMarkdown(md, preset, options = {}) {
  const {
    useLocalImgPath = false,
    assetDirs = [],
    headingOffset = 0,
    assetOutputDir = null,
    assetUrlPrefix = '',
  } = options;

  const STYLES = preset.STYLES;
  const decos = preset.decorations || {};
  let h1Counter = 0;

  // 章节容器模式：preset 定义 openSection/closeSection + sectionHeadingLevel 后启用。
  // 每个匹配层级的标题开启一个独立容器（可含标题本身），用于「一个章节一个框」的复刻需求。
  const sectionMode = typeof decos.openSection === 'function' && typeof decos.closeSection === 'function';
  const sectionLevel = decos.sectionHeadingLevel || 0;
  let sectionIndex = 0;
  let sectionOpen = false;

  const normalizedAssetUrlPrefix = String(assetUrlPrefix || '').replace(/^\/+|\/+$/g, '');
  const assetUrl = (fileName) => normalizedAssetUrlPrefix
    ? path.posix.join(normalizedAssetUrlPrefix, fileName)
    : fileName;

  if (decos.setAssetDir && assetOutputDir) {
    decos.setAssetDir(assetOutputDir, useLocalImgPath, {
      assetUrl,
      assetUrlPrefix: normalizedAssetUrlPrefix,
      outputDir: assetOutputDir,
    });
  }

  function resolveImage(imgName) {
    if (/^https?:\/\//.test(imgName) || imgName.startsWith('data:')) {
      return imgName;
    }
    for (const dir of assetDirs) {
      const p = path.join(dir, imgName);
      if (fs.existsSync(p)) return p;
    }
    return imgName;
  }

  function parseInline(text) {
    if (decos.parseInline) return decos.parseInline(text, STYLES);
    text = text.replace(/\*\*(.+?)\*\*/g,
      `<span style="${STYLES.strong || 'font-weight: bold;'}">$1</span>`);
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      '<span style="font-style: italic;">$1</span>');
    text = text.replace(/`([^`]+)`/g,
      `<code style="${STYLES.code || 'background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:14px;font-family:Consolas,monospace;'}">$1</code>`);
    return text;
  }

  function makeParagraph(text) {
    if (decos.makeParagraph) return decos.makeParagraph(text, parseInline, STYLES);
    const html = parseInline(text);
    return `<p style="${STYLES.p || 'margin: 16px 0; line-height: 1.8; font-size: 15px; color: #333;'}">${html}</p>`;
  }

  function makeBr() {
    if (decos.makeBr !== undefined) return decos.makeBr(STYLES);
    if (STYLES.br_p) {
      return `<p style="${STYLES.br_p}"><br></p>`;
    }
    return '';
  }

  function makeH1(text) {
    h1Counter++;
    if (decos.makeH1) return decos.makeH1(text, h1Counter, parseInline, STYLES);
    const html = parseInline(text);
    return `<p style="${STYLES.h1 || 'font-size: 22px; font-weight: bold; margin: 28px 0 16px; color: #222;'}">${html}</p>`;
  }

  function makeH2(text) {
    if (decos.makeH2) return decos.makeH2(text, parseInline, STYLES);
    const html = parseInline(text);
    return `<p style="${STYLES.h2 || 'font-size: 18px; font-weight: bold; margin: 24px 0 12px; color: #333;'}">${html}</p>`;
  }

  function makeH3(text) {
    if (decos.makeH3) return decos.makeH3(text, parseInline, STYLES);
    const html = parseInline(text);
    return `<p style="${STYLES.h3 || 'font-size: 16px; font-weight: bold; margin: 20px 0 10px; color: #333;'}">${html}</p>`;
  }

  function makeImage(imgSrc, imgAlt, caption) {
    if (decos.makeImage) return decos.makeImage(imgSrc, imgAlt, caption, useLocalImgPath, resolveImage, STYLES);
    const src = useLocalImgPath ? resolveImage(imgSrc) : imgSrc;
    const srcAttr = useLocalImgPath ? 'src' : 'data-src';
    const imgStyle = STYLES.img || 'max-width: 100%; height: auto;';
    const imgSectionStyle = STYLES.img_section || 'text-align: center; margin: 16px 0;';
    let html = `<section style="${imgSectionStyle}">
  <img ${srcAttr}="${src}" alt="${imgAlt}" style="${imgStyle}"/>
</section>`;
    if (caption) {
      const capStyle = STYLES.caption || 'text-align: center; color: #888; font-size: 13px; margin: 8px 0 16px;';
      html += `\n<p style="${capStyle}">${caption}</p>`;
    }
    return html;
  }

  function makeQuote(text) {
    if (decos.makeQuote) return decos.makeQuote(text, parseInline, STYLES);
    const html = parseInline(text).replace(/\n/g, '<br/>');
    const outer = STYLES.quote_outer || 'border-left: 4px solid #ddd; padding: 12px 20px; margin: 16px 0; background: #f9f9f9;';
    const textStyle = STYLES.quote_text || STYLES.quote_span || 'color: #666; font-size: 14px; line-height: 1.6;';
    return `<section style="${outer}">
  <span style="${textStyle}">${html}</span>
</section>`;
  }

  function makeUl(items) {
    if (decos.makeUl) return decos.makeUl(items, parseInline, STYLES);
    let inner = '';
    items.forEach(item => {
      const html = parseInline(item);
      const liStyle = STYLES.li || 'margin-bottom: 8px; line-height: 1.6;';
      const bulletStyle = STYLES.li_bullet_text || 'margin-right: 8px; color: #999;';
      const bulletChar = STYLES.li_bullet_char || '•';
      const spanStyle = STYLES.li_span || '';
      inner += `<section style="${liStyle}">
  <span style="${bulletStyle}">${bulletChar}</span><span style="${spanStyle}">${html}</span>
</section>\n`;
    });
    const ulOuter = STYLES.ul_outer || 'margin: 16px 0;';
    return `<section style="${ulOuter}">\n${inner}</section>`;
  }

  function makeHr() {
    if (decos.makeHr) return decos.makeHr(STYLES);
    if (STYLES.hr_line || STYLES.hr_section) {
      const sectionS = STYLES.hr_section || 'text-align: center; margin: 24px 0;';
      const lineS = STYLES.hr_line || 'display: inline-block; width: 40%; height: 1px; background: #ddd;';
      return `<section style="${sectionS}">
  <span style="${lineS}"></span>
</section>`;
    }
    return `<hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;"/>`;
  }

  function makeCodeBlock(code) {
    const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (decos.makeCodeBlock) return decos.makeCodeBlock(escaped, STYLES);
    const blockStyle = STYLES.code_block || 'margin: 16px 0; background: #f5f5f5; padding: 16px; border-radius: 4px; overflow-x: auto;';
    const preStyle = STYLES.code_pre || 'margin: 0; font-size: 13px; font-family: Consolas, Monaco, monospace; color: #444; white-space: pre-wrap; word-break: break-all; line-height: 1.5;';
    return `<section style="${blockStyle}">
  <pre style="${preStyle}"><code>${escaped}</code></pre>
</section>`;
  }

  // 状态必须在解析前重置；发布版和预览版会复用同一个 preset 实例。
  const beforeContentHtml = decos.beforeContent ? decos.beforeContent(STYLES) : '';
  const lines = md.split('\n');
  const output = [];
  let inList = null;
  let listItems = [];
  let inQuote = false;
  let quoteLines = [];
  let paragraphBuffer = [];
  let inFrontmatter = false;
  let frontmatterEnded = false;

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      output.push(makeParagraph(paragraphBuffer.join(' ')));
      paragraphBuffer = [];
    }
  }

  function flushList() {
    if ((inList === 'ul' || inList === 'ol') && listItems.length > 0) {
      output.push(makeUl(listItems));
      listItems = [];
      inList = null;
    }
  }

  function flushQuote() {
    if (inQuote && quoteLines.length > 0) {
      output.push(makeQuote(quoteLines.join('\n')));
      quoteLines = [];
      inQuote = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        frontmatterEnded = true;
      }
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      flushList();
      flushQuote();
      output.push(makeBr());
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph(); flushList(); flushQuote();
      output.push(makeHr());
      continue;
    }

    const wikiMatch = trimmed.match(/^!\[\[(.+?)\]\]\s*$/);
    const mdImgMatch = trimmed.match(/^!\[(.+?)\]\((.+?)\)\s*$/);
    let imgSrc = null, imgAlt = '', caption = '';
    if (wikiMatch) {
      const parts = wikiMatch[1].split('|');
      imgSrc = parts[0].trim();
      imgAlt = parts[0].trim();
      if (parts.length > 1) {
        // Obsidian wikilink 的 `|480` 是显示宽度参数，不是图片说明，纯数字时忽略
        const cap = parts.slice(1).join('|').trim();
        if (cap && !/^\d+$/.test(cap)) caption = cap;
      }
    } else if (mdImgMatch) {
      imgSrc = mdImgMatch[2]; imgAlt = mdImgMatch[1]; caption = mdImgMatch[1];
    }
    if (imgSrc) {
      flushParagraph(); flushList(); flushQuote();
      output.push(makeImage(imgSrc, imgAlt, caption));
      continue;
    }

    const h1m = trimmed.match(/^# (.+)$/);
    const h2m = trimmed.match(/^## (.+)$/);
    const h3m = trimmed.match(/^### (.+)$/);

    let headingLevel = 0;
    let headingText = null;
    if (h1m) { headingLevel = 1; headingText = h1m[1]; }
    else if (h2m) { headingLevel = 2; headingText = h2m[1]; }
    else if (h3m) { headingLevel = 3; headingText = h3m[1]; }

    if (headingLevel > 0) {
      const effectiveLevel = headingLevel + headingOffset;
      flushParagraph(); flushList(); flushQuote();
      if (sectionMode && sectionLevel && effectiveLevel === sectionLevel) {
        // 章节容器模式：闭合上一个章节容器，再开启新容器（标题 HTML 交给 preset 决定放框内还是框外）
        let headingHtml;
        if (effectiveLevel <= 1) {
          headingHtml = makeBr() + makeH1(headingText) + makeBr();
        } else if (effectiveLevel === 2) {
          headingHtml = makeH2(headingText);
        } else {
          headingHtml = makeH3(headingText);
        }
        if (sectionOpen) {
          output.push(decos.closeSection(sectionIndex, effectiveLevel, STYLES));
        }
        sectionIndex++;
        output.push(decos.openSection(sectionIndex, effectiveLevel, headingText, headingHtml, parseInline, STYLES));
        sectionOpen = true;
      } else if (effectiveLevel <= 1) {
        output.push(makeBr());
        output.push(makeH1(headingText));
        output.push(makeBr());
      } else if (effectiveLevel === 2) {
        output.push(makeH2(headingText));
      } else if (effectiveLevel === 3) {
        output.push(makeH3(headingText));
      } else {
        output.push(makeH3(headingText));
      }
      continue;
    }

    const qm = trimmed.match(/^> ?(.*)$/);
    if (qm) {
      flushParagraph(); flushList();
      inQuote = true; quoteLines.push(qm[1]);
      continue;
    }

    const ulm = trimmed.match(/^[-*+] (.+)$/);
    if (ulm) {
      flushParagraph(); flushQuote();
      if (inList !== 'ul') { flushList(); inList = 'ul'; }
      listItems.push(ulm[1]);
      continue;
    }

    const olm = trimmed.match(/^\d+\. (.+)$/);
    if (olm) {
      flushParagraph(); flushQuote();
      if (inList !== 'ol') { flushList(); inList = 'ol'; }
      listItems.push(olm[1]);
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushParagraph(); flushList(); flushQuote();
      let code = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]); i++;
      }
      output.push(makeCodeBlock(code.join('\n')));
      continue;
    }

    flushList(); flushQuote();
    paragraphBuffer.push(trimmed);

    const next = lines[i + 1]?.trim() || '';
    if (next === '' || /^[-*+#>]/.test(next) || /^!\[/.test(next) || /^---+$/.test(next) || /^\d+\./.test(next) || /^```/.test(next)) {
      flushParagraph();
    }
  }

  flushParagraph(); flushList(); flushQuote();
  if (sectionOpen) {
    output.push(decos.closeSection(sectionIndex, sectionLevel, STYLES));
  }

  let inner = output.join('\n');
  if (beforeContentHtml) inner = beforeContentHtml + '\n' + inner;
  if (decos.afterContent) inner = inner + '\n' + decos.afterContent(STYLES);
  if (STYLES.outer) {
    return `<section style="${STYLES.outer}">\n${inner}\n</section>`;
  }
  return inner;
}

module.exports = { renderMarkdown };
