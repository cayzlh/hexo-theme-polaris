'use strict';

/**
 * Complete sitemap generator for the Polaris theme.
 *
 * The stock hexo-generator-sitemap only knows about posts, pages, tags and
 * categories. That left two gaps on this site:
 *
 *   - archive pages (/archives/2022/03/ etc.) were never listed at all
 *   - the scanner picked up stray files such as README.html, which 404s online
 *
 * This generator replaces it so every indexable URL a reader can actually reach
 * appears exactly once, and nothing that cannot be reached does.
 *
 * Registered with a higher priority than the plugin so ours wins.
 */

// Helpers built here rather than requiring the plugin's internals, so a plugin
// upgrade cannot silently change our output.
function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Normalise a page path to the URL form the host actually serves. */
function absoluteUrl(siteUrl, path) {
  var p = String(path || '')
    .replace(/^\/+/, '')
    .replace(/index\.html$/, '')
    // The host rewrites `/foo.html` -> `/foo`; listing the .html form would put
    // a redirecting URL in the sitemap, which crawlers report as an error.
    .replace(/\.html?$/, '');
  return siteUrl.replace(/\/+$/, '') + '/' + p;
}

/**
 * Pages that must never be advertised to crawlers: build artefacts, the 404
 * page, and anything a page explicitly marks `sitemap: false`.
 */
function isExcluded(path, page) {
  // An empty string is the home page and is valid; only null/undefined are not.
  if (typeof path !== 'string') return true;
  if (page && page.sitemap === false) return true;
  // Uppercase README/LICENSE artefacts and the 404 page are not content.
  if (/^(README|LICENSE)(\.html)?$/i.test(path)) return true;
  if (/^404\.html$/i.test(path)) return true;
  // Feed and sitemap files are listings of URLs, not documents to index.
  if (/\.(xml|txt|json)$/i.test(path)) return true;
  return false;
}

hexo.extend.generator.register('polaris_sitemap', function (locals) {
  var config = this.config;
  var siteUrl = (config.url || '').replace(/\/+$/, '');
  var entries = new Map();

  function add(path, updated, changefreq, priority) {
    if (isExcluded(path)) return;
    var url = absoluteUrl(siteUrl, path);
    var prev = entries.get(url);
    var ts = updated instanceof Date ? updated.getTime() : new Date(updated || Date.now()).getTime();
    if (prev && prev.lastmod >= ts) return;
    entries.set(url, {
      loc: url,
      lastmod: ts,
      changefreq: changefreq,
      priority: priority
    });
  }

  // ---- Posts ----
  locals.posts.forEach(function (post) {
    add(post.path, post.updated || post.date, 'monthly', '0.8');
  });

  // ---- Pages, including the dossier routes the theme generates itself ----
  locals.pages.forEach(function (page) {
    // Listing pages carry a paginated path; the first page is the canonical one.
    add(page.path, page.updated || page.date, 'weekly', '0.5');
  });

  // ---- Home ----
  add('', new Date(), 'daily', '1.0');

  // ---- Tag index and every tag ----
  var tagDir = config.tag_dir || 'tags';
  add(tagDir + '/', new Date(), 'weekly', '0.4');
  if (locals.tags) {
    locals.tags.forEach(function (tag) {
      add(tag.path, tag.updated || tag.date || new Date(), 'weekly', '0.4');
    });
  }

  // ---- Category index and every category ----
  var catDir = config.category_dir || 'categories';
  add(catDir + '/', new Date(), 'weekly', '0.4');
  if (locals.categories) {
    locals.categories.forEach(function (cat) {
      add(cat.path, cat.updated || cat.date || new Date(), 'weekly', '0.4');
    });
  }

  // ---- Archive index plus every year / month page ----
  // These are real, linked pages that were missing from the previous sitemap.
  var archiveDir = config.archive_dir || 'archives';
  add(archiveDir + '/', new Date(), 'weekly', '0.5');
  var years = new Map();
  locals.posts.forEach(function (post) {
    if (!post.date) return;
    var d = post.date.toDate ? post.date.toDate() : new Date(post.date);
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth() + 1;
    var yKey = String(y);
    var mKey = yKey + '/' + (m < 10 ? '0' + m : String(m));
    var ts = Math.max(years.get(yKey) || 0, d.getTime());
    years.set(yKey, ts);
    var mTs = Math.max(years.get(mKey) || 0, d.getTime());
    years.set(mKey, mTs);
  });
  years.forEach(function (ts, key) {
    if (key.indexOf('/') > 0) {
      add(archiveDir + '/' + key + '/', new Date(ts), 'monthly', '0.3');
    } else {
      add(archiveDir + '/' + key + '/', new Date(ts), 'monthly', '0.4');
    }
  });

  // ---- Render ----
  var sorted = Array.from(entries.values()).sort(function (a, b) {
    return b.lastmod - a.lastmod;
  });

  var body = sorted
    .map(function (e) {
      return (
        '  <url>\n' +
        '    <loc>' + xmlEscape(e.loc) + '</loc>\n' +
        '    <lastmod>' + new Date(e.lastmod).toISOString() + '</lastmod>\n' +
        '    <changefreq>' + e.changefreq + '</changefreq>\n' +
        '    <priority>' + e.priority + '</priority>\n' +
        '  </url>'
      );
    })
    .join('\n');

  var xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</urlset>\n';

  // Baidu's crawler wants the same URL set; the stock generator only emitted
  // posts that happened to have categories, and wrote `index.html` paths that the
  // host redirects away. Emit both files from one source of truth instead.
  return [
    { path: 'sitemap.xml', data: xml },
    { path: 'baidusitemap.xml', data: xml }
  ];
});
