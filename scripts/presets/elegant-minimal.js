const STYLES = {
  outer: '-webkit-tap-highlight-color: rgba(0, 0, 0, 0); margin: 0px; padding: 0px; outline: 0px; max-width: 100%; box-sizing: border-box; overflow-wrap: break-word; color: rgba(0, 0, 0, 0.9); font-family: "PingFang SC NEW", system-ui, -apple-system, "system-ui", "Helvetica Neue", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif; font-size: 15px; font-style: normal; font-weight: 400; letter-spacing: 0.544px; orphans: 2; text-align: justify; text-indent: 0px; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; white-space: normal; background-color: rgb(255, 255, 255);',

  h1_decoration_outer: 'margin: 28px 0 8px; box-sizing: border-box; text-align: center;',
  h1_decoration: 'font-size: 17px; color: rgba(0, 0, 0, 0.9); margin: 0; padding: 0;',
  h1_outer: 'margin: 0 0 8px; box-sizing: border-box; text-align: center;',
  h1: 'font-size: 20px; line-height: 1.5; font-weight: bold; color: rgba(0, 0, 0, 0.9); margin: 0; padding: 0; box-sizing: border-box;',

  h2: 'font-size: 17px; line-height: 1.6; font-weight: bold; text-align: justify; color: rgba(0, 0, 0, 0.9); margin: 28px 0 12px; box-sizing: border-box;',

  h3: 'font-size: 15px; line-height: 1.6; font-weight: bold; text-align: justify; color: rgba(0, 0, 0, 0.85); margin: 20px 0 10px; box-sizing: border-box;',

  p: 'margin: 0; padding: 0 8px; box-sizing: border-box; line-height: 2em; text-align: justify; color: rgb(102, 102, 102); font-size: 15px;',

  br_p: 'margin: 0; padding: 0; box-sizing: border-box; line-height: 16px;',

  strong: 'color: rgba(0, 0, 0, 0.9); font-weight: bold;',

  code: 'background-color: rgb(245, 245, 245); padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Consolas, Monaco, monospace; color: rgb(180, 80, 40);',

  quote_outer: 'border-left: 2px solid rgb(61, 170, 214); padding: 12px 20px; margin: 20px 8px; background-color: rgb(248, 252, 255);',
  quote_text: 'color: rgb(102, 102, 102); font-size: 14px; line-height: 1.8;',

  ul_outer: 'margin: 16px 8px;',
  li: 'margin: 8px 0; line-height: 2em; color: rgb(102, 102, 102); font-size: 15px;',
  li_bullet_text: 'margin-right: 10px; color: rgba(0, 0, 0, 0.5);',
  li_bullet_char: '•',
  li_span: 'color: rgb(102, 102, 102);',

  img_section: 'text-align: center; margin: 16px 0; box-sizing: border-box;',
  img: 'vertical-align: middle; max-width: 100%; width: 100%; height: auto; box-sizing: border-box;',

  caption: 'font-size: 12px; color: rgb(136, 136, 136); line-height: 1.5; text-align: center; margin: 8px 0 20px;',

  hr_section: 'text-align: center; margin: 30px 0;',
  hr_line: 'display: inline-block; width: 30px; height: 1px; background-color: rgb(200, 200, 200);',

  code_block: 'margin: 16px 8px; background: rgb(245, 245, 245); padding: 16px; border-radius: 4px; overflow-x: auto;',
  code_pre: 'margin: 0; font-size: 13px; font-family: Consolas, Monaco, monospace; color: rgb(80, 80, 80); white-space: pre-wrap; word-break: break-all; line-height: 1.6;',
};

const decorations = {
  makeH1(text, counter, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<section style="${S.h1_decoration_outer}">
  <p style="${S.h1_decoration}"><span style="letter-spacing: 2px;">○●</span></p>
</section>
<section style="${S.h1_outer}">
  <p style="${S.h1}">${inlineHtml}</p>
</section>`;
  },

  makeH2(text, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<p style="${S.h2}">${inlineHtml}</p>`;
  },

  makeH3(text, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<p style="${S.h3}">${inlineHtml}</p>`;
  },

  makeParagraph(text, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<p style="${S.p}">${inlineHtml}</p>`;
  },

  makeBr(S) {
    return `<p style="${S.br_p}"><br></p>`;
  },

  makeImage(imgSrc, imgAlt, caption, useLocalPath, resolveImage, S) {
    const src = useLocalPath ? resolveImage(imgSrc) : imgSrc;
    const srcAttr = useLocalPath ? 'src' : 'data-src';
    let html = `<section style="${S.img_section}">
  <img ${srcAttr}="${src}" alt="${imgAlt}" style="${S.img}"/>
</section>`;
    if (caption) {
      html += `<p style="${S.caption}">${caption}</p>`;
    }
    return html;
  },

  parseInline(text, S) {
    text = text.replace(/\*\*(.+?)\*\*/g,
      `<strong style="${S.strong}">$1</strong>`);
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      '<em style="font-style: italic;">$1</em>');
    text = text.replace(/`([^`]+)`/g,
      `<code style="${S.code}">$1</code>`);
    return text;
  },

  makeQuote(text, parseInline, S) {
    const inlineHtml = parseInline(text).replace(/\n/g, '<br/>');
    return `<section style="${S.quote_outer}">
  <p style="${S.quote_text}">${inlineHtml}</p>
</section>`;
  },

  makeUl(items, parseInline, S) {
    let inner = '';
    items.forEach(item => {
      const html = parseInline(item);
      const bulletChar = S.li_bullet_char || '•';
      inner += `<section style="${S.li}">
  <span style="${S.li_bullet_text}">${bulletChar}</span><span style="${S.li_span}">${html}</span>
</section>\n`;
    });
    return `<section style="${S.ul_outer}">\n${inner}</section>`;
  },

  makeHr(S) {
    return `<section style="${S.hr_section}">
  <span style="${S.hr_line}"></span>
</section>`;
  },

  makeCodeBlock(code, S) {
    return `<section style="${S.code_block}">
  <pre style="${S.code_pre}"><code>${code}</code></pre>
</section>`;
  },
};

module.exports = {
  id: 'elegant-minimal',
  name: '极简雅致',
  tagline: '灰白极简风格，双圆点标题装饰，大行距两端对齐，雅致克制',
  description: '灰白主色调的极简排版。一级标题居中，上方配有 ○● 双圆点符号装饰；灰色正文 2em 大行距两端对齐，阅读呼吸感强。整体气质雅致克制，留白充分。',
  suitableFor: ['设计美学', '成长感悟', '生活方式', '知识分享', '职场思考'],
  meta: {
    primaryColor: 'rgba(0, 0, 0, 0.9)',
    accentColor: 'rgb(61, 170, 214)',
    bgColor: '#ffffff',
    textColor: 'rgb(102, 102, 102)',
  },
  STYLES,
  decorations,
};
