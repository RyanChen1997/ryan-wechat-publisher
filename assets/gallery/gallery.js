/* ===========================================================================
   模板推荐画廊交互层
   数据来源：window.__GALLERY__（由 scripts/build-gallery.js 注入）
   计算都在 Node 侧完成，这里只负责：推荐位 + 分类浏览 + 切模板 + 复制模板名称。
   分类为空（如动漫 / 中国风暂无模板）时该分类不出现 —— Node 侧已过滤一次，这里再兜一层。
   =========================================================================== */
(function () {
  'use strict';

  var P = window.__GALLERY__ || { presets: [], categories: [] };
  var state = { index: 0, category: 'all' };
  var cardOrder = []; // 画面上从上到下的模板下标（推荐位在前，其次是当前分类列表），键盘操作用

  var el = {
    rail: document.getElementById('rail'),
    wx: document.getElementById('wx'),
    copy: document.getElementById('copy'),
    copyName: document.getElementById('copy-name'),
    hint: document.getElementById('hint'),
    barSub: document.getElementById('bar-sub'),
    pickCat: document.getElementById('pick-cat'),
    foot: document.getElementById('rail-foot'),
    toast: document.getElementById('toast'),
  };

  var toastTimer = null;
  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.hidden = false;
    el.toast.dataset.show = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.dataset.show = '0'; }, 4200);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var indexById = {};
  P.presets.forEach(function (p, i) { indexById[p.id] = i; });

  // 空分类不上页面
  function visibleCategories() {
    return (P.categories || []).filter(function (c) {
      return c.count > 0 && c.presets && c.presets.length;
    });
  }

  function cardHtml(preset, index, badge, showCategory) {
    var tags = (preset.suitableFor && preset.suitableFor.length)
      ? '<span class="card-tags">适合：' + esc(preset.suitableFor.join(' · ')) + '</span>'
      : '';
    var category = showCategory && preset.categoryName
      ? '<span class="card-cat">' + esc(preset.categoryName) + '</span>'
      : '';
    return '<button class="card' + (badge ? '' : ' card-plain') + '" type="button" data-index="' + index + '" aria-pressed="' + (index === state.index) + '">' +
      '<span class="card-head"><span class="card-name">' + esc(preset.name) + '</span>' + (badge || '') + '</span>' +
      '<span class="card-tagline">' + esc(preset.tagline) + '</span>' +
      tags +
      '<span class="card-foot"><span class="card-id">' + esc(preset.id) + '</span>' + category + '</span>' +
      '</button>';
  }

  function cardById(id, showCategory) {
    var index = indexById[id];
    if (index == null) return '';
    var preset = P.presets[index];
    return cardHtml(preset, index, preset.recommended ? '<span class="badge badge-mute">推荐</span>' : '', showCategory);
  }

  function chipHtml(id, name, count, description) {
    return '<button class="chip" type="button" data-cat="' + esc(id) + '"' +
      (description ? ' title="' + esc(description) + '"' : '') +
      ' aria-pressed="' + (state.category === id) + '">' +
      esc(name) + '<span class="chip-count">' + count + '</span></button>';
  }

  function renderRail() {
    var recommended = [];
    P.presets.forEach(function (p, i) { if (p.recommended) recommended.push({ preset: p, index: i }); });
    var cats = visibleCategories();

    var html = '';
    if (recommended.length) {
      html += '<p class="rail-title">为你推荐</p>';
      html += '<div class="rail-group">' + recommended.map(function (item, i) {
        var badge = i === 0
          ? '<span class="badge">最推荐</span>'
          : '<span class="badge badge-mute">备选 ' + i + '</span>';
        return cardHtml(item.preset, item.index, badge, true);
      }).join('') + '</div>';
    }

    html += '<p class="rail-title rail-title-sub">按分类浏览</p>';
    html += '<div class="chips" id="chips">' +
      chipHtml('all', '全部', P.presets.length, '') +
      cats.map(function (c) { return chipHtml(c.id, c.name, c.count, c.description); }).join('') +
      '</div>';
    html += '<div class="rail-group" id="rail-list"></div>';

    el.rail.innerHTML = html;

    Array.prototype.forEach.call(el.rail.querySelectorAll('.chip'), function (chip) {
      chip.addEventListener('click', function () { setCategory(chip.dataset.cat); });
    });
    bindCards(el.rail);
    renderList();
  }

  function renderList() {
    var list = document.getElementById('rail-list');
    if (!list) return;

    var cats = visibleCategories();
    var html = '';

    if (state.category === 'all') {
      cats.forEach(function (c) {
        html += '<p class="rail-sub"><span>' + esc(c.name) + '</span><span>' + c.count + ' 套</span></p>';
        html += c.presets.map(function (id) { return cardById(id, false); }).join('');
      });
    } else {
      var cat = cats.filter(function (c) { return c.id === state.category; })[0];
      if (cat) {
        html = cat.presets.map(function (id) { return cardById(id, false); }).join('');
      } else {
        // 分类不存在 / 被隐藏（例如脚本换了数据），退回「全部」
        state.category = 'all';
        return renderList();
      }
    }

    list.innerHTML = html;
    bindCards(list);
    collectOrder();
  }

  function bindCards(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.card'), function (card) {
      var index = parseInt(card.dataset.index, 10);
      card.setAttribute('aria-pressed', String(index === state.index));
      card.addEventListener('click', function () { select(index); });
    });
  }

  function collectOrder() {
    cardOrder = [];
    Array.prototype.forEach.call(el.rail.querySelectorAll('.card'), function (card) {
      cardOrder.push(parseInt(card.dataset.index, 10));
    });
  }

  function setCategory(id) {
    if (id === state.category) return;
    state.category = id;
    Array.prototype.forEach.call(el.rail.querySelectorAll('.chip'), function (chip) {
      chip.setAttribute('aria-pressed', String(chip.dataset.cat === id));
    });
    renderList();

    // 当前模板不在这个分类里，就自动跳到该分类第一套，避免预览和列表对不上
    if (id === 'all') return;
    var cat = visibleCategories().filter(function (c) { return c.id === id; })[0];
    if (!cat) return;
    var current = P.presets[state.index];
    if (current && current.category === id) return;
    var first = indexById[cat.presets[0]];
    if (first != null) select(first);
  }

  function paint() {
    var p = P.presets[state.index];
    el.wx.innerHTML = p.html;
    el.copyName.textContent = p.name;
    el.hint.textContent = '复制后粘贴给 AI，说「用' + p.name + '」就行';
    el.barSub.textContent = P.articleLabel || '';
    if (el.pickCat) el.pickCat.textContent = p.categoryName || '';
    Array.prototype.forEach.call(el.rail.querySelectorAll('.card'), function (card) {
      card.setAttribute('aria-pressed', String(parseInt(card.dataset.index, 10) === state.index));
    });
  }

  // 键盘上下移动时把卡片滚进可视区（只滚左栏，不动页面）
  function ensureCardVisible(card) {
    if (!card || !el.rail) return;
    var top = card.offsetTop;
    var bottom = top + card.offsetHeight;
    var viewTop = el.rail.scrollTop;
    var viewBottom = viewTop + el.rail.clientHeight;
    if (top < viewTop) el.rail.scrollTop = top - 8;
    else if (bottom > viewBottom) el.rail.scrollTop = bottom - el.rail.clientHeight + 8;
  }

  function select(index) {
    if (index < 0 || index >= P.presets.length || index === state.index) return;
    state.index = index;
    paint();
    ensureCardVisible(el.rail.querySelector('.card[aria-pressed="true"]'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function legacyCopyText(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.cssText = 'position:fixed;left:-99999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  async function copyName() {
    var name = P.presets[state.index].name;
    var ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(name);
        ok = true;
      }
    } catch (err) { ok = false; }
    if (!ok) ok = legacyCopyText(name);
    toast(ok
      ? '已复制「' + name + '」—— 粘贴给 AI 就行'
      : '复制失败，可以直接告诉 AI 你想要「' + name + '」');
  }

  function init() {
    if (!P.presets || !P.presets.length) {
      el.rail.innerHTML = '<p class="card-tagline">没有可选模板</p>';
      return;
    }
    renderRail();
    paint();
    collectOrder();

    if (el.foot) {
      var catCount = visibleCategories().length;
      var recommendedCount = P.presets.filter(function (p) { return p.recommended; }).length;
      el.foot.textContent = '共 ' + P.presets.length + ' 套模板 · ' + catCount + ' 个分类 · 推荐 ' + recommendedCount + ' 套';
    }

    el.copy.addEventListener('click', copyName);
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var pos = cardOrder.indexOf(state.index);
      if (pos === -1) pos = 0;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && n <= cardOrder.length) select(cardOrder[n - 1]);
      if (e.key === 'ArrowDown') select(cardOrder[Math.min(pos + 1, cardOrder.length - 1)]);
      if (e.key === 'ArrowUp') select(cardOrder[Math.max(pos - 1, 0)]);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
