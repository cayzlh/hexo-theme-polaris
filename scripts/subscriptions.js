'use strict';

/**
 * Subscriptions Generator
 *
 * Fetches RSS/Atom feeds during `hexo generate` and renders them
 * on a /subscriptions/ page.
 *
 * Configuration (themes/polaris/_config.yml):
 *   subscriptions:
 *     default_limit: 3       # 每个源默认抓取条数
 *     page_title: 订阅        # 页面标题
 *     page_subtitle: '正在关注 %d 个博客'
 *     show_description: true # 是否显示描述
 *     show_count: true       # 是否显示更新条数
 *     timeout: 10000         # 请求超时（毫秒）
 *
 * Data source: source/_data/subscriptions.yml
 *
 *   subscriptions:
 *     - name: 博客名称
 *       url: https://example.com/feed.xml
 *       homepage: https://example.com          # 可选，博主主页（订阅名称将链接到此）
 *       limit: 3                               # 可选，默认使用 default_limit
 *       icon: 📡                               # 可选
 *       description: 简介                       # 可选
 */

var i18n = require('./lib/i18n-core')(hexo);
var tr = i18n.tr;

var Parser, parser;
try {
  Parser = require('rss-parser');
  parser = new Parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Polaris-Subscriptions/1.0'
    }
  });
} catch (e) {
  hexo.log.error('[subscriptions] Failed to load rss-parser: ' + e.message);
  hexo.log.error('[subscriptions] Run: npm install rss-parser --save');
}

function requireRssParser() {
  if (!Parser) {
    hexo.log.error('[subscriptions] rss-parser not available, skipping feed fetch.');
    return false;
  }
  return true;
}

hexo.extend.generator.register('subscriptions', function () {
  var cfg = hexo.config.subscriptions || {};
  var themeCfg = (hexo.theme.config && hexo.theme.config.subscriptions) || {};
  // 合并：站点配置优先于主题配置
  for (var k in themeCfg) {
    if (cfg[k] === undefined) cfg[k] = themeCfg[k];
  }

  var pageTitle = i18n.pick(cfg.page_title, 'subscriptions.page_title');
  var pageSubtitle = cfg.page_subtitle || '';
  var defaultLimit = cfg.default_limit || 3;
  var showDesc = cfg.show_description !== false;
  var showCount = cfg.show_count !== false;
  var timeout = cfg.timeout || 10000;

  // 检查 rss-parser 是否可用
  if (!requireRssParser()) {
    return buildPage({
      title: pageTitle,
      items: [],
      isEmpty: true,
      totalActive: 0
    });
  }

  // 读取数据文件
  var data = hexo.locals.get('data') || {};
  var subscriptions = (data.subscriptions && data.subscriptions.subscriptions) || [];

  /* 兜底默认订阅源：站点没配 source/_data/subscriptions.yml（或配成空列表）
     时用主题 _config.yml 里的 defaults 顶上，让 /subscriptions/ 与首页
     「逛逛博客」开箱就有内容，而不是两个空页面。
     站点自己配了就完全以站点为准，默认值不会混进来。 */
  if (!subscriptions.length) {
    var defaults = (cfg.defaults || []);
    if (Array.isArray(defaults) && defaults.length) {
      subscriptions = defaults;
      hexo.log.info('[subscriptions] 未配置订阅源，使用主题默认的 ' + defaults.length + ' 个');
    }
  }

  var PER_PAGE = 10;

  function buildPage(customData) {
    var path = customData.path || 'subscriptions/index.html';
    return {
      path: path,
      layout: 'subscriptions',
      data: customData
    };
  }

  function buildPages(allItems, totalActive, sources) {
    var totalPages = Math.max(1, Math.ceil(allItems.length / PER_PAGE));
    var pages = [];

    for (var p = 1; p <= totalPages; p++) {
      var start = (p - 1) * PER_PAGE;
      var end = Math.min(start + PER_PAGE, allItems.length);
      var pageItems = allItems.slice(start, end);

      var pagePath = p === 1
        ? 'subscriptions/index.html'
        : 'subscriptions/page/' + p + '/index.html';

      var prevLink = p > 1
        ? (p === 2 ? '/subscriptions/' : '/subscriptions/page/' + (p - 1) + '/')
        : null;

      var nextLink = p < totalPages
        ? '/subscriptions/page/' + (p + 1) + '/'
        : null;

      pages.push(buildPage({
        path: pagePath,
        title: pageTitle,
        items: pageItems,
        isEmpty: false,
        totalActive: totalActive,
        sources: sources || [],
        total: totalPages,
        current: p,
        prev: p > 1,
        next: p < totalPages,
        prev_link: prevLink,
        next_link: nextLink
      }));
    }

    return pages;
  }

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    hexo.log.info('[subscriptions] No subscriptions data found, page will be empty.');
    return buildPage({
      title: pageTitle,
      items: [],
      updateTime: nowStr(),
      isEmpty: true,
      totalActive: 0
    });
  }

  hexo.log.info('[subscriptions] Fetching ' + subscriptions.length + ' feeds...');

  // 并发请求所有订阅源
  var promises = subscriptions.map(function (sub) {
    return fetchFeed(sub, defaultLimit, timeout);
  });

  return Promise.all(promises).then(function (feeds) {
    var totalActive = 0;
    var allItems = [];
    // 订阅源摘要：供页面「正在关注」网格使用。只留展示需要的字段，
    // 不把每个源抓到的全部条目塞进页面数据。
    var sources = [];
    feeds.forEach(function (f) {
      if (!f.error) totalActive++;
      sources.push({
        name: f.name,
        url: f.url,
        homepage: f.homepage || f.url,
        icon: f.icon,
        description: f.description || '',
        error: !!f.error,
        count: (f.items || []).length
      });
      if (f.items && f.items.length > 0) {
        f.items.forEach(function (item) {
          allItems.push({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            sourceName: f.name,
            sourceHomepage: f.homepage || f.url,
            sourceIcon: f.icon
          });
        });
      }
    });

    // 按 pubDate 倒序排序（最新的在前）
    allItems.sort(function (a, b) {
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    hexo.log.info('[subscriptions] Done — ' + totalActive + '/' + feeds.length + ' feeds fetched, ' + allItems.length + ' items.');

    /* 把最近几条摘要挂到 theme.config 上，供首页「逛逛博客」模块使用。
       为什么挂在 theme.config 而不是 hexo.locals：模板能拿到的 site 是
       所有生成器跑之前拍好的快照，生成器之间又没有结果传递通道；而
       theme.config 是同一个对象，生成器里写、模板里就能读到。
       dossier.js 早就用这个方式传 projects，保持一致。
       注意存的是**拷贝**：下面 buildPages 还要用 allItems / sources，
       不能把同一个数组的引用交出去，否则模板侧的改动会反向污染。 */
    if (!hexo.theme.config) hexo.theme.config = {};
    hexo.theme.config.subscriptions_latest = {
      items: allItems.slice(0, 20).map(function (it) {
        return {
          title: it.title,
          link: it.link,
          pubDate: it.pubDate,
          sourceName: it.sourceName,
          sourceHomepage: it.sourceHomepage,
          sourceIcon: it.sourceIcon
        };
      }),
      sources: sources,
      totalActive: totalActive
    };

    return buildPages(allItems, totalActive, sources);
  }).catch(function (err) {
    hexo.log.error('[subscriptions] Fatal: ' + err.message);
    return buildPage({
      title: pageTitle,
      items: [],
      updateTime: nowStr(),
      isEmpty: true,
      totalActive: 0
    });
  });
});

/* ===== Feed Fetcher ===== */

function fetchFeed(sub, defaultLimit, timeout) {
  var limit = sub.limit || defaultLimit;
  var url = sub.url;

  if (!url) {
    return Promise.resolve({
      name: sub.name || tr('subscriptions.unknown_source'),
      url: '',
      icon: sub.icon || '⚠️',
      description: sub.description || '',
      homepage: sub.homepage || '',
      items: [],
      error: true,
      errorMsg: tr('subscriptions.fetch_failed')
    });
  }

  // 超时控制
  var fetchPromise = parser.parseURL(url);
  var timeoutPromise = new Promise(function (_, reject) {
    var id = setTimeout(function () {
      clearTimeout(id);
      reject(new Error('请求超时 (' + timeout + 'ms)'));
    }, timeout);
  });

  return Promise.race([fetchPromise, timeoutPromise]).then(function (feed) {
    var items = (feed.items || []).slice(0, limit).map(function (item) {
      return {
        title: item.title || tr('subscriptions.untitled'),
        link: item.link || '#',
        pubDate: item.pubDate || item.isoDate || '',
        content: (item.contentSnippet || item.content || '').substring(0, 200)
      };
    });

    return {
      name: sub.name || feed.title || tr('subscriptions.unknown_source'),
      url: sub.url,
      icon: sub.icon || '📡',
      description: sub.description || '',
      homepage: sub.homepage || '',
      items: items,
      feedTitle: feed.title || '',
      feedDescription: feed.description || '',
      error: false
    };
  }).catch(function (err) {
    hexo.log.warn('[subscriptions] Failed to fetch: ' + sub.url + ' — ' + err.message);
    return {
      name: sub.name || tr('subscriptions.unknown_source'),
      url: sub.url,
      icon: sub.icon || '⚠️',
      description: sub.description || '',
      homepage: sub.homepage || '',
      items: [],
      error: true,
      errorMsg: err.message
    };
  });
}

/* ===== Helpers ===== */

function nowStr() {
  var d = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
