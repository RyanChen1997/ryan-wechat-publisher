/**
 * 分类：复古（当前没有模板）
 *
 * 目录约定：scripts/presets/<分类 id>/<预设 id>/index.js（本文件 = 分类桶）
 * - 目录先留着：新增纸签 / 印章 / 旧纸质感模板时直接建 scripts/presets/retro/<id>/，
 *   再往下面的 presets 里加一行 require 即可，不用改根 index.js
 * - 画廊只展示有模板的分类，空分类不会出现在页面上
 */
module.exports = {
  id: 'retro',
  name: '复古',
  description: '纸签、印章、米色旧纸质感',
  presets: [],
};
