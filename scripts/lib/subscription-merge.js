'use strict';

/**
 * Vellum — 订阅源合并核心（纯函数）
 *
 * 为什么单独抽一个文件，而不是塞在 scripts/subscriptions.js 里：
 *   1. **要能单测**。合并规则是这个功能里最容易写错、也最难在真实构建里
 *      观察的部分（两个列表、三种模式、字段补空、排序都得对）。放在
 *      generator 里就只能靠跑 `hexo generate` 连着网络一起验，太慢也不稳；
 *      这里只吃两个数组、吐一个数组，`node tools/test-subscription-merge.js`
 *      就能把九种情形全钉住。
 *   2. **契约归属清楚**。URL 归一化规则来自 rss-hub 的 01-api-contract.md
 *      第 4 节，hub 侧存库、插件侧查重、主题侧合并必须是同一套算法。
 *      独立文件方便以后别人抄/对照，也方便哪天要换实现时只改一处。
 *
 * 本文件不 require hexo、不读配置、不打日志、不发请求——给定输入就有确定输出。
 *
 * 用法：
 *   var merge = require('./lib/subscription-merge');
 *   merge.normalizeFeedUrl('HTTPS://Example.com/feed/#top');  // 'https://example.com/feed'
 *   merge.mergeSubscriptions(localList, remoteList, 'remote-first');
 *
 * 三种模式（见 rss-hub/docs/00-design.md 第 5 节）：
 *   remote-first（默认）  远程记录在前，本地只补空字段；本地独有的接在后
 *   local-first           镜像规则：本地在前，远程只补空字段；远程独有的接在后
 *   remote-only           只用远程，本地配置完全不参与
 */

/* 「本地补空」只补这几个展示字段。id / sort / url 不补：
   它们是身份与顺序，混着来源补会出现两种口径打架的情况。 */
var FILL_FIELDS = ['name', 'description', 'icon', 'limit', 'homepage'];

var VALID_MODES = ['remote-first', 'local-first', 'remote-only'];
var DEFAULT_MODE = 'remote-first';

/**
 * 把写歪的 mode 归一化。认不出来就回默认值，而不是抛错或返回空——
 * 配置里一个拼写错误不该让整站构建挂掉（生成器那边也绝不用 try/catch 兜）。
 * 允许 `remote_first` / `Remote-First` 这类写法，减少无谓的踩坑。
 */
function normalizeMode(mode) {
  if (!mode) return DEFAULT_MODE;
  var m = String(mode).trim().toLowerCase().replace(/_/g, '-');
  return VALID_MODES.indexOf(m) >= 0 ? m : DEFAULT_MODE;
}

/**
 * URL 归一化 —— 合并去重的唯一身份。
 *
 * 规则照抄契约第 4 节：trim、协议与主机小写、**只对路径**去尾部 `/`、去 fragment。
 * 路径大小写**保留**（`/Feed` 与 `/feed` 在 HTTP 里是两个地址），
 * query **保留**（`?alt=rss` 这种是很多源的必要参数），query 里的 `/` 一个都不能动。
 *
 * 解析不了的字符串原样返回（只 trim）：宁可两条坏 URL 不合并，
 * 也不要把用户的源静默变成别的地址。
 *
 * 本函数是**三处共用口径**（hub / Chrome 插件 / 主题）。改这里之前先确认
 * 另外两处也一起改，否则同一源会被算成两个键。
 */
function normalizeFeedUrl(raw) {
  if (raw === null || raw === undefined) return '';
  var s = String(raw).trim();
  if (!s) return '';

  var u;
  try {
    u = new URL(s);
  } catch (e) {
    return s;
  }

  // fragment 不可能是 feed 地址的一部分，必须去掉，否则 /feed#top 会重复
  u.hash = '';
  // WHATWG URL 本身已把协议与主机小写化，这里显式写一遍是为了让继承者
  // 一眼看到「归一化包含这两条」，不必去翻 URL 规范。
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();

  /* 只削**路径**尾部的斜杠，然后手工拼 search —— 绝不对整个 href 削尾斜杠。
     为什么不能图省事写 `u.toString().replace(/\/$/, '')`：那会连 query 值
     一起削。`https://a.com/feed?next=/x/` 会被改成 `...?next=/x`，
     `https://a.com/feed/?q=a/` 会被改成 `.../feed?q=a`——这不只是去重口径
     与 hub/插件对不上，更糟的是这个返回值在合并后会被当成**实际抓取地址**
     （cloneRecord 把 url 换成归一化形式，随后 parseURL 用它），
     等于静默把用户的源改写成另一个地址，那类源必然抓不到。
     根路径 '/' 削成空串，所以 `https://a.com/` 与 `https://a.com` 一致；
     `https://a.com/?` 的 search 为空串，结果同样是 `https://a.com`。
     本函数必须与 hub（rss-hub）和 Chrome 插件里的实现逐字一致：
     三处算出来的键不同，就会出现「同一源在页面上重复两条」或
     「插件说已存在、构建却当成新源」这类无法解释的现象。 */
  var path = u.pathname.replace(/\/+$/, '');

  return u.protocol + '//' + u.host + path + u.search;
}

/**
 * 判断「这个字段算不算没填」。
 *
 * 契约规定可空字段用 null 表示没填（不是空字符串），但本地 yml 是手写的，
 * 空字符串、只填空格都常见；limit 的合法范围是 1–20，所以 0 与负数
 * 在这套语义里等同「没填」。两种来源混在一起时必须按同一把尺子判断。
 */
function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'number') return !isFinite(v) || v <= 0;
  return false;
}

function toInt(v, fallback) {
  var n = parseInt(v, 10);
  return isFinite(n) ? n : fallback;
}

/**
 * 浅拷贝一条记录，并**顺手把 url 归一化**。合并是「产出新列表」，
 * 绝不能改调用方传进来的对象。
 *
 * 为什么输出要把 url 换成归一化形式（而不是原样保留）：合并结果里的 url
 * 不只用来看，还要被拿去 parseURL 抓 feed。带 fragment 的地址会让请求
 * 直接 404（实测 `http://a.com/atom.xml/#top` → 404，去掉 fragment 才是 200），
 * 尾斜杠也常被源站判成另一个路径。显示与抓取用同一个规范地址，能少一类
 * 「明明有源却抓不到」的怪事；去重用的键与抓取用的 URL 也就永远是同一个。
 * 解析不了的地址按 normalizeFeedUrl 的约定原样返回。
 */
function cloneRecord(item) {
  var out = {};
  for (var k in item) {
    if (Object.prototype.hasOwnProperty.call(item, k)) out[k] = item[k];
  }
  if (out.url !== undefined && out.url !== null) {
    out.url = normalizeFeedUrl(out.url);
  }
  return out;
}

/**
 * 用 secondary 补 primary 里空着的展示字段。
 * 只在 primary 该字段「没填」时补——远程明确填了 `icon: 📡` 就尊重远程，
 * 不会因为本地也写了 icon 就被覆盖。
 */
function fillBlank(primary, secondary) {
  var out = cloneRecord(primary);
  if (!secondary) return out;
  FILL_FIELDS.forEach(function (field) {
    if (isBlank(out[field]) && !isBlank(secondary[field])) {
      out[field] = secondary[field];
    }
  });
  return out;
}

/**
 * 同一列表内按归一化 URL 去重，保留**第一条**。
 * 另外顺手滤掉非对象元素（yml 里写成 `- ` 会得到 null，hub 返回脏数据也可能）。
 */
function dedupeWithin(list) {
  var out = [];
  var seen = Object.create(null);
  (Array.isArray(list) ? list : []).forEach(function (item) {
    if (!item || typeof item !== 'object') return;
    var key = normalizeFeedUrl(item.url);
    if (key) {
      if (seen[key]) return;
      seen[key] = true;
    }
    out.push(item);
  });
  return out;
}

/**
 * 远程列表的排序：`sort` 升序，`sort` 相同按 `id` 升序（契约如此）。
 * 缺 sort 视同 0（契约默认值），缺 id 排到最后（不猜它该在哪）。
 * 之所以只对远程排序：本地 yml 的顺序是作者手排的，打乱它等于改版式。
 */
function sortRemote(list) {
  var MAX = Number.MAX_SAFE_INTEGER;
  return list.slice().sort(function (a, b) {
    var sa = toInt(a.sort, 0);
    var sb = toInt(b.sort, 0);
    if (sa !== sb) return sa - sb;
    return toInt(a.id, MAX) - toInt(b.id, MAX);
  });
}

function indexByUrl(list) {
  var map = Object.create(null);
  list.forEach(function (item) {
    var key = normalizeFeedUrl(item.url);
    if (key) map[key] = item;
  });
  return map;
}

/**
 * 合并本地与远程订阅列表。
 *
 * @param {Array}  localList  本地 source/_data/subscriptions.yml 里的数组
 * @param {Array}  remoteList hub 公开接口返回的 subscriptions 数组
 * @param {string} mode       'remote-first'（默认）| 'local-first' | 'remote-only'
 * @returns {Array} 新的合并结果；入参的数组与对象都不会被修改
 */
function mergeSubscriptions(localList, remoteList, mode) {
  var m = normalizeMode(mode);
  var local = dedupeWithin(localList);
  var remote = sortRemote(dedupeWithin(remoteList));

  // remote-only：本地配置整块不参与，远程是什么就是什么
  if (m === 'remote-only') {
    return remote.map(cloneRecord);
  }

  if (m === 'local-first') {
    var remoteByKey = indexByUrl(remote);
    var takenRemote = Object.create(null);
    var localOut = local.map(function (item) {
      var key = normalizeFeedUrl(item.url);
      var hit = key ? remoteByKey[key] : null;
      if (hit) takenRemote[key] = true;
      // 本地优先，远程补本地没填的展示字段
      return hit ? fillBlank(item, hit) : cloneRecord(item);
    });
    /* 只有远程才有的源接在后，保持远程排序。
       本地没配过的源不该被丢掉——那才是「加了一堆源却看不到」的典型抱怨。 */
    var extras = remote.filter(function (item) {
      var key = normalizeFeedUrl(item.url);
      return !(key && takenRemote[key]);
    });
    return localOut.concat(extras.map(cloneRecord));
  }

  // remote-first（默认）：远程在前，本地补空，本地独有接在后
  var localByKey = indexByUrl(local);
  var remoteKeys = indexByUrl(remote);
  var out = remote.map(function (item) {
    var key = normalizeFeedUrl(item.url);
    var hit = key ? localByKey[key] : null;
    return hit ? fillBlank(item, hit) : cloneRecord(item);
  });
  local.forEach(function (item) {
    var key = normalizeFeedUrl(item.url);
    if (key && remoteKeys[key]) return; // 已被远程那条代表
    out.push(cloneRecord(item));
  });
  return out;
}

module.exports = {
  normalizeFeedUrl: normalizeFeedUrl,
  mergeSubscriptions: mergeSubscriptions,
  /* 下面两个不是契约要求，只是给测试和调用方留的观察窗 */
  normalizeMode: normalizeMode,
  FILL_FIELDS: FILL_FIELDS
};
