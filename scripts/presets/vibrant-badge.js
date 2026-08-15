const path = require('path');
const { DecoAssetManager } = require('../utils/svg-to-png');

const PRESET_DIR = __dirname;

const SPIRAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 49.5 23" width="49.5" height="23">
  <path d="M39.5.5a10,10,0,1,1-10,10A10,10,0,0,1,39.5.5Z" style="fill: #f5f5f5;"/>
  <path d="M35.7,4.93c3,1.76,4.8,4.05,4.8,6.57A5.57,5.57,0,0,1,40.28,13C38.86,17.81,30.77,21.5,21,21.5,10.23,21.5,1.5,17,1.5,11.5s8.73-10,19.5-10" style="fill: none; stroke: #1266be; stroke-width: 3px;"/>
</svg>`;

const MAGNIFIER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="216" cy="216" r="150" fill="none" stroke="#cccccc" stroke-width="24"/>
  <line x1="322" y1="322" x2="460" y2="460" stroke="#888888" stroke-width="24" stroke-linecap="round"/>
  <circle cx="216" cy="216" r="60" fill="none" stroke="#1266be" stroke-width="12"/>
</svg>`;

const decoAssets = new DecoAssetManager(PRESET_DIR);

const STYLES = {
  outer: 'background-color: rgb(245, 245, 245); padding: 20px 0; box-sizing: border-box; font-size: 15px; color: #333333; line-height: 1.75;',

  h1_container: 'margin: 30px auto 20px; display: flex; justify-content: center; align-items: center;',
  h1_inner: 'display: flex; flex-direction: column; align-items: flex-start;',
  h1_badge_row: 'display: flex; align-items: center; margin-bottom: -8px; position: relative;',
  h1_badge: 'background-color: #e36c09; padding: 8px 22px; box-sizing: border-box; transform: rotate(-3deg); -webkit-transform: rotate(-3deg);',
  h1_badge_text: 'font-size: 16px; color: #ffffff; font-weight: bold; letter-spacing: 1px;',
  h1_title_row: 'display: flex; align-items: center; margin-left: 30px;',
  h1_magnifier: 'width: 42px; height: 42px; margin-right: -10px; position: relative; flex-shrink: 0;',
  h1_magnifier_img: 'display: block; width: 100%; height: 100%;',
  h1_title_bg: 'background-color: #1266be; padding: 10px 24px; box-sizing: border-box;',
  h1_title_text: 'font-size: 16px; color: #ffffff; font-weight: bold; letter-spacing: 2px;',

  card_outer: 'width: 92%; margin: 0 auto 20px; box-sizing: border-box; display: flex;',
  card_left_deco: 'flex-shrink: 0; display: flex; flex-direction: column; justify-content: space-around; width: 28px; margin-right: -14px; position: relative; padding: 15px 0;',
  card_spiral_img: 'display: block; width: 28px; height: auto;',
  card_body: 'flex: 1; background-color: #ffffff; border-radius: 10px; box-sizing: border-box; padding: 16px 20px 16px 30px;',

  h2: 'font-size: 15px; font-weight: bold; color: #1266be; margin: 16px 0 10px; line-height: 2;',

  h3: 'font-size: 15px; font-weight: bold; color: #e36c09; margin: 14px 0 8px; line-height: 2;',

  p: 'margin: 0 0 14px; font-size: 15px; line-height: 2; color: #333333; letter-spacing: 1.5px; text-align: justify;',

  br_p: 'margin: 0; line-height: 1;',

  strong: 'color: #1266be; font-weight: bold;',

  code: 'background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Consolas, Monaco, monospace; color: #e36c09;',

  quote_outer: 'border-left: 4px solid #1266be; padding: 12px 20px; margin: 14px 0; background-color: #f0f6fc; border-radius: 0 8px 8px 0;',
  quote_text: 'color: #555; font-size: 14px; line-height: 1.8; letter-spacing: 1px;',

  ul_outer: 'margin: 14px 0;',
  li: 'margin: 8px 0; line-height: 1.8; font-size: 15px;',
  li_bullet_text: 'margin-right: 8px; color: #1266be;',
  li_bullet_char: '•',
  li_span: 'color: #333333;',

  img_section: 'text-align: center; margin: 14px 0;',
  img: 'max-width: 100%; height: auto; border-radius: 8px;',

  caption: 'font-size: 13px; color: #888; line-height: 1.5; text-align: center; margin: 6px 0 14px;',

  hr_section: 'text-align: center; margin: 24px 0;',
  hr_line: 'display: inline-block; width: 30%; height: 2px; background: linear-gradient(to right, transparent, #1266be, transparent);',

  code_block: 'margin: 14px 0; background: #f5f5f5; padding: 14px; border-radius: 6px; overflow-x: auto;',
  code_pre: 'margin: 0; font-size: 13px; font-family: Consolas, Monaco, monospace; color: #444; white-space: pre-wrap; word-break: break-all; line-height: 1.6;',
};

let useLocalPath = false;

function decoImgSrc(svg, name, width) {
  return decoAssets.get(svg, name, width);
}

function imgAttr(src) {
  const attr = useLocalPath ? 'src' : 'data-src';
  return `${attr}="${src}"`;
}

function cardOpen(S) {
  const spiralSrc = decoImgSrc(SPIRAL_SVG, 'spiral', 112);
  const spiral = `<img ${imgAttr(spiralSrc)} alt="" style="${S.card_spiral_img}"/>`;
  return `<section style="${S.card_outer}">
  <section style="${S.card_left_deco}">
    ${spiral}
    ${spiral}
    ${spiral}
  </section>
  <section style="${S.card_body}">`;
}

function cardClose() {
  return `  </section>
</section>`;
}

const decorations = (() => {
  let cardOpened = false;

  function ensureCardOpen(S) {
    if (!cardOpened) {
      cardOpened = true;
      return cardOpen(S);
    }
    return '';
  }

  return {
    setAssetDir(dir, useLocal) {
      useLocalPath = useLocal;
      decoAssets.setOutput(dir, useLocal);
    },

    beforeContent() {
      cardOpened = false;
      return '';
    },

    afterContent() {
      if (cardOpened) {
        cardOpened = false;
        return cardClose();
      }
      return '';
    },

    makeH1(text, counter, parseInline, S) {
      const inlineHtml = parseInline(text);
      const magSrc = decoImgSrc(MAGNIFIER_SVG, 'magnifier', 168);
      const magnifier = `<section style="${S.h1_magnifier}"><img ${imgAttr(magSrc)} alt="" style="${S.h1_magnifier_img}"/></section>`;
      const headingHtml = `<section style="${S.h1_container}">
  <section style="${S.h1_inner}">
    <section style="${S.h1_badge_row}">
      <section style="${S.h1_badge}">
        <span style="${S.h1_badge_text}">PART.${counter}</span>
      </section>
    </section>
    <section style="${S.h1_title_row}">
      ${magnifier}
      <section style="${S.h1_title_bg}">
        <span style="${S.h1_title_text}">${inlineHtml}</span>
      </section>
    </section>
  </section>
</section>`;
      let result = '';
      if (cardOpened) {
        result += cardClose() + '\n';
      }
      result += headingHtml + '\n' + cardOpen(S);
      cardOpened = true;
      return result;
    },

    makeParagraph(text, parseInline, S) {
      const inlineHtml = parseInline(text);
      return ensureCardOpen(S) + `<p style="${S.p}">${inlineHtml}</p>`;
    },

    makeBr(S) {
      if (!cardOpened) return '';
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
      return ensureCardOpen(S) + html;
    },

    parseInline(text, S) {
      // 链接：微信会过滤 <a>，转为「标题（URL）」纯文本展示
      text = text.replace(/\[(.+?)\]\((.+?)\)/g, '$1（$2）');
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
      return ensureCardOpen(S) + `<section style="${S.quote_outer}">
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
      return ensureCardOpen(S) + `<section style="${S.ul_outer}">\n${inner}</section>`;
    },

    makeHr(S) {
      return ensureCardOpen(S) + `<section style="${S.hr_section}">
  <span style="${S.hr_line}"></span>
</section>`;
    },
  };
})();

module.exports = {
  id: 'vibrant-badge',
  name: '活力徽章',
  tagline: '蓝橙撞色 + PART徽章标题 + 白色卡片 + 左侧螺旋装订',
  description: '复刻自 135编辑器 风格模板。橙色 PART 倾斜徽章 + 蓝色横条标题 + 放大镜图标，白色圆角内容卡片配左侧螺旋装订装饰，浅灰背景，活泼有设计感。',
  suitableFor: ['职场干货', '效率工具', '方法论', '成长感悟', '产品测评'],
  meta: {
    primaryColor: '#1266be',
    accentColor: '#e36c09',
    bgColor: '#f5f5f5',
    textColor: '#333333',
  },
  STYLES,
  decorations,
};
