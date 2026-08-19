# 童趣手绘模板

这套模板从公众号文章复刻排版中拆出，目标是让后续文章只改 Markdown 标题，就能自动生成同一套视觉元素。

> [!IMPORTANT] SVG 是设计源，不会直接写进公众号 HTML
> 渲染时会把 SVG 占位符替换成文章标题，再生成 PNG。最终 HTML 只引用 PNG/GIF，避免微信公众号过滤 SVG。

## 模板结构

```text
scripts/presets/childlike-doodle/
├── index.js                      # Ryan WeChat Publisher 预设入口
├── generate-assets.js            # 重新生成数字 1～10
├── svg/
│   ├── title-template.svg        # 黄色笔刷 + 动态标题占位符
│   └── number-template.svg       # 手绘数字模板
└── assets/
    ├── numbers/                  # 预渲染的 1～10 PNG
    └── top-art/                  # 顶部插画，可同名替换
```

## 标题如何自动更新

Markdown 中每个一级标题都会经过下面的流程：

```text
# 新标题
  ↓
替换 title-template.svg 中的 {{TITLE}}
  ↓
按标题长度自动调整字号和字宽
  ↓
生成带哈希缓存的 PNG
  ↓
插入公众号 HTML
```

标题文字没有 hardcode。只要修改 Markdown 的 `# 标题`，重新运行排版，就会自动得到新的标题图；相同标题会复用缓存。

动态标题 PNG 默认缓存在系统临时目录，不会写入或污染 Git 仓库。需要指定缓存位置时，可以设置环境变量 `RYAN_WECHAT_TEMPLATE_CACHE_DIR`。

## 手绘数字

`assets/numbers/` 已预生成 `number-01.png` 到 `number-10.png`。章节超过 10 时，`index.js` 仍会临时用同一 SVG 模板生成对应数字。

如需修改数字的颜色、描边或字体，编辑 `svg/number-template.svg` 后运行：

```bash
node generate-assets.js
```

## 顶部插画

当前沿用原文章的 3 张 GIF，并按章节循环使用：

- `top-art-1.gif`
- `top-art-2.gif`
- `top-art-3.gif`

后续可以把新的插画覆盖成相同文件名，无需改代码。保留透明背景和相近画布比例，效果会最稳定。

## 多色加粗高亮

Markdown 仍然使用普通加粗语法：

```markdown
这是普通文字，**这里是重点内容**。
```

模板会按照出现顺序，在下面四种颜色之间循环：

1. 田园橙 `#E6A221`
2. 天空蓝 `#65C5E9`
3. 嫩叶绿 `#8BCF89`
4. 珊瑚红 `#FF6576`

相同文章每次渲染的顺序固定，不使用随机颜色。需要调整颜色或顺序时，修改 `index.js` 顶部的 `HIGHLIGHT_PALETTE` 数组。

> [!TIP] 当前文章只有两处 Markdown 加粗
> 因此当前预览会依次看到橙色和蓝色。后续文章出现第三、第四处加粗时，会继续使用绿色和珊瑚红。

## 渲染命令

```bash
node ../../render.js \
  --md /path/to/article.md \
  --preset childlike-doodle \
  --heading-offset 0 \
  --output-body /tmp/article-body.html \
  --output-preview /tmp/article-preview.html \
  --asset-output-dir /tmp/article-assets \
  --asset-url-prefix assets \
  --asset-dir /tmp/assets \
  --asset-dir /path/to/article-assets
```

> [!TIP] 修改视觉样式时
> 黄色笔刷和标题样式改 `svg/title-template.svg`；数字改 `svg/number-template.svg`；文章正文样式改 `index.js` 的 `STYLES`。
