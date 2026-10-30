'use strict';

// SEO Helpers for Polaris theme
// Generates title, description, keywords, JSON-LD

function stripHtml(str) {
  if (!str) return '';
  return String(str)
    // Markdown images and links -> keep only their alt/label text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Headings, emphasis, code fences, inline code
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    // HTML tags and entities
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace so the meta tag stays on one line
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(str, len) {
  len = len || 150;
  if (!str) return '';
  str = stripHtml(str);
  return str.length > len ? str.substring(0, len) + '...' : str;
}

// Dynamic page title
hexo.extend.helper.register('seo_title', function(page) {
  var site = hexo.config.title || 'Untitled';
  var sep = ' · ';

  // Front-matter seo_title takes priority
  if (page.seo_title) return page.seo_title;

  // Dossier pages
  if (page.dossier) {
    var dkey = page.dossier;
    var theme = hexo.theme.config;
    var proj = (theme.dossier && theme.dossier.tree) ? theme.dossier.tree[dkey] : null;
    var dName = proj ? (proj.name || dkey) : dkey;
    if (page.title) return dName + sep + page.title + sep + site;
    return dName + sep + site;
  }

  // Article pages
  if (page.layout === 'post' && page.title) return page.title + sep + site;

  // Category pages
  if (page.category) return page.category + ' 分类' + sep + site;

  // Tag pages
  if (page.tag) return page.tag + ' 标签' + sep + site;

  // Archive pages: the year (and month) is the only thing distinguishing them,
  // and without it every archive shares the bare site title.
  var archiveMatch = /^archives\/(\d{4})(?:\/(\d{2}))?/.exec(page.path || '');
  if (archiveMatch) {
    var when = archiveMatch[2]
      ? archiveMatch[1] + ' 年 ' + parseInt(archiveMatch[2], 10) + ' 月'
      : archiveMatch[1] + ' 年';
    return when + '归档' + sep + site;
  }
  if (page.path === 'archives/index.html' || page.path === 'archives/') return '归档' + sep + site;

  // Other pages with title
  if (page.title) return page.title + sep + site;

  // Home / default
  if (page.__index) return site;

  return site;
});

// SEO description
/**
 * Build a description for listing pages (tag / category / archive) from the posts
 * they actually contain.
 *
 * Without this every listing page fell through to the site-wide tagline, so 73 tag
 * pages and 49 archive pages carried identical meta descriptions. Search engines
 * treat that as duplicate content and drop the pages from the index.
 *
 * Returns '' when the page is not a listing, so the caller keeps its old order.
 */
function listingDescription(page, config, siteName) {
  var posts = page.posts;
  if (!posts || typeof posts.length !== 'number' || posts.length === 0) return '';

  var titles = [];
  posts.forEach(function (post) {
    if (post && post.title) titles.push(post.title);
  });

  var count = posts.length;
  var preview = titles.slice(0, 3).join('、');
  var more = count > 3 ? ' 等' : '';

  if (page.tag) {
    return truncate(
      siteName + ' 上关于「' + page.tag + '」的 ' + count + ' 篇文章：' + preview + more + '。',
      160
    );
  }

  if (page.category) {
    return truncate(
      siteName + ' 的「' + page.category + '」分类下共 ' + count + ' 篇文章：' + preview + more + '。',
      160
    );
  }

  // Archive pages carry a year (and sometimes a month) in the path.
  var m = /^archives\/(\d{4})(?:\/(\d{2}))?/.exec(page.path || '');
  if (m) {
    var when = m[2] ? m[1] + ' 年 ' + parseInt(m[2], 10) + ' 月' : m[1] + ' 年';
    return truncate(
      siteName + ' 在 ' + when + ' 发布的 ' + count + ' 篇文章：' + preview + more + '。',
      160
    );
  }

  return '';
}

/**
 * Descriptions for the two index pages that have no `posts` collection:
 * the archive landing page and the dossier landing page.
 */
function indexPageDescription(page, siteName) {
  var path = page.path || '';

  if (path === 'archives/' || path === 'archives/index.html') {
    return truncate(
      siteName + ' 的全部文章归档，按年份和月份整理，可快速翻阅往期内容。',
      160
    );
  }

  if (path === 'dossier/' || path === 'dossier/index.html') {
    // Count the dossier projects the theme generated so the sentence is concrete.
    var projects = 0;
    try {
      var locals = hexo.locals.toObject();
      var pages = locals.pages || [];
      pages.forEach(function (p) {
        var pp = p.path || '';
        if (/^dossier\/[^/]+\/index\.html$/.test(pp)) projects += 1;
      });
    } catch (e) {
      projects = 0;
    }
    var base = siteName + ' 的档案库';
    return truncate(
      projects > 0
        ? base + '，收录 ' + projects + ' 个技术专题的系列笔记，按章节组织，适合系统性地读。'
        : base + '，按主题整理的系列技术笔记。',
      160
    );
  }

  return '';
}

hexo.extend.helper.register('seo_description', function(page) {
  var config = hexo.config;
  var theme = hexo.theme.config;
  var siteName = config.title || '';

  // 1. Front-matter description
  if (page.description) return truncate(page.description, 160);

  // 2. Listing pages: derive from the posts on the page so each one is unique
  var listing = listingDescription(page, config, siteName);
  if (listing) return listing;

  // 2b. Index pages that have no post collection of their own
  var indexDesc = indexPageDescription(page, siteName);
  if (indexDesc) return indexDesc;

  // 3. Excerpt
  if (page.excerpt) return truncate(page.excerpt, 160);

  // 4. Content first 150 chars
  if (page.content) return truncate(page.content, 160);

  // 5. Site global description
  if (config.description) return truncate(config.description, 160);

  // 6. Theme description
  if (theme.description) return truncate(theme.description, 160);

  return '';
});

// SEO keywords
hexo.extend.helper.register('seo_keywords', function(page) {
  // 1. Front-matter keywords
  if (page.keywords) {
    if (Array.isArray(page.keywords)) return page.keywords.join(', ');
    return page.keywords;
  }

  // 2. Tags
  if (page.tags && page.tags.length) {
    return page.tags.map(function(t) { return t.name; }).join(', ');
  }

  // 3. Dossier project tags
  if (page.dossier && hexo.theme.config.dossier && hexo.theme.config.dossier.tree) {
    var dkey = page.dossier;
    var proj = hexo.theme.config.dossier.tree[dkey];
    if (proj && proj.tags && proj.tags.length) return proj.tags.join(', ');
  }

  return '';
});

// JSON-LD structured data
hexo.extend.helper.register('json_ld', function(page, config) {
  var theme = hexo.theme.config;
  var sd = theme.structured_data;
  if (!sd || !sd.enable) return '';

  var siteUrl = config.url || '';

  // Article page → BlogPosting
  if (page.layout === 'post' && page.date) {
    var img = page.cover || page.banner || (sd.logo || '');
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: page.seo_title || page.title || '',
      datePublished: page.date.toISOString(),
      dateModified: (page.updated || page.date).toISOString(),
      author: {
        '@type': sd.site_type || 'Person',
        name: config.author || ''
      },
      publisher: {
        '@type': sd.site_type || 'Person',
        name: config.author || '',
        logo: sd.logo ? { '@type': 'ImageObject', url: sd.logo } : undefined
      },
      description: page.description || truncate(page.content, 160),
      mainEntityOfPage: { '@type': 'WebPage', '@id': siteUrl + (page.path || '') },
      image: img || undefined
    }, null, 2);
  }

  // Home page → WebSite
  if (page.__index) {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.title || '',
      url: siteUrl,
      description: config.description || '',
      author: {
        '@type': sd.site_type || 'Person',
        name: config.author || ''
      }
    }, null, 2);
  }

  return '';
});

// Canonical URL
hexo.extend.helper.register('canonical_url', function(page) {
  var config = hexo.config;
  var theme = hexo.theme.config;
  var canon = theme.canonical;
  if (!canon || !canon.originalHost) return '';

  var host = canon.originalHost.replace(/\/+$/, '');
  var path = page.path || '';
  if (!path.startsWith('/')) path = '/' + path;

  // `page.path` includes index.html for every generated directory page, but the
  // host rewrites that URL to the trailing-slash form with a 307. A canonical
  // that points at a redirecting URL is ignored by search engines, so strip the
  // filename and let the slash form be canonical — matching hexo's
  // pretty_urls.trailing_index/trailing_html: false setting.
  path = path.replace(/index\.html$/, '');
  // The host also rewrites `/foo.html` to `/foo`, so a canonical ending in .html
  // would point at a redirecting URL and be discarded.
  path = path.replace(/\.html?$/, '');
  if (path === '') path = '/';

  return 'https://' + host + path;
});

// Replace tricky characters in description for meta tag safety
hexo.extend.helper.register('safe_meta', function(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/\n/g, ' ').trim();
});
