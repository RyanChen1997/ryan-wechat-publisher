function requireOrExit(modName, usage) {
  try {
    return require(modName);
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND') {
      console.error(`缺少依赖模块: ${modName}（${usage}）`);
      console.error('请在 skill 目录下执行: npm install');
      process.exit(1);
    }
    throw e;
  }
}

const request = requireOrExit('request-promise', '复刻抓取功能需要该模块');
const cheerio = requireOrExit('cheerio', '复刻抓取功能需要该模块');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildAssetInventory, imageFormat } = require('./asset_inventory');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36';

function isValidWechatUrl(url) {
  return /https?:\/\/mp\.weixin\.qq\.com/.test(url) ||
         /https?:\/\/weixin\.sogou\.com/.test(url);
}

function extractMeta(rawHtml) {
  const meta = {};
  const scripts = rawHtml.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi) || [];

  const fields = ['msg_title', 'msg_desc', 'msg_cdn_url', 'msg_link', 'nickname', 'ct'];
  for (const field of fields) {
    const reg = new RegExp(`var\\s+${field}\\s*=`);
    for (const script of scripts) {
      if (reg.test(script)) {
        try {
          const line = script.split('\n').filter(l => reg.test(l))[0];
          const fn = new Function(`${line}\nreturn ${field};`);
          meta[field] = fn();
        } catch (e) {}
        break;
      }
    }
  }

  return meta;
}

function cleanJsContent(jsContentHtml) {
  const $ = cheerio.load(jsContentHtml, { decodeEntities: false });

  $('[data-src]').each((i, el) => {
    $(el).attr('src', $(el).attr('data-src'));
    $(el).removeAttr('data-src');
  });

  $('mp-style-type, mp-common-profile, mp-common-clipboard').remove();
  $('[style*="display: none"]').remove();

  let html = $.html();
  html = html.replace(/&amp;amp;/g, '&');
  return html;
}

function extensionFromContentType(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return ({
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  })[type] || null;
}

async function downloadInventoryAssets(inventory, outputDir, referer) {
  const assetDir = path.join(outputDir, 'template-assets');
  fs.mkdirSync(assetDir, { recursive: true });

  async function download(asset) {
    if (!asset.src || !/^https?:\/\/|^\/\//.test(asset.src)) {
      asset.download_error = '不是可下载的 HTTP(S) 地址';
      return;
    }
    const uri = asset.src.startsWith('//') ? `https:${asset.src}` : asset.src;
    try {
      const response = await request({
        uri,
        method: 'GET',
        encoding: null,
        resolveWithFullResponse: true,
        headers: {
          'user-agent': USER_AGENT,
          Referer: referer,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });
      const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body);
      const contentType = response.headers['content-type'] || '';
      const extension = imageFormat(uri) || extensionFromContentType(contentType) || 'bin';
      const fileName = `asset-${String(asset.index + 1).padStart(3, '0')}.${extension}`;
      const target = path.join(assetDir, fileName);
      fs.writeFileSync(target, body);
      asset.local_path = path.relative(outputDir, target);
      asset.format = extension;
      if (asset.classification) asset.classification.animated = extension === 'gif';
      asset.mime_type = contentType.split(';')[0] || null;
      asset.byte_size = body.length;
      asset.sha256 = crypto.createHash('sha256').update(body).digest('hex');
      asset.download_error = null;
    } catch (error) {
      asset.download_error = error.message;
    }
  }

  for (let index = 0; index < inventory.assets.length; index += 4) {
    await Promise.all(inventory.assets.slice(index, index + 4).map(download));
  }
  inventory.downloaded_count = inventory.assets.filter((asset) => asset.local_path).length;
  inventory.download_failed_count = inventory.assets.filter((asset) => asset.download_error).length;
  inventory.animated_count = inventory.assets.filter((asset) => asset.format === 'gif').length;
}

function localizeTemplateImages(contentHtml, inventory) {
  const $ = cheerio.load(contentHtml, { decodeEntities: false });
  $('img').each((index, element) => {
    const localPath = inventory.assets[index] && inventory.assets[index].local_path;
    if (localPath) $(element).attr('src', localPath);
  });
  return $('body').length ? $('body').html() : $.html();
}

async function fetchTemplate(url, outputDir, options = {}) {
  if (!isValidWechatUrl(url)) {
    throw new Error('不是有效的微信公众号文章链接');
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const host = /weixin\.sogou\.com/.test(url) ? 'weixin.sogou.com' : 'mp.weixin.qq.com';

  console.log('正在抓取模板文章...');
  const rawHtml = await request({
    uri: url,
    method: 'GET',
    headers: {
      'user-agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Host': host,
    },
  });

  fs.writeFileSync(path.join(outputDir, 'template-raw.html'), rawHtml);
  console.log('  原始 HTML 已保存');

  if (!rawHtml.includes('id="js_content"')) {
    if (rawHtml.includes('访问过于频繁')) throw new Error('访问过于频繁，请稍后再试');
    if (rawHtml.includes('链接已过期')) throw new Error('链接已过期');
    throw new Error('无法找到文章正文（可能文章已删除或违规）');
  }

  const $ = cheerio.load(rawHtml, { decodeEntities: false });
  const jsContent = $('#js_content').html();
  const cleanHtml = cleanJsContent(jsContent);

  fs.writeFileSync(path.join(outputDir, 'template-content.html'), cleanHtml);
  console.log('  正文 HTML 已清洗保存');

  const inventory = buildAssetInventory(cleanHtml, { sourceUrl: url });
  if (options.downloadAssets !== false) {
    console.log(`  正在归档 ${inventory.asset_count} 张原始图片...`);
    await downloadInventoryAssets(inventory, outputDir, url);
  }
  const inventoryPath = path.join(outputDir, 'asset-inventory.json');
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
  const localContentPath = path.join(outputDir, 'template-content-local.html');
  fs.writeFileSync(localContentPath, localizeTemplateImages(cleanHtml, inventory));
  console.log(`  资产清单已保存（图片标题候选 ${inventory.image_heading_candidate_count} 处）`);

  const title = $('.rich_media_title').text().trim() || '';
  const meta = extractMeta(rawHtml);

  const result = {
    url,
    title: meta.msg_title || title,
    description: meta.msg_desc || null,
    cover: meta.msg_cdn_url || null,
    account: meta.nickname || null,
    publish_time: meta.ct ? new Date(meta.ct * 1000).toISOString() : null,
    raw_html_path: path.join(outputDir, 'template-raw.html'),
    content_html_path: path.join(outputDir, 'template-content.html'),
    local_content_html_path: localContentPath,
    asset_inventory_path: inventoryPath,
    downloaded_asset_count: inventory.downloaded_count || 0,
    content_length: cleanHtml.length,
  };

  console.log(`  标题: ${result.title}`);
  console.log(`  公众号: ${result.account}`);
  console.log(`  正文长度: ${result.content_length} bytes`);

  return result;
}

if (require.main === module) {
  const url = process.argv[2];
  const outputDir = process.argv[3] || '.';
  const downloadAssets = !process.argv.includes('--no-download-assets');

  if (!url) {
    console.error('用法: node fetch_template.js <公众号文章URL> [输出目录]');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  fetchTemplate(url, outputDir, { downloadAssets })
    .then(result => {
      fs.writeFileSync(path.join(outputDir, 'fetch-result.json'),
        JSON.stringify(result, null, 2));
      console.log('\n抓取完成 ✓');
    })
    .catch(err => {
      console.error('抓取失败:', err.message);
      process.exit(1);
    });
}

module.exports = { fetchTemplate, cleanJsContent, downloadInventoryAssets, localizeTemplateImages, USER_AGENT };
