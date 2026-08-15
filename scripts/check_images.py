#!/usr/bin/env python3
"""
图片存在性校验：检查 HTML 中所有本地图片路径是否真实存在。

用法: python3 check_images.py <article.html> [--asset-dir DIR]...
输出: PASS 或 FAIL + 缺失图片列表
"""

import sys
import re
import os
import html as html_mod


def extract_images(html_content, use_local_path=True):
    """从 HTML 中提取图片路径"""
    src_attr = 'src' if use_local_path else 'data-src'
    pattern = re.compile(rf'<img[^>]+{src_attr}="([^"]+)"', re.IGNORECASE)
    matches = pattern.findall(html_content)
    return [html_mod.unescape(m) for m in matches]


def resolve_image(img_src, asset_dirs):
    """在所有 asset 目录中查找图片，返回绝对路径或 None"""
    if re.match(r'^https?://', img_src) or img_src.startswith('data:'):
        return img_src

    if os.path.isabs(img_src) and os.path.exists(img_src):
        return img_src

    for d in asset_dirs:
        p = os.path.join(d, img_src)
        if os.path.exists(p):
            return os.path.abspath(p)

    return None


def main():
    if len(sys.argv) < 2:
        print("用法: python3 check_images.py <article.html> [--asset-dir DIR]...")
        sys.exit(1)

    html_path = sys.argv[1]
    asset_dirs = []
    for i, arg in enumerate(sys.argv[2:]):
        if arg == '--asset-dir' and i + 1 < len(sys.argv) - 2:
            asset_dirs.append(sys.argv[2:][i + 1])

    html_dir = os.path.dirname(os.path.abspath(html_path))
    if html_dir not in asset_dirs:
        asset_dirs.append(html_dir)

    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    img_paths = extract_images(content, use_local_path=True)
    if not img_paths:
        img_paths = extract_images(content, use_local_path=False)

    if not img_paths:
        print("PASS")
        print("未找到图片")
        sys.exit(0)

    missing = []
    found = []
    for p in img_paths:
        resolved = resolve_image(p, asset_dirs)
        if resolved:
            found.append((p, resolved))
        else:
            missing.append(p)

    if not missing:
        print(f"PASS")
        print(f"共 {len(found)} 张图片，全部存在")
    else:
        print(f"FAIL")
        print(f"共 {len(img_paths)} 张图片，缺失 {len(missing)} 张")
        print("---")
        for m in missing:
            print(f"  缺失: {m}")

    sys.exit(0 if not missing else 1)


if __name__ == '__main__':
    main()
