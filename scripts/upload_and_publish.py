#!/usr/bin/env python3
"""
图片上传 + 草稿创建。

直接通过 HTTP 调用微信云托管服务的 API，不再走 CLI 解析。
API 路径：
  POST /api/image/upload        → 上传内联图，返回 {url, ...}
  POST /api/material/upload     → 上传永久素材（封面），返回 {media_id, ...}
  POST /api/draft/create        → 创建草稿，返回 {media_id, ...}

用法: python3 upload_and_publish.py \
         --html <body.html> \
         --title <文章标题> \
         --cover <封面图路径> \
         [--digest <摘要>] \
         [--author <作者>] \
         [--article-dir <文章目录>] \
         [--output-dir <输出目录>] \
         [--publisher-url <WECHAT_PUBLISHER_URL>]
"""

import argparse
import os
import sys
import re
import json
import mimetypes

try:
    import requests
except ImportError:
    print("缺少依赖: requests（图片上传和草稿创建需要）", file=sys.stderr)
    print("请先安装: pip install requests", file=sys.stderr)
    sys.exit(1)


def get_publisher_url(cli_url):
    url = cli_url or os.environ.get('WECHAT_PUBLISHER_URL', '').strip().rstrip('/')
    if not url:
        print("ERROR: WECHAT_PUBLISHER_URL 未设置", file=sys.stderr)
        print("", file=sys.stderr)
        print("设置方式：", file=sys.stderr)
        print("  export WECHAT_PUBLISHER_URL=https://xxx.ap-shanghai.run.tcloudbase.com", file=sys.stderr)
        print("", file=sys.stderr)
        print("URL 获取位置：", file=sys.stderr)
        print("  微信云托管控制台 → 服务列表 → 你的服务 → 服务设置 / 访问域名", file=sys.stderr)
        sys.exit(2)
    return url


def errcode_hint(errcode):
    hints = {
        40164: "invalid ip — 必须在云托管容器内调用，请确认 URL 是云托管公网域名",
        45001: "media size out — 单图 ≤ 10MB",
        45004: "description too long — digest ≤ 120 字符",
        45009: "daily quota exceeded — 当日调用配额用完",
        48001: "api unauthorized — 云托管权限没配（云调用 → 微信令牌权限配置），或环境是小程序不是公众号",
    }
    return hints.get(int(errcode), "")


def api_post(base_url, path, files=None, data=None, json_body=None, timeout=60):
    """统一的 API 调用封装"""
    url = f"{base_url}{path}"
    try:
        r = requests.post(url, files=files, data=data, json=json_body, timeout=timeout)
    except requests.exceptions.ConnectionError as e:
        print(f"连接失败: {e}", file=sys.stderr)
        print("请检查 WECHAT_PUBLISHER_URL 是否正确，或服务是否正常运行", file=sys.stderr)
        sys.exit(3)

    try:
        body = r.json()
    except json.JSONDecodeError:
        print(f"响应不是 JSON（status={r.status_code}）: {r.text[:200]}", file=sys.stderr)
        sys.exit(3)

    if r.status_code != 200 or not body.get("ok"):
        err = body.get("error", {}) if isinstance(body, dict) else {}
        msg = err.get("message", "unknown")
        code = err.get("errcode", "")
        print(f"API 调用失败 {path}: status={r.status_code}, message={msg}", file=sys.stderr)
        if code:
            print(f"  errcode: {code}", file=sys.stderr)
            hint = errcode_hint(code)
            if hint:
                print(f"  提示: {hint}", file=sys.stderr)
        sys.exit(3)

    return body.get("data", {})


def upload_inline_image(base_url, file_path):
    """上传内联图，返回微信 URL"""
    path = os.path.expanduser(file_path)
    if not os.path.isfile(path):
        print(f"文件不存在: {path}", file=sys.stderr)
        return None

    mime, _ = mimetypes.guess_type(path)
    mime = mime or "application/octet-stream"

    with open(path, "rb") as f:
        data = api_post(
            base_url, "/api/image/upload",
            files={"file": (os.path.basename(path), f, mime)},
        )
    return data.get("url")


def upload_material(base_url, file_path, media_type="image"):
    """上传永久素材（封面），返回 media_id"""
    path = os.path.expanduser(file_path)
    if not os.path.isfile(path):
        print(f"文件不存在: {path}", file=sys.stderr)
        return None

    mime, _ = mimetypes.guess_type(path)
    mime = mime or "application/octet-stream"

    with open(path, "rb") as f:
        data = api_post(
            base_url, "/api/material/upload",
            files={"file": (os.path.basename(path), f, mime)},
            data={"type": media_type},
        )
    return data.get("media_id")


def create_draft(base_url, title, content, thumb_media_id, digest="", author=""):
    """创建草稿，返回 data（含 media_id）"""
    article = {
        "title": title,
        "author": author,
        "digest": digest,
        "content": content,
        "thumb_media_id": thumb_media_id,
        "content_source_url": "",
        "show_cover_pic": 1,
        "need_open_comment": 1,
        "only_fans_can_comment": 0,
    }
    return api_post(base_url, "/api/draft/create", json_body={"article": article})


def find_local_images(html_content, article_dir):
    """找出 HTML 中所有本地图片路径（非 http/ 和非 data:）"""
    images = []
    seen = set()

    for m in re.finditer(r'<img[^>]+(?:src|data-src)="([^"]+)"', html_content, re.IGNORECASE):
        src = m.group(1)
        if src.startswith('http://') or src.startswith('https://') or src.startswith('data:'):
            continue
        if src in seen:
            continue
        seen.add(src)

        if os.path.isabs(src):
            abs_path = src
        else:
            abs_path = os.path.join(article_dir, src)
        abs_path = os.path.normpath(abs_path)

        if os.path.exists(abs_path):
            images.append({'original': src, 'abs_path': abs_path})
        else:
            print(f"[警告] 图片不存在: {src}", file=sys.stderr)

    return images


def main():
    parser = argparse.ArgumentParser(description='上传图片 + 创建公众号草稿')
    parser.add_argument('--html', required=True, help='HTML 文件路径（发布版，data-src）')
    parser.add_argument('--title', required=True, help='文章标题')
    parser.add_argument('--cover', default=None, help='封面图路径')
    parser.add_argument('--digest', default=None, help='摘要（≤120字）')
    parser.add_argument('--author', default=None, help='作者')
    parser.add_argument('--article-dir', default=None, help='文章所在目录（解析相对路径用）')
    parser.add_argument('--output-dir', default=None, help='输出目录（默认与 HTML 同目录）')
    parser.add_argument('--publisher-url', default=None, help='WECHAT_PUBLISHER_URL（也可用环境变量）')
    args = parser.parse_args()

    base_url = get_publisher_url(args.publisher_url)

    with open(args.html, 'r', encoding='utf-8') as f:
        html_content = f.read()

    article_dir = args.article_dir or os.path.dirname(os.path.abspath(args.html))
    output_dir = args.output_dir or article_dir
    os.makedirs(output_dir, exist_ok=True)

    images = find_local_images(html_content, article_dir)
    print(f"找到 {len(images)} 张本地图片")

    uploaded_map = {}
    failed_images = []
    for i, img in enumerate(images):
        print(f"上传图片 ({i+1}/{len(images)}): {os.path.basename(img['abs_path'])}", end=' ')
        sys.stdout.flush()
        wx_url = upload_inline_image(base_url, img['abs_path'])
        if wx_url:
            uploaded_map[img['original']] = wx_url
            print("✓")
        else:
            print("✗ 失败")
            failed_images.append(img['original'])

    images_map_path = os.path.join(output_dir, 'images-uploaded.json')
    with open(images_map_path, 'w', encoding='utf-8') as f:
        json.dump({'uploaded': uploaded_map, 'failed': failed_images}, f, ensure_ascii=False, indent=2)
    print(f"图片映射表已保存: {images_map_path}")

    if failed_images:
        print(f"警告: {len(failed_images)} 张图片上传失败，将保留原始路径", file=sys.stderr)

    final_html = html_content
    for original, wx_url in uploaded_map.items():
        final_html = final_html.replace(f'src="{original}"', f'src="{wx_url}"')
        final_html = final_html.replace(f'data-src="{original}"', f'data-src="{wx_url}"')

    final_html_path = os.path.join(output_dir, 'final-content.html')
    with open(final_html_path, 'w', encoding='utf-8') as f:
        f.write(final_html)
    print(f"最终 HTML 已保存: {final_html_path}")

    thumb_media_id = None
    if args.cover:
        print(f"上传封面图: {os.path.basename(args.cover)}", end=' ')
        sys.stdout.flush()
        thumb_media_id = upload_material(base_url, args.cover)
        if thumb_media_id:
            print(f"✓ (media_id: {thumb_media_id})")
        else:
            print("✗ 失败")

    if not thumb_media_id:
        print("错误: 没有有效的封面图 media_id，无法创建草稿", file=sys.stderr)
        sys.exit(1)

    digest = args.digest or ""
    if len(digest) > 120:
        print(f"警告: digest 超过 120 字符（{len(digest)}），将被截断", file=sys.stderr)
        digest = digest[:120]

    print("创建草稿...", end=' ')
    sys.stdout.flush()
    result = create_draft(
        base_url,
        title=args.title,
        content=final_html,
        thumb_media_id=thumb_media_id,
        digest=digest,
        author=args.author or "",
    )
    print("✓")

    result_path = os.path.join(output_dir, 'draft-result.json')
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"草稿创建结果已保存: {result_path}")

    media_id = result.get('media_id', '')
    print(f"\n✓ 草稿创建成功！media_id: {media_id}")
    print("请前往公众号后台 → 内容与互动 → 草稿箱 预览并发布")


if __name__ == '__main__':
    main()
