#!/usr/bin/env python3
"""比较 Markdown 与渲染 HTML 的语义文字，忽略明确标记的视觉装饰。"""

import difflib
import html
from html.parser import HTMLParser
import re
import sys


INLINE_LINK_RE = re.compile(r"\[(.*?)\]\((.*?)\)")
DECORATION_BULLETS_RE = re.compile(r"[•●○■□▪➤►→▶◆✦✧★☆]")


def clean_inline(text):
    text = re.sub(r"!\[\[.*?\]\]", "", text)
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"\[\[(.*?)\]\]", r"\1", text)
    text = INLINE_LINK_RE.sub(r"\1（\2）", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.strip()


def extract_md_tokens(md_content):
    tokens = []
    in_frontmatter = False
    in_code = False
    code_lines = []
    for index, line in enumerate(md_content.splitlines()):
        stripped = line.strip()
        if index == 0 and stripped == "---":
            in_frontmatter = True
            continue
        if in_frontmatter:
            if stripped == "---":
                in_frontmatter = False
            continue
        if stripped.startswith("```"):
            if in_code and code_lines:
                tokens.append("\n".join(code_lines))
                code_lines = []
            in_code = not in_code
            continue
        if in_code:
            code_lines.append(line)
            continue
        if not stripped or re.fullmatch(r"(?:---+|\*\*\*+)", stripped):
            continue

        wiki_image = re.fullmatch(r"!\[\[(.+?)\]\]", stripped)
        markdown_image = re.fullmatch(r"!\[(.*?)\]\((.+?)\)", stripped)
        if wiki_image:
            parts = wiki_image.group(1).split("|")
            caption = "|".join(parts[1:]).strip() if len(parts) > 1 else ""
            if caption and not caption.isdigit():
                tokens.append(caption)
            continue
        if markdown_image:
            if markdown_image.group(1).strip():
                tokens.append(markdown_image.group(1).strip())
            continue

        stripped = re.sub(r"^#{1,6}\s+", "", stripped)
        stripped = re.sub(r"^>\s?", "", stripped)
        stripped = re.sub(r"^[-*+]\s+", "", stripped)
        stripped = re.sub(r"^\d+\.\s+", "", stripped)
        cleaned = clean_inline(stripped)
        if cleaned:
            tokens.append(cleaned)
    return tokens


class SemanticHTMLParser(HTMLParser):
    """读取可见语义文字；装饰和有显式语义替代的子树不参与比较。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens = []
        self.skip_depth = 0
        self.stack = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        parent_skipped = self.skip_depth > 0
        role = attributes.get("data-role", "").lower()
        style = attributes.get("style", "").replace(" ", "").lower()
        hidden = (
            tag.lower() in {"script", "style"}
            or role in {"decoration", "generated-decoration"}
            or attributes.get("aria-hidden", "").lower() == "true"
            or "display:none" in style
        )
        semantic_text = attributes.get("data-semantic-text")
        skip_here = parent_skipped or hidden or semantic_text is not None
        self.stack.append(skip_here)
        if skip_here:
            self.skip_depth += 1
        if not parent_skipped and not hidden and semantic_text is not None:
            self.tokens.append(semantic_text)
        if tag.lower() in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            skipped = self.stack.pop()
            if skipped:
                self.skip_depth = max(0, self.skip_depth - 1)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.stack:
            return
        skipped = self.stack.pop()
        if skipped:
            self.skip_depth = max(0, self.skip_depth - 1)

    def handle_data(self, data):
        if self.skip_depth == 0 and data.strip():
            self.tokens.append(data)


def extract_html_tokens(html_content):
    parser = SemanticHTMLParser()
    parser.feed(html_content)
    return parser.tokens


def normalize(tokens):
    value = html.unescape("".join(tokens))
    value = DECORATION_BULLETS_RE.sub("", value)
    return re.sub(r"\s+", "", value)


def format_diffs(expected, actual):
    matcher = difflib.SequenceMatcher(a=expected, b=actual, autojunk=False)
    diffs = []
    for operation, a1, a2, b1, b2 in matcher.get_opcodes():
        if operation == "equal":
            continue
        before = expected[max(0, a1 - 16):min(len(expected), a2 + 16)]
        after = actual[max(0, b1 - 16):min(len(actual), b2 + 16)]
        diffs.append(f"{operation}: MD[{a1}:{a2}] {before!r} / HTML[{b1}:{b2}] {after!r}")
    return diffs


def main():
    if len(sys.argv) < 3:
        print("用法: python3 compare_visible_text.py <source.md> <output.html>")
        sys.exit(1)
    with open(sys.argv[1], "r", encoding="utf-8") as source_file:
        md_tokens = extract_md_tokens(source_file.read())
    with open(sys.argv[2], "r", encoding="utf-8") as html_file:
        html_tokens = extract_html_tokens(html_file.read())
    expected = normalize(md_tokens)
    actual = normalize(html_tokens)
    if expected == actual:
        print("MATCH")
        print(f"语义字符数: {len(expected)}；MD token: {len(md_tokens)}；HTML token: {len(html_tokens)}")
        return 0
    diffs = format_diffs(expected, actual)
    print("MISMATCH")
    print(f"MD 语义字符数: {len(expected)}；HTML 语义字符数: {len(actual)}；差异段: {len(diffs)}")
    print("---")
    for diff in diffs[:30]:
        print(diff)
    return 1


if __name__ == "__main__":
    sys.exit(main())
