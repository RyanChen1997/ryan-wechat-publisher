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

# 夜间模式（mp-darkmode 反色算法）友好性检查，只告警不拦截。
# 规则背景：微信夜间模式对每个显式颜色独立做 HSL 亮度映射，
# 浅色淡彩背景（感知亮度 190~250）会被压成中灰色块 → 深浅不一“马赛克”。
# 正确做法：浅色背景一律写成 var(--weui-BG-1/2/3, <白天色>) 形式。
BG_COLOR_RE = re.compile(r'background(?:-color)?\s*:\s*([^;]+)', re.IGNORECASE)
VAR_BG_RE = re.compile(r'var\(--weui-', re.IGNORECASE)
RGBA_WHITE_RE = re.compile(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+)\s*\)', re.IGNORECASE)


def perceived_brightness(rgb):
    """微信官方感知亮度公式 (r*299+g*587+b*114)/1000"""
    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000


def parse_rgb(value):
    m = re.search(r'rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', value, re.IGNORECASE)
    if not m:
        m = re.search(r'#([0-9a-fA-F]{6})\b', value)
        if m:
            h = m.group(1)
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
        return None
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)))


def parse_px(style_value, property_name):
    match = re.search(rf'{property_name}\s*:\s*([\d.]+)px', style_value, re.IGNORECASE)
    return float(match.group(1)) if match else None


def is_accent_background(content, style_match, style_value, rgb):
    """高饱和强调色和小面积装饰不按大块浅背景告警。"""
    tag_start = content.rfind('<', 0, style_match.start())
    tag_end = content.find('>', style_match.end())
    opening_tag = content[tag_start:tag_end + 1] if tag_start >= 0 and tag_end >= 0 else ''
    if re.search(r'data-role="(?:decoration|generated-decoration)"', opening_tag, re.IGNORECASE):
        return True
    width = parse_px(style_value, 'width')
    height = parse_px(style_value, 'height')
    if (width is not None and width <= 32) or (height is not None and height <= 10):
        return True
    saturation_span = max(rgb) - min(rgb)
    return saturation_span >= 85


def darkmode_warnings(content):
    """返回夜间模式告警列表（不阻断 PASS/FAIL 结果）。"""
    warnings = []
    style_pattern = re.compile(r'style="([^"]*)"', re.IGNORECASE)
    bg_colors = set()
    light_bg_count = 0

    for m in style_pattern.finditer(content):
        style_val = m.group(1)
        line_num = content[:m.start()].count('\n') + 1

        # 1) 半透明白背景（未用 var）：夜间会被反色成说不清的中灰，直接告警
        for bm in BG_COLOR_RE.finditer(style_val):
            bg_value = bm.group(1)
            if VAR_BG_RE.search(bg_value):
                continue  # var(--weui-BG-*, rgba(...)) 是推荐写法，跳过
            am = RGBA_WHITE_RE.search(bg_value)
            if am and float(am.group(1)) >= 0.05:
                warnings.append(
                    f"[夜间] 第{line_num}行: 半透明白背景 {bg_value.strip()}，夜间会被反色成灰色块，建议改 var(--weui-BG-2, ...)")

        # 2) 显式浅色背景（感知亮度 190~250 且没用 var）：夜间被压成中灰，马赛克来源
        for bm in BG_COLOR_RE.finditer(style_val):
            bg_value = bm.group(1)
            if VAR_BG_RE.search(bg_value):
                continue
            rgb = parse_rgb(bg_value)
            if rgb:
                p = perceived_brightness(rgb)
                bg_colors.add(rgb)
                if 190 <= p <= 250 and not is_accent_background(content, m, style_val, rgb):
                    light_bg_count += 1
                    warnings.append(
                        f"[夜间] 第{line_num}行: 浅色背景 {bg_value.strip()}（感知亮度 {p:.0f}），"
                        f"夜间会被反成中灰，建议改 var(--weui-BG-1/2/3, ...)")

    # 3) 显式背景色数量过多：夜间每种颜色映射结果不同，容易花
    if len(bg_colors) > 10:
        warnings.append(
            f"[夜间] 全文显式背景色 {len(bg_colors)} 种（>10），夜间映射后深浅不一，建议浅色块统一走 var(--weui-BG-*)")

    return warnings


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

    # 夜间模式友好性告警（不参与 PASS/FAIL）
    warnings = darkmode_warnings(content)
    if warnings:
        print(f"---")
        print(f"夜间模式告警 {len(warnings)} 条（不阻断，发布前建议处理）")
        for w in warnings[:30]:
            print(w)
        if len(warnings) > 30:
            print(f"... 还有 {len(warnings) - 30} 条")

    sys.exit(0 if not violations else 1)


if __name__ == '__main__':
    main()
