/**
 * 分类：文艺（当前没有模板）
 *
 * 目录约定：scripts/presets/<分类 id>/<预设 id>/index.js（本文件 = 分类桶）
 * - 目录先留着：新增水彩 / 手作 / 杂志质感模板时直接建 scripts/presets/literary/<id>/，
 *   再往下面的 presets 里加一行 require 即可，不用改根 index.js
 * - 画廊只展示有模板的分类，空分类不会出现在页面上
 */
module.exports = {
  id: 'literary',
  name: '文艺',
  description: '水彩、手作、杂志质感、艺术与美学',
  presets: [],
};
