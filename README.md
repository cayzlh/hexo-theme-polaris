# Polaris

> A minimal, elegant, and feature-rich Hexo theme.  
> *Be water, my friend.*

![Theme Version](https://img.shields.io/badge/version-3.0.0-blue.svg)
![Hexo](https://img.shields.io/badge/hexo-7.x-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## Overview

Polaris is a personal blog theme for [Hexo](https://hexo.io/), designed with a focus on **reading experience**, **performance**, and **customizability**. It ships with a built-in dossier (project archive) system, SEO-first markup, dark mode, and smooth page transitions.

**Demo:** [https://www.cayzlh.com](https://www.cayzlh.com)

---

## Features

- **Dossier System** — Organize projects or series as a tree of Markdown documents, with auto-generated navigation and card-based index
- **Dark Mode** — Auto / Manual / System-aware, with separate color palette
- **SEO Optimized** — Open Graph, JSON-LD structured data, canonical URL with clone detection
- **Table of Contents** — Collapsible sidebar TOC with scroll following, tree lines, and gradient mask
- **Page Transitions** — View Transitions API with JS fade fallback
- **Responsive** — Mobile-first design, adapts from phone to desktop
- **Custom Pages** — Drop plain Markdown/HTML into a `custom/` directory
- **Typography-first** — Carefully tuned font size, line height, and max-width for comfortable reading
- **Minimal & Clean** — No unnecessary dependencies, pure CSS + vanilla JS

---

## Quick Start

### 1. Install

```bash
# Navigate to your Hexo site directory
cd your-hexo-site

# Install the theme
git clone https://github.com/cayzlh/hexo-theme-polaris.git themes/polaris
```

### 2. Configure

Edit your site's `_config.yml`:

```yaml
theme: polaris
```

Then copy or reference `themes/polaris/_config.yml` to customize theme options.

### 3. Run

```bash
hexo clean && hexo server
```

---

## Configuration

Key configuration is in `themes/polaris/_config.yml`. Below are the main sections:

| Section | Description |
|---|---|
| `menu` | Navigation links |
| `intro` | Homepage intro text (supports Markdown) |
| `canonical` | SEO canonical URL & clone detection |
| `open_graph` / `structured_data` | Social sharing & schema.org markup |
| `color` / `dark` | Light & dark color palettes |
| `dark_mode` | Auto/manual/system mode selection |
| `transition` | Page transition animation settings |
| `toc` | Table of contents sidebar |
| `dossier` | Project archive system |
| `archive` | Archive page search configuration |
| `custom_pages` | Extra pages from `custom/` directory |
| `footer` | Footer text & copyright |
| `hr` | Horizontal rule styles (gradient / short / dotted / double / ornament) |
| `alapi` | Daily news API settings (token, switches, cache) |

### Daily News

Polaris ships with a `/news/` page that aggregates three data sources from [alapi.cn](https://alapi.cn): 每日早报, 知乎日报, 微博热搜.

**Theme scripts:**
- `scripts/zaobao.js` — Fetches all three APIs on `hexo generate`, generates `/news/index.html`

**Theme config (`themes/polaris/_config.yml`):**

```yaml
alapi:
  enable: true               # 总开关
  token: ''                  # API Token（建议通过环境变量或站点配置传入）
  zaobao:
    enable: true             # 每日早报
  zhihu:
    enable: true             # 知乎日报
  weibo:
    enable: true             # 微博热搜
```

**Token (themes/polaris/_config.yml):**

```yaml
alapi:
  token: 'your_token_here'
```

> **Cache**: Data is cached in `.daily_cache.json` (gitignored). Repeated builds on the same day skip API requests, preventing free tier overuse during local development.

See the [full `_config.yml`](_config.yml) for all options and defaults.

---

## Horizontal Rules (分割线体系)

Polaris transforms `<hr>` from a functional divider into a **visual breathing pause** — each variant becomes part of the page's design language.

### Available Styles

| Style | CSS Class | Preview | Best For |
|-------|-----------|---------|----------|
| Gradient | `hr.gradient` or `hr.style-gradient` | 两端渐隐，中间清晰 | Homepage post separators |
| Short | `hr.short` or `hr.style-short` | 64px 居中短横线 | In-post section breaks |
| Dotted | `hr.dotted` or `hr.style-dotted` | `· — · — ·` | Article endings |
| Double | `hr.double` or `hr.style-double` | 超细双平行线 | Sidebar / card dividers |
| Ornament | `hr.ornament` or `hr.style-ornament` | `✦ ✦ ✦` | About page, footer |
| Dash‑dot | `hr.dash-dot` | `— · — · —` | Alternative ornament |

### Usage

In Markdown content, add a classed `<hr>`:

```html
<hr class="short">
<hr class="dotted">
<hr class="ornament">
```

Or use the `style-` prefixed variant for compatibility:

```html
<hr class="style-gradient">
<hr class="style-short">
```

### Scene Mapping

```yaml
hr:
  home_style: gradient    # homepage post separators
  post_style: short       # in-post section breaks
  footer_style: ornament  # page footer
  sidebar_style: double   # sidebar/card dividers
  page_style: ornament    # About / standalone pages
```

All styles respect **dark mode** automatically via CSS custom properties.

---

## Dossier System

The Dossier system lets you group related posts into a browsable archive tree.

```text
source/dossier/
├── project-a/
│   ├── index.md          # Project home (required)
│   ├── part-1.md
│   └── part-2.md
└── project-b/
    ├── index.md
    └── chapter-1.md
```

Each `index.md` supports front-matter fields: `title`, `description`, `tags`, `sort`, `date`.

See [Dossier documentation](https://www.cayzlh.com/dossier/) for details.

---

## Customization

### Colors

Override any color variable in `_config.yml`:

```yaml
color:
  text: '#2C2A28'
  text-light: '#A09C96'
  text-muted: '#6B6864'
  background: '#F4F3EF'
  background-secondary: '#FAFAF7'
  background-tertiary: '#F0EFEB'
  link: '#8B6B4D'
  link-hover: '#6D4F3A'
  accent: '#8B6B4D'
  border: '#E5E2DC'
  border-dark: '#D4CEC6'
  code-bg: '#EDECE8'
  code-border: '#E0DED9'
  selection: '#E5E2DC'
```

> The default light mode uses a warm off-white background (`#F4F3EF`) with an earthy brown accent palette (`#8B6B4D`) for a comfortable reading experience. Dark mode is unaffected.

### Typography

```yaml
font_size: 17px
line_height: 1.75
max_width: 680px
```

### Add custom CSS/JS

Place files in `source/css/` or `source/js/` — they are loaded automatically.

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge — latest 2 versions)
- View Transitions API: Chrome 111+, Edge 111+, Opera 97+
- Graceful degradation for older browsers

---

## License

[MIT](LICENSE)

Copyright © 2018–2026 [Ant丶](https://cayzlh.com)

---

*Made with ❤️ by [cayzlh](https://github.com/cayzlh)*
