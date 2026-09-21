/**
 * 分类：清新
 *
 * 目录约定：scripts/presets/<分类 id>/<预设 id>/index.js（本文件 = 分类桶）
 * - 分类的中文名与说明只写在本文件；画廊按 presets 顺序展示该分类的模板
 * - 新增 / 移动模板 = 只改本文件的一行 require，不需要动根 index.js
 * - 列表按 preset-id 字母序排列，方便定位
 */
module.exports = {
  id: 'fresh',
  name: '清新',
  description: '明亮清爽的配色，校园、教学、生活与科普内容',
  presets: [
    require('./purple-badge/index'),
  ],
};
