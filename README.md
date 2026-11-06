# Vellum

> 一个为 [Hexo](https://hexo.io/) 打造的极简博客主题。重心在**阅读体验**、**构建性能**和**可配置性**。

![Version](https://img.shields.io/badge/version-0.4.2-blue.svg)
![Hexo](https://img.shields.io/badge/hexo-6.x%20%7C%207.x%20%7C%208.x-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## 特性

- **档案系统（Dossier）** —— 把一个项目或系列写成一个目录树，自动生成导航、卡片索引、上下篇
- **每日资讯** —— 构建期从 [60s-API](https://github.com/vikiboss/60s) 抓取早报 / 知乎 / 微博 / Hacker News，生成静态 `/news/`
- **订阅页** —— 构建期聚合你关注的 RSS/Atom，生成静态 `/subscriptions/`；支持从远程接口叠加订阅列表
- **SEO 优先** —— canonical、Open Graph、JSON-LD、完整 sitemap，全部自实现，不依赖插件
- **深浅色** —— 手动 / 跟随系统 / 按日出日落自动切换，两套独立色板
- **目录** —— 桌面侧栏跟随高亮 + 手机底部面板，没标题的页面不出现死键
- **页面过渡** —— View Transitions API，不支持时自动降级
- **移动端悬浮球** —— 右下角竖向胶囊，`目录` 与 `导航` 各一格
- **多语言界面** —— 内置简体中文 / 繁體中文 / English，界面文案跟着站点语言走
- **零前端框架** —— 纯 CSS + 原生 JS，没有打包步骤

---

## 安装

```bash
cd your-hexo-site

# 跟随主干
git clone https://github.com/cayzlh/hexo-theme-vellum.git themes/vellum

# 或者锁定到某个版本（推荐，升级前先看 Releases 的版本说明）
git clone --branch v0.4.2 --depth 1 https://github.com/cayzlh/hexo-theme-vellum.git themes/vellum
```

站点 `_config.yml` 里指定主题：

```yaml
theme: vellum
```

```bash
hexo clean && hexo server
```

主题自带一份**可运行的默认配置**，不改任何东西也能直接把站点跑起来。

**可选依赖**：只有用到订阅页才需要 `npm install rss-parser --save`。其余功能不依赖任何额外包。

---

## 制作

> **本主题的全部代码与文档，均由 DSH（DeepSeek Harness）生成。**
>
> 覆盖范围：`layout/` 下的模板、`scripts/` 下的生成器与过滤器、`source/` 下的样式与前端脚本、
> `_config.yml` 的配置项及注释、`tools/` 下的脚本，以及本 README 和完整的主题档案文档。
>
> 例外只有一项：`source/fonts/` 内嵌的 **Maple Mono NF CN** 是第三方开源字体，
> 版权归 The Maple Mono Project Authors，不是 DSH 的产出（详见下方许可）。

---

## 📖 文档

**完整文档在主题档案里：<https://www.cayzlh.com/dossier/vellum/>**

每一处配置、每个功能点、常见报错的排查，都在那边。README 只保留「这是什么 + 怎么装」。

---

## 界面多语言

主题自己的界面文案（按钮、`aria-label`、空状态、`<title>` 后缀、页脚署名）
支持三种语言：**简体中文 `zh-CN`（基准）/ 繁體中文 `zh-TW` / English `en`**。
文章正文不归它管。

默认跟着站点的 `_config.yml`：

```yaml
language: zh-CN
```

也可以强制指定，忽略站点配置：

```yaml
# themes/vellum/_config.yml
i18n:
  lang: zh-TW      # auto | zh-CN | zh-TW | en
```

**改单条文案**：优先用原有配置项，它们优先级高于语言包：

```yaml
# 直接写字符串（老写法，原样使用）
toc:
  back_to_top_text: '回到顶部'

# 或者按语言分开写，切语言时不会串味
recent_posts_title:
  zh-CN: '近日所思：'
  zh-TW: '近日所思：'
  en: 'Recent thoughts:'
```

**加一门新语言**：在 `languages/` 放一个 `<code>.yml`，把 `<code>` 加进
`scripts/lib/i18n-core.js` 的 `LANG_ALIAS`。缺的键自动回落到 `zh-CN`，
不必一次翻完。

改完之后跑一下自检，它会揪出漏译和占位符对不上的键：

```bash
node themes/vellum/tools/test-i18n.js
```

---

## 订阅页 · 远程订阅列表

订阅源默认来自站点的 `source/_data/subscriptions.yml`。还可以再叠加一份**远程列表**：
构建期向一个公开只读接口要一份 JSON，和本地 yml 合并后一起抓取。典型用法是自己
有个小服务（比如 Cloudflare Worker + 一个 Chrome 插件），随手存一个新源，下次部署
页面就自动多一条——不用回来改 yml、不用重新提交。

**默认关闭**。不打开时完全不发这个请求，`/subscriptions/` 的产物与没有这个功能时一致。

```yaml
# themes/vellum/_config.yml（或站点侧 _config.<theme>.yml，站点配置优先）
subscriptions:
  remote:
    enable: true
    api_base: 'https://hub.example.com'   # 不带结尾斜杠
    path: '/api/subscriptions/public'     # 默认值，一般不用改
    timeout: 5000                         # 拉列表的超时，超时就退回本地
    merge: remote-first                   # remote-first | local-first | remote-only
```

接口形状（只读公开，**不带凭据**）：

```json
{
  "version": 1,
  "updatedAt": 1762345678901,
  "subscriptions": [
    { "id": 1, "name": "示例博客", "url": "https://example.com/atom.xml",
      "homepage": "https://example.com", "icon": "📡",
      "description": "一句话简介", "limit": 3, "sort": 0 }
  ]
}
```

**合并规则**（同一 URL 归一化后只保留一条；归一化 = 协议与主机小写、去尾部斜杠、
去 fragment，所以 `https://a.com/feed` 与 `https://a.com/feed/` 是同一条）：

| 模式 | 顺序 | 同 URL 时 |
| --- | --- | --- |
| `remote-first`（默认） | 远程按 `sort`→`id` 排在前，本地独有接在后 | 远程记录优先；远程留空的 `name` / `description` / `icon` / `limit` / `homepage` 用本地补 |
| `local-first` | 本地（yml 顺序）在前，远程独有接在后 | 本地记录优先，远程补空 |
| `remote-only` | 只用远程 | 本地 yml 完全不参与 |

**失败兜底**：超时、非 2xx、JSON 解析失败、Node 太老没有全局 `fetch`——一律只打一行
`warn`，然后拿本地 yml 继续构建。**网络问题永远不会让整站构建失败。**

`merge` 写错（拼错、大小写混着写）会回落到 `remote-first`，不会报错。

合并逻辑抽在 `scripts/lib/subscription-merge.js` 里（纯函数，无 hexo 依赖），
自测：

```bash
node themes/vellum/tools/test-subscription-merge.js
```

---

## 许可

- 主题代码与文档：[MIT](LICENSE)
- 内嵌字体 **Maple Mono NF CN** 是**第三方开源字体**（非本主题作品），版权属
  [The Maple Mono Project Authors](https://github.com/subframe7536/maple-font)，
  以 [SIL OFL 1.1](LICENSE-MapleMono.txt) 授权使用。主题只负责把上游字体切片成
  带 `unicode-range` 的 WOFF2 分片（`tools/build-fonts.py`），字形设计全部归功于上游。

Copyright © 2026 [Ant丶](https://cayzlh.com)
