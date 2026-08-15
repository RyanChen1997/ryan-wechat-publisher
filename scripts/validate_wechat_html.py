#!/usr/bin/env python3
"""
微信 HTML 兼容性校验。

用法: python3 validate_wechat_html.py <article.html>
输出: PASS 或 FAIL + 违规详情
"""

import sys
import re

TAG_BLACKLIST = [
    r'<!DOCTYPE', r'<html', r'<head', r'<body',
    r'<style', r'<link', r'<script',
    r'<form', r'<input', r'<button', r'<select', r'<textarea',
    r'<iframe', r'<audio', r'<video', r'<object', r'<embed',
    r'<foreignObject',
    r'<!--', r'-->',
    r'<svg', r'</svg',
    r'<ul', r'</ul', r'<ol', r'</ol', r'<li', r'</li',
]

CSS_BLACKLIST = [
    (r'position\s*:\s*fixed', 'position: fixed'),
    (r'position\s*:\s*sticky', 'position: sticky'),
    (r'float\s*:', 'float'),
    (r'clear\s*:', 'clear'),
    (r'z-index\s*:', 'z-index'),
    (r'filter\s*:', 'filter'),
    (r'columns\s*:', 'columns'),
    (r'@font-face', '@font-face'),
    (r'margin-[a-z]+\s*:\s*-[3-9]\d', '负 margin (≥30px)'),
    (r'margin-[a-z]+\s*:\s*-\d{3,}', '负 margin (≥100px)'),
]


def main():
    if len(sys.argv) < 2:
        print("用法: python3 validate_wechat_html.py <article.html>")
        sys.exit(1)

    html_path = sys.argv[1]
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    violations = []

    for pattern in TAG_BLACKLIST:
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for m in matches:
            line_num = content[:m.start()].count('\n') + 1
            violations.append(f"[标签] 第{line_num}行: {m.group()[:40]}")

    svg_data_uri = re.finditer(r'data:image/svg\+xml', content, re.IGNORECASE)
    for m in svg_data_uri:
        line_num = content[:m.start()].count('\n') + 1
        violations.append(f"[SVG] 第{line_num}行: base64 SVG（公众号不兼容，请转 PNG）")

    style_pattern = re.compile(r'style="([^"]*)"', re.IGNORECASE)
    for m in style_pattern.finditer(content):
        style_val = m.group(1)
        line_num = content[:m.start()].count('\n') + 1
        for css_pattern, desc in CSS_BLACKLIST:
            if re.search(css_pattern, style_val, re.IGNORECASE):
                violations.append(f"[CSS] 第{line_num}行: {desc}")
                break

    if not violations:
        print("PASS")
        print(f"文件大小: {len(content)} bytes")
    else:
        print("FAIL")
        print(f"违规数: {len(violations)}")
        print("---")
        for v in violations[:50]:
            print(v)
        if len(violations) > 50:
            print(f"... 还有 {len(violations) - 50} 条")

    sys.exit(0 if not violations else 1)


if __name__ == '__main__':
    main()
