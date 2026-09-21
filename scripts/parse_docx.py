#!/usr/bin/env python3
"""
Word (.docx) → Markdown 解析。
优先使用 mammoth（样式保留更好），没有则用 python-docx。

文章标题会被移到 Markdown 的 frontmatter（`title:`），**不留在正文里** ——
正文只从章节标题开始，草稿标题单独取 frontmatter 的 title。
标题来源顺序：Word 的 Title 段落 → docx 核心属性 dc:title → 输入文件名。

用法: python3 parse_docx.py <input.docx> <output.md> [--extract-images <图片输出目录>]
"""

import sys
import os
import argparse
import re
import zipfile
import xml.etree.ElementTree as ET

W_NS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
DC_NS = '{http://purl.org/dc/elements/1.1/}'
# Word 的 Title 样式（按样式名匹配，兼容中文 Word 的 `标题` 与各种 styleId）
TITLE_STYLES = {'title', '标题'}


def _style_names(archive):
    """styleId → 样式名（小写），用于跨语言识别 Title 样式。"""
    names = {}
    try:
        with archive.open('word/styles.xml') as stream:
            root = ET.fromstring(stream.read())
    except KeyError:
        return names
    for style in root.iter(f'{W_NS}style'):
        style_id = style.get(f'{W_NS}styleId')
        node = style.find(f'{W_NS}name')
        if style_id and node is not None:
            names[style_id] = (node.get(f'{W_NS}val') or '').strip().lower()
    return names


def detect_docx_title(docx_path):
    """从 docx 里取文章标题：先找 Title 样式的段落，再退回核心属性 dc:title。

    不依赖 python-docx / mammoth，直接用 zipfile 读 OOXML。
    """
    try:
        with zipfile.ZipFile(docx_path) as archive:
            with archive.open('word/document.xml') as stream:
                root = ET.fromstring(stream.read())
            names = _style_names(archive)
            for para in root.iter(f'{W_NS}p'):
                style = para.find(f'{W_NS}pPr/{W_NS}pStyle')
                if style is None:
                    continue
                val = (style.get(f'{W_NS}val') or '').strip()
                if names.get(val, val).lower() in TITLE_STYLES:
                    text = ''.join(node.text or '' for node in para.iter(f'{W_NS}t')).strip()
                    if text:
                        return text
            try:
                with archive.open('docProps/core.xml') as stream:
                    core = ET.fromstring(stream.read())
                node = core.find(f'{DC_NS}title')
                if node is not None and (node.text or '').strip():
                    return node.text.strip()
            except KeyError:
                pass
    except (zipfile.BadZipFile, KeyError, ET.ParseError):
        pass
    return None


def move_title_to_frontmatter(md_path, title):
    """把标题写进 frontmatter，并把正文里跟标题重复的那个 `#` 行摘掉。"""
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')

    # 同一个标题可能被写成 `# 标题`，也可能是不带 # 的独立段落（取决于解析器样式映射）
    pattern = re.compile(r'^#{0,6}\s*\**' + re.escape(title) + r'\**\s*$')
    for index, line in enumerate(lines[:20]):
        if pattern.match(line.strip()):
            del lines[index]
            break

    body = '\n'.join(lines).strip('\n')
    escaped = title.replace('\\', '\\\\').replace('"', '\\"')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(f'---\ntitle: "{escaped}"\n---\n\n{body}\n')


def parse_with_mammoth(docx_path, output_md_path, image_dir=None):
    """用 mammoth 解析（Node.js，样式保留更好）"""
    import subprocess
    import json

    node_script = f"""
    const mammoth = require('mammoth');
    const fs = require('fs');
    const path = require('path');

    const options = {{
      convertImage: mammoth.images.imgElement(function(image) {{
        return image.read().then(function(imageBuffer) {{
          const contentType = image.contentType;
          const ext = contentType.split('/')[1] || 'png';
          const fileName = 'image-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6) + '.' + ext;
          const outDir = {json.dumps(image_dir) if image_dir else 'null'};
          if (outDir) {{
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {{ recursive: true }});
            fs.writeFileSync(path.join(outDir, fileName), imageBuffer);
            return {{ src: fileName }};
          }}
          return {{ src: 'data:' + contentType + ';base64,' + imageBuffer.toString('base64') }};
        }});
      }})
    }};

    mammoth.convertToMarkdown({{ path: {json.dumps(docx_path)} }}, options)
      .then(function(result) {{
        console.log(result.value);
        if (result.messages.length > 0) {{
          console.error('Warnings:');
          result.messages.forEach(function(m) {{ console.error('  ' + m.message); }});
        }}
      }})
      .catch(function(err) {{
        console.error('Mammoth 解析失败:', err.message);
        process.exit(1);
      }});
    """

    result = subprocess.run(
        ['node', '-e', node_script],
        capture_output=True, text=True,
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )

    if result.returncode != 0:
        print(f"mammoth 解析失败: {result.stderr}", file=sys.stderr)
        return False

    with open(output_md_path, 'w', encoding='utf-8') as f:
        f.write(result.stdout)

    print(f"解析完成（mammoth）: {output_md_path}")
    if image_dir:
        print(f"图片输出目录: {image_dir}")
    return True


def parse_with_python_docx(docx_path, output_md_path, image_dir=None):
    """用 python-docx 解析（无样式依赖时的 fallback）"""
    try:
        from docx import Document
        from docx.oxml.ns import qn
    except ImportError:
        print("未安装 python-docx，请先安装: pip install python-docx", file=sys.stderr)
        return False

    doc = Document(docx_path)
    lines = []

    if image_dir:
        os.makedirs(image_dir, exist_ok=True)
        img_counter = 0

    for para in doc.paragraphs:
        style_name = para.style.name if para.style else 'Normal'
        text = para.text.strip()

        if not text:
            lines.append('')
            continue

        if style_name in ('Title', '标题'):
            lines.append(f'# {text}')
            lines.append('')
        elif style_name.startswith('Heading 1') or style_name == '标题 1':
            lines.append(f'# {text}')
            lines.append('')
        elif style_name.startswith('Heading 2') or style_name == '标题 2':
            lines.append(f'## {text}')
            lines.append('')
        elif style_name.startswith('Heading 3') or style_name == '标题 3':
            lines.append(f'### {text}')
            lines.append('')
        elif style_name == 'Quote' or style_name == '引用':
            lines.append(f'> {text}')
            lines.append('')
        elif style_name == 'List Paragraph' or style_name.startswith('List'):
            lines.append(f'- {text}')
            lines.append('')
        else:
            runs_text = []
            for run in para.runs:
                t = run.text
                if run.bold:
                    t = f'**{t}**'
                if run.italic:
                    t = f'*{t}*'
                runs_text.append(t)
            lines.append(''.join(runs_text))
            # 段落之间必须留空行：Markdown 里相邻两行会被当成同一个段落
            lines.append('')

    if image_dir:
        from docx.opc.constants import RELATIONSHIP_TYPE as RT
        for rel in doc.part.rels.values():
            if "image" in rel.reltype:
                img_counter += 1
                ext = rel.target_ref.split('.')[-1] if '.' in rel.target_ref else 'png'
                img_name = f'image-{img_counter:03d}.{ext}'
                img_path = os.path.join(image_dir, img_name)
                with open(img_path, 'wb') as f:
                    f.write(rel.target_part.blob)
                lines.append(f'![[{img_name}]]')

    # 空段落 / 连续分隔行统一压成单个空行
    body = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip('\n')
    with open(output_md_path, 'w', encoding='utf-8') as f:
        f.write(body + '\n')

    print(f"解析完成（python-docx）: {output_md_path}")
    if image_dir:
        print(f"图片输出目录: {image_dir}（{img_counter} 张）")
    return True


def main():
    parser = argparse.ArgumentParser(description='Word (.docx) → Markdown')
    parser.add_argument('input', help='输入 .docx 文件')
    parser.add_argument('output', help='输出 .md 文件')
    parser.add_argument('--extract-images', dest='image_dir', default=None,
                        help='图片输出目录（不指定则嵌入为 base64）')
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"文件不存在: {args.input}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    ok = parse_with_mammoth(args.input, args.output, args.image_dir)
    if not ok:
        print("尝试 python-docx fallback...", file=sys.stderr)
        ok = parse_with_python_docx(args.input, args.output, args.image_dir)

    if not ok:
        print("解析失败", file=sys.stderr)
        sys.exit(1)

    title = detect_docx_title(args.input) or os.path.splitext(os.path.basename(args.input))[0]
    move_title_to_frontmatter(args.output, title)
    print(f"文章标题: {title}（已写入 frontmatter，不在正文里）")


if __name__ == '__main__':
    main()
