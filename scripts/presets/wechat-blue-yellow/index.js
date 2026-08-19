const STYLES = {
  // 夜间模式说明：页面底色/色块用微信 CSS 变量（--weui-BG-1 页面 / --weui-BG-2 卡片 / --weui-BG-3 代码），
  // fallback 为白天色（本地预览可见）；夜间微信自动换成原生深色（#1E1E1E / #191919 / #404040），避免 mp-darkmode 反色算法把浅色块映射成深浅不一的中灰马赛克。
  outer: 'background-color: var(--weui-BG-1, rgb(247, 249, 252)); box-sizing: border-box; font-style: normal; font-weight: 400; text-align: justify; font-size: 15px; line-height: 2; color: rgb(62, 62, 62); letter-spacing: 0.3px; padding: 24px 0 32px;',

  // 顶部引言区：虚线框（对应模板文章头部的虚线框）
  intro_box: 'width: 94%; margin: 0 auto 20px; padding: 18px 20px 8px; box-sizing: border-box; border-style: dashed; border-width: 1px; border-color: rgb(0, 95, 199); background-color: var(--weui-BG-2, rgba(255, 255, 255, 0.45));',

  // 章节容器框型（对应模板中不同章节的不同框）
  box_white: 'width: 94%; margin: 0 auto 22px; padding: 20px 18px 12px; box-sizing: border-box; background-color: var(--weui-BG-2, rgb(255, 255, 255)); border-style: solid; border-width: 1px; border-color: rgb(0, 95, 199);',
  box_glass: 'width: 94%; margin: 0 auto 22px; padding: 20px 18px 12px; box-sizing: border-box; background-color: var(--weui-BG-2, rgba(255, 255, 255, 0.2)); border-style: solid; border-width: 1px; border-color: rgb(0, 95, 199);',
  box_tail: 'width: 94%; margin: 0 auto 22px; padding: 20px 18px 10px; box-sizing: border-box; background-color: var(--weui-BG-2, rgb(247, 251, 255)); border-radius: 8px;',
  box_plain: 'width: 94%; margin: 0 auto 22px; padding: 0 18px; box-sizing: border-box;',

  // 章节标题：深蓝色块 + 白字 + 右侧黄色边条（所有章节统一，居中）
  h2_outer: 'text-align: center; margin: 0 0 14px; box-sizing: border-box;',
  h2_label: 'display: inline-block; max-width: 82%; vertical-align: top; background-color: rgb(0, 95, 199); padding: 5px 12px; border-right: 5px solid rgb(251, 197, 24); box-sizing: border-box;',
  h2_text: 'font-size: 18px; line-height: 1.5; font-weight: bold; color: rgb(255, 255, 255); letter-spacing: 0.5px;',

  // 参考资料标题（无框章节）
  ref_title: 'font-size: 16px; font-weight: bold; color: rgb(0, 95, 199); margin: 0 0 10px;',

  h3: 'font-size: 17px; line-height: 1.6; font-weight: bold; color: rgb(0, 95, 199); margin: 20px 0 10px; padding: 3px 10px; border-left: 4px solid rgb(251, 197, 24); background-color: var(--weui-BG-2, rgb(231, 244, 255)); box-sizing: border-box;',

  p_section: 'box-sizing: border-box; margin: 0 0 10px; padding: 0;',
  p: 'text-indent: 2em; white-space: normal; margin: 0; padding: 0; box-sizing: border-box; font-size: 15px; line-height: 2; text-align: justify; color: rgb(62, 62, 62);',
  p_span: 'box-sizing: border-box;',

  br_section: 'box-sizing: border-box; height: 6px;',
  br_p: 'margin: 0; padding: 0; height: 6px; line-height: 1; box-sizing: border-box;',
  br_span: 'box-sizing: border-box;',

  strong: 'color: rgb(0, 95, 199); font-weight: bold;',
  strong_span: 'box-sizing: border-box;',
  code: 'background-color: var(--weui-BG-3, rgb(231, 244, 255)); padding: 2px 6px; border-radius: 2px; font-size: 14px; font-family: Consolas, Monaco, monospace; color: rgb(0, 95, 199);',

  quote_outer: 'border-left: 3px solid rgb(0, 95, 199); padding: 12px 16px; margin: 14px 0; background-color: var(--weui-BG-2, rgb(247, 251, 255)); box-sizing: border-box;',
  quote_p: 'margin: 0; padding: 0; color: rgb(62, 62, 62); font-size: 14px; line-height: 1.9; text-align: justify;',
  quote_text: 'color: rgb(62, 62, 62); font-size: 14px; line-height: 1.9;',

  ul_outer: 'margin: 10px 0 14px; padding: 8px 12px; background-color: var(--weui-BG-2, rgb(247, 251, 255)); box-sizing: border-box;',
  li: 'margin: 4px 0; line-height: 2; font-size: 15px; text-align: justify;',
  li_bullet_text: 'margin-right: 8px; color: rgb(251, 197, 24); font-weight: bold;',
  li_bullet_char: '▪',
  li_span: 'color: rgb(62, 62, 62);',

  img_section: 'text-align: center; line-height: 0; margin: 16px 0 18px; padding: 0; box-sizing: border-box;',
  img_wrapper: 'max-width: 100%; vertical-align: middle; display: inline-block; line-height: 0; box-sizing: border-box;',
  img: 'vertical-align: middle; max-width: 100%; width: 100%; height: auto; box-sizing: border-box;',
  caption: 'font-size: 13px; color: rgb(98, 126, 160); line-height: 1.6; text-align: center; margin: 6px 0 14px;',

  hr_section: 'text-align: center; margin: 24px 0; box-sizing: border-box;',
  hr_line: 'display: inline-block; width: 40%; height: 1px; background-color: rgb(0, 95, 199);',

  code_block: 'margin: 16px 0; background-color: var(--weui-BG-3, rgb(247, 251, 255)); border: 1px solid rgb(188, 220, 248); padding: 14px; border-radius: 0; overflow-x: auto; box-sizing: border-box;',
  code_pre: 'margin: 0; font-size: 13px; font-family: Consolas, Monaco, monospace; color: rgb(62, 62, 62); white-space: pre-wrap; word-break: break-word; line-height: 1.6;',
};

const decorations = {
  sectionHeadingLevel: 2,

  beforeContent(S) {
    // 外层浅蓝灰背景 + 顶部引言虚线框
    return `<section style="${S.outer}">\n<section style="${S.intro_box}">`;
  },

  afterContent() {
    return '</section>';
  },

  // 章节容器：每个一级章节一个独立框，不同章节不同框型
  openSection(index, level, text, headingHtml, parseInline, S) {
    let html = '';
    if (index === 1) html += '</section>'; // 闭合顶部引言虚线框
    const t = parseInline(text);
    if (index === 1 || index === 2) {
      // 白色实线框，深蓝标题块在框外
      return html + headingHtml + `<section style="${S.box_white}">`;
    } else if (index === 3 || index === 4) {
      // 半透明白实线框，深蓝标题块在框外
      return html + headingHtml + `<section style="${S.box_glass}">`;
    } else if (index === 5) {
      // 结尾：浅蓝圆角块，深蓝标题块在框外
      return html + headingHtml + `<section style="${S.box_tail}">`;
    }
    // 其余（参考资料）：无框，小号标题
    return html + `<section style="${S.box_plain}"><p style="${S.ref_title}">${t}</p>`;
  },

  closeSection(index, level, S) {
    return '</section>';
  },

  makeH1(text, counter, parseInline, S) {
    const html = parseInline(text);
    return `<section style="${S.h1}"><p style="margin:0;padding:0;text-align:center;"><strong style="${S.strong}"><span style="${S.strong_span}">${html}</span></strong></p></section>`;
  },

  makeH2(text, parseInline, S) {
    // 章节标题基础 HTML（openSection 决定放框内还是被胶囊替代）
    const html = parseInline(text);
    return `<section style="${S.h2_outer}"><section style="${S.h2_label}"><p style="margin:0;padding:0;text-align:left;"><span style="${S.h2_text}">${html}</span></p></section></section>`;
  },

  makeH3(text, parseInline, S) {
    const html = parseInline(text);
    return `<section style="${S.h3}"><p style="margin:0;padding:0;"><span style="${S.strong}">${html}</span></p></section>`;
  },

  makeParagraph(text, parseInline, S) {
    const html = parseInline(text);
    return `<section style="${S.p_section}"><p style="${S.p}"><span style="${S.p_span}">${html}</span></p></section>`;
  },

  makeBr(S) {
    return `<section style="${S.br_section}"><p style="${S.br_p}"><span style="${S.br_span}"><br></span></p></section>`;
  },

  makeImage(imgSrc, imgAlt, caption, useLocalPath, resolveImage, S) {
    const src = useLocalPath ? resolveImage(imgSrc) : imgSrc;
    const srcAttr = useLocalPath ? 'src' : 'data-src';
    let html = `<section style="${S.img_section}"><section style="${S.img_wrapper}"><img ${srcAttr}="${src}" alt="${imgAlt}" style="${S.img}"/></section></section>`;
    if (caption) html += `<p style="${S.caption}">${caption}</p>`;
    return html;
  },

  parseInline(text, S) {
    // 微信不支持正文超链接（<a> 会被过滤成纯文字），链接改为「标题 + 小字 URL」两行纯文本展示
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span style="color: rgb(62, 62, 62);">$1</span><br/><span style="color: rgb(98, 126, 160); font-size: 13px; word-break: break-all;">$2</span>');
    text = text.replace(/\*\*(.+?)\*\*/g, `<strong style="${S.strong}"><span style="${S.strong_span}">$1</span></strong>`);
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');
    text = text.replace(/`([^`]+)`/g, `<code style="${S.code}">$1</code>`);
    return text;
  },

  makeQuote(text, parseInline, S) {
    const html = parseInline(text).replace(/\n/g, '<br/>');
    return `<section style="${S.quote_outer}"><p style="${S.quote_p}">${html}</p></section>`;
  },

  makeUl(items, parseInline, S) {
    let inner = '';
    items.forEach(item => {
      const html = parseInline(item);
      inner += `<section style="${S.li}"><span style="${S.li_bullet_text}display:inline-block;width:6px;height:6px;border-radius:50%;background-color:rgb(251, 197, 24);vertical-align:middle;"></span><span style="${S.li_span}">${html}</span></section>`;
    });
    return `<section style="${S.ul_outer}">${inner}</section>`;
  },

  makeHr(S) {
    return `<section style="${S.hr_section}"><span style="${S.hr_line}"></span></section>`;
  },
};

module.exports = {
  id: 'wechat-blue-yellow',
  name: '公众号蓝黄线框',
  tagline: '浅蓝灰底 + 章节独立框 + 蓝黄标签',
  description: '根据参考公众号文章复刻：浅蓝灰背景，引言虚线框，每个一级章节独立成框（白色实线框 / 半透明白实线框 / 浅蓝圆角块交替），深蓝标题块配黄色边条或渐变胶囊标题，正文首行缩进和两端对齐。',
  suitableFor: ['AI 工具', '科技科普', '职场干货', '方法论'],
  meta: {
    primaryColor: 'rgb(0, 95, 199)',
    accentColor: 'rgb(251, 197, 24)',
    bgColor: 'rgb(247, 249, 252)',
    textColor: 'rgb(62, 62, 62)',
    darkMode: 'weui-var', // 页面底色 --weui-BG-1，卡片/引用/列表 --weui-BG-2，代码 --weui-BG-3；蓝黄强调色保留
  },
  STYLES,
  decorations,
};
