const fs = require('fs');
const os = require('os');
const path = require('path');

const TEMPLATE_DIR = __dirname;
const SKILL_ROOT = path.resolve(TEMPLATE_DIR, '../../..');
const { DecoAssetManager } = require(path.join(SKILL_ROOT, 'scripts/utils/svg-to-png'));

const TITLE_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'svg/title-template.svg'), 'utf8');
const NUMBER_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'svg/number-template.svg'), 'utf8');
const TOP_ART = ['top-art-1.gif', 'top-art-2.gif', 'top-art-3.gif'];
const NUMBER_COLORS = ['#FF6657', '#F5B92E', '#72BCEA'];
// Markdown 中的 **加粗内容** 按此顺序循环着色；调整数组即可换色或改顺序。
const HIGHLIGHT_PALETTE = [
  '#E6A221', // 田园橙
  '#65C5E9', // 天空蓝
  '#8BCF89', // 嫩叶绿
  '#FF6576', // 珊瑚红
];
const CACHE_ROOT = process.env.RYAN_WECHAT_TEMPLATE_CACHE_DIR
  || path.join(os.tmpdir(), 'ryan-wechat-publisher', 'childlike-doodle-cache');
const decoAssets = new DecoAssetManager(CACHE_ROOT);

const STYLES = {
  outer: 'background-color: var(--weui-BG-2, #ffffff); padding: 8px 0 24px; box-sizing: border-box; color: rgb(62, 62, 62); font-size: 16px; line-height: 2; letter-spacing: 1.5px;',
  h1_wrap: 'margin: 48px auto 34px; text-align: center; box-sizing: border-box;',
  h1_doodle_row: 'text-align: center; margin: 0 auto 12px;',
  h1_doodle: 'display: inline-block; width: 30%; max-width: 210px; height: auto;',
  h1_number_row: 'text-align: center; margin: 0 auto 12px;',
  h1_number: 'display: inline-block; width: 12%; max-width: 84px; height: auto;',
  h1_title_row: 'text-align: center; margin: 0 auto;',
  h1_title: 'display: inline-block; width: 80%; max-width: 560px; height: auto;',
  h1_semantic: 'display: none;',
  h2: 'margin: 30px 0 16px; color: rgb(134, 189, 224); font-size: 18px; line-height: 2; letter-spacing: 1.5px; font-weight: bold; text-align: center;',
  h3: 'margin: 24px 0 12px; color: rgb(112, 188, 234); font-size: 16px; line-height: 1.8; letter-spacing: 1.5px; font-weight: bold;',
  p: 'margin: 0 0 18px; color: rgb(62, 62, 62); font-size: 16px; line-height: 2; letter-spacing: 1.5px; text-align: justify;',
  p_intro: 'margin: 0 0 18px; color: rgb(62, 62, 62); font-size: 16px; line-height: 2; letter-spacing: 1.5px; text-align: center;',
  strong: 'font-weight: bold;',
  code: 'background-color: var(--weui-BG-3, #f7f7f7); padding: 2px 6px; border-radius: 3px; color: rgb(255, 101, 118); font-size: 14px;',
  quote_outer: 'margin: 24px auto 28px; padding: 16px 24px; width: 88%; box-sizing: border-box; border-top: 2px solid rgb(134, 189, 224); border-bottom: 2px solid rgb(134, 189, 224); background-color: var(--weui-BG-2, #ffffff); text-align: center;',
  quote_text: 'color: rgb(134, 189, 224); font-size: 15px; line-height: 2; letter-spacing: 1.5px; font-style: italic;',
  ul_outer: 'margin: 18px 0;',
  li: 'margin: 8px 0; line-height: 2; font-size: 16px;',
  li_bullet_text: 'margin-right: 9px; color: rgb(255, 101, 118);',
  li_bullet_char: '●',
  li_span: 'color: rgb(62, 62, 62);',
  img_section: 'text-align: center; margin: 24px 0;',
  img: 'display: inline-block; max-width: 100%; height: auto; border-radius: 20px;',
  caption: 'margin: 8px 0 18px; color: rgba(62, 62, 62, 0.67); font-size: 12px; line-height: 1.6; letter-spacing: 0.544px; text-align: right;',
  hr_section: 'text-align: center; margin: 32px 0;',
  hr_line: 'display: inline-block; width: 18%; height: 3px; background-color: rgb(134, 189, 224); border-radius: 3px;',
  code_block: 'margin: 18px 0; padding: 16px; border-radius: 10px; background-color: var(--weui-BG-3, #f7f7f7); overflow-x: auto;',
  code_pre: 'margin: 0; color: rgb(62, 62, 62); font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-all;',
};

let useLocalPath = false;
let outputDir = null;
let currentChapter = 0;
let highlightIndex = 0;

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fillTemplate(source, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    source,
  );
}

function titleSvg(title) {
  const length = Array.from(title).length;
  return fillTemplate(TITLE_TEMPLATE, {
    TITLE: escapeXml(title),
    FONT_SIZE: length >= 14 ? 58 : length >= 12 ? 64 : 72,
    TEXT_WIDTH: length >= 14 ? 970 : length >= 12 ? 980 : 900,
  });
}

function numberSvg(number) {
  const twoDigits = number >= 10;
  return fillTemplate(NUMBER_TEMPLATE, {
    NUMBER: number,
    COLOR: NUMBER_COLORS[(number - 1) % NUMBER_COLORS.length],
    SEED: 20 + number,
    FONT_SIZE: twoDigits ? 470 : 610,
    TEXT_WIDTH: twoDigits ? 610 : 360,
  });
}

function copyAsset(source, outputName = path.basename(source)) {
  if (!outputDir) return outputName;
  const target = path.join(outputDir, outputName);
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  return useLocalPath ? target : outputName;
}

function copyTopArt(counter) {
  const name = TOP_ART[(counter - 1) % TOP_ART.length];
  return copyAsset(path.join(TEMPLATE_DIR, 'assets/top-art', name), name);
}

function chapterNumber(counter) {
  const fileName = `number-${String(counter).padStart(2, '0')}.png`;
  const pregenerated = path.join(TEMPLATE_DIR, 'assets/numbers', fileName);
  if (counter <= 10 && fs.existsSync(pregenerated)) return copyAsset(pregenerated, fileName);
  return decoAssets.get(numberSvg(counter), `number-${String(counter).padStart(2, '0')}`, 760);
}

function assetAttr(src) {
  return useLocalPath
    ? `src="assets/${path.basename(src)}"`
    : `data-src="${path.basename(src)}"`;
}

const decorations = {
  setAssetDir(dir, useLocal) {
    outputDir = dir;
    useLocalPath = useLocal;
    fs.mkdirSync(outputDir, { recursive: true });
    decoAssets.setOutput(dir, useLocal);
  },

  beforeContent() {
    currentChapter = 0;
    highlightIndex = 0;
    return '';
  },

  afterContent() {
    return '';
  },

  makeH1(text, counter, parseInline, S) {
    currentChapter = counter;
    const safeText = escapeXml(text);
    const topArt = copyTopArt(counter);
    const number = chapterNumber(counter);
    const title = decoAssets.get(titleSvg(text), `chapter-${counter}-title`, 1440);
    return `<section style="${S.h1_wrap}">
  <section style="${S.h1_doodle_row}"><img ${assetAttr(topArt)} alt="" style="${S.h1_doodle}"/></section>
  <section style="${S.h1_number_row}"><img ${assetAttr(number)} alt="第 ${counter} 章" style="${S.h1_number}"/></section>
  <section style="${S.h1_title_row}"><img ${assetAttr(title)} alt="${safeText}" style="${S.h1_title}"/></section>
  <p style="${S.h1_semantic}">${parseInline(text)}</p>
</section>`;
  },

  makeParagraph(text, parseInline, S) {
    const style = currentChapter === 1 ? S.p_intro : S.p;
    return `<p style="${style}">${parseInline(text)}</p>`;
  },

  makeBr() {
    return '';
  },

  makeImage(imgSrc, imgAlt, caption, local, resolveImage, S) {
    let src = local ? resolveImage(imgSrc) : imgSrc;
    if (local && outputDir && fs.existsSync(src)) {
      const fileName = path.basename(src);
      copyAsset(src, fileName);
      src = `assets/${fileName}`;
    }
    const srcAttr = local ? 'src' : 'data-src';
    let html = `<section style="${S.img_section}"><img ${srcAttr}="${src}" alt="${escapeXml(imgAlt)}" style="${S.img}"/></section>`;
    if (caption) html += `<p style="${S.caption}">${escapeXml(caption)}</p>`;
    return html;
  },

  parseInline(text, S) {
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, '$1（$2）');
    text = text.replace(/\*\*(.+?)\*\*/g, (_, content) => {
      const color = HIGHLIGHT_PALETTE[highlightIndex % HIGHLIGHT_PALETTE.length];
      highlightIndex += 1;
      return `<span style="${S.strong} color: ${color};">${content}</span>`;
    });
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<span style="font-style: italic;">$1</span>');
    text = text.replace(/`([^`]+)`/g, `<code style="${S.code}">$1</code>`);
    return text;
  },
};

module.exports = {
  id: 'childlike-doodle',
  name: '童趣手绘',
  tagline: '动态标题占位符 + 手绘数字 1～10 + 可替换顶部插画',
  description: '童趣手绘风格：一级标题由顶部插画、手绘数字和黄色笔刷标题组成；SVG 仅作为设计源，发布时自动渲染为 PNG。',
  suitableFor: ['AI 工具', '创作方法', '轻松科普', '自动化演示'],
  meta: {
    primaryColor: '#72BCEA',
    accentColor: '#FF6576',
    secondaryColor: '#FFE36F',
    bgColor: '#FFFFFF',
    textColor: '#3E3E3E',
    darkMode: 'weui-var',
  },
  STYLES,
  decorations,
};
