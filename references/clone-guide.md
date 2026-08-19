# 复刻排版指南

复刻排版的核心原理：微信公众号文章的所有样式都是内联样式，所以"复刻"本质是**抽象出模板的设计语言，映射到自己文章的结构角色上**。

---

## 复刻流程

### Step 1：抓取模板

用 `scripts/clone/fetch_template.js <url> <output-dir>` 抓取模板文章。

输出：
- `template-raw.html` — 原始页面 HTML
- `template-content.html` — 清洗后的正文 HTML（data-src→src，移除自定义标签等）
- `template-content-local.html` — 图片路径改为本地归档素材的离线版本，视觉门禁优先使用此文件
- `template-assets/` — 下载归档的原始 PNG/JPG/GIF 等素材
- `asset-inventory.json` — 图片尺寸、格式、上下文、DOM 路径、GIF 和图片标题候选
- `fetch-result.json` — 元数据（标题、公众号、封面、发布时间等）

> [!important]
> 抓到 HTML 不等于抓到完整视觉内容。样式分析前必须先读 `asset-inventory.json`，逐个查看 `image_heading_candidate` 和 `requires_visual_review`。连续图片、空 alt、GIF 都不能直接按普通正文图片处理；图片里可能包含完整标题、序号或文字装饰。

### Step 2：样式分析

用 `scripts/clone/analyze_style.js template-content.html analysis.json` 自动分析。

分析结果包含：
- **body**：正文字号、颜色、行高、对齐方式、字间距
- **headings**：各层级标题的字号、颜色、字重（按字号从大到小排前 4 档）
- **structure**：整体结构类型（扁平型 / 嵌套 section 型 / 单外层包裹型）
- **images**：图片数量、圆角、阴影、对齐方式
- **colors**：文字颜色分布
- **emphasis**：全部加粗/强调文字的颜色、字号和样例；不能只取主色
- **asset_inventory_summary**：图片标题候选、GIF 数量和待视觉复核项
- **decorations**：装饰元素（标题装饰、分割线、引用块、列表符号）
- **paragraph_spacing**：段落间距方式（空行法 / margin 法）
- **font_size_distribution**：完整字号分布统计

### Step 3：生成 cloned preset（人工 + LLM 协作）

分析结果是原始数据，需要把它整理成一个可渲染的 preset 对象。

**步骤**：

1. **确认主体样式**：从分析结果中提取 body、h1、h2、h3、p、img、quote、ul、hr 的样式
2. **处理装饰元素**：
   - 简单装饰（左边框、圆点、背景色、渐变背景）→ 直接用 CSS 实现
   - 复杂装饰（标题徽章、植物装饰、丝带等图形）→ **先画 SVG，再用 `@resvg/resvg-js` 转 PNG**，发布时走图片上传流水线。详见下方"装饰图实现规范"
   - **列表圆点不要用 `<ul>/<li>` + `position: absolute`**，公众号会同时显示默认列表符号，样式错乱。统一用 `<section>` + 内联文字圆点（`•` 或 `·`）实现
3. **补齐缺失元素**：模板里没有的元素（比如没有引用块、没有列表），用模板的主色和设计语言自行设计，保持风格一致
4. **确认使用范围**：并入已有的排版方案确认，不增加额外确认轮次。通常推荐持久化到当前引用 Skill 的 `scripts/presets/<id>/`；若用户明确仅本次使用，则保存到任务目录 `03-style/clone-template/`。不要假设存在 `.skillman` 或其他运行环境副本
5. **输出为 preset 包**：格式参考 `scripts/presets/vibrant-badge/index.js`（含装饰图的预设范例）；预设专属不可变素材放在同一目录的 `assets/` 或 `svg/` 下，运行时缓存不得写入 preset 包

---

## 装饰图实现规范

> [!important]
> **公众号不支持 inline SVG 和 base64 SVG**，装饰图一律用 PNG 格式，通过图片上传机制注入。

### 实现流程

1. 在 preset 文件中用 SVG 字符串定义装饰图案（方便修改颜色、尺寸）
2. 用 `DecoAssetManager`（`scripts/utils/svg-to-png.js`）管理 SVG → PNG 的转换和缓存
3. 渲染时调用 `decoAssets.get(svgString, name, width)` 获取图片路径，像普通图片一样用 `<img data-src="...">` 引用
4. 发布时装饰图和正文图片一起走 `upload_and_publish.py` 上传到微信素材库

### DecoAssetManager 用法

```js
const { DecoAssetManager } = require('../../utils/svg-to-png');

const DECO_SVG = `<svg ...>...</svg>`;
const decoAssets = new DecoAssetManager({
  presetDir: __dirname,
  cacheDir: '/tmp/ryan-wechat-publisher/my-preset-cache',
  fontFiles: [], // SVG 有文字且采用 bundled 策略时填字体文件
});

// decorations.setAssetDir 中调用：
decoAssets.setOutput({ outputDir, useLocalPath, urlPrefix: 'assets' });

// 渲染时获取图片路径：
const src = decoAssets.get(DECO_SVG, 'deco-name', 200); // 200 = 输出宽度(px)
```

### 设计原则

- **文字尽量用 HTML 实现**，SVG 只负责图形装饰（跟 troubleshooting.md 的原则一致）
- 简单图形优先用 CSS（圆、方块、线条、渐变背景），SVG 只做 CSS 搞不定的复杂形状
- 输出 PNG 的宽度建议是显示尺寸的 2 倍（适配高清屏）
- `assets/` 是不可变源素材目录；SVG 渲染缓存默认放系统临时目录，最终 PNG 复制到任务的 `--asset-output-dir`
- SVG 含 `<text>` 时必须提供 `font-policy.json`。优先 bundled 字体或 path；`system-fallback` 仅在有边界预览时允许

## 语义内容标记

图片标题和带编号的标题会产生原文之外的可见装饰。校验器不再猜测 `PART.1`、星星或数字是否属于装饰，preset 必须显式标记：

```html
<section data-role="decoration" aria-hidden="true">PART.1</section>
<section data-semantic-role="heading-1" data-semantic-text="真实标题">
  <!-- 图片标题、序号、顶部插画 -->
</section>
```

- `data-role="decoration"`：整个子树不参与内容一致性比较
- `data-semantic-text="..."`：用该值代表整个子树的正文语义，适用于图片标题
- `data-semantic-role="heading-1"`：供视觉门禁定位关键元素
- 不再使用 `display:none` 藏一份重复标题；隐藏文字可能被微信过滤，也会干扰复制和计数器

---

## 质量验证门禁

生成完 HTML 后，按以下分级清单逐项验证。**上一级不通过，下一级不用看。**

### L1：整体风格门禁（最关键，决定 80% 的"像不像"）

| 检查项 | 通过标准 |
|--------|---------|
| 整体色调 | 主色、辅助色、背景色基本一致 |
| 整体布局结构 | 模板有的宏观结构（外框、背景、侧边装饰），生成版也要有 |
| 标题气质 | 标题风格方向（简约/可爱/商务/手绘）一致 |
| 正文字感 | 字号大小、行高疏密、颜色深浅接近 |

### L2：关键元素门禁（决定 15% 的还原度）

L2 不能只看整页。先生成关键元素并排页：

```bash
node scripts/clone/build_visual_review.js \
  03-style/clone-template/template-content-local.html \
  04-html/article-preview.html \
  05-validation/visual-review.html \
  03-style/clone-template/asset-inventory.json
```

工具会并排提取一级标题/图片标题组、强调文字、引用块和正文图片，并附整页双栏预览。自动识别不到的项目必须人工定位，不能默认通过。

| 检查项 | 通过标准 |
|--------|---------|
| 一级标题 | 字号、颜色、对齐方式、装饰类型一致 |
| 二级标题 | 字号差级合理，颜色关系正确 |
| 正文段落 | 字号、行高、颜色、对齐方式、段间距一致 |
| 图片样式 | 圆角大小、边框、阴影一致 |
| 强调/加粗 | 变色 / 加粗 / 两者兼有，颜色正确 |

### L3：细节和规范门禁（剩下 5% 的精细度）

| 检查项 | 通过标准 |
|--------|---------|
| 字间距 | `letter-spacing` 接近 |
| 行间距 | 行高倍数一致 |
| 段落间距 | `margin-bottom` 数值接近，或空行法/margin 法匹配 |
| 圆角大小 | `border-radius` 数值接近 |
| 公众号规范 | 全部内联样式，无 class/style 标签，图片用 data-src |
| 夜间模式 | 浅色块全部用 `var(--weui-BG-1/2/3, <白天色>)`，无半透明白背景；用 `--output-dark-preview` 检查夜间无马赛克（规则见 `style-presets.md`） |

### L4：边界测试

- 多标题测试：生成至少 4 个一级标题，看装饰/编号是否正确
- 动态图片标题测试：至少覆盖 2、8、14、24 个中文字和两位数序号
- 确定性测试：同一 preset 实例连续生成发布版/预览版并重复渲染，输出必须一致
- 字体测试：运行 `node scripts/clone/check_svg_fonts.js scripts/presets/<id>`；system-fallback 必须逐项检查边界预览
- 长文本测试：超长文字段落换行、对齐是否正常
- 空段落测试：连续空行会不会间距过大
- 移动端预览：缩小到手机宽度（~375px），看装饰是否变形
- **夜间模式测试**：`--output-dark-preview` 生成夜间预览，确认没有深浅不一的灰阶马赛克（模板里的浅色块是重点，复刻时不要 1:1 照搬浅色底，改用 `var(--weui-BG-2, ...)`）

---

## 常见装饰模式速查

### 标题装饰

| 模式 | 特征 | 实现方式 |
|------|------|---------|
| 纯色圆点+文字 | 标题旁有个纯色小圆点 | CSS 圆角 div 即可 |
| 数字徽章 | 圆形/圆角方块 + 数字 + 渐变 | SVG 画图形 → 转 PNG 作背景，数字用 HTML 文字 |
| 横幅/丝带标题 | 文字嵌在丝带/卷轴形状里 | SVG `<path>` 画丝带 → 转 PNG，文字用 HTML |
| 顶部装饰条 | 标题上方横条装饰 | SVG 波浪/几何条纹 → 转 PNG |
| 纯文字+符号装饰 | 标题前/后有 `●`、`◆`、`✦` 等符号 | 直接用 Unicode 字符，CSS 控制颜色和大小 |

### 背景/边框

| 模式 | 特征 | 实现方式 |
|------|------|---------|
| 纯色背景 | 整页统一背景色 | 最外层 section 设 `background-color` |
| 虚线边框 | 页面两侧或四周虚线装饰 | `border-left/right` + `dashed` |
| 植物/图案边 | 边缘装饰图案 | SVG 画装饰图 → 转 PNG，左右各放一张 img |

### 内容块

| 模式 | 特征 | 实现方式 |
|------|------|---------|
| 左边框高亮 | 左侧竖线 + 浅背景 | `border-left` + `padding-left` + `background` |
| 全框圆角 | 圆角矩形框 | `border` + `border-radius` + 背景色 |
| 左侧图标+内容 | 块左侧小图标 + 右侧文字 | flex 布局，左侧 `<img>` 图标，右侧文字 section |

### 列表

| 模式 | 特征 | 实现方式 |
|------|------|---------|
| 实心圆点列表 | 小圆点 + 文字 | `<section>` 行 + 内联 `•` 字符（不要用 `<ul>/<li>`） |
| 方块/菱形列表 | 特殊符号 + 文字 | 对应 Unicode 字符（`■` `◆` 等） + CSS 颜色 |
| 数字编号列表 | 数字 + 文字 | 每个 section 前加数字序号（不要用 `<ol>`） |

> [!caution]
> **绝对不要用 `<ul>/<ol>/<li>` 标签**。公众号编辑器会强制显示默认列表符号，跟自定义圆点叠加导致样式错乱。所有列表都用 `<section>` + 内联符号/文字实现。

---

## 踩过的坑

1. **只看当前元素样式，不看继承** — 基础样式往往在外层祖先上，必须合并完整祖先链
2. **段落间距加倍** — 模板段落有 margin-bottom，又额外生成空行，行距宽一倍。先看模板用的是空行法还是 margin 法
3. **找错装饰图** — 正文配图和装饰图尺寸接近时容易混淆，必须结合上下文位置判断
4. **全局计数器不重置** — 多次渲染标题编号不从 1 开始，每次渲染入口处要重置计数器
5. **SVG 中文字体不一致** — 标题文字优先用 HTML + CSS 实现，SVG 只做装饰背景
6. **忽略整体页面结构** — 只盯内容元素，漏掉整体背景色、外框装饰等宏观特征。宏观特征对风格辨识度的影响远大于细节
7. **结构层级和模板不一致** — 模板用 `section > p > span` 三层，只输出 `<p>` 单层。粘贴到公众号编辑器继续编辑时可能出问题。尽量复刻模板的 DOM 结构层级
8. **SVG 装饰图在公众号不显示** — inline SVG 和 base64 SVG 都会被公众号过滤或不渲染。装饰图必须转 PNG，走图片上传流水线。用 `DecoAssetManager` 统一管理
9. **列表用 ul/li 导致样式错乱** — 公众号会强制显示默认列表符号，跟自定义的 `position: absolute` 圆点叠加显示。所有列表改用 `<section>` + 内联文字圆点（`•` 等）实现
10. **`position: absolute` 在公众号内表现不稳定** — 除了极简单的场景（列表圆点等），尽量用 flex 布局、内联元素替代绝对定位
11. **把运行时缓存写入 preset/assets** — 会污染源码并产生文章专属文件。源素材、缓存、最终输出必须分离
12. **只按出现次数提取主色** — 会把多色强调全部压成一种颜色。必须查看 `emphasis.palette` 和实际样例
13. **在解析完成后才重置计数器** — 发布版和预览版复用 preset 实例，`beforeContent` 必须在 Markdown 解析前执行

---

## 相关脚本

| 脚本 | 作用 |
|------|------|
| `scripts/clone/fetch_template.js` | 抓取模板文章 + 清洗正文 |
| `scripts/clone/asset_inventory.js` | 生成图片资产清单、GIF 和图片标题候选 |
| `scripts/clone/analyze_style.js` | 自动分析字号分布、结构、装饰等 |
| `scripts/clone/build_visual_review.js` | 生成关键元素并排视觉门禁 |
| `scripts/clone/check_svg_fonts.js` | 检查 SVG 文字字体可移植策略 |
| `scripts/presets/base.js` | 渲染引擎公共骨架 |
| `scripts/render.js` | 渲染入口（md + preset → HTML） |
