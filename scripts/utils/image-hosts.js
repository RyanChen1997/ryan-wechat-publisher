/**
 * 图片托管（图床）适配器。
 *
 * 干什么：定义「把本地图片临时传到公有图床」的端点与时长 —— 复制到公众号时
 *   内容里放 URL，而不是把整篇图的 base64 塞进剪贴板。
 *
 * 谁来上传：**预览器页面**。用户点「复制到公众号」那一刻，浏览器把内联 base64
 *   转成 Blob 直传图床（Litterbox 上传接口带 `access-control-allow-origin: *`，
 *   且 multipart/form-data 属 CORS 安全类型、不触发预检，实测浏览器直传可用）。
 *   本文件里的 upload() 是等价的 Node 实现，供脚本/排错使用，CLI 渲染路径不再调用。
 *
 * 为什么用 Litterbox：零配置、免登录、直接上传、返回公开直链，
 *   实测图片响应带 `Access-Control-Allow-Origin: *` 且没有防盗链。
 *
 * 注意：Litterbox 是**临时**托管，最长 72 小时。公众号在发布时会把图片转存到
 *   自己的服务器，所以链接只需要活到你点发布为止。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

const USER_AGENT = 'ryan-wechat-publisher/1.1 (+https://github.com/RyanChen1997/ryan-wechat-publisher)';

const EXPIRY_HOURS = { '1h': 1, '12h': 12, '24h': 24, '72h': 72 };

const HOSTS = {
  litterbox: {
    id: 'litterbox',
    label: 'Litterbox',
    endpoint: 'https://litterbox.catbox.moe/resources/internals/api.php',
    defaultTime: '72h',
    times: Object.keys(EXPIRY_HOURS),
    /**
     * @returns {Promise<string>} 公开直链
     */
    async upload(filePath, { time = '72h', timeoutMs = 90000 } = {}) {
      const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      const buffer = fs.readFileSync(filePath);
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('time', EXPIRY_HOURS[time] ? time : '72h');
      form.append('fileToUpload', new Blob([buffer], { type: mime }), path.basename(filePath));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          body: form,
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        const text = (await response.text()).trim();
        if (!response.ok) throw new Error(`HTTP ${response.status}：${text.slice(0, 120)}`);
        if (!/^https?:\/\/\S+$/i.test(text)) throw new Error(`返回内容不是链接：${text.slice(0, 120)}`);
        return text;
      } finally {
        clearTimeout(timer);
      }
    },
  },
};

function getImageHost(id) {
  return HOSTS[String(id || '').toLowerCase()] || null;
}

function listImageHosts() {
  return Object.values(HOSTS).map((h) => `${h.id}（临时托管，最长 ${h.defaultTime}）`).join('、');
}

/** 带重试的上传：网络抖动重试 2 次，仍失败就交给调用方降级 */
async function uploadWithRetry(host, filePath, options = {}, attempts = 3) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await host.upload(filePath, options);
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
    }
  }
  throw lastError;
}

module.exports = { HOSTS, EXPIRY_HOURS, getImageHost, listImageHosts, uploadWithRetry, USER_AGENT };
