/**
 * HTML 里的图片引用：统一收集 / 替换。
 *
 * 为什么需要这个模块：
 *   微信链路上图片有两类载体 ——
 *     1. `<img src="..." data-src="...">`
 *     2. CSS `background-image: url("...")`   ← 标题背景条 / 徽章底图 / 装饰条常用
 *   只处理第 1 类会导致第 2 类在粘贴/发布后裂图（本地路径不会被内联替换）。
 *   所以「收集本地图片」和「替换成内联 base64」都必须同时覆盖两类。
 */

'use strict';

// <img ... src="..." data-src="...">
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const IMG_ATTR_RE = /<img\b[^>]*?\b(data-src|src)\s*=\s*(["'])(.*?)\2/gi;
// 单个属性（在一个 <img> 标签内部使用）
const IMG_ATTR_ONLY_RE = /\b(?:data-src|src)\s*=\s*(["'])(.*?)\1/gi;
// style="background-image: url('...')" / url("...") / url(...)
const CSS_URL_RE = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;

/** 去掉 HTML 实体引号：style="background-image: url(&quot;a.png&quot;)" 这种写法很常见 */
function normalizeRef(ref) {
  return String(ref || '').trim().replace(/^&(?:quot|#39|apos);/, '').replace(/&(?:quot|#39|apos);$/, '');
}

/** 远程 / 内联 / 锚点引用 —— 这些不需要内联，也不需要替换 */
function isRemoteRef(ref) {
  return /^(?:https?:)?\/\//i.test(ref) || /^data:/i.test(ref) || /^#/i.test(ref) || /^about:/i.test(ref);
}

function classifyRef(ref) {
  if (/^data:/i.test(ref)) return 'data';
  if (/^(?:https?:)?\/\//i.test(ref)) {
    return /^(?:https?:)?\/\/mmbiz\.qpic\.cn\//i.test(ref) ? 'wechat' : 'external';
  }
  if (/^#/i.test(ref) || /^about:/i.test(ref)) return 'other';
  return 'local';
}

/**
 * 收集 HTML 里出现的所有图片引用（去重，保持出现顺序）。
 * @returns {Array<{ref:string, where:'img'|'css', kind:'local'|'wechat'|'external'|'data'|'other'}>}
 */
function collectImageRefs(html) {
  const out = [];
  const seen = new Set();
  let m;

  IMG_ATTR_RE.lastIndex = 0;
  while ((m = IMG_ATTR_RE.exec(html))) {
    const ref = m[3];
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    out.push({ ref, where: 'img', attr: m[1].toLowerCase(), kind: classifyRef(ref) });
  }

  CSS_URL_RE.lastIndex = 0;
  while ((m = CSS_URL_RE.exec(html))) {
    const ref = normalizeRef(m[2]);
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    out.push({ ref, where: 'css', kind: classifyRef(ref) });
  }

  return out;
}

/** 只取需要本地解析的引用（排除远程 / data: / 锚点） */
function collectLocalImageRefs(html) {
  return collectImageRefs(html).filter((r) => r.kind === 'local');
}

/**
 * 按 mapping 替换 HTML 里的图片引用，两类载体同时替换。
 * 注意：同一个 <img> 可能同时带 src 与 data-src（发布版只写 data-src，复制前会补上 src），
 * 两个属性都要改写 —— 只改第一个会留下本地路径，粘贴时微信可能去读本地路径而报「图片粘贴失败」。
 * @param {string} html
 * @param {Map<string,string>|Object} mapping  ref -> 新地址
 */
function replaceImageRefs(html, mapping) {
  const get = (ref) => (mapping instanceof Map ? mapping.get(ref) : mapping[ref]);

  let out = html.replace(IMG_TAG_RE, (tag) => tag.replace(IMG_ATTR_ONLY_RE, (full, quote, ref) => {
    const next = get(ref);
    return next ? `${full.slice(0, full.indexOf('=') + 1)}${quote}${next}${quote}` : full;
  }));

  out = out.replace(CSS_URL_RE, (full, quote, raw) => {
    const ref = normalizeRef(raw);
    const next = get(ref);
    if (!next) return full;
    return `url(${quote}${next}${quote})`;
  });

  return out;
}

module.exports = {
  IMG_TAG_RE,
  IMG_ATTR_RE,
  CSS_URL_RE,
  isRemoteRef,
  classifyRef,
  normalizeRef,
  collectImageRefs,
  collectLocalImageRefs,
  replaceImageRefs,
};
