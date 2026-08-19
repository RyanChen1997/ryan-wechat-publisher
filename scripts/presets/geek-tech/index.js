const path = require('path');
const { DecoAssetManager } = require('../../utils/svg-to-png');
const { semanticAttributes } = require('../../utils/semantic-html');

const PRESET_DIR = __dirname;

const YELLOW_BAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 12" width="60" height="12">
  <rect x="0" y="2" width="60" height="8" fill="#fee2b9" rx="4" ry="4"/>
</svg>`;

const decoAssets = new DecoAssetManager(PRESET_DIR);

const STYLES = {
  outer: 'box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, \'PingFang SC\', \'Microsoft YaHei\', sans-serif; font-size: 16px; color: rgb(0, 0, 0); line-height: 1.6; text-align: justify; margin-left: 8px; margin-right: 8px;',

  h1_outer: 'font-family: -apple-system, BlinkMacSystemFont, \'PingFang SC\', \'Microsoft YaHei\', sans-serif; margin-top: 36px; margin-bottom: 0; padding-bottom: 0; text-align: center; display: block;',
  h1_num_section: 'text-align: center; line-height: 1;',
  h1_num_text: 'display: inline-block; font-size: 24px; letter-spacing: 0px; color: rgb(45, 113, 214); font-weight: bold; line-height: 1; font-style: italic; position: relative;',
  h1_bar_img: 'display: block; width: 40px; height: auto; margin: -4px auto 0;',
  h1_title_p: 'font-family: -apple-system, BlinkMacSystemFont, \'PingFang SC\', \'Microsoft YaHei\', sans-serif; margin: 8px 0 0; text-align: center;',
  h1_title_span: 'font-size: 17px; font-family: -apple-system, BlinkMacSystemFont, \'PingFang SC\', \'Microsoft YaHei\', sans-serif; text-align: center;',
  h1_title_strong: 'letter-spacing: 1px; color: rgba(0, 0, 0, 0.9); font-weight: bold; text-align: center;',
  h1_title_text: 'text-align: center;',

  h2: 'font-size: 17px; font-weight: bold; color: rgba(0, 0, 0, 0.9); text-align: center; margin: 36px 0 16px; letter-spacing: 1px;',

  h3: 'font-size: 16px; font-weight: bold; color: rgb(55, 84, 116); margin: 20px 0 10px;',

  p: 'margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: rgb(0, 0, 0); text-align: justify;',

  br_p: 'margin: 0; line-height: 1;',

  strong: 'font-weight: bold; color: rgb(55, 84, 116);',

  code: 'background-color: var(--weui-BG-3, rgb(245, 245, 245)); padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Consolas, Monaco, monospace; color: rgb(45, 113, 214);',

  quote_outer: 'border-left: 3px solid rgb(45, 113, 214); padding: 12px 20px; margin: 20px 0; background-color: var(--weui-BG-2, rgb(242, 247, 253));',
  quote_text: 'color: rgb(80, 80, 80); font-size: 15px; line-height: 1.6;',

  ul_outer: 'margin: 16px 0;',
  li: 'margin: 8px 0; line-height: 1.6; font-size: 16px;',
  li_bullet_text: 'margin-right: 10px; color: rgb(45, 113, 214);',
  li_bullet_char: '•',
  li_span: 'color: rgb(0, 0, 0);',

  img_section: 'margin: 24px 8px 16px; text-align: center;',
  img: 'display: block; width: 100%; max-width: 100%; vertical-align: bottom; box-sizing: border-box; margin: 0;',

  caption: 'font-size: 13px; color: #888; line-height: 1.5; text-align: center; margin: 8px 0 16px;',

  hr_section: 'text-align: center; margin: 28px 0;',
  hr_line: 'display: inline-block; width: 40%; height: 1px; background: rgb(220, 220, 220);',

  code_block: 'margin: 16px 0; background: var(--weui-BG-3, rgb(245, 245, 245)); padding: 16px; border-radius: 4px; overflow-x: auto;',
  code_pre: 'margin: 0; font-size: 13px; font-family: Consolas, Monaco, monospace; color: rgb(60, 60, 60); white-space: pre-wrap; word-break: break-all; line-height: 1.5;',
};

let useLocalPath = false;

function decoImgSrc(svg, name, width) {
  return decoAssets.get(svg, name, width);
}

function imgAttr(src) {
  const attr = useLocalPath ? 'src' : 'data-src';
  return `${attr}="${src}"`;
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

const decorations = {
  setAssetDir(dir, useLocal, context = {}) {
    useLocalPath = useLocal;
    decoAssets.setOutput({ outputDir: dir, useLocalPath: useLocal, urlPrefix: context.assetUrlPrefix });
  },

  makeH1(text, counter, parseInline, S) {
    const inlineHtml = parseInline(text);
    const num = pad2(counter);
    const barSrc = decoImgSrc(YELLOW_BAR_SVG, 'yellow-bar', 80);

    return `<section ${semanticAttributes(text, 'heading-1')} style="${S.h1_outer}">
  <section style="${S.h1_num_section}">
    <span style="${S.h1_num_text}">${num}</span>
    <img ${imgAttr(barSrc)} alt="" style="${S.h1_bar_img}"/>
  </section>
  <p style="${S.h1_title_p}"><span style="${S.h1_title_span}"><strong style="${S.h1_title_strong}"><span style="${S.h1_title_text}">${inlineHtml}</span></strong></span></p>
</section>`;
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
      html += `\n<p style="${S.caption}">${caption}</p>`;
    }
    return html;
  },

  parseInline(text, S) {
    text = text.replace(/\*\*(.+?)\*\*/g,
      `<span style="${S.strong}">$1</span>`);
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      '<span style="font-style: italic;">$1</span>');
    text = text.replace(/`([^`]+)`/g,
      `<code style="${S.code}">$1</code>`);
    return text;
  },

  makeQuote(text, parseInline, S) {
    const inlineHtml = parseInline(text).replace(/\n/g, '<br/>');
    return `<section style="${S.quote_outer}">
  <span style="${S.quote_text}">${inlineHtml}</span>
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
};

module.exports = {
  id: 'geek-tech',
  name: '极客科技',
  tagline: '蓝色数字编号 + 黄色装饰条 + 居中标题，科技媒体风',
  description: '复刻自科技媒体公众号风格。居中一级标题配蓝色大号数字编号和黄色装饰条，正文两端对齐，加粗文字深蓝灰色，简约专业有辨识度，适合科技资讯和职场干货类内容。',
  suitableFor: ['科技资讯', '职场干货', '行业分析', '产品解读', 'AI 工具'],
  meta: {
    primaryColor: 'rgb(45, 113, 214)',
    accentColor: '#fee2b9',
    bgColor: '#ffffff',
    textColor: 'rgb(0, 0, 0)',
    darkMode: 'weui-var', // 页面透明（夜间自动原生黑底）；引用 --weui-BG-2，代码 --weui-BG-3；蓝色强调色保留
  },
  STYLES,
  decorations,
};
