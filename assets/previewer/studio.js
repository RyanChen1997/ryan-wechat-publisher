/* ===========================================================================
   公众号排版预览器（Studio）交互层
   数据来源：window.__STUDIO__（由 scripts/preview-studio.js 注入）
   所有计算都在 Node 侧完成，这里只负责展示与「复制到公众号」。
   =========================================================================== */
(function () {
  'use strict';

  var P = window.__STUDIO__ || {};
  var state = { device: 'mobile', mode: 'light', failedImages: 0 };   // 默认手机端：先看手机效果，要对比编辑器宽度再切电脑端

  var el = {
    chip: document.getElementById('preset-chip'),
    side: document.getElementById('side'),
    device: document.getElementById('device'),
    canvas: document.getElementById('canvas'),
    wx: document.getElementById('wx'),
    title: document.getElementById('stage-title'),
    meta: document.getElementById('stage-meta'),
    foot: document.getElementById('stage-foot'),
    copyBtn: document.getElementById('copy-btn'),
    toast: document.getElementById('toast'),
    hostSwitch: document.getElementById('host-switch'),
    hostSwitchWrap: document.getElementById('host-switch-wrap'),
    busy: document.getElementById('busy'),
    busyTitle: document.getElementById('busy-title'),
    busyFill: document.getElementById('busy-fill'),
    busyNote: document.getElementById('busy-note'),
  };

  // ---------- 图床开关（默认勾选，随时可关）----------
  var hostPlan = (P.copy && P.copy.upload && P.copy.upload.available) ? P.copy.upload : null;
  var hostOn = !!(hostPlan && hostPlan.enabled);

  function initHostSwitch() {
    if (!el.hostSwitchWrap) return;
    if (!hostPlan) { el.hostSwitchWrap.hidden = true; return; }
    el.hostSwitchWrap.hidden = false;
    el.hostSwitch.checked = hostOn;
    el.hostSwitch.addEventListener('change', function () {
      hostOn = el.hostSwitch.checked;
      renderSide();
    });
  }

  // 点击时上传图床的进度遮罩
  var busyTimer = null;
  function showBusy(total) {
    if (!el.busy) return;
    document.body.dataset.busy = '1';
    el.busy.hidden = false;
    el.busyTitle.textContent = '正在上传图片到 ' + ((P.copy && P.copy.upload && P.copy.upload.label) || '图床') + '…';
    el.busyFill.style.width = '0%';
    el.busyNote.textContent = '0 / ' + total + ' 张 · 上传完成后会自动复制到剪贴板，请不要关闭页面。';
  }

  function setBusyProgress(done, total, label) {
    if (!el.busy) return;
    var pct = total ? Math.round((done / total) * 100) : 0;
    el.busyFill.style.width = pct + '%';
    el.busyNote.textContent = done + ' / ' + total + ' 张' + (label ? ' · ' + label : '') + ' · 上传完成后会自动复制到剪贴板，请不要关闭页面。';
  }

  function hideBusy() {
    if (!el.busy) return;
    el.busy.hidden = true;
    delete document.body.dataset.busy;
  }

  // 同一个 data URI 只传一次（重复点「复制」也不重新上传）
  var uploadMemo = {};
  var uriList = null;

  // 清单里只存了「第几个唯一 data URI」，用 Node 侧给的正则按同样顺序取回本体
  function allDataUris() {
    if (uriList) return uriList;
    var html = (P.copy && P.copy.html) || '';
    var pattern = (hostPlan && hostPlan.uriPattern) || 'data:[a-z0-9.+-]+\\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+';
    var re = new RegExp(pattern, 'gi');
    var seen = {};
    var list = [];
    var m;
    while ((m = re.exec(html))) {
      if (!seen[m[0]]) { seen[m[0]] = 1; list.push(m[0]); }
    }
    uriList = list;
    return uriList;
  }

  // 把内联 base64 的图逐张传到图床，返回 data URI → https 链接 的映射
  async function uploadImages(plan) {
    var items = plan.items || [];
    var map = {};
    var failed = 0;
    var done = 0;
    showBusy(items.length);
    try {
      var queue = items.slice();
      var workers = [];
      var concurrency = Math.min(3, queue.length);
      for (var i = 0; i < concurrency; i++) {
        workers.push((async function () {
          var uris = allDataUris();
          while (queue.length) {
            var item = queue.shift();
            var dataUri = uris[item.i];
            if (!dataUri) { failed += 1; done += 1; setBusyProgress(done, items.length, '“' + (item.name || '') + '”定位失败，保留内联'); continue; }
            if (uploadMemo[dataUri]) {
              map[dataUri] = uploadMemo[dataUri];
              done += 1;
              setBusyProgress(done, items.length, '已复用上次上传');
              continue;
            }
            try {
              var blob = await (await fetch(dataUri)).blob();
              var form = new FormData();
              form.append('reqtype', 'fileupload');
              form.append('time', plan.time || '72h');
              form.append('fileToUpload', blob, item.name || 'image.png');
              var response = await fetch(plan.endpoint, { method: 'POST', body: form });
              var text = (await response.text()).trim();
              if (!response.ok || !/^https?:\/\/\S+$/i.test(text)) throw new Error(text.slice(0, 80) || ('HTTP ' + response.status));
              map[dataUri] = text;
              uploadMemo[dataUri] = text;
              done += 1;
              setBusyProgress(done, items.length, item.name);
            } catch (err) {
              failed += 1;
              done += 1;
              setBusyProgress(done, items.length, '“' + (item.name || '') + '”上传失败，保留内联');
            }
          }
        })());
      }
      await Promise.all(workers);
    } finally {
      hideBusy();
    }
    return { map: map, failed: failed };
  }

  // ---------- 工具 ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function $(sel) { return document.querySelector(sel); }

  function kb(n) {
    if (!n) return '0 KB';
    return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
  }

  var toastTimer = null;
  function toast(message, tone) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.dataset.tone = tone || 'ok';
    el.toast.hidden = false;
    el.toast.dataset.show = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.dataset.show = '0';
      setTimeout(function () { if (el.toast.dataset.show === '0') el.toast.hidden = true; }, 220);
    }, 4200);
  }

  // ---------- 预览渲染 ----------
  function currentHtml() {
    return state.mode === 'dark' ? P.html.dark : P.html.light;
  }

  function paintArticle() {
    el.wx.innerHTML = currentHtml();
    el.canvas.style.background = state.mode === 'dark' ? '#191919' : '#ffffff';
    state.failedImages = 0;
    Array.prototype.forEach.call(el.wx.querySelectorAll('img'), function (img) {
      img.addEventListener('error', function () {
        state.failedImages++;
        renderSide();
      });
    });
  }

  function setDevice(device) {
    state.device = device;
    el.device.dataset.device = device;
    Array.prototype.forEach.call(document.querySelectorAll('[data-device]'), function (btn) {
      if (btn.classList.contains('seg-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.device === device));
    });
    var meta = el.device.dataset.device === 'mobile' ? '375 × 812（手机端）' : '677px（电脑端 · 公众号编辑器宽度）';
    el.meta.textContent = meta;
  }

  function setMode(mode) {
    state.mode = mode;
    document.documentElement.dataset.theme = mode;
    paintArticle();
    Array.prototype.forEach.call(document.querySelectorAll('.seg-btn[data-mode]'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
    renderSide();
  }

  // ---------- 侧栏 ----------
  var KIND_LABEL = {
    wechat: { label: '已上传微信', dot: 'ok', hint: '复制后图片正常显示' },
    external: { label: '外链图片', dot: 'warn', hint: '非微信域名，公众号可能过滤成空白' },
    local: { label: '本地路径', dot: 'danger', hint: '粘贴到公众号后会丢图' },
    data: { label: '内联 data:', dot: 'danger', hint: '公众号会过滤 data: 图片' },
  };

  function card(title, body) {
    return '<div class="card"><h2 class="card-title">' + esc(title) + '</h2>' + body + '</div>';
  }

  function row(label, value, dot) {
    return '<div class="row">' +
      '<span class="row-label">' + (dot ? '<span class="dot dot-' + dot + '"></span>' : '') + esc(label) + '</span>' +
      '<span class="row-value">' + esc(value) + '</span>' +
      '</div>';
  }

  var uploadPlan = hostOn ? hostPlan : null;

  function renderSide() {
    uploadPlan = hostOn ? hostPlan : null;
    var preset = P.preset || {};
    var images = P.images || { total: 0, byKind: {}, list: [] };
    var copy = P.copy || {};
    var checks = P.checks || {};
    var html = '';

    // 模板
    html += card('当前模板',
      '<p class="preset-name">' + esc(preset.name || preset.id) + '</p>' +
      '<p class="preset-desc">' + esc(preset.tagline || '') + '</p>' +
      '<dl class="kv">' +
      '<dt>ID</dt><dd class="mono">' + esc(preset.id) + '</dd>' +
      (preset.categoryName ? '<dt>分类</dt><dd>' + esc(preset.categoryName) + '</dd>' : '') +
      (preset.suitableFor && preset.suitableFor.length ? '<dt>适合</dt><dd>' + esc(preset.suitableFor.join('、')) + '</dd>' : '') +
      '<dt>标题偏移</dt><dd>' + esc(P.headingOffset === 0 ? '0（默认）' : String(P.headingOffset)) + '</dd>' +
      '<dt>生成于</dt><dd>' + esc(P.generatedAt) + '</dd>' +
      '</dl>');

    // 图片
    var isInline = copy.imageMode === 'inline';
    var imgRows = '';
    ['wechat', 'external', 'local', 'data'].forEach(function (kind) {
      var n = (images.byKind && images.byKind[kind]) || 0;
      if (n > 0) imgRows += row(KIND_LABEL[kind].label, n + ' 张', isInline ? 'mute' : KIND_LABEL[kind].dot);
    });
    if (isInline && copy.inlined) imgRows += row('已内联进复制内容', copy.inlined + ' 张', 'ok');
    if (uploadPlan && uploadPlan.enabled) imgRows += row('复制时上传图床', uploadPlan.count + ' 张', 'ok');
    if (!images.total) imgRows = row('共 0 张', '纯文字排版', 'ok');
    if (state.failedImages > 0) imgRows += row('预览加载失败', state.failedImages + ' 张', 'danger');

    var imgList = '';
    if (images.list && images.list.length) {
      imgList = '<details class="imgs"><summary>查看图片清单（' + images.list.length + '）</summary><ul class="img-list">' +
        images.list.map(function (item, i) {
          return '<li><span class="idx">' + (i + 1) + '</span><span class="src">' + esc(item.src) + '</span></li>';
        }).join('') +
        '</ul></details>';
    }

    var imgNote = '';
    if (isInline) {
      imgNote += '<p class="note">图片已内联进复制内容（' + kb(copy.inlinedBytes) + (copy.inlinedCompressed ? '，' + copy.inlinedCompressed + ' 张压缩过' : '') +
        '），粘贴时由公众号编辑器转存到自己的服务器 —— 不需要本地服务或云托管。</p>';
      if (copy.missingLocalImages > 0) {
        imgNote += '<p class="note note-danger">有 ' + copy.missingLocalImages + ' 张本地图片找不到文件，复制后会缺图。</p>';
      }
    } else if ((images.byKind && images.byKind.local) || (images.byKind && images.byKind.data)) {
      imgNote = '<p class="note note-danger">有本地图片没内联进复制内容 —— 粘贴后这些位置会缺图，用 Chrome/Edge 重开或检查图片文件是否存在。</p>';
    } else if ((images.byKind && images.byKind.external)) {
      imgNote = '<p class="note note-warn">存在外链图片：非微信域名的图片可能被过滤成空白，建议换成微信图片地址或下载到本地后再复制。</p>';
    }

    if (uploadPlan) {
      imgNote += '<p class="note">点「复制到公众号」时会把 <b>' + esc(uploadPlan.count) + ' 张图</b>（' + kb(uploadPlan.bytes) + '）传到 ' + esc(uploadPlan.label) +
        '，复制内容里换成 https 链接，粘贴成功后由微信转存到自己服务器。' +
        '<b>链接 ' + esc(uploadPlan.timeLabel) + '后失效，请在过期前发布</b>；上传失败的图会自动保留内联 base64。</p>';
    } else if (hostPlan) {
      imgNote += '<p class="note note-warn">图床已关闭：复制内容会用内联 base64（单张很大的图可能粘贴失败）。' +
        '勾选顶栏的「复制时传图床」，就能在复制时把 ' + esc(hostPlan.count) + ' 张图传到 ' + esc(hostPlan.label) + '、换成 https 链接。</p>';
    }
    html += card('图片（' + (images.total || 0) + ' 张）', '<div class="rows">' + imgRows + '</div>' + imgNote + imgList);
    // 夜间体检
    var verdictPill = {
      ok: '<span class="pill pill-ok">夜间无明显问题</span>',
      notice: '<span class="pill pill-warn">夜间灰阶偏多</span>',
      warn: '<span class="pill pill-danger">夜间马赛克风险</span>',
    }[checks.verdict || 'ok'];
    html += card('夜间模式体检',
      verdictPill +
      '<div class="rows" style="margin-top:10px">' +
      row('中灰块', (checks.darkMidGray || 0) + ' 种', checks.verdict === 'ok' ? 'ok' : 'warn') +
      row('背景色总数', (checks.darkTotalBg || 0) + ' 种', (checks.darkTotalBg || 0) > 10 ? 'warn' : 'ok') +
      '</div>' +
      '<p class="note">' + esc(checks.message || '') + ' 点上方「夜间」切到夜间预览复核。</p>');

    // 复制准备度
    var source = copy.source ? copy.source.split('/').slice(-1)[0] : '（未找到发布版 HTML）';
    var imageStatus = uploadPlan && uploadPlan.enabled
      ? uploadPlan.count + ' 张待上传（点击时）'
      : (isInline ? (copy.inlined ? copy.inlined + ' 张已内联' : '无图或未内联') : (copy.ready ? '可直接使用' : '需先处理'));
    html += card('复制到公众号',
      '<div class="rows">' +
      row('内容来源', source, copy.ready ? 'ok' : 'warn') +
      row('图片状态', imageStatus, copy.ready ? 'ok' : 'warn') +
      '</div>' +
      '<ol class="steps">' +
      '<li>点右上角「复制到公众号」</li>' +
      '<li>打开公众号编辑器新建图文</li>' +
      '<li>正文区粘贴（<kbd>⌘V</kbd> / <kbd>Ctrl+V</kbd>）</li>' +
      '<li>补标题、封面后保存草稿</li>' +
      '</ol>' +
      '<p class="note">复制的是<b>发布版</b>内容，与当前日夜/端预览无关。' + (isInline ? '图片已内联，粘贴后公众号会自动转存。' : '') + '</p>');

    el.side.innerHTML = html;

    // 顶栏
    el.chip.textContent = (preset.name || preset.id || '未指定模板') + ' · ' + (preset.id || '');
    el.title.textContent = P.title || '未命名文章';
    el.foot.innerHTML = '复制后样式会以内联方式保留，不会复原。快捷键：<kbd>D</kbd> 日夜切换 · <kbd>M</kbd> 手机端';

    el.copyBtn.dataset.tone = copy.ready ? 'ok' : 'warn';
  }

  // ---------- 复制 ----------
  function buildCopyHtml() {
    return '<section style="font-size:17px;line-height:1.75;color:#333333;font-family:-apple-system,BlinkMacSystemFont,\'Helvetica Neue\',\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">'
      + (P.copy && P.copy.html ? P.copy.html : '')
      + '</section>';
  }

  var copying = false;

  async function copyToWeChat() {
    if (copying) return;
    var html = buildCopyHtml();
    var text = (P.copy && P.copy.text) || el.wx.innerText || '';
    var ok = false;
    var uploadFailed = 0;
    var uploadedCount = 0;

    // 开了图床时，先上传（带进度条），再把内联 base64 换成 https 链接
    if (uploadPlan) {
      copying = true;
      if (el.copyBtn) el.copyBtn.disabled = true;
      try {
        var result = await uploadImages(uploadPlan);
        uploadFailed = result.failed;
        Object.keys(result.map).forEach(function (dataUri) {
          uploadedCount += 1;
          html = html.split(dataUri).join(result.map[dataUri]);
        });
      } catch (err) {
        uploadFailed = uploadPlan.count;
      } finally {
        copying = false;
        if (el.copyBtn) el.copyBtn.disabled = false;
      }
    }


    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })]);
        ok = true;
      }
    } catch (err) {
      ok = false;
    }

    if (!ok) ok = legacyCopy(html);

    if (!ok) {
      // 兜底：帮用户选中正文，手动 ⌘C 也能拿到完整内联样式
      setMode('light');
      const selected = selectStageContent();
      toast(selected
        ? '浏览器拦截了剪贴板访问，已帮你选中正文：按 ⌘C（Ctrl+C）复制即可。'
        : '复制失败：浏览器拒绝了剪贴板访问。请改用 Chrome/Edge 打开，或用 http://localhost 方式提供服务。', 'danger');
      return;
    }

    if (uploadPlan && uploadedCount) {
      toast('已复制：' + uploadedCount + ' 张图片已传到 ' + uploadPlan.label + '（链接 ' + uploadPlan.timeLabel + '后失效，记得在过期前发布）' +
        (uploadFailed ? '，' + uploadFailed + ' 张上传失败已保留内联。' : '。'), uploadFailed ? 'warn' : 'ok');
    } else if (P.copy && P.copy.ready) {
      toast(P.copy.imageMode === 'inline' && P.copy.inlined
        ? '已复制（' + P.copy.inlined + ' 张图片已内联，粘贴后由公众号自动转存）。'
        : '已复制到剪贴板，去公众号编辑器直接粘贴即可。', 'ok');
    } else {
      toast('已复制，但复制内容里还有本地图片地址 —— 粘贴后图片位置会是空的，正文样式正常。', 'warn');
    }
  }

  // file:// 或旧浏览器下 ClipboardItem 可能不可用，退回选区复制（同样保留内联样式）
  function selectStageContent() {
    try {
      var range = document.createRange();
      range.selectNodeContents(el.wx);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return sel.toString().length > 0;
    } catch (err) {
      return false;
    }
  }

  function legacyCopy(html) {
    var holder = document.createElement('div');
    holder.setAttribute('contenteditable', 'true');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;';
    holder.innerHTML = html;
    document.body.appendChild(holder);

    var ok = false;
    try {
      var range = document.createRange();
      range.selectNodeContents(holder);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ok = document.execCommand('copy');
      sel.removeAllRanges();
    } catch (err) {
      ok = false;
    }
    holder.parentNode.removeChild(holder);
    return ok;
  }

  // ---------- 初始化 ----------
  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.seg-btn[data-device]'), function (btn) {
      btn.addEventListener('click', function () { setDevice(btn.dataset.device); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.seg-btn[data-mode]'), function (btn) {
      btn.addEventListener('click', function () { setMode(btn.dataset.mode); });
    });
    el.copyBtn.addEventListener('click', copyToWeChat);

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'd' || e.key === 'D') setMode(state.mode === 'dark' ? 'light' : 'dark');
      if (e.key === 'm' || e.key === 'M') setDevice(state.device === 'mobile' ? 'desktop' : 'mobile');
    });

    setDevice('mobile');
    setMode('light');
    initHostSwitch();
    renderSide();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
