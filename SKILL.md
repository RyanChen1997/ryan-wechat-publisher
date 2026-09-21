---
name: ryan-wechat-publisher
description: 微信公众号文章一条龙工作流 — 从原始文章（Markdown / Word）到排版到复制粘贴发布。当用户说"把这篇文章发到公众号"、"排版并发布"、"公众号一条龙"、"帮我发篇公众号文章"、"帮我的文章排版"时必须使用。涵盖：文章解析 → 结构确认 → 模板画廊选风格 → 排版方案二次确认 → 渲染与校验 → 浏览器预览器复制到公众号。内置多套排版预设。
---

# Ryan WeChat Publisher

微信公众号文章全流程工作流 skill — 从一篇原始文章（Markdown / Word）开始，经过结构化、排版、校验、预览，最后在**浏览器预览器**里一键复制、粘贴进公众号编辑器。

本 skill 是独立完整的工作流，包含从文章解析、排版、校验到发布的全部功能。排版引擎基于样式规则表 + 装饰生成函数模式，内置多套预设（含「章节独立框」能力）。**发布环节不需要任何服务配置**：预览器把图片内联进复制内容，微信编辑器在粘贴时自动把图转存到自己的 CDN。

## 使用前提：依赖自检（首次使用）

排版渲染引擎（`scripts/render.js` + 预设）为纯 Node 标准库实现，内容校验脚本为纯 Python 标准库，**零依赖即可跑通排版与校验主链路**。只有下表功能需要第三方包 —— 首次使用（或换了机器）前先自检，缺什么装什么。

### 第 0 步：依赖自检

```bash
cd <skill 根目录>          # 本 SKILL.md 所在目录
node -e "['mammoth','@resvg/resvg-js','sharp'].forEach(m=>{try{require.resolve(m);console.log('OK   '+m)}catch(e){console.log('MISS '+m)}})"
python3 --version          # 三门校验（内容一致性 / 微信兼容 / 图片存在性）依赖 Python 3
```

出现任何一个 `MISS` 就补装，然后重跑自检：

```bash
cd <skill 根目录>
npm install --omit=dev            # Node 侧：mammoth / @resvg/resvg-js / sharp（按当前平台自动选原生二进制）
```

> [!important] 原生二进制必须在本机由 npm 安装
> `sharp`、`@resvg/resvg-js` 通过 `optionalDependencies` 分发**平台专属**原生包（darwin-arm64 / linux-x64 / win32-x64 等）。请始终在用户本机执行 `npm install` —— 从别的机器复制来的 `node_modules/`（或打包成 zip 分发）在其它平台会直接加载失败。
> 若本 skill 由 pi 包管理器安装（`pi install git:…`），pi 已在安装时自动执行 `npm install --omit=dev`，此时通常只需检查 Python 侧依赖。

### 依赖清单

| 功能 | 依赖 | 缺失时的表现 | 安装方式 |
|------|------|--------------|----------|
| Word 解析（`parse_docx.py`） | Node `mammoth`，或 Python `python-docx`（自动降级） | 两者都缺时报错并提示 | `npm install` 或 `python3 -m pip install python-docx` |
| SVG 装饰图转 PNG（`svg-to-png.js`） | Node `@resvg/resvg-js` 或 `sharp`，或系统 ImageMagick | 三者都缺时报错并说明安装方式 | `npm install`，或 `brew install imagemagick` / `apt install imagemagick`；按 resvg → sharp → ImageMagick 自动降级 |

- 环境基线：Node 18+、Python 3.8+（三门校验脚本只用标准库，无需 pip 安装任何包）
- 分发说明：`node_modules/` 与运行时产物不随 skill 分发，接收方按上表自检安装后功能完整
- 仓库中另有复刻相关的历史脚本（`scripts/clone/*`），额外需要 `cheerio`、`request-promise`；它们不在工作流内，默认不安装

## 工作目录

每次任务创建一个独立工作目录，所有中间产物保存在这里方便追溯。

> [!tip] 权限提示
> 开始任务前，先创建工作目录的最上层（如 `/tmp/ryan-wechat-publisher/<日期>-<时间>/`），一次性申请该目录的写权限，后续所有子目录文件都在里面操作，不用每次都弹权限申请。

默认路径：`/tmp/ryan-wechat-publisher/<YYYYMMDD-HHMM>/`

目录结构：
```
01-input/source.md              原始文章
02-structured/structured.md     确认后的结构化 md（唯一真相源）
03-style/selected-preset.json   选定的风格信息
04-html/studio.html             排版预览器（浏览器打开 → 预览 + 复制到公众号）
04-html/article-body.html       发布版 HTML（data-src）
04-html/article-preview.html    预览版 HTML
05-validation/                  三门校验日志（渲染时自动写入）
```

## 完整工作流（6 步）

| 步骤 | 内容 |
|------|------|
| 1 | 解析文章（md / word） |
| 2 | 结构确认：梳理文章层级（`#` → `1.`、`##` → `1.1`）编号发给用户；文案见 `references/confirmation-dialogs.md` |
| 3 | 模板推荐：生成画廊页（用内置示例文章渲染 3 套推荐模板），用户点「复制「模板名」」回传 |
| 4 | 排版方案确认：**已确定的模板 + 标题层级 + 文章结构**再核对一次；文案见 `references/confirmation-dialogs.md` 节点 3 |
| 5 | 渲染 + 校验：一条命令产出发布版 HTML 与 studio.html，同时跑三门校验（内容一致性 / 微信兼容 / 图片存在性） |
| 6 | 打开浏览器 studio：用户切电脑/手机、白天/夜间确认效果，点「复制到公众号」粘贴发布；文案见 `references/confirmation-dialogs.md` 节点 4 |

每一步的具体操作、命令、输出格式，详见 `references/workflow-detail.md`。需要用户回话的节点（第 2、3、4、6 步）发给用户的文案已全部定稿，见 `references/confirmation-dialogs.md` —— **逐字照写，不要发挥**。

> [!tip] 第 3 步不要用文字表格推荐模板
> 跑 `node scripts/build-gallery.js --workdir <任务工作目录> --open` 生成画廊页：顶部是**为你推荐的 3 套**（第 1 套默认展示），下面是**按分类浏览**（标签页 = 有模板的分类 + 计数），中间手机版白天效果，底部一个「复制「模板名」」按钮。用户点完粘贴回来，拿着名称映射回预设 ID 再进第 4 步。
> 3 套推荐**尽量来自不同分类**（脚本会在全落在同一个分类时提示），用户更容易一眼分辨风格；`--presets` 最多 3 个。
> 画廊**固定用 skill 内置的示例文章渲染**（`assets/gallery/article.md`），不要拿用户的文章去套 —— 所有模板渲染同一篇才好对比，也不用等用户的长文和图片。
> 没有模板的分类（当前是「动漫」「文艺」「复古」「中国风」）**不会出现在画廊里**，这是预期行为，不要跟用户解释成缺失。

> [!important] 第 1 步之前先做依赖自检
> 首次使用（或换了机器）时，先完成上面的「第 0 步：依赖自检」并补齐缺失依赖，再进入第 1 步；缺依赖会让 Word 解析、SVG 转 PNG、三门校验等环节中途失败。

第 2、3、4、6 步需要用户回话后才能继续。

> [!important] 第 5 步的校验门不要手动重写
> `preview-studio.js` **自带校验门**，渲染完会自动跑内容一致性 / 微信兼容 / 图片存在性三门校验，日志写到 `<workdir>/05-validation/`，输出 `校验门: 3/3 通过`。任一门未通过会 `exit 1` 且**不打开浏览器** —— 先修问题、重跑同一命令，别把没校验的稿子拿给用户确认。
> 只有需要单独复跑某一门时才手动调用 `scripts/compare_visible_text.py` / `validate_wechat_html.py` / `check_images.py`（见 `references/workflow-detail.md` 第 5 步）。

> [!tip] 第 6 步：发布就是「复制到公众号」
> 预览器点「复制到公众号」→ 公众号编辑器新建图文 → 粘贴（⌘V）→ 补标题/封面 → 存草稿。整篇内联样式不丢，图片会一起过去：默认把本地图片压到 1080px 后**内联 base64**（粘贴时微信编辑器把每张图抓下来转存到自己 CDN）。
> 图床（Litterbox）**默认就是开着的**：图片在**用户点「复制到公众号」那一刻**才上传（零配置、免登录），页面弹进度条，上传完自动把内联替换成 https 链接并复制；上传失败的图保留内联 base64。预览器顶栏有「复制时传图床」开关，用户随时能关；命令行用 `--no-image-host` 可整个关掉。链接 72 小时后失效，**要提醒用户在过期前发布**。
> 所以**不需要额外加参数**，也不需要判断该用哪种方案 —— 复制内容同时具备两条路，用户在预览器里一眼就能切。
> 无论哪种，**都不需要云托管、不需要自建图床、不需要手动传图**，没有「API 建草稿」这条路。

## 硬约束

- 不改写、不增删、不重排文章内容，除非用户明确要求
- 所有样式必须是内联样式（`style="..."`），不能用 `<style>` 标签或 class
- 发布版图片用 `data-src`（微信懒加载规范）
- 不用黑名单标签：`<script>`, `<style>`, `<iframe>`, `<form>`, `<svg>`, `<ul>`, `<ol>`, `<li>` 等
- 不用黑名单 CSS：`position: fixed/sticky`, `float`, `z-index`, `filter` 等（relative/absolute 尽量少用，优先 flex 布局）
- **装饰图形一律转 PNG**：SVG 只作为设计源文件，输出到 HTML 必须是 PNG 图片，公众号不支持 inline SVG 和 base64 SVG
- **列表一律用 section + 内联符号**：不要用 `<ul>/<ol>/<li>`，公众号会强制显示默认列表符号导致样式错乱
- **夜间模式友好**：浅色背景一律写成微信 CSS 变量 `var(--weui-BG-1/2/3, <白天色>)` 形式（fallback 为白天色，本地预览不变），不用半透明白背景；高饱和强调色保留。夜间由微信 mp-darkmode 算法统一映射，深浅不一的灰阶马赛克是“浅色块过多”的信号。规则详见 `references/style-presets.md`「深色模式适配规范」
- **正文不含文章标题**：草稿标题（title）单独放在 `02-structured/structured.md` 的 frontmatter `title:` 里，正文从第一个章节标题（`#`）开始 —— 不要把标题写成正文的第一个 `#`
- 需要用户确认的步骤（第 2、4、6 步），等用户明确答复后才继续
- **校验门未过不得进下一步**：`校验门: 3/3 通过` 才打开浏览器 studio；改了 HTML（换预设、调偏移、改结构）必须重跑渲染 + 校验

## 预设包结构（分类 → 预设 两层）

预设按分类归档：`scripts/presets/<分类 id>/<preset-id>/`。分类清单与展示顺序见 `scripts/presets/index.js` 的 `CATEGORY_ORDER`；每个分类目录下的 `index.js` 是**分类桶**（分类中文名 + 该分类的模板列表），模板与它的 SVG、PNG、GIF、生成脚本和说明文档放在同一个包里，避免所有预设共享一个全局素材目录。

```text
scripts/presets/<分类 id>/
├── index.js          # 分类桶：{ id, name, description, presets: [...] }
└── <preset-id>/      # 具体预设包
    ├── index.js
    ├── assets/       # 可选：只放不可变源素材或预渲染成品，不放运行时缓存
    ├── svg/          # 可选：SVG 设计源
    ├── font-policy.json # SVG 含文字时必需：字体可移植策略
    ├── manifest.json # 复刻模板必需：来源与还原度记录（见下）
    └── README.md     # 可选：复杂预设的使用说明
```

十个分类（按顺序）：**商务、简约、清新、卡通、时尚、极简、动漫、文艺、复古、中国风**。

- 分类目录**必须存在**，空分类也要留目录 + 桶文件（`presets: []`）—— 画廊会自动隐藏没有模板的分类，目录先留着，以后加了模板就自动出现
- 新增 / 移动模板 = 新建或移动包目录 + 改所属分类桶里的一行 `require`，**不用动根 `index.js`**
- 注册器在加载时校验：分类桶 id 与目录名一致、preset 目录名与 `preset.id` 一致、分类目录下没有未注册的模板包，任一条不满足直接抛错
- 每个预设注册时会被注入 `category` / `categoryName`，画廊、测试等下游直接读这两个字段
- `scripts/presets/base.js` 是公共渲染引擎，`scripts/presets/index.js` 是预设注册器，两者不属于具体预设包。

### `manifest.json`（复刻模板）

从公众号文章复刻来的预设必须带 `manifest.json`，记录「这套模板从哪来、还原到什么程度」。
**10 个基础键固定不变，可选键只在需要时出现**，不要各自增加口径不同的新键：

| 键 | 必需 | 说明 |
|---|---|---|
| `preset_id` | ✅ | 与目录名、`index.js` 的 `id` 三者一致 |
| `name` | ✅ | 模板中文名 |
| `article_id` | ✅ | 原公众号文章 id（`mp.weixin.qq.com/s/<id>` 里那段），画廊据此配对原文 |
| `url` / `account` / `score` | ✅ | 原文链接 / 公众号名 / 采集阶段的设计感评分（0~100） |
| `worker` | ✅ | 复刻它的是哪个 worker 会话 |
| `status` | ✅ | `done` 或 `failed`（失败也要留文件，避免静默丢失） |
| `fidelity` | ✅ | `{ "L1": bool, "L2": bool, "L3": bool, "L4": bool }`，对应 clone-guide 的四级视觉门禁 |
| `known_gaps` | ✅ | 字符串数组，逐条写清已知偏差。**不要把合规细节写成缺陷** |
| `semantic_markup` | ❌ 可选 | **仅当该预设标记了短语级装饰时出现**：`{ decorated_nodes: string[], note: string }` |

> 不写 `updated_at` 之类的冗余时间戳 —— 预设包在 git 里，修改时间由版本历史记录，自建时间戳容易失真且格式不统一。

## 资源索引

| 分类 | 文件 | 作用 |
|------|------|------|
| 工作流 | `references/workflow-detail.md` | 6 步工作流详细操作指南 |
| 对话 | `references/confirmation-dialogs.md` | 各确认节点发给用户的固定文案规范（只锁已定稿的节点） |
| 预设 | `references/style-presets.md` | 内置预设风格详细说明（含夜间模式适配规范） |
| 排错 | `references/troubleshooting.md` | 常见问题、错误码、避坑要点（含「复制粘贴带图的机制」实测表） |
| 诊断 | `scripts/paste-probe.js` | 图片粘贴探针：一次性验证哪种图片形式能活着粘进公众号编辑器（需配 `utils/static-server.js`） |
| 渲染 | `scripts/render.js` | 渲染入口：md + preset → HTML（脚本化批量处理用；日常走预览器） |
| 预览器 | `scripts/preview-studio.js` | 生成 studio.html（预览 + 复制到公众号）与发布版 HTML，**并自带三门校验门**；图片默认压到 1080px 内联进复制内容，可用 `--image-host` 改成传图床走链接 |
| 预览器 | `assets/previewer/studio.{html,css,js}` | 预览器本体（可复用，不需要每次重写）：端模式、日夜模式、复制到公众号 |
| 画廊 | `scripts/build-gallery.js` | 生成模板推荐画廊页（3 个推荐位 + 分类浏览 + 手机版预览 + 复制模板名；空分类不显示） |
| 画廊 | `assets/gallery/` | 画廊外壳与内置示例文章（`article.md` + `images/`），供渲染展示用 |
| 夜间模拟 | `scripts/utils/dark-preview.js` | 按微信 mp-darkmode 算法做夜间映射（预览器右上角「夜间」开关就是它，不需要另开页面） |
| 预设 | `scripts/presets/index.js` | 预设注册器：聚合各分类桶、注入分类信息，导出 `getPreset` / `listPresets` / `listCategories` / `getPresetDir` |
| 引擎 | `scripts/presets/base.js` | 渲染引擎公共骨架 |
| 校验 | `scripts/compare_visible_text.py` | 内容一致性校验（校验门第 1 道；语义比较，装饰文本不计） |
| 校验 | `scripts/validate_wechat_html.py` | 微信兼容校验（校验门第 2 道，含夜间模式告警） |
| 校验 | `scripts/check_images.py` | 图片存在性校验（校验门第 3 道） |
| 图床 | `scripts/utils/image-hosts.js` | 图床适配器（Litterbox：零配置、免登录、临时托管，默认开启）。端点与时长在这里定义，实际上传在预览器里点击时由浏览器完成 |
| 输入 | `scripts/parse_docx.py` | Word → Markdown 解析 |
