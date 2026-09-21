/**
 * 把渲染好的文章 HTML 包成一个独立的本地预览页。
 *
 * 用途：render.js（--output-preview）与 preview-studio.js 共用同一套页面骨架，
 * 避免两处各写一份模板导致预览底色、宽度、字体不一致。
 */

const BASE_CSS = `  /* 容器基线必须和微信一致：微信的 .rich_media_area_primary 用
     padding: var(--richMediaAreaPrimaryPaddingTop) var(--appmsgPageGap) 0，
     而 --appmsgPageGap: 20px（见 res.wx.qq.com 的 appmsg CSS）。
     少了水平内边距，文章就会贴到容器边缘 —— 那是预览缺了平台页边距，不是模板的问题。 */
  body {
    max-width: 680px;
    margin: 20px auto;
    padding: 0 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: %BG%;%COLOR%
  }
  img { max-width: 100%; height: auto; }`;

function buildPreviewPage({ title, html, dark = false }) {
  const css = BASE_CSS
    .replace('%BG%', dark ? '#191919' : '#fff')
    .replace('%COLOR%', dark ? '\n    color: #a3a3a3;' : '');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
${html}
</body>
</html>`;
}

module.exports = { buildPreviewPage };
