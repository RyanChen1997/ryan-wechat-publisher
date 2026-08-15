const STYLES = {
  h1_wrapper: 'position: relative; margin: 30px 8px 20px; height: 70px;',
  h1_arc_bg: 'position: absolute; left: -8px; bottom: 0; width: 200px; height: 50px; background-color: rgba(105, 130, 250, 0.12); border-radius: 100px 100px 0 0;',
  h1_num: 'position: absolute; left: 10px; bottom: -4px; font-size: 56px; font-weight: bold; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: rgb(180, 195, 255); letter-spacing: -2px; line-height: 1;',
  h1_star1: 'position: absolute; left: 180px; top: 2px; font-size: 18px; color: rgb(105, 130, 250); opacity: 0.7;',
  h1_star2: 'position: absolute; left: 20px; top: 12px; font-size: 10px; color: rgb(105, 130, 250); opacity: 0.5;',
  h1_star3: 'position: absolute; left: 165px; bottom: 20px; font-size: 8px; color: rgb(105, 130, 250); opacity: 0.6;',
  h1_text_outer: 'margin-left: 8px; margin-right: 8px; margin-bottom: 24px; line-height: 1.6em; text-align: left;',
  h1_text_span: 'font-size: 26px; letter-spacing: 2px; color: rgb(105, 130, 250); font-weight: bold;',

  // 二级标题
  h2_p: 'margin-left: 8px; margin-right: 8px; text-align: justify; margin-bottom: 24px; line-height: 1.6em;',
  h2_span: 'font-size: 18px; letter-spacing: 2px; color: rgb(47, 47, 47); font-weight: bold;',

  // 三级标题
  h3_p: 'margin-left: 8px; margin-right: 8px; text-align: justify; margin-bottom: 20px; line-height: 1.6em;',
  h3_span: 'font-size: 17px; letter-spacing: 1px; color: rgb(47, 47, 47); font-weight: bold;',

  // 正文段落
  p: 'margin-left: 8px; margin-right: 8px; text-align: justify; margin-bottom: 24px; line-height: 1.6em;',
  p_span: 'color: rgb(47, 47, 47); font-size: 16px; letter-spacing: 2px;',

  // 加粗
  strong_span: 'font-weight: bold; color: rgb(47, 47, 47);',

  // 行内代码
  code: 'background-color: rgb(245, 245, 245); padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Consolas, Monaco, monospace; color: rgb(105, 130, 250); letter-spacing: 0;',

  // 引用块
  quote_outer: 'margin-left: 8px; margin-right: 8px; margin-bottom: 24px; padding: 16px 20px; border-left: 4px solid rgb(105, 130, 250); background-color: rgb(245, 247, 255); line-height: 1.6em;',
  quote_span: 'color: rgb(60, 60, 60); font-size: 15px; letter-spacing: 1px;',

  // 列表
  ul_outer: 'margin-left: 8px; margin-right: 8px; margin-bottom: 24px;',
  li: 'margin-bottom: 12px; line-height: 1.6em;',
  li_bullet_text: 'margin-right: 10px; color: rgb(105, 130, 250);',
  li_bullet_char: '•',
  li_span: 'color: rgb(47, 47, 47); font-size: 16px; letter-spacing: 2px;',

  // 图片（圆角 12px）
  img_section: 'text-align: center; margin-bottom: 24px;',
  img: 'border-radius: 12px; background-color: transparent; width: 100%; height: auto !important;',

  // 图片说明
  caption_p: 'margin-left: 8px; margin-right: 8px; text-align: center; margin-bottom: 24px; line-height: 1.5em;',
  caption_span: 'color: rgb(140, 140, 140); font-size: 13px; letter-spacing: 1px;',
  caption: 'color: rgb(140, 140, 140); font-size: 13px; letter-spacing: 1px; text-align: center; margin: 8px 8px 24px 8px; line-height: 1.5em;',

  // 分割线
  hr_section: 'text-align: center; margin: 30px 0;',
  hr_line: 'display: inline-block; width: 40%; height: 1px; background-color: rgb(200, 200, 200);',

  // 代码块
  code_block: 'margin-left: 8px; margin-right: 8px; margin-bottom: 24px; background: rgb(245, 245, 245); padding: 16px; border-radius: 8px;',
  code_pre: 'margin: 0; font-size: 14px; font-family: Consolas, Monaco, monospace; color: rgb(60, 60, 60); white-space: pre-wrap; word-break: break-all; line-height: 1.6;',

  // 空行间距（段落用 margin-bottom，空行不额外生成）
  br_p: 'margin-left: 8px; margin-right: 8px; margin-bottom: 12px; line-height: 1.6em;',
};

const decorations = {
  makeH1(text, counter, parseInline, S) {
    const n = String(counter).padStart(2, '0');
    const inlineHtml = parseInline(text);
    return `<section style="${S.h1_wrapper}">
  <span style="${S.h1_arc_bg}"></span>
  <span style="${S.h1_num}">${n}</span>
  <span style="${S.h1_star1}">✦</span>
  <span style="${S.h1_star2}">✦</span>
  <span style="${S.h1_star3}">✧</span>
</section>
<section style="${S.h1_text_outer}">
  <span style="${S.h1_text_span}">${inlineHtml}</span>
</section>`;
  },

  makeH2(text, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<p style="${S.h2_p}">
  <span style="${S.h2_span}">${inlineHtml}</span>
</p>`;
  },

  makeH3(text, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<p style="${S.h3_p}">
  <span style="${S.h3_span}">${inlineHtml}</span>
</p>`;
  },

  makeParagraph(text, parseInline, S) {
    const inlineHtml = parseInline(text);
    return `<p style="${S.p}">
  <span style="${S.p_span}">${inlineHtml}</span>
</p>`;
  },

  makeBr(S) {
    return '';
  },

  makeImage(imgSrc, imgAlt, caption, useLocalPath, resolveImage, S) {
    const src = useLocalPath ? resolveImage(imgSrc) : imgSrc;
    const srcAttr = useLocalPath ? 'src' : 'data-src';
    let html = `<section style="${S.img_section}">
  <img ${srcAttr}="${src}" alt="${imgAlt}" style="${S.img}"/>
</section>`;
    if (caption) {
      html += `
<p style="${S.caption_p}">
  <span style="${S.caption_span}">${caption}</span>
</p>`;
    }
    return html;
  },

  parseInline(text, S) {
    // 链接：微信会过滤 <a>，转为「标题（URL）」纯文本展示
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, '$1（$2）');
    text = text.replace(/\*\*(.+?)\*\*/g,
      `<span style="${S.strong_span}">$1</span>`);
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      '<span style="font-style: italic;">$1</span>');
    text = text.replace(/`([^`]+)`/g,
      `<code style="${S.code}">$1</code>`);
    return text;
  },

  makeQuote(text, parseInline, S) {
    const inlineHtml = parseInline(text).replace(/\n/g, '<br/>');
    return `<section style="${S.quote_outer}">
  <span style="${S.quote_span}">${inlineHtml}</span>
</section>`;
  },

  makeHr(S) {
    return `<section style="${S.hr_section}">
  <span style="${S.hr_line}"></span>
</section>`;
  },
};

module.exports = {
  id: 'purple-badge',
  name: '蓝紫徽章',
  tagline: '蓝紫主色，数字徽章标题装饰，现代清新有呼吸感',
  description: '以蓝紫色为主色调，一级标题配数字徽章装饰图（渐变色星星点缀。大字号、大字间距、大段落间距，排版疏朗透气，有现代杂志感。图片圆角处理，整体气质年轻清新。',
  suitableFor: ['成长感悟', '心理情感', '生活方式', '个人提升', '女性向内容'],
  meta: {
    primaryColor: 'rgb(105, 130, 250)',
    bgColor: '#ffffff',
    textColor: 'rgb(47, 47, 47)',
  },
  STYLES,
  decorations,
};
