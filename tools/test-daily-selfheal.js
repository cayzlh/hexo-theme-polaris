#!/usr/bin/env node
'use strict';

/**
 * 资讯页自愈逻辑回归测试
 *
 * 背景：/news/ 是构建期静态产物，页面期号 = 构建那一刻的日期。GitHub
 * Actions 的 schedule 经常晚 1~3 小时，于是北京时间 00:00 到当次构建完成
 * 之间，页面挂的是前一天的资讯。旧实现遇到「API 期号 ≠ 页面期号」直接
 * return，页面只能等下次构建，用户刷新无效。
 *
 * 这个测试锁住现在的行为：
 *   stale 页面(t-1) 旧于 API(t)      -> 必须整页重渲染成今天，且不 reload
 *   same  页面与 API 同期号          -> 不得整页重渲染，只原地轻量刷新
 *   ahead 页面期号比 API 还新        -> 必须保持页面现状，不得回退
 *
 * 用法：
 *   node tools/test-daily-selfheal.js            # 用内置 fixture
 *   node tools/test-daily-selfheal.js --fetch    # 拉真实 API 当 fixture
 *   DAILY_API_BASE=https://your-60s-host node tools/test-daily-selfheal.js --fetch
 *
 * 退出码 0 = 全部通过，1 = 有场景失败。
 * 不依赖 jsdom / puppeteer：只模拟用到的 DOM 与 fetch 接口。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LAYOUT = path.join(ROOT, 'layout', 'daily.ejs');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'daily');
/* 与主题默认值保持一致（themes/vellum/_config.yml 的 daily.api_base）。
 * 自部署实例用环境变量覆盖，避免把任何私有域名写进脚本。 */
const API = (process.env.DAILY_API_BASE || 'https://60s.viki.moe').replace(/\/+$/, '');

/* 布局里只用到这两个 EJS 表达式，这里自己替换，避免为了测试去跑 hexo */
const EJS_SUBS = [
  [/'<%=\s*API_BASE\s*%>'/g, "'" + API + "'"],
  [/'<%=\s*daily\.date \|\| ""\s*%>'/g, "''"], // 占位，随后按场景改写
];

const ENDPOINTS = {
  '/v2/60s': '60s.json',
  '/v2/today-in-history': 'today-in-history.json',
  '/v2/zhihu': 'zhihu.json',
  '/v2/weibo': 'weibo.json',
  '/v2/ai-news': 'ai-news.json',
  '/v2/hacker-news/top': 'hacker-news.json',
  '/v2/moyu': 'moyu.json',
  '/v2/luck': 'luck.json',
};

/* ===== fixture ===== */

async function ensureFixtures(wantFetch) {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const [apiPath, file] of Object.entries(ENDPOINTS)) {
    const dest = path.join(FIXTURE_DIR, file);
    if (fs.existsSync(dest) && !wantFetch) continue;
    const res = await fetch(API + apiPath);
    if (!res.ok) throw new Error('fetch ' + apiPath + ' -> HTTP ' + res.status);
    fs.writeFileSync(dest, JSON.stringify(await res.json(), null, 2));
    console.log('  fixture 已刷新: ' + file);
  }
}

/* ===== 从布局里抽出页面脚本 ===== */

function loadClientSource(pageDate) {
  const layout = fs.readFileSync(LAYOUT, 'utf8');
  // 页面自身的脚本是最后一段 <script>（前面是主题的公共脚本引用）
  const blocks = [...layout.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!blocks.length) throw new Error('没在 daily.ejs 里找到内联 <script>');
  let src = blocks[blocks.length - 1];

  for (const [re, to] of EJS_SUBS) src = src.replace(re, to);
  // 兜底：把 date 占位换成场景需要的期号
  src = src.replace(/var pageDate = '[0-9]{4}-[0-9]{2}-[0-9]{2}'?;/, "var pageDate = '" + pageDate + "';");
  src = src.replace(/var pageDate = '';/, "var pageDate = '" + pageDate + "';");
  return src;
}

/* ===== 最小 DOM / fetch 桩 ===== */

function makeHarness(src, fixtures) {
  const appEl = { innerHTML: '' };
  const stubItems = n => Array.from({ length: n }, (_, i) => ({ textContent: 'item ' + i }));
  const mkEl = id => ({
    id,
    textContent: '',
    innerHTML: '',
    children: stubItems(5),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    querySelectorAll() { return this.children; },
  });

  // 模拟「页面已由服务端渲染好」的初始状态，均为旧一天的内容
  const seeded = {
    'dm-tip':      { textContent: '旧 tip' },
    'update-time': { textContent: '10-31 22:00' },
    'b-weekend':   { textContent: '周末还有 2 天' },
    'b-luck':      { textContent: '🍀 运势 15' },
    'copy-zaobao': mkEl('copy-zaobao'),
    'z-list':      mkEl('z-list'),
    'z-toggle':    mkEl('z-toggle'),
  };

  const document = {
    getElementById: id => (id === 'daily-app' ? appEl : (seeded[id] || null)),
  };

  const fetched = [];
  const fakeFetch = url => {
    const { pathname } = new URL(url);
    fetched.push(pathname);
    const file = ENDPOINTS[pathname];
    if (!file) return Promise.resolve({ json: async () => ({ code: 404, data: null }) });
    return Promise.resolve({ json: async () => fixtures[file] });
  };

  const state = { reloads: 0 };
  const navigator = { clipboard: { writeText: async () => {} } };
  const location = { reload() { state.reloads++; } };
  const sessionStorage = { getItem: () => null, setItem() {} };

  new Function('document', 'fetch', 'navigator', 'location', 'sessionStorage', 'window', src)(
    document, fakeFetch, navigator, location, sessionStorage, {}
  );

  return { appEl, seeded, fetched, state };
}

/* ===== 场景 ===== */

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runScenario(name, pageDate, fixtures) {
  const src = loadClientSource(pageDate);
  const h = makeHarness(src, fixtures);
  await sleep(900); // 等 Promise 链走完

  const html = h.appEl.innerHTML;
  const apiDate = fixtures['60s.json'].data.date;
  const r = {
    rerendered: html.length > 0,
    hasApiDate: html.includes(apiDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => parseInt(m, 10) + '月' + parseInt(d, 10) + '日')),
    hasOldZaobao: html.includes('统计局：2025 年末全国人口总量'),
    hasApiZaobao: html.includes(fixtures['60s.json'].data.news[0].replace(/^\d+[、.．\s]\s*/, '').slice(0, 12)),
    reloads: h.state.reloads,
    fetched: h.fetched,
  };

  let pass, rule;
  if (name === 'stale') {
    pass = r.rerendered && r.hasApiDate && r.hasApiZaobao && !r.hasOldZaobao && r.reloads === 0;
    rule = '页面(' + pageDate + ')旧于 API(' + apiDate + ') → 整页重渲染为今天，不 reload';
  } else if (name === 'same') {
    pass = !r.rerendered && r.reloads === 0;
    rule = '页面与 API 同期号(' + apiDate + ') → 不整页重渲染，只原地轻量刷新';
  } else {
    pass = !r.rerendered;
    rule = '页面(' + pageDate + ')新于 API(' + apiDate + ') → 保持页面现状，不回退';
  }

  const icon = pass ? '✓' : '✗';
  console.log('  ' + icon + ' ' + name.padEnd(6) + ' pageDate=' + pageDate + '  ' + rule);
  if (!pass) {
    console.log('      重渲染=' + r.rerendered + ' 新日期=' + r.hasApiDate +
                ' 新早报=' + r.hasApiZaobao + ' 旧早报残留=' + r.hasOldZaobao +
                ' reload=' + r.reloads);
    console.log('      请求=' + r.fetched.join(', '));
  }
  return pass;
}

/* ===== 入口 ===== */

(async () => {
  const wantFetch = process.argv.includes('--fetch');
  console.log('资讯页自愈回归测试');
  console.log('布局: ' + path.relative(process.cwd(), LAYOUT));
  await ensureFixtures(wantFetch);

  const fixtures = {};
  for (const file of Object.values(ENDPOINTS)) {
    fixtures[file] = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'));
  }
  const apiDate = fixtures['60s.json'].data.date;
  console.log('fixture 期号: ' + apiDate + '\n');

  const prev = shiftDate(apiDate, -1);
  const next = shiftDate(apiDate, +1);

  const results = [
    await runScenario('stale', prev, fixtures),
    await runScenario('same', apiDate, fixtures),
    await runScenario('ahead', next, fixtures),
  ];

  const ok = results.filter(Boolean).length;
  console.log('\n' + ok + '/' + results.length + ' 通过');
  process.exit(ok === results.length ? 0 : 1);
})().catch(err => {
  console.error('测试异常: ' + err.message);
  process.exit(1);
});

function shiftDate(ymd, days) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
