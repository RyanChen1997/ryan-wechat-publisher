#!/usr/bin/env python3
"""
内容一致性校验：对比 Markdown 原文和渲染后的 HTML，
确保可见文字没有被增删改写。

用法: python3 compare_visible_text.py <source.md> <output.html>
输出: MATCH 或 MISMATCH + 差异详情
"""

import sys
import re
import html

DECOR_PATTERNS = [
    re.compile(r'^PART\.\d+$', re.IGNORECASE),
    # purple-badge 数字徽章装饰（如 `01 ✦ ✦ ✧`）
    re.compile(r'^\d{1,2}\s+[✦✧★☆\s]+$'),
]


def is_decor_text(text):
    """判断是否为装饰性文字（预设样式带来的，非原文内容）"""
    norm = text.strip()
    for pat in DECOR_PATTERNS:
        if pat.match(norm):
            return True
    return False


def extract_md_text(md_content):
    """从 Markdown 中提取可见文本（按行，去掉格式标记）"""

    def clean_inline(text):
        """清除行内格式标记"""
        text = re.sub(r'!\[\[.*?\]\]', '', text)
        text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
        text = re.sub(r'\[\[(.*?)\]\]', r'\1', text)
        # 链接：与渲染规则一致，转为「标题（URL）」
        text = re.sub(r'\[(.*?)\]\((.*?)\)', r'\1（\2）', text)
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'\1', text)
        text = re.sub(r'`([^`]+)`', r'\1', text)
        return text
    lines = md_content.split('\n')
    result = []
    in_code_block = False
    code_buffer = []
    in_frontmatter = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        if i == 0 and stripped == '---':
            in_frontmatter = True
            continue
        if in_frontmatter:
            if stripped == '---':
                in_frontmatter = False
            continue

        if stripped.startswith('```'):
            if in_code_block and code_buffer:
                result.append(' '.join(code_buffer))
                code_buffer = []
            in_code_block = not in_code_block
            continue
        if in_code_block:
            code_buffer.append(stripped)
            continue

        if stripped == '':
            continue

        if re.match(r'^#{1,6}\s+', stripped):
            text = re.sub(r'^#{1,6}\s+', '', stripped)
            text = clean_inline(text)
            result.append(text.strip())
            continue

        if stripped.startswith('> '):
            text = clean_inline(stripped[2:].strip())
            result.append(text)
            continue

        if re.match(r'^[-*+]\s+', stripped):
            text = re.sub(r'^[-*+]\s+', '', stripped).strip()
            text = clean_inline(text)
            result.append(text)
            continue

        if re.match(r'^\d+\.\s+', stripped):
            text = re.sub(r'^\d+\.\s+', '', stripped).strip()
            text = clean_inline(text)
            result.append(text)
            continue

        if re.match(r'^---+$', stripped) or re.match(r'^\*\*\*+$', stripped):
            continue

        text = clean_inline(stripped)

        text = text.strip()
        if text:
            result.append(text)

    return result


def extract_html_text(html_content):
    """从 HTML 中提取可见文本（按块级元素分行）"""
    text = html_content
    text = re.sub(r'<script[\s\S]*?</script>', '', text)
    text = re.sub(r'<style[\s\S]*?</style>', '', text)

    blocks = re.split(r'<(?:p|section|div|li|h[1-6]|blockquote|pre|br|hr)[^>]*>', text, flags=re.IGNORECASE)

    result = []
    for block in blocks:
        clean = re.sub(r'<[^>]+>', '', block)
        clean = html.unescape(clean)
        clean = clean.strip()
        clean = re.sub(r'\s+', ' ', clean)
        # 去掉行首列表 bullet 符号（HTML 渲染侧才有，MD 侧无）
        clean = re.sub(r'^[•●○■□▪➤►→▶◆]\s*', '', clean)
        if clean and not is_decor_text(clean):
            result.append(clean)

    return result


def normalize(s):
    """归一化文本：去掉多余空白，统一比较单位"""
    s = s.strip()
    s = re.sub(r'\s+', '', s)
    return s


def compare_lines(md_lines, html_lines):
    """逐行比对，返回差异列表"""
    diffs = []
    md_idx = 0
    html_idx = 0

    while md_idx < len(md_lines) and html_idx < len(html_lines):
        md_norm = normalize(md_lines[md_idx])
        html_norm = normalize(html_lines[html_idx])

        if md_norm == html_norm:
            md_idx += 1
            html_idx += 1
            continue

        found = False
        for lookahead in range(1, 8):
            if md_idx + lookahead < len(md_lines):
                if normalize(md_lines[md_idx + lookahead]) == html_norm:
                    for skip in range(lookahead):
                        diffs.append(f"MD多出 第{md_idx+1+skip}行: {md_lines[md_idx+skip][:60]}")
                    md_idx += lookahead
                    found = True
                    break
            if html_idx + lookahead < len(html_lines):
                if normalize(html_lines[html_idx + lookahead]) == md_norm:
                    for skip in range(lookahead):
                        diffs.append(f"HTML多出 第{html_idx+1+skip}行: {html_lines[html_idx+skip][:60]}")
                    html_idx += lookahead
                    found = True
                    break

        if not found:
            diffs.append(
                f"不匹配 MD[{md_idx+1}]: {md_lines[md_idx][:50]}\n"
                f"     HTML[{html_idx+1}]: {html_lines[html_idx][:50]}"
            )
            md_idx += 1
            html_idx += 1

    while md_idx < len(md_lines):
        diffs.append(f"MD多出 第{md_idx+1}行: {md_lines[md_idx][:60]}")
        md_idx += 1
    while html_idx < len(html_lines):
        diffs.append(f"HTML多出 第{html_idx+1}行: {html_lines[html_idx][:60]}")
        html_idx += 1

    return diffs


def main():
    if len(sys.argv) < 3:
        print("用法: python3 compare_visible_text.py <source.md> <output.html>")
        sys.exit(1)

    md_path = sys.argv[1]
    html_path = sys.argv[2]

    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    md_lines = extract_md_text(md_content)
    html_lines = extract_html_text(html_content)

    diffs = compare_lines(md_lines, html_lines)

    if not diffs:
        print("MATCH")
        print(f"MD 行数: {len(md_lines)}, HTML 行数: {len(html_lines)}")
    else:
        print("MISMATCH")
        print(f"MD 行数: {len(md_lines)}, HTML 行数: {len(html_lines)}")
        print(f"差异数: {len(diffs)}")
        print("---")
        for d in diffs[:30]:
            print(d)
        if len(diffs) > 30:
            print(f"... 还有 {len(diffs) - 30} 条差异")

    sys.exit(0 if not diffs else 1)


if __name__ == '__main__':
    main()
