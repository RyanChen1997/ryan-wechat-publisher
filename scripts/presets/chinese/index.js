/**
 * 分类：中国风（当前没有模板）
 *
 * 目录约定：scripts/presets/<分类 id>/<预设 id>/index.js（本文件 = 分类桶）
 * - 目录先留着：新增水墨 / 书法 / 中式纹样模板时直接建 scripts/presets/chinese/<id>/，
 *   再往下面的 presets 里加一行 require 即可，不用改根 index.js
 * - 画廊只展示有模板的分类，空分类不会出现在页面上
 */
module.exports = {
  id: 'chinese',
  name: '中国风',
  description: '水墨、书法与中式纹样，东方美学内容',
  presets: [],
};
