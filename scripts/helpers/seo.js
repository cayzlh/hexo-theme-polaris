'use strict';

// SEO Helpers for Polaris theme
// Generates title, description, keywords, JSON-LD

function stripHtml(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
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
  if (page.category) return 'Category: ' + page.category + sep + site;

  // Tag pages
  if (page.tag) return 'Tag: #' + page.tag + sep + site;

  // Other pages with title
  if (page.title) return page.title + sep + site;

  // Home / default
  if (page.__index) return site;

  return site;
});

// SEO description
hexo.extend.helper.register('seo_description', function(page) {
  var config = hexo.config;
  var theme = hexo.theme.config;

  // 1. Front-matter description
  if (page.description) return truncate(page.description, 160);

  // 2. Excerpt
  if (page.excerpt) return truncate(page.excerpt, 160);

  // 3. Content first 150 chars
  if (page.content) return truncate(page.content, 160);

  // 4. Site global description
  if (config.description) return truncate(config.description, 160);

  // 5. Theme description
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
  return 'https://' + host + path;
});

// Replace tricky characters in description for meta tag safety
hexo.extend.helper.register('safe_meta', function(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/\n/g, ' ').trim();
});
