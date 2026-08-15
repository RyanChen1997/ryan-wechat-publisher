# 工作流详细操作指南

本文件是 SKILL.md 中 9 步工作流的详细展开。每一步包含：做什么、用什么命令、输出什么、交互格式要求。

---

## 第 1 步：解析文章

**输入**：用户提供的文件路径（.md 或 .docx）

**操作**：

- **Markdown (.md)**：直接读取文件内容，识别 frontmatter、标题层级、图片
- **Word (.docx)**：用 `scripts/parse_docx.py` 转成结构化 md
  ```bash
  python3 scripts/parse_docx.py <输入.docx> 01-input/source.md --extract-images 01-input/images/
  ```

**输出**：`01-input/source.md`

**结构判断** `hasClearStructure`：
- 有 ≥ 2 个 `##` 二级标题 → true
- 否则 → false

---

## 第 2 步：标题框架建议

### hasClearStructure = true

直接从 source.md 提取标题层级，用引用块格式展示：

**标题框架确认**

> **# 第一章：xxx**
> 
> **# 第二章：xxx**
> 
> ## 2.1 xxx
> ## 2.2 xxx
> 
> **# 第三章：xxx**

共 N 个一级章节，第 M 章含 K 个二级小节。确认这个结构就继续，有调整直接说。

确认后保存到 `02-structured/structured.md`。

### hasClearStructure = false

让 LLM 根据文章内容生成标题大纲，用引用块格式展示：

**标题框架确认**

> **# 第一章：xxx**
> 
> **# 第二章：xxx**
> 
> ## 2.1 xxx
> ## 2.2 xxx
> 
> **# 第三章：xxx**

共 N 个一级章节，第 M 章含 K 个二级小节。确认这个结构就继续，有调整直接说。

> [!important] 结构说明
> 正文从 `#` 一级标题开始，每个 `#` 是一个章节。模板的最强标题样式（如徽章、丝带等）会应用在 `#` 上。
> 公众号草稿的标题（title 字段）取第一个 `#` 的文本，也可以由用户另行指定。

用户可以：接受 / 修改 / 拒绝（保持原样）。

用户确认后，把标题结构写入文章，保存为 `02-structured/structured.md`。

> [!important]
> `structured.md` 是后续所有步骤的**唯一真相源**。内容一致性校验也以它为基准。

---

## 第 3 步：排版风格选择

判断用户意图：

| 用户输入 | 处理方式 |
|---------|---------|
| 指定了预设名称 | 直接用对应 preset |
| 说"复刻 XX 文章" + 给了 URL | 走复刻流程（见 `clone-guide.md`） |
| 没说风格 | 推荐所有内置预设 |

**输出格式：**

**第 3 步：排版风格选择**

| ID | 名称 | 描述 | 适合场景 |
|----|------|------|----------|
| blue-dot-notes | 蓝点笔记 | 清爽蓝白配色，蓝色圆点装饰一级标题，简约克制 | 职场干货、方法论、科技科普、效率提升 |
| purple-badge | 蓝紫徽章 | 蓝紫主色，数字徽章 SVG 装饰，现代清新有呼吸感 | 成长感悟、心理情感、生活方式、个人提升 |
| elegant-minimal | 极简雅致 | 灰白极简，双圆点标题装饰，大行距两端对齐，雅致克制 | 设计美学、成长感悟、知识分享、职场思考 |
| vibrant-badge | 活力徽章 | 蓝橙撞色，PART 倾斜徽章 + 卡片式排版，活泼有设计感 | 职场干货、效率工具、方法论、成长感悟 |
| geek-tech | 极客科技 | 蓝色数字编号 + 黄色装饰条 + 居中标题，科技媒体风 | 科技资讯、职场干货、行业分析、AI 工具 |
| wechat-blue-yellow | 公众号蓝黄线框 | 浅蓝灰底 + 引言虚线框 + 每个章节独立成框，深蓝标题块黄边条居中 | AI 工具、科技科普、职场干货、方法论 |

你的文章是 [类型] 类型，推荐 **xxx** 或 **xxx**。选哪个？或者有想复刻的公众号文章也可以发链接。

预设列表和详细说明见 `references/style-presets.md`。

---

## 第 4 步：排版方案确认

用表格 + 引用块格式展示：

**第 2 步确认：排版方案**

| ID | 名称 | 描述 | 适合场景 |
|----|------|------|----------|
| purple-badge | 蓝紫徽章 | 蓝紫主色，数字徽章 SVG 装饰，现代清新有呼吸感 | 成长感悟、心理情感、生活方式、个人提升 |

**标题层级映射：** heading-offset = **0**（`#` 用 h1 徽章样式，`##` 用 h2 样式）

**文章结构：**

> **# 第一章：xxx**
> 
> **# 第二章：xxx**
> 
> ## 2.1 xxx
> ## 2.2 xxx
> 
> **# 第三章：xxx**

确认就开始生成 HTML，有调整直接说。

### 标题层级映射说明

模板视觉最强的标题样式（如徽章、丝带）通常在 h1 上。文章从 `#` 一级标题开始，默认 heading-offset = 0 即可，最强样式直接应用在每个章节标题上。

如果文章主要章节用的是 `##`（二级标题）而你希望它们用模板最强的 h1 样式，就设置 `heading-offset = -1`（整体升一级）。

用户确认后，把选定的风格信息和 heading-offset 保存到 `03-style/selected-preset.json`。

---

## 第 5 步：生成 HTML

调用 `scripts/render.js`：

```bash
node scripts/render.js \
  --md 02-structured/structured.md \
  --preset <preset-id 或 preset 文件路径> \
  --heading-offset <偏移量> \
  --output-body 04-html/article-body.html \
  --output-preview 04-html/article-preview.html \
  --output-dark-preview 04-html/article-dark-preview.html \
  --title "文章标题" \
  --asset-dir 02-structured/
```

**输出**：
- `04-html/article-body.html` — 发布版（图片用 `data-src`，微信懒加载规范）
- `04-html/article-preview.html` — 预览版（完整 HTML 文档，图片用本地路径 `src`）
- `04-html/article-dark-preview.html` — 夜间预览版（按微信 mp-darkmode 算法模拟夜间映射）

---

## 第 6 步：校验

### 6a. 内容一致性校验

```bash
python3 scripts/compare_visible_text.py \
  02-structured/structured.md \
  04-html/article-body.html \
  > 05-validation/text-compare.log 2>&1
```

要求输出包含 `MATCH` 才算通过。
（frontmatter 导致的首行不匹配是已知 artifact，其余行一致即可。）

### 6b. 微信兼容校验

用校验脚本：

```bash
python3 scripts/validate_wechat_html.py \
  04-html/article-body.html \
  > 05-validation/wechat-compat.log 2>&1
```

要求输出 `PASS`。

也可以用 grep 手动检查：
- 黑名单标签：`<style>`, `<script>`, `<iframe>`, `<form>`, `<!-- -->` 等
- 黑名单 CSS：`position: fixed`, `position: sticky`, `float`, `z-index`, `filter` 等
  - 注意：`position: relative` 和 `position: absolute` 用于列表圆点等简单定位是允许的，也是预设内建的用法

### 6c. 图片存在性校验

```bash
python3 scripts/check_images.py \
  04-html/article-body.html \
  --asset-dir 02-structured/ \
  > 05-validation/images-check.log 2>&1
```

要求输出 `PASS`。

**作用**：发布版 HTML 中图片用的是原始文件名（`data-src`），此门禁确认所有图片都能在指定目录中找到，避免发出去后图裂。
如果 wikilink 图片在文章目录的子目录里（如 `图片素材/`），需要用多个 `--asset-dir` 全部列出来。

校验日志全部保存到 `05-validation/`。

---

## 第 7 步：本地预览 ← 第 3 道门

```bash
open 04-html/article-preview.html
open 04-html/article-dark-preview.html   # 夜间模式预览（模拟微信 mp-darkmode 算法）
```

在用户默认浏览器打开预览。渲染时生成夜间预览：

```bash
node scripts/render.js --md 02-structured/structured.md --preset <预设ID> \
  --output-preview 04-html/article-preview.html \
  --output-dark-preview 04-html/article-dark-preview.html
```

**必须确认白天和夜间两个预览都打开检查**（尤其引用块、代码块、色块多的文章），用户明确说"可以/确认/发吧"后才能继续。

如果用户要求修改：
- 小调整（改颜色、字号、间距等）→ 修改 preset 样式 → 回到第 5 步重新生成
- 换风格 → 回到第 3 步
- 改内容结构 → 回到第 2 步，更新 structured.md

**注意**：只要 HTML 内容改过，就要重新走第 6 步校验。

---

## 第 8 步：图片上传 + 创建草稿

### 前置检查：WECHAT_PUBLISHER_URL

检查环境变量：

```bash
echo $WECHAT_PUBLISHER_URL
```

**已设置** → 继续发布。

**未设置** → 按以下两步处理：

**第一步：发送部署文档**

先告知用户需要部署微信云托管服务，并发送部署指南链接：

> 需要先部署微信云托管服务才能发布到公众号草稿箱。请跟着这份文档操作：
> 
> https://my.feishu.cn/wiki/IlYkwcmmIis0UXkNTLlcbcwsnMf?from=from_copylink
> 
> 部署完成后，把服务域名（类似 `https://xxx.sh.run.tcloudbase.com`）发给我，我帮你配置好，以后就不用再配了。

**第二步：获取域名并配置**

用户提供域名后，执行以下操作：

1. 验证域名可访问：
   ```bash
   curl -s <用户提供的域名>/health
   ```
   返回 `ok` 即为正常。

2. 写入 shell 配置文件（持久化，下次不用再配）：
   - 检查用户用的是什么 shell（`echo $SHELL`）
   - zsh → 追加到 `~/.zshrc`
   - bash → 追加到 `~/.bash_profile` 或 `~/.bashrc`

   追加内容：
   ```
   export WECHAT_PUBLISHER_URL=<用户提供的域名>
   ```

3. 同时 `export` 到当前 shell 环境，立即生效。

4. 告知用户：已配置完成，以后发布文章不需要再提供域名。

> 配置完成，以后发布文章不需要再提供域名了。

### 一条龙发布

```bash
python3 scripts/upload_and_publish.py \
  --html 04-html/article-body.html \
  --title "文章标题" \
  --cover /path/to/cover.jpg \
  --digest "摘要（≤120字）" \
  --author "作者" \
  --article-dir 02-structured/ \
  --output-dir 09-publish/
```

脚本内部自动完成：
1. 扫描 HTML 中的本地图片路径
2. 调用 `/api/image/upload` 批量上传内联图
3. 替换 HTML 中本地路径为微信 mmbiz URL
4. 上传封面图（调用 `/api/material/upload`）
5. 调用 `/api/draft/create` 创建草稿

**输出文件**：
- `09-publish/images-uploaded.json` — 图片上传映射表（含失败列表）
- `09-publish/final-content.html` — 替换完微信 URL 的最终 HTML
- `09-publish/draft-result.json` — 草稿创建返回结果（含 media_id）

常见错误码及处理见 `references/troubleshooting.md`。

**发布失败自动重试机制**：

如果上传图片或创建草稿时遇到 5xx / 连接错误（云托管冷启动很常见）：
1. 先探测 `${WECHAT_PUBLISHER_URL}/health`
2. 每 10 秒重试一次，最多 5 次
3. 服务恢复后自动继续发布流程
4. 5 次都失败再告知用户去检查云托管状态

---

## 第 9 步：完成

告知用户：
- 草稿已创建成功（附上 media_id）
- 去 **公众号后台 → 内容与互动 → 草稿箱** 预览并发布
- API 不能直接发布，需要手动在后台点发布
