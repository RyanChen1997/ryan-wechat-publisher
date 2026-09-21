# AGENTS.md

面向**在本仓库里干活的 agent** 的作业地图：一条任务的执行顺序（先做什么、后做什么、哪几步要用户回话），以及模板（预设）的目录结构与写法。

- 运行时对用户说什么、命令细节 → 看 `SKILL.md`（流程骨架）+ `references/workflow-detail.md`（每步展开）+ `references/confirmation-dialogs.md`（节点文案，**逐字照写**）
- 本文件不重复那三份的内容，只锁「顺序」「模板长什么样」，以及画廊 / 预览器两个界面什么时候开

---

## 1. 工作流：先做什么、后做什么

**顺序不可跳**；第 2、3、4、6 步要等用户回话，其余步骤自己跑完。

| # | 做什么 | 命令 / 动作 | 产出 | 等用户？ |
|---|--------|-------------|------|----------|
| 0 | 依赖自检（首次 / 换机器） | `node -e "['mammoth','@resvg/resvg-js','sharp'].forEach(...)"` + `python3 --version`，缺则 `npm install --omit=dev` | — | 否 |
| 1 | 解析文章（md / docx） | `python3 scripts/parse_docx.py <in.docx> 01-input/source.md --extract-images 01-input/images/`；md 直接读并补 frontmatter `title:` | `01-input/source.md` | 否 |
| 2 | **结构确认** | 梳理 `#` → `1.`、`##` → `1.1` 的层级；同时做**样式丰富化 + 图片注释**（只写进 structured.md，消息不变，见 workflow-detail 第 2 步），按 `confirmation-dialogs.md` 节点 1 发消息 | `02-structured/structured.md`（**唯一真相源**） | ✅ |
| 3 | **打开模板的画廊**（选风格） | `node scripts/build-gallery.js --presets <最推荐>,<备选1>,<备选2> --workdir <工作目录> --open` | `<workdir>/03-style/gallery.html` | ✅ |
| 4 | **排版方案确认** | 把「已定模板 + 标题层级映射 + 文章结构」摆一起核对，按节点 3 发消息 | `03-style/selected-preset.json`（preset id + heading-offset） | ✅ |
| 5 | 渲染 + 校验 | `node scripts/preview-studio.js --md 02-structured/structured.md --preset <id> --heading-offset <N> --workdir <工作目录> --title "标题" --asset-dir 02-structured/ --asset-dir 01-input/images` | `04-html/{studio,article-body,article-preview}.html` + `05-validation/*.log` | 否（校验门自带） |
| 6 | **打开预览器** → 复制发布 | `open 04-html/studio.html`（或第 5 步加 `--open`，校验通过才会真的打开），按节点 4 发消息 | 用户点「复制到公众号」粘进公众号编辑器 | ✅ |

细节要点：

- **第 3 步不要用文字表格推荐模板。** 画廊固定用 skill 内置示例文章 `assets/gallery/article.md` 渲染（所有模板同一篇才好对比，脚本不接受换文章）；顶部 3 个推荐位 = `--presets` 给的 3 套（第一个是「最推荐」且默认展示，**尽量来自不同分类**，最多 3 套），下面是**按分类浏览**（标签 = 有模板的分类 + 套数）。用户在各个分类里翻到的模板同样有效，用下面的命令把名称映射回 ID：
  ```bash
  node -e "const {PRESETS}=require('./scripts/presets/index');for(const p of Object.values(PRESETS))console.log(p.name,'=>',p.id,'['+p.categoryName+']')"
  ```
- 第 3 步的三种入口：用户直接点名模板 → 跳过画廊直接进第 4 步；没说风格 → 生成画廊；发来别人的公众号链接要求「照着排」→ 不从外部复刻，改推内置相近的 3 套。
- **第 5 步不要加 `--open`。** `preview-studio.js` 自带校验门（内容一致性 / 微信兼容 / 图片存在性），通过才输出 `校验门: 3/3 通过`；任一门失败会 `exit 1` 且不打开浏览器 —— 修问题后重跑**同一条命令**（渲染 + 校验一起重来），不要带着失败结果进第 6 步。
- 第 5 步产出 `04-html/studio.html`，第 6 步打开它 —— 二者是同一条链的两端，别重复生成夜间预览页。
- 工作目录：`/tmp/ryan-wechat-publisher/<YYYYMMDD-HHMM>/`，一次性申请写权限，子目录按 `01-input/ 02-structured/ 03-style/ 04-html/ 05-validation/` 排。
- **画廊和预览器都是自包含单文件，直接 `open` 即可，不需要服务器。** 浏览只有一个预览页面：`04-html/studio.html`——不要再生成 / 打开 `article-dark-preview.html` 这类单独的夜间预览页（旧做法，已废弃）。

### 需要用户回话的 4 个节点

| 节点 | 时机 | 文案位置 |
|------|------|----------|
| 1 | 第 2 步结构确认 | `references/confirmation-dialogs.md` 节点 1 |
| 2 | 第 3 步画廊已打开、等用户挑模板 | 同文件节点 2 |
| 3 | 第 4 步排版方案确认 | 同文件节点 3（不写 preset ID、不写 heading-offset 数值） |
| 4 | 第 6 步预览器已打开、让用户确认日夜效果并发布 | 同文件节点 4（重新渲染后要**重发同一条**） |

### 用户要求修改时的回路

| 用户诉求 | 回到哪一步 |
|----------|------------|
| 改文字 → 改 `02-structured/structured.md` | 第 5 步（重渲染 + 三门校验） |
| 调颜色 / 字号 / 间距 → 改 preset | 第 5 步 |
| 换风格 | 第 3 步（重开画廊）或第 4 步（直接指定 preset） |
| 改标题层级 / 文章结构 | 第 2 步 |

**只要 HTML 改过，就必须重跑第 5 步（渲染 + 校验）**，校验没过不要重开预览器。

---

## 2. 模板结构：分类 → 模板（两层）

模板（预设）以**分类**归档，路径形如 `scripts/presets/<分类 id>/<模板 id>/`。分类清单与展示顺序锁在 `scripts/presets/index.js` 的 `CATEGORY_ORDER`；每个分类目录下的 `index.js` 是**分类桶**（中文名 + 说明 + 模板列表），每个模板是一个**独立包**（入口 + 自己的 SVG / PNG / GIF / 生成脚本 / 说明文档），不共享全局素材目录。

```text
scripts/presets/
├── base.js                       # 渲染引擎公共骨架（不属于任何分类）
├── index.js                      # 注册器：聚合各分类桶，导出 getPreset / listPresets / listCategories / getPresetDir
└── <分类 id>/
    ├── index.js                  # 分类桶：{ id, name, description, presets: [...] }
    └── <模板 id>/                # 一个模板 = 一个包
        ├── index.js              # 必需：模板入口（字段见 2.3）
        ├── assets/               # 可选：不可变源素材 / 预渲染成品（不放运行时缓存）
        ├── svg/                  # 可选：SVG 设计源（发布时必须转成 PNG）
        ├── font-policy.json      # SVG 内含文字时必需：字体可移植策略
        ├── manifest.json         # 复刻模板必需：来源与还原度记录（见 2.5）
        └── README.md             # 可选：复杂模板的使用说明
```

### 2.1 十个分类

顺序即画廊展示顺序；**空分类也要保留目录 + 占位桶**（`presets: []`），画廊会自动隐藏没模板的分类（当前是「动漫」「文艺」「复古」「中国风」，这是预期行为，不要解释成缺失）。

| 顺序 | id | 中文名 | 套数 | 适合内容 |
|---|---|---|---|---|
| 1 | `business` | 商务 | 1 | 企业动态、产品发布、会议通稿、B 端产品与商业分析 |
| 2 | `simple` | 简约 | 2 | 技术文档、教程与干货长文 |
| 3 | `fresh` | 清新 | 1 | 校园、教学、生活与科普 |
| 4 | `cartoon` | 卡通 | 1 | 手绘涂鸦、轻松科普、活动与亲子 |
| 5 | `fashion` | 时尚 | 1 | 强对比海报感、品牌与视觉专题 |
| 6 | `minimal` | 极简 | 1 | 大留白、深度长文与高级感内容 |
| 7 | `anime` | 动漫 | 0 | （空分类，占位） |
| 8 | `literary` | 文艺 | 0 | （空分类，占位） |
| 9 | `retro` | 复古 | 0 | （空分类，占位） |
| 10 | `chinese` | 中国风 | 0 | （空分类，占位） |

共 7 套模板。分类桶文件长这样（新增 / 移动模板只改这个 `presets` 数组里的一行 `require`）：

```js
module.exports = {
  id: 'business',            // 必须等于目录名
  name: '商务',               // 中文名，画廊标签用它
  description: '企业动态、产品发布、会议通稿、B 端产品与商业分析',
  presets: [
    require('./wechat-blue-yellow/index'),   // 目录名 === preset.id
    // ...
  ],
};
```

### 2.2 模板长什么样

一个模板 = **一份内联样式表 `STYLES` + 一组装饰生成函数 `decorations`**，导出后由 `scripts/presets/base.js` 的 `renderMarkdown()` 按 Markdown 节点逐块调用，产出全内联样式的 HTML。画廊和预览器只是把同一份渲染结果套不同的外壳（示例文章 vs 用户文章）。

最小可用的模板目录只有一个 `index.js`（如 `minimal/elegant-minimal/`）；需要图形装饰的模板再加 `svg/`（设计源）+ `assets/`（成品）+ 生成脚本，运行时由 `scripts/utils/svg-to-png.js` 把 SVG 渲染成 PNG 输出到 `04-html/assets/`。

### 2.3 模板入口 `index.js` 的字段

| 字段 | 必需 | 说明 |
|------|------|------|
| `id` | ✅ | 与目录名、分类桶里 `require` 的路径三者一致（注册器会校验） |
| `name` | ✅ | 模板中文名（画廊卡片 + 用户回传的就是它） |
| `tagline` | ✅ | 一句话卖点 |
| `description` | ✅ | 风格详细说明 |
| `suitableFor` | ✅ | 适合场景数组，第 3 步挑推荐时按它匹配文章类型 |
| `meta` | ✅ | `{ primaryColor, accentColor, bgColor, textColor, darkMode: 'weui-var', ... }` |
| `STYLES` | ✅ | 样式对象：键名对应 base.js 的默认节点（`outer` / `h1` / `h2` / `h3` / `p` / `quote_*` / `li*` / `img*` / `caption` / `hr_*` / `code_block` / `code_pre` …），值是 CSS 声明字符串 |
| `decorations` | ✅ | 装饰函数集合，见下表 |
| `category` / `categoryName` | —（注入） | 注册器加载时自动写入，画廊 / 测试等下游直接读 |

`decorations` 里被引擎调用的钩子（括号内数字 = 当前使用它的模板数）：

| 钩子 | 作用 |
|------|------|
| `makeH1`(7) / `makeH2`(3) / `makeH3`(3) | 各级标题，视觉最强的样式通常给 h1 |
| `makeParagraph`(7) / `makeBr`(7) / `parseInline`(7) | 段落、换行、行内标记（加粗 / 斜体 / 行内代码） |
| `makeImage`(7) | 配图 + 图注 |
| `makeQuote`(6) / `makeHr`(5) / `makeUl`(4) / `makeCodeBlock`(1) | 引用、分隔线、列表（输出 section + 内联符号，**不用 `<ul>/<ol>/<li>`**）、代码块 |
| `beforeContent`(3) / `afterContent`(3) | 正文前 / 后追加装饰（开篇图、结尾卡） |
| `setAssetDir`(3) | 有 SVG / 生成装饰图时接住输出目录与路径映射，内部用 `DecoAssetManager` |
| `openSection` / `closeSection` / `sectionHeadingLevel`（各 1） | 「一个章节一个独立框」模式：按层级开合容器 |

### 2.4 模板的硬规矩（写模板时）

- 样式**全部内联**（`style="..."` 字符串），不能用 `<style>` 或 class；黑名单标签 `script/style/iframe/form/svg/ul/ol/li` 一律不出现
- 装饰图形必须是 **PNG**（SVG 只做设计源，公众号不支持 inline / base64 SVG）
- 浅色背景写微信 CSS 变量 `var(--weui-BG-1/2/3, <白天色>)` 做夜间适配（详见 `references/style-presets.md`「深色模式适配规范」）
- 发布版图片用 `data-src`（微信懒加载规范）
- 正文不含文章标题，标题在 `structured.md` 的 frontmatter `title:`
- **渲染输出不许增删正文**：内容一致性校验会拿 `structured.md` 和产物做语义比对，模板的装饰文本不计入

### 2.5 `manifest.json`（复刻来的模板必填）

记录「这套模板从哪来、还原到什么程度」。**10 个基础键固定，不要自创口径不同的新键**，也不写 `updated_at` 这类冗余时间戳（git 版本历史为准）：

| 键 | 必需 | 说明 |
|---|---|---|
| `preset_id` | ✅ | 与目录名、`index.js` 的 `id` 三者一致 |
| `name` / `article_id` / `url` / `account` / `score` | ✅ | 模板名；原公众号文章 id、链接、公众号名、采集阶段设计感评分（0~100）；画廊据此配对原文 |
| `worker` | ✅ | 复刻它的 worker 会话 |
| `status` | ✅ | `done` / `failed`（失败也留文件） |
| `fidelity` | ✅ | `{ L1, L2, L3, L4 }` 四级视觉门禁布尔值，对应 `references/clone-guide.md` |
| `known_gaps` | ✅ | 字符串数组，逐条写已知偏差；**不要把合规细节写成缺陷** |
| `semantic_markup` | ❌ 可选 | **仅当标记了短语级装饰时出现**：`{ decorated_nodes: string[], note: string }` |

### 2.6 新增 / 移动 / 删除模板的操作清单

1. 在目标分类下建包目录 `scripts/presets/<分类 id>/<模板 id>/`，目录名 === `id`
2. 写 `index.js`（字段见 2.3），需要装饰图再加 `svg/` + `assets/` + `font-policy.json`（SVG 含文字时）
3. 在**分类桶** `scripts/presets/<分类 id>/index.js` 的 `presets` 数组里加 / 删一行 `require`（**不用动根 `index.js`**）
4. 跑自检与测试：`npm test`（`scripts/test_presets.js`：注册一致性 + 全模板渲染 fixture + 字体检查）
5. 发布前用画廊肉眼过一遍新模板：`node scripts/build-gallery.js --presets <新模板id> --open`

注册器 `scripts/presets/index.js` 在加载时会直接抛错的红线：分类桶 `id` 与目录名不一致、`preset.id` 与目录名不一致、分类目录下有未注册的模板包、分类目录缺桶文件、`presets/` 下有未登记进 `CATEGORY_ORDER` 的分类目录、预设 id 重复。

---

排错（复制粘贴带图机制、错误码、避坑）见 `references/troubleshooting.md`；模板风格细则见 `references/style-presets.md`。
