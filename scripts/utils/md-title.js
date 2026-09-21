/**
 * 从结构化 Markdown 里取文章标题。
 *
 * 约定：文章标题写在 frontmatter 的 `title:` 里，**不在正文里**；
 * 这里按 frontmatter → 第一个 `#` 标题 → 文件名的顺序兜底，
 * 供 preview-studio.js / build-gallery.js 共用，避免两处各写一份走样。
 */

'use strict';

const fs = require('fs');
const path = require('path');

function extractTitle(mdPath, fallback = '') {
  try {
    const content = fs.readFileSync(mdPath, 'utf-8');
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatter) {
      const matched = frontmatter[1].match(/^\s*title\s*:\s*(.+)$/m);
      if (matched) {
        const unquoted = matched[1].trim().replace(/^["']([\s\S]*)["']$/, '$1').replace(/\\"/g, '"');
        if (unquoted) return unquoted;
      }
    }
    const line = content.split(/\r?\n/).find((l) => /^#\s+\S/.test(l));
    if (line) return line.replace(/^#\s+/, '').trim();
    return path.basename(mdPath, path.extname(mdPath));
  } catch (err) {
    return fallback;
  }
}

module.exports = { extractTitle };
