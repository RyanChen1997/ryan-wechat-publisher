---
name: ryan-wechat-publisher
description: 微信公众号文章一条龙工作流 — 从原始文章（Markdown / Word）到排版到发布草稿箱。当用户说"把这篇文章发到公众号"、"排版并发布"、"公众号一条龙"、"帮我发篇公众号文章"、"照着这篇公众号的风格排我的文章"时必须使用。涵盖：文章解析 → 标题大纲建议 → 风格选择 → 排版方案确认 → 生成 HTML → 内容一致性校验 → 微信兼容校验 → 本地预览 → 图片上传 → 创建草稿。内置多种排版预设，支持复刻任意公众号文章的排版风格。
---

# Ryan WeChat Publisher

微信公众号文章全流程工作流 skill — 从一篇原始文章（Markdown / Word）开始，经过结构化、排版、校验、预览，最终发布到公众号草稿箱。

本 skill 是独立完整的工作流，包含从文章解析、排版、校验到发布的全部功能。排版引擎基于样式规则表 + 装饰生成函数模式，内置多套预设（含「章节独立框」能力），也支持从模板 URL 复刻任意公众号文章的排版风格。发布阶段通过微信云托管服务调用公众号 API。

## 环境要求（首次使用）

排版渲染引擎（`scripts/render.js` + 预设）为纯 Node 标准库实现，内容校验脚本为纯 Python 标准库，均不依赖第三方包。但以下功能需要额外依赖，首次使用前请确认已安装：

| 功能 | 依赖 | 安装方式 |
|------|------|----------|
| Word 解析（`parse_docx.py`） | Node `mammoth`，或 Python `python-docx`（自动降级） | `npm install` 或 `pip install python-docx` |
| 图片上传 + 草稿创建（`upload_and_publish.py`） | Python `requests` | `pip install requests` |
| 复刻抓取/分析（`fetch_template.js`、`analyze_style.js`） | Node `cheerio`、`request-promise` | skill 目录下 `npm install` |
| SVG 装饰图转 PNG（`svg-to-png.js`） | Node `@resvg/resvg-js` 或 `sharp`，或系统 ImageMagick | `npm install` 或安装 ImageMagick；按 resvg → sharp → ImageMagick 自动降级 |

> [!tip] 缺依赖时的表现
> - `upload_and_publish.py` 缺 `requests`：启动即提示安装命令，不会裸报错
> - 复刻脚本缺 npm 包：提示「缺少依赖模块 … 请在 skill 目录执行 npm install」
> - SVG 转 PNG 全部渲染器缺失：报错并说明安装方式
> - 分发时 `node_modules/` 与运行时产物（`images-uploaded.json`、`draft-result.json` 等）不随 skill 分发，接收方按上表安装后功能完整

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
04-html/article-body.html       发布版 HTML（data-src）
04-html/article-preview.html    预览版 HTML
05-validation/                  校验日志
09-publish/                     发布产物（图片映射、最终 HTML、草稿结果）
```
复刻模式下 `03-style/clone-template/` 存放模板抓取和分析产物。

## 完整工作流（9 步）

| 步骤 | 内容 |
|------|------|
| 1 | 解析文章（md / word） |
| 2 | 标题框架建议（结构不清晰时生成大纲），输出引用块格式确认 |
| 3 | 排版风格选择（预设表格 / 复刻） |
| 4 | 排版方案确认（风格 + 标题层级映射 + 结构） |
| 5 | 生成 HTML |
| 6 | 校验（内容一致性 + 微信兼容） |
| 7 | 本地预览，确认效果 |
| 8 | 图片上传 + 创建草稿 |
| 9 | 完成通知 |

每一步的具体操作、命令、输出格式，详见 `references/workflow-detail.md`。

第 2、4、7 步需要用户确认后才能继续。

> [!tip] 发布前检查
> 第 8 步（发布）开始前，必须检查 `WECHAT_PUBLISHER_URL` 环境变量。未配置时，先发送部署文档链接引导用户部署微信云托管服务，再获取用户提供的域名写入 shell 配置文件（持久化）。详细流程见 `references/workflow-detail.md` 第 8 步「前置检查」。

## 复刻排版

当用户说"照着 XX 这篇公众号的风格排"时触发。

> [!caution] 复刻排版需要视觉能力
> 开始复刻前先告知用户：复刻需要分析模板的视觉风格，效果取决于模型是否有图片理解能力。复杂装饰的还原度可能有限。确认后再进入。

复刻流程（6 步）：
1. 抓取模板 + 清洗
2. 样式分析（由宏观到微观：整体 → 区块 → 单元素）
3. 元素映射规划（md 元素 → 模板角色）
4. 生成 cloned preset + 渲染
5. 验证门禁（L1 整体 → L2 关键元素 → L3 细节 → L4 边界）
6. 加入排版方案确认

详细步骤、分析方法、验证门禁、常见模式、踩坑清单，详见 `references/clone-guide.md`。

## 硬约束

- 不改写、不增删、不重排文章内容，除非用户明确要求
- 所有样式必须是内联样式（`style="..."`），不能用 `<style>` 标签或 class
- 发布版图片用 `data-src`（微信懒加载规范）
- 不用黑名单标签：`<script>`, `<style>`, `<iframe>`, `<form>`, `<svg>`, `<ul>`, `<ol>`, `<li>` 等
- 不用黑名单 CSS：`position: fixed/sticky`, `float`, `z-index`, `filter` 等（relative/absolute 尽量少用，优先 flex 布局）
- **装饰图形一律转 PNG**：SVG 只作为设计源文件，输出到 HTML 必须是 PNG 图片（走图片上传流水线），公众号不支持 inline SVG 和 base64 SVG
- **列表一律用 section + 内联符号**：不要用 `<ul>/<ol>/<li>`，公众号会强制显示默认列表符号导致样式错乱
- **夜间模式友好**：浅色背景一律写成微信 CSS 变量 `var(--weui-BG-1/2/3, <白天色>)` 形式（fallback 为白天色，本地预览不变），不用半透明白背景；高饱和强调色保留。夜间由微信 mp-darkmode 算法统一映射，深浅不一的灰阶马赛克是“浅色块过多”的信号。规则详见 `references/style-presets.md`「深色模式适配规范」
- 正文从 `#` 一级标题开始，不额外加"文章总标题"层（草稿 title 取第一个 `#` 文本）
- 需要用户确认的步骤（第 2、4、7 步），等用户明确答复后才继续

## 预设包结构

每个具体预设都是 `scripts/presets/<preset-id>/` 下的独立包，入口统一为 `index.js`。与该预设绑定的 SVG、PNG、GIF、生成脚本和说明文档放在同一包内，避免所有预设共享一个全局素材目录。

```text
scripts/presets/<preset-id>/
├── index.js
├── assets/       # 可选：预渲染图片或装饰缓存
├── svg/          # 可选：SVG 设计源
└── README.md     # 可选：复杂预设的使用说明
```

`scripts/presets/base.js` 是公共渲染引擎，`scripts/presets/index.js` 是预设注册器，两者不属于具体预设包。

## 资源索引

| 分类 | 文件 | 作用 |
|------|------|------|
| 工作流 | `references/workflow-detail.md` | 9 步工作流详细操作指南 |
| 复刻 | `references/clone-guide.md` | 复刻排版完整指南（6 步流程 + 四级门禁 + 模式速查） |
| 预设 | `references/style-presets.md` | 内置预设风格详细说明（含夜间模式适配规范） |
| 排错 | `references/troubleshooting.md` | 常见问题、错误码、避坑要点 |
| 渲染 | `scripts/render.js` | 渲染入口：md + preset → HTML（支持 `--output-dark-preview` 夜间预览） |
| 夜间模拟 | `scripts/utils/dark-preview.js` | 按微信 mp-darkmode 算法生成夜间模式预览 |
| 引擎 | `scripts/presets/base.js` | 渲染引擎公共骨架 |
| 校验 | `scripts/compare_visible_text.py` | 内容一致性校验 |
| 校验 | `scripts/validate_wechat_html.py` | 微信兼容校验 |
| 校验 | `scripts/check_images.py` | 图片存在性校验 |
| 发布 | `scripts/upload_and_publish.py` | 图片上传 + 草稿创建（HTTP 调用云托管 API） |
| 复刻 | `scripts/clone/fetch_template.js` | 抓取模板文章 |
| 复刻 | `scripts/clone/analyze_style.js` | 样式自动分析 |
| 输入 | `scripts/parse_docx.py` | Word → Markdown 解析 |
