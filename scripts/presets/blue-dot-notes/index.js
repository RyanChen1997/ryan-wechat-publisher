const STYLES = {
  outer: 'font-size: 15px; line-height: 1.93; box-sizing: border-box; font-style: normal; font-weight: 400; text-align: justify; color: rgb(62, 62, 62);',

  // 一级标题（带蓝色圆点）
  h1_dot_col: 'margin: 0px; width: 100%; box-sizing: border-box;',
  h1_dot: 'display: inline-block; width: 22px; height: 22px; vertical-align: top; overflow: hidden; background-color: rgb(2, 183, 237); border-style: solid; border-width: 2px; border-color: rgba(247, 247, 247, 0.8); border-radius: 15px; box-shadow: rgba(255, 255, 255, 0.5) 0px 0px 0px 2px inset; margin: 0px; line-height: 0; box-sizing: border-box;',
  h1_text_outer: 'margin: 0px; box-sizing: border-box;',
  h1_text: 'font-size: 22px; line-height: 1.5; box-sizing: border-box;',
  h1_text_p: 'white-space: normal; margin: 0px; padding: 0px; box-sizing: border-box;',
  h1_text_strong: 'box-sizing: border-box;',
  h1_text_span: 'box-sizing: border-box;',
  h1_flex: 'text-align: left; justify-content: flex-start; display: flex; flex-flow: row; width: 100%; box-sizing: border-box;',

  // 二级标题
  h2: 'font-size: 18px; line-height: 1.6; font-weight: bold; text-align: justify; color: rgb(50, 50, 50); margin: 28px 0 14px;',

  // 三级标题
  h3: 'font-size: 16px; line-height: 1.6; font-weight: bold; text-align: justify; color: rgb(62, 62, 62); margin: 20px 0 10px;',

  // 正文段落
  p_section: 'box-sizing: border-box;',
  p: 'margin: 0px; padding: 0px; box-sizing: border-box;',
  p_span: 'box-sizing: border-box;',

  // 空行（段落间距）
  br_section: 'box-sizing: border-box;',
  br_p: 'margin: 0px; padding: 0px; box-sizing: border-box;',
  br_span: 'box-sizing: border-box;',

  // 加粗
  strong: 'box-sizing: border-box;',
  strong_span: 'box-sizing: border-box;',

  // 行内代码
  code: 'background-color: var(--weui-BG-3, rgb(245, 245, 245)); padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Consolas, Monaco, monospace; color: rgb(180, 80, 40);',

  // 引用块
  quote_outer: 'border-left: 3px solid rgb(2, 183, 237); padding: 12px 20px; margin: 20px 0; background-color: var(--weui-BG-2, rgb(248, 252, 255));',
  quote_p: 'margin: 0; color: rgb(80, 80, 80); font-size: 14px; line-height: 1.8;',
  quote_text: 'color: rgb(80, 80, 80); font-size: 14px; line-height: 1.8;',

  // 列表
  ul_outer: 'margin: 16px 0;',
  li: 'margin: 8px 0; line-height: 1.93;',
  li_bullet_text: 'margin-right: 10px; color: rgb(2, 183, 237);',
  li_bullet_char: '•',
  li_span: 'color: rgb(62, 62, 62);',

  // 图片
  img_section: 'text-align: center; line-height: 0; margin: 0px 0px 10px; box-sizing: border-box;',
  img_wrapper: 'max-width: 100%; vertical-align: middle; display: inline-block; line-height: 0; box-sizing: border-box;',
  img: 'vertical-align: middle; max-width: 100%; width: 100%; box-sizing: border-box;',

  // 图片说明
  caption_outer: 'text-align: left; margin: 10px 0px 0px; box-sizing: border-box;',
  caption_text: 'font-size: 12px; color: rgb(121, 121, 121); line-height: 1.5;',
  caption: 'font-size: 12px; color: rgb(121, 121, 121); line-height: 1.5; text-align: left; margin: 10px 0 20px;',

  // 分割线
  hr: 'border: none; height: 1px; background-color: rgb(220, 220, 220); margin: 30px 0;',

  // 代码块
  code_block: 'margin: 16px 0; background: var(--weui-BG-3, rgb(245, 245, 245)); padding: 16px; border-radius: 4px; overflow-x: auto;',
  code_pre: 'margin: 0; font-size: 13px; font-family: Consolas, Monaco, monospace; color: rgb(60, 60, 60); white-space: pre-wrap; word-break: break-all; line-height: 1.5;',
};

const decorations = {
  makeH1(text, counter, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<section style="${S.h1_flex}">
  <section style="${S.h1_dot_col}">
    <section style="${S.h1_dot}"></section>
  </section>
</section>
<section style="${S.h1_text_outer}">
  <section style="${S.h1_text}">
    <p style="${S.h1_text_p}"><strong style="${S.h1_text_strong}"><span style="${S.h1_text_span}">${inlineHtml}</span></strong></p>
  </section>
</section>`;
  },

  makeParagraph(text, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<section style="${S.p_section}">
  <p style="${S.p}"><span style="${S.p_span}">${inlineHtml}</span></p>
</section>`;
  },

  makeBr(S) {
    return `<section style="${S.br_section}">
  <p style="${S.br_p}"><span style="${S.br_span}"><br></span></p>
</section>`;
  },

  makeImage(imgSrc, imgAlt, caption, useLocalPath, resolveImage, S) {
    const src = useLocalPath ? resolveImage(imgSrc) : imgSrc;
    const srcAttr = useLocalPath ? 'src' : 'data-src';
    let html = `<section style="${S.img_section}">
  <section style="${S.img_wrapper}">
    <img ${srcAttr}="${src}" alt="${imgAlt}" style="${S.img}"/>
  </section>
</section>`;
    if (caption) {
      html += `<p style="${S.caption}">${caption}</p>`;
    }
    return html;
  },

  parseInline(text, S) {
    text = text.replace(/\*\*(.+?)\*\*/g,
      `<strong style="${S.strong}"><span style="${S.strong_span}">$1</span></strong>`);
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      '<em style="font-style: italic;">$1</em>');
    text = text.replace(/`([^`]+)`/g,
      `<code style="${S.code}">$1</code>`);
    return text;
  },

  makeQuote(text, parseInline, S) {
    const inlineHtml = parseInline(text).replace(/\n/g, '<br/>');
    return `<section style="${S.quote_outer}">
  <p style="${S.quote_p}">${inlineHtml}</p>
</section>`;
  },
};

module.exports = {
  id: 'blue-dot-notes',
  name: '蓝点笔记',
  tagline: '清爽蓝白配色，蓝色圆点装饰标题，简约克制',
  description: '以蓝色小圆点为视觉标识的极简风格。白底深灰字，两端对齐大行距，阅读体验舒适。蓝色作为点缀色出现在标题、引用、列表符号等处，统一而不单调。',
  suitableFor: ['职场干货', '方法论', '科技科普', '工具测评', '效率提升'],
  meta: {
    primaryColor: 'rgb(2, 183, 237)',
    bgColor: '#ffffff',
    textColor: 'rgb(62, 62, 62)',
    darkMode: 'weui-var', // 页面透明（夜间自动原生黑底）；引用 --weui-BG-2，代码 --weui-BG-3；青色点缀保留
  },
  STYLES,
  decorations,
};
