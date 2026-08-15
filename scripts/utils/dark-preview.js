#!/usr/bin/env node
/**
 * 微信深色模式（mp-darkmode）本地预览模拟器。
 *
 * 用途：把渲染好的文章 HTML 按微信官方 wechatjs/mp-darkmode 算法做颜色映射，
 * 生成夜间模式预览页，发布前即可在浏览器里检查夜间效果（避免发布后才发现"马赛克"）。
 *
 * 用法：
 *   node scripts/utils/dark-preview.js <article.html> [output.html]
 *   # 或经 render.js：node scripts/render.js ... --output-dark-preview <path>
 *
 * 算法要点（与官方一致）：
 *   - 背景：白/近白（灰阶 L>40% 或感知亮度>250）→ 亮度取反至 #191919 附近；
 *           浅色淡彩（感知亮度 190~250）→ 压到感知亮度 190（中灰，马赛克来源）；
 *           高饱和中间调（如品牌蓝/橙）→ 保持不变；alpha 保留。
 *   - 文字/边框：按父级背景做对比度调整（近白文字不动、深色文字反白、低对比自动提亮）。
 *   - var(--weui-*) 不做映射，直接解析成微信夜间原生值（BG-1→#1E1E1E、BG-2→#191919、BG-3→#404040 等），
 *     与真机行为一致（本地预览里变量未定义，所以这里需要主动解析）。
 */

const fs = require('fs');
const path = require('path');

// ---------- 官方常量 ----------
const DEFAULT_DARK_BG = [25, 25, 25];      // #191919
const DEFAULT_DARK_TEXT = [163, 163, 163]; // #a3a3a3
const DEFAULT_DARK_BG_L = 9.8;             // #191919 的 HSL 亮度
const DEFAULT_DARK_BG_PERCEIVED = 25;
const DEFAULT_DARK_TEXT_PERCEIVED = 163;
const MAX_LIMIT_OFFSET = DEFAULT_DARK_TEXT_PERCEIVED - DEFAULT_DARK_BG_PERCEIVED; // 138
const IGNORE_ALPHA = 0.05;
const WHITE_LIKE = 250;
const MAX_LIMIT_BG = 190;
const MIN_OFFSET = 65;
const HIGH_BW_L = 40;
const LOW_BW_L = 22;

// 微信 CSS 变量 → 夜间原生值（本地预览时变量未定义，主动解析；真机上由客户端定义）
const WEUI_VAR_DARK = {
  '--weui-BG-0': '#111111',
  '--weui-BG-1': '#1e1e1e',
  '--weui-BG-2': '#191919',
  '--weui-BG-3': '#404040',
  '--weui-BG-4': '#4c4c4c',
  '--weui-BG-5': '#2c2c2c',
  '--weui-FG-0': 'rgba(255, 255, 255, 0.8)',
  '--weui-FG-1': 'rgba(255, 255, 255, 0.5)',
  '--weui-FG-2': 'rgba(255, 255, 255, 0.3)',
  '--weui-FG-3': 'rgba(255, 255, 255, 0.1)',
  '--weui-LINK': '#7d90a9',
};

// ---------- 颜色基础 ----------
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue2rgb(h + 1 / 3);
    g = hue2rgb(h);
    b = hue2rgb(h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function perceived(rgb) {
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
}

function adjustBrightnessTo(target, rgb) {
  const ratio = target / perceived(rgb);
  let r = Math.min(255, rgb[0] * ratio);
  let g = Math.min(255, rgb[1] * ratio);
  let b = Math.min(255, rgb[2] * ratio);
  if (g === 0 || r === 255 || b === 255) {
    g = (target * 1000 - r * 299 - b * 114) / 587;
  } else if (r === 0) {
    r = (target * 1000 - g * 587 - b * 114) / 299;
  } else if (b === 0 || g === 255) {
    b = (target * 1000 - r * 299 - g * 587) / 114;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

// 解析 rgb()/rgba()/#hex → { rgb:[r,g,b], alpha }；失败返回 null
const COLOR_RE = /rgba?\(([^)]+)\)|#([0-9a-fA-F]{3,8})\b/g;

function parseColor(str) {
  if (!str) return null;
  const m = str.match(COLOR_RE);
  if (!m) return null;
  const part = m[m.length - 1];
  if (part[0] === '#') {
    const hex = part.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split('').map(c => parseInt(c + c, 16));
      return { rgb: [r, g, b], alpha: a === undefined ? 1 : +(a / 255).toFixed(3) };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? +(parseInt(hex.slice(6, 8), 16) / 255).toFixed(3) : 1;
      return { rgb: [r, g, b], alpha: a };
    }
    return null;
  }
  const nums = part.slice(part.indexOf('(') + 1, -1).split(',').map(s => parseFloat(s.trim()));
  if (nums.length < 3 || nums.some(n => Number.isNaN(n))) return null;
  const alpha = nums.length === 4 ? nums[3] : 1;
  return { rgb: nums.slice(0, 3).map(n => Math.max(0, Math.min(255, Math.round(n)))), alpha };
}

function fmtRgb(rgb, alpha) {
  const [r, g, b] = rgb;
  if (alpha !== undefined && alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${+alpha.toFixed(3)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// ---------- 官方映射算法 ----------
// 背景色映射
function mapBackground(rgb, alpha) {
  const [h, s, l] = rgbToHsl(...rgb);
  const p = perceived(rgb);
  let newRgb = rgb;
  if ((s === 0 && l > HIGH_BW_L) || p > WHITE_LIKE) {
    // 灰阶亮色 / 近白 → 亮度取反到 #191919 附近
    const newL = Math.min(100, 100 + DEFAULT_DARK_BG_L - l);
    newRgb = hslToRgb(h, 0, newL);
  } else if (p > MAX_LIMIT_BG) {
    // 浅色淡彩 → 压到感知亮度 190（中灰，这就是夜间马赛克的来源）
    newRgb = adjustBrightnessTo(MAX_LIMIT_BG, rgb);
  } else if (l < LOW_BW_L) {
    newRgb = hslToRgb(h, s, LOW_BW_L);
  }
  return { rgb: newRgb, alpha };
}

// 文字/边框色映射（对父级背景做对比度调整）
function mapText(textRgb, textAlpha, bgRgb, bgAlpha) {
  const bgPerceived = perceived(bgRgb) * bgAlpha + DEFAULT_DARK_BG_PERCEIVED * (1 - bgAlpha);
  const textPerceived = perceived(textRgb);
  const offset = Math.abs(bgPerceived - textPerceived);

  if (textPerceived >= WHITE_LIKE) return { rgb: textRgb, alpha: textAlpha }; // 近白文字不动

  if (offset > MAX_LIMIT_OFFSET && bgPerceived <= DEFAULT_DARK_BG_PERCEIVED + 2) {
    return { rgb: adjustBrightnessTo(MAX_LIMIT_OFFSET + bgPerceived, textRgb), alpha: textAlpha };
  }
  if (offset >= MIN_OFFSET) return { rgb: textRgb, alpha: textAlpha }; // 对比度足够，不动

  const [h, s, l] = rgbToHsl(...textRgb);
  if (bgPerceived >= 100) {
    if (l > 90 - HIGH_BW_L) {
      const tmp = hslToRgb(h, s, 90 - l);
      return mapText(tmp, textAlpha, bgRgb, bgAlpha);
    }
    return { rgb: adjustBrightnessTo(Math.min(MAX_LIMIT_OFFSET, bgPerceived - MIN_OFFSET), textRgb), alpha: textAlpha };
  }
  if (l <= HIGH_BW_L) {
    const tmp = hslToRgb(h, s, 90 - l);
    return mapText(tmp, textAlpha, bgRgb, bgAlpha);
  }
  return { rgb: adjustBrightnessTo(Math.min(MAX_LIMIT_OFFSET, bgPerceived + MIN_OFFSET), textRgb), alpha: textAlpha };
}

// 渐变 → 官方 mixColors 纯色（transparent 视为白色 alpha 0）
function mixGradient(value) {
  const colors = [];
  let m;
  const g = new RegExp(COLOR_RE.source, 'g');
  while ((m = g.exec(value)) !== null) colors.push(m[0]);
  let mix = null;
  for (const c of colors) {
    const parsed = parseColor(c);
    if (!parsed) continue;
    if (!mix) { mix = parsed; continue; }
    // color.mix(other, other.alpha())：在 RGB 空间线性混合
    const a = parsed.alpha;
    mix = {
      rgb: [
        Math.round(mix.rgb[0] * (1 - a) + parsed.rgb[0] * a),
        Math.round(mix.rgb[1] * (1 - a) + parsed.rgb[1] * a),
        Math.round(mix.rgb[2] * (1 - a) + parsed.rgb[2] * a),
      ],
      alpha: mix.alpha + parsed.alpha * (1 - mix.alpha),
    };
  }
  return mix;
}

// ---------- 样式处理 ----------
const BG_PROPS = /^background/;
const TEXT_PROPS = ['color', '-webkit-text-fill-color', '-webkit-text-stroke', '-webkit-text-stroke-color', 'text-decoration', 'text-decoration-color', 'text-emphasis-color'];
const BORDER_PROPS = ['border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline', 'outline-color', 'box-shadow', 'column-rule', 'column-rule-color'];

function resolveVarDark(value) {
  // 把 var(--weui-XX, fallback) 解析成夜间值（fallback 可能含 rgb(...) 括号，需平衡匹配）。
  // 已解析的值用占位符保护，后续颜色映射不会二次处理（与真机一致：var() 不参与 mp-darkmode 映射）。
  const resolved = [];
  const out = value.replace(/var\((--weui-[a-zA-Z0-9-]+)(?:\s*,\s*((?:[^()]|\([^)]*\))*))?\)/g,
    (whole, name, fallback) => {
      if (WEUI_VAR_DARK[name]) {
        resolved.push(WEUI_VAR_DARK[name]);
        return `\u0000${resolved.length - 1}\u0000`;
      }
      return fallback ? fallback.trim() : whole;
    });
  return { value: out, resolved };
}

// 把一个 style 值里所有颜色按属性类型映射。bg 为祖先有效背景（用于文字对比度）。
function mapStyleValue(prop, value, bg) {
  const { value: v0, resolved } = resolveVarDark(value);
  const isBg = BG_PROPS.test(prop);
  const isText = TEXT_PROPS.indexOf(prop) > -1;
  const isBorder = BORDER_PROPS.indexOf(prop) > -1;
  const isGradient = /gradient/i.test(v0);

  if (isGradient && isBg) {
    const mix = mixGradient(v0);
    if (!mix) return { value: v0.replace(/\u0000(\d+)\u0000/g, (m, i) => resolved[+i]), bgColor: null };
    const mapped = mapBackground(mix.rgb, mix.alpha);
    return { value: fmtRgb(mapped.rgb, mapped.alpha), bgColor: mapped };
  }

  const replaced = v0.replace(COLOR_RE, (match) => {
    const c = parseColor(match);
    if (!c || c.alpha < IGNORE_ALPHA) return match;
    if (isBg) {
      const mapped = mapBackground(c.rgb, c.alpha);
      return fmtRgb(mapped.rgb, mapped.alpha);
    }
    // 文字 / 边框：边框按文字规则处理（与官方一致）
    const mapped = mapText(c.rgb, c.alpha, bg.rgb, bg.alpha);
    return fmtRgb(mapped.rgb, mapped.alpha);
  });
  const value2 = replaced.replace(/\u0000(\d+)\u0000/g, (m, i) => resolved[+i]);
  // 自身背景色（映射后）→ 供子元素文字对比度使用
  let bgColor = null;
  if (isBg) {
    const c = parseColor(value2);
    if (c && c.alpha >= IGNORE_ALPHA) bgColor = c;
  }
  return { value: value2, bgColor };
}

// 解析 style 字符串，返回 [key, value] 列表
function parseStyle(styleStr) {
  return styleStr.split(';')
    .map(part => {
      const idx = part.indexOf(':');
      if (idx < 0) return null;
      return [part.slice(0, idx).trim().toLowerCase(), part.slice(idx + 1).trim()];
    })
    .filter(Boolean);
}

// ---------- 轻量 DOM 遍历（面向本引擎生成的标准 HTML） ----------
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'wbr']);

// 提取 style 属性值。注意 style 值里可能含内嵌引号（如 font-family: "PingFang SC"），
// 不能用 /style="([^"]*)"/ 直接匹配（会截断）。CSS 内嵌引号必然成对出现，
// 因此属性闭合引号就是该引号字符的最后一次出现。
function extractStyleAttr(attrs) {
  const styleIdx = attrs.indexOf('style=');
  if (styleIdx < 0) return null;
  const openQuote = attrs[styleIdx + 6];
  if (openQuote !== '"' && openQuote !== "'") return null;
  const closeIdx = attrs.lastIndexOf(openQuote);
  if (closeIdx <= styleIdx + 6) return null;
  return {
    start: styleIdx + 7,
    end: closeIdx,
    value: attrs.slice(styleIdx + 7, closeIdx),
  };
}

function simulateDark(html) {
  let out = '';
  let lastIndex = 0;
  const stack = []; // 每个元素: { bg: {rgb,alpha} | null }

  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(html)) !== null) {
    out += html.slice(lastIndex, m.index);
    lastIndex = m.index + m[0].length;

    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';
    const selfClose = m[4] === '/' || VOID_TAGS.has(tag);

    if (closing) {
      if (stack.length) stack.pop();
      out += m[0];
      continue;
    }

    // 当前元素的有效背景 = 最近祖先的背景（官方默认 #191919）
    let bg = DEFAULT_DARK_BG;
    let bgAlpha = 1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].bg) { bg = stack[i].bg.rgb; bgAlpha = stack[i].bg.alpha; break; }
    }

    const styleMatch = extractStyleAttr(attrs);
    let newAttrs = attrs;
    let elBg = null;
    if (styleMatch) {
      const styleStr = styleMatch.value;
      const pairs = parseStyle(styleStr);
      const mapped = [];
      let firstBg = null;
      for (const [key, value] of pairs) {
        if (BG_PROPS.test(key) || TEXT_PROPS.indexOf(key) > -1 || BORDER_PROPS.indexOf(key) > -1) {
          const ret = mapStyleValue(key, value, { rgb: bg, alpha: bgAlpha });
          mapped.push(`${key}: ${ret.value}`);
          if (ret.bgColor && !firstBg) firstBg = ret.bgColor;
        } else {
          mapped.push(`${key}: ${value}`);
        }
      }
      if (firstBg) elBg = firstBg;
      newAttrs = attrs.slice(0, styleMatch.start) + mapped.join('; ') + attrs.slice(styleMatch.end);
    }

    out += `<${m[1]}${tag}${newAttrs}${selfClose ? '/' : ''}>`;
    if (!selfClose) stack.push({ bg: elBg });
  }
  out += html.slice(lastIndex);
  return out;
}

// ---------- 入口 ----------
function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('用法: node scripts/utils/dark-preview.js <article.html> [output.html]');
    process.exit(1);
  }
  const src = path.resolve(args[0]);
  const dest = args[1] ? path.resolve(args[1]) : src.replace(/\.html$/, '-dark.html');
  const html = fs.readFileSync(src, 'utf-8');
  const mapped = simulateDark(html);
  const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>夜间模式预览</title>
<style>
  body {
    max-width: 680px;
    margin: 20px auto;
    padding: 0 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #191919;
    color: #a3a3a3;
  }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${mapped}
</body>
</html>`;
  fs.writeFileSync(dest, page);
  console.log('夜间预览 HTML:', dest, '(' + page.length + ' bytes)');
}

module.exports = { simulateDark, mapBackground, mapText, parseColor };

if (require.main === module) main();
