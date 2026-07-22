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
| `custom_pages` | Extra pages from `custom/` directory |
| `footer` | Footer text & copyright |

See the [full `_config.yml`](_config.yml) for all options and defaults.

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
  text: '#1a1a1a'
  background: '#ffffff'
  link: '#1a1a1a'
  link-hover: '#3b82f6'
```

### Typography

```yaml
font_size: 18px
line_height: 1.8
max_width: 720px
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
