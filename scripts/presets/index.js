/**
 * 预设注册器。
 *
 * 目录结构（分类 → 预设）：
 *   scripts/presets/
 *   ├── base.js                 渲染引擎公共骨架（不属于任何分类）
 *   ├── index.js                本文件：聚合各分类桶，导出查询 API
 *   ├── <分类 id>/
 *   │   ├── index.js            分类桶：中文名/说明 + 该分类的 preset 列表
 *   │   └── <preset id>/        预设包（入口 index.js）
 *   └── <空分类 id>/
 *       └── index.js            占位桶：presets 为空数组，画廊自动隐藏该分类
 *
 * 约定：
 * - 分类的展示顺序 = 下面 CATEGORY_ORDER（用户给定的分类顺序），画廊按它排列
 * - 分类目录必须存在，哪怕是空分类 —— 缺目录 / 缺桶文件会直接抛错，避免分类悄悄消失
 * - 每个 preset 的目录名必须等于它的 id；移动模板 = 改分类桶里的一行 require
 * - 注册时给每个 preset 注入 category / categoryName，下游（画廊、测试）直接用
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 分类展示顺序（与用户给的分类清单一致）
const CATEGORY_ORDER = [
  'business',
  'simple',
  'fresh',
  'cartoon',
  'fashion',
  'minimal',
  'anime',
  'literary',
  'retro',
  'chinese',
];

const CATEGORIES = [];
const PRESETS = {};
const PRESET_DIRS = {};

function loadCategory(categoryId, order) {
  const dir = path.join(__dirname, categoryId);
  const entry = path.join(dir, 'index.js');
  if (!fs.existsSync(entry)) {
    throw new Error(
      `分类目录缺少桶文件: scripts/presets/${categoryId}/index.js —— 空分类也要保留目录与占位桶（presets: []）`
    );
  }

  const bucket = require(entry);
  if (bucket.id !== categoryId) {
    throw new Error(`分类桶 id 与目录名不一致: scripts/presets/${categoryId}/index.js 里写的是 ${bucket.id}`);
  }
  if (!Array.isArray(bucket.presets)) {
    throw new Error(`分类桶缺少 presets 数组: scripts/presets/${categoryId}/index.js`);
  }

  const ids = [];
  for (const preset of bucket.presets) {
    if (!preset || !preset.id) {
      throw new Error(`分类 ${categoryId} 里有 preset 缺少 id 字段`);
    }
    const presetDir = path.join(dir, preset.id);
    if (!fs.existsSync(path.join(presetDir, 'index.js'))) {
      throw new Error(`预设包缺少入口: scripts/presets/${categoryId}/${preset.id}/index.js`);
    }
    if (PRESETS[preset.id]) {
      throw new Error(`预设 id 重复: ${preset.id}`);
    }

    // 注入分类信息（同一个模块对象被 require 一次，所有下游都能拿到）
    preset.category = categoryId;
    preset.categoryName = bucket.name;

    PRESETS[preset.id] = preset;
    PRESET_DIRS[preset.id] = presetDir;
    ids.push(preset.id);
  }

  // 目录里多出来的预设包 = 忘记在桶里注册，直接报错
  const unregistered = fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && !ids.includes(item.name))
    .map((item) => item.name);
  if (unregistered.length) {
    throw new Error(
      `scripts/presets/${categoryId}/ 下的模板没有注册到分类桶: ${unregistered.join(', ')}`
    );
  }

  CATEGORIES.push({
    id: categoryId,
    name: bucket.name,
    description: bucket.description || '',
    order,
    count: ids.length,
    presets: ids,
  });
}

function loadAll() {
  const known = new Set(CATEGORY_ORDER);
  const strayDirs = fs.readdirSync(__dirname, { withFileTypes: true })
    .filter((item) => item.isDirectory() && !known.has(item.name))
    .map((item) => item.name);
  if (strayDirs.length) {
    throw new Error(
      `scripts/presets/ 下有未登记的分类目录: ${strayDirs.join(', ')} —— 请加进 CATEGORY_ORDER 并建好分类桶`
    );
  }

  CATEGORY_ORDER.forEach((id, i) => loadCategory(id, i));
}

loadAll();

function getPreset(id) {
  return PRESETS[id] || null;
}

/** 预设包目录（绝对路径），供测试、迁移、字体检查等脚本定位文件 */
function getPresetDir(id) {
  return PRESET_DIRS[id] || null;
}

function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

/**
 * 分类清单。
 * @param {{ nonEmptyOnly?: boolean }} [options] nonEmptyOnly = true 时只返回有模板的分类（画廊用）
 */
function listCategories(options = {}) {
  const cats = options.nonEmptyOnly ? CATEGORIES.filter((c) => c.count > 0) : CATEGORIES;
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    order: c.order,
    count: c.count,
    presets: c.presets.slice(),
  }));
}

function listPresets() {
  return Object.values(PRESETS).map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    suitableFor: p.suitableFor,
    meta: p.meta,
    category: p.category,
    categoryName: p.categoryName,
  }));
}

module.exports = {
  CATEGORY_ORDER,
  CATEGORIES,
  PRESETS,
  getPreset,
  getPresetDir,
  getCategory,
  listCategories,
  listPresets,
};
