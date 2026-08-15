#!/usr/bin/env python3
"""
Word (.docx) → Markdown 解析。
优先使用 mammoth（样式保留更好），没有则用 python-docx。

用法: python3 parse_docx.py <input.docx> <output.md> [--extract-images <图片输出目录>]
"""

import sys
import os
import argparse


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

        if style_name.startswith('Heading 1') or style_name == '标题 1' or style_name == 'Title':
            lines.append(f'# {text}')
        elif style_name.startswith('Heading 2') or style_name == '标题 2':
            lines.append(f'## {text}')
        elif style_name.startswith('Heading 3') or style_name == '标题 3':
            lines.append(f'### {text}')
        elif style_name == 'Quote' or style_name == '引用':
            lines.append(f'> {text}')
        elif style_name == 'List Paragraph' or style_name.startswith('List'):
            lines.append(f'- {text}')
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
                lines.append(f'\n![[{img_name}]]\n')

    with open(output_md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

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


if __name__ == '__main__':
    main()
