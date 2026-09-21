#!/usr/bin/env node
/**
 * 本地静态文件服务器（带 CORS），供「图片粘贴探针」验证 http://127.0.0.1 这种图片源能否被公众号编辑器抓取。
 *
 * 用法：
 *   node scripts/utils/static-server.js <目录> [--port 8791]
 *
 * 启动后常驻，测试完直接 Ctrl+C 或 kill 掉即可。
 */

'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
};

function main() {
  const args = process.argv.slice(2);
  let root = null;
  let port = 8791;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') port = parseInt(args[++i], 10);
    else if (!root) root = args[i];
  }
  if (!root) {
    console.error('用法: node scripts/utils/static-server.js <目录> [--port 8791]');
    process.exit(1);
  }

  const rootDir = path.resolve(root);

  const server = http.createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (err) {
      res.writeHead(400).end('bad request');
      return;
    }
    const filePath = path.join(rootDir, rel);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`静态服务器已启动: http://127.0.0.1:${port}/  → ${rootDir}`);
    console.log('（测试完可直接关掉这个终端 / kill 掉进程）');
  });
  server.on('error', (err) => {
    console.error(`启动失败: ${err.message}`);
    process.exit(1);
  });
}

main();
