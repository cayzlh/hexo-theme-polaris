#!/usr/bin/env node
'use strict';

/**
 * 订阅源合并逻辑回归测试
 *
 * 背景：/subscriptions/ 的数据以前只有一条来源——站点的
 * source/_data/subscriptions.yml。现在多了一条：构建期从 hub 的
 * `GET /api/subscriptions/public` 拉一份。两条来源要合成一份列表，
 * 而合并是这个功能里最容易「看着对、实际错一行」的部分：
 *
 *   - 去重的身份是**归一化后的 url**（尾斜杠、主机大小写、fragment 都不算差异）
 *   - 同一 URL 两边都有时谁在前、谁补谁的字段，由 merge 模式决定
 *   - 远程有 sort/id，要排序；本地是作者手排的，顺序不能被打乱
 *
 * 这些规则没法靠跑 `hexo generate` 观察（要真网络、真 feed、真超时），
 * 所以合并被抽成 scripts/lib/subscription-merge.js 的纯函数，这里直接钉住。
 *
 * 用法：
 *   node tools/test-subscription-merge.js
 *
 * 退出码 0 = 全部通过，1 = 有场景失败。
 * 不依赖 hexo / rss-parser / 网络：只 require 那个纯函数文件。
 */

const assert = require('assert');
const path = require('path');
const merge = require(path.join(__dirname, '..', 'scripts', 'lib', 'subscription-merge.js'));

const { normalizeFeedUrl, mergeSubscriptions } = merge;

const results = [];

/**
 * 跑一个场景。断言用 assert，失败即抛；这里统一收口成一行报告。
 * @param {string} name 场景名（报告里显示）
 * @param {string} rule 一句话说明这条规则在防什么
 * @param {function} fn 断言函数
 */
function scenario(name, rule, fn) {
  let pass = true;
  let detail = '';
  try {
    fn();
  } catch (err) {
    pass = false;
    detail = String(err.message || err).split('\n').join('\n      ');
  }
  results.push(pass);
  console.log('  ' + (pass ? '✓' : '✗') + ' ' + name.padEnd(12) + ' ' + rule);
  if (!pass) console.log('      ' + detail);
}

/** 只取展示用的 name 数组，断言顺序时报告更易读 */
const names = list => list.map(s => s.name);

/* ===== fixture ===== */

const REMOTE_ONE = [
  { id: 7, name: '只有远程', url: 'https://remote-only.example/feed', sort: 0 },
];

/* ===== 场景 ===== */

console.log('订阅源合并回归测试');
console.log('实现: scripts/lib/subscription-merge.js');
console.log('');

scenario('空/空', '两边都没有 → 空数组（由生成器回落到 defaults），不得报错', () => {
  assert.deepStrictEqual(mergeSubscriptions([], [], 'remote-first'), []);
  // 传 null / undefined 也不能炸：真实配置里「没这一段」就是 undefined
  assert.deepStrictEqual(mergeSubscriptions(null, undefined, 'remote-first'), []);
  assert.deepStrictEqual(mergeSubscriptions(undefined, null, 'local-first'), []);
});

scenario('仅本地', '远程空 → 本地原样保留，顺序不变', () => {
  const local = [
    { name: 'A', url: 'https://a.example/feed' },
    { name: 'B', url: 'https://b.example/feed' },
  ];
  assert.deepStrictEqual(mergeSubscriptions(local, [], 'remote-first'), local);
  // remote-only 是唯一的例外：本地整块不参与
  assert.deepStrictEqual(mergeSubscriptions(local, [], 'remote-only'), []);
});

scenario('仅远程', '本地空 → 远程全要，按 sort→id 排序', () => {
  const remote = [
    { id: 2, name: '后', url: 'https://b.example/feed', sort: 10 },
    { id: 1, name: '前', url: 'https://a.example/feed', sort: 5 },
  ];
  assert.deepStrictEqual(names(mergeSubscriptions([], remote, 'remote-first')), ['前', '后']);
});

scenario('远程优先', '同 URL 两边都有 → 远程记录代表这条，字段以远程为准', () => {
  const local = [{ name: '本地名', url: 'https://x.example/feed', description: '本地描述' }];
  const remote = [{ id: 1, name: '远程名', url: 'https://x.example/feed', description: '远程描述' }];
  const out = mergeSubscriptions(local, remote, 'remote-first');
  assert.strictEqual(out.length, 1, '应合并成 1 条');
  assert.strictEqual(out[0].name, '远程名');
  assert.strictEqual(out[0].description, '远程描述');
  assert.strictEqual(out[0].id, 1, '远程的 id 应保留');
});

scenario('本地优先', '同 URL 两边都有 → local-first 下本地代表这条，远程只补空', () => {
  const local = [{ name: '本地名', url: 'https://x.example/feed' }];
  const remote = [{ id: 9, name: '远程名', url: 'https://x.example/feed', icon: '📡' }];
  const out = mergeSubscriptions(local, remote, 'local-first');
  assert.strictEqual(out.length, 1, '应合并成 1 条');
  assert.strictEqual(out[0].name, '本地名');
  assert.strictEqual(out[0].icon, '📡', '远程的 icon 应补进本地空缺');
});

scenario('远程-only', 'remote-only → 本地配置整块不参与', () => {
  const local = [{ name: '本地', url: 'https://local.example/feed' }];
  assert.deepStrictEqual(names(mergeSubscriptions(local, REMOTE_ONE, 'remote-only')), ['只有远程']);
});

scenario('URL 归一化', '尾斜杠 / 主机大小写 / fragment 不算差异 → 视为同一条', () => {
  const local = [{ name: '本地', url: 'https://Example.COM/feed/' }];
  const remote = [
    { id: 1, name: '远程', url: 'https://example.com/feed#top' },
    { id: 2, name: '远程二', url: 'HTTPS://EXAMPLE.com/feed' },
  ];
  const out = mergeSubscriptions(local, remote, 'remote-first');
  assert.strictEqual(out.length, 1, '三条同源记录应合并成 1 条');

  const norm = [
    normalizeFeedUrl('https://Example.COM/feed/'),
    normalizeFeedUrl('https://example.com/feed#top'),
    normalizeFeedUrl('HTTPS://EXAMPLE.COM/feed'),
    normalizeFeedUrl('  https://example.com:443/feed/?alt=rss  '),
  ];
  assert.deepStrictEqual(norm, [
    'https://example.com/feed',
    'https://example.com/feed',
    'https://example.com/feed',
    // query 必须保留：?alt=rss 这种是很多源的必要参数
    'https://example.com/feed?alt=rss',
  ]);
  // 路径大小写必须保留：/Feed 与 /feed 是两个 HTTP 地址
  assert.strictEqual(normalizeFeedUrl('https://a.example/Feed'), 'https://a.example/Feed');
  // 解析不了的地址原样 trim 返回，不要静默改写
  assert.strictEqual(normalizeFeedUrl('  not a url '), 'not a url');
  assert.strictEqual(normalizeFeedUrl(null), '');
});

scenario('字段补空', '远程留空的展示字段用本地补上；远程填了的绝不被覆盖', () => {
  const local = [{
    name: '本地名',
    url: 'https://x.example/feed',
    description: '本地描述',
    icon: '🅻',
    limit: 5,
    homepage: 'https://x.example',
  }];
  const remote = [{
    id: 3,
    name: '远程名',
    url: 'https://x.example/feed',
    description: null,          // 契约：没填就是 null
    icon: '',                   // 手写配置里也常见空串
    limit: 0,                   // 越界值（合法范围 1–20）等同没填
    homepage: 'https://remote.example',
  }];
  const out = mergeSubscriptions(local, remote, 'remote-first');
  assert.strictEqual(out.length, 1);
  const m = out[0];
  assert.strictEqual(m.name, '远程名');
  assert.strictEqual(m.description, '本地描述', 'description 应由本地补上');
  assert.strictEqual(m.icon, '🅻', 'icon 应由本地补上');
  assert.strictEqual(m.limit, 5, 'limit 应由本地补上');
  assert.strictEqual(m.homepage, 'https://remote.example', '远程填了的 homepage 不该被覆盖');
});

scenario('排序', '远程按 sort→id 排在前，本地独有接在后且保持 yml 顺序', () => {
  const local = [
    { name: '本地1', url: 'https://local1.example/feed' },
    { name: '本地2', url: 'https://local2.example/feed' },
    { name: '重复源(本地)', url: 'https://dup.example/feed/' },
  ];
  const remote = [
    { id: 5, name: '远B', url: 'https://b.example/feed', sort: 20 },
    { id: 3, name: '远A', url: 'https://a.example/feed', sort: 10 },
    { id: 2, name: '同sort前', url: 'https://c.example/feed', sort: 10 },
    { id: 1, name: '重复源(远程)', url: 'https://dup.example/feed', sort: 1 },
  ];
  const out = mergeSubscriptions(local, remote, 'remote-first');
  assert.deepStrictEqual(names(out), [
    '重复源(远程)', // sort 1
    '同sort前',     // sort 10，id 2
    '远A',          // sort 10，id 3
    '远B',          // sort 20
    '本地1',        // 本地独有，按 yml 顺序接在后
    '本地2',
  ]);
});

scenario('模式兜底', 'mode 写错/大小写/下划线 → 归一化到合法模式，不抛错', () => {
  assert.strictEqual(merge.normalizeMode(''), 'remote-first');
  assert.strictEqual(merge.normalizeMode(undefined), 'remote-first');
  assert.strictEqual(merge.normalizeMode('local_first'), 'local-first');
  assert.strictEqual(merge.normalizeMode('REMOTE-ONLY'), 'remote-only');
  assert.strictEqual(merge.normalizeMode('nonsense'), 'remote-first');
});

scenario('不改入参', '合并返回新数组/新对象，调用方的数据不得被就地改写', () => {
  const local = [{ name: '本地', url: 'https://x.example/feed' }];
  const remote = [{ id: 1, name: '远程', url: 'https://x.example/feed' }];
  const localSnapshot = JSON.parse(JSON.stringify(local));
  const remoteSnapshot = JSON.parse(JSON.stringify(remote));
  const out = mergeSubscriptions(local, remote, 'remote-first');
  assert.deepStrictEqual(local, localSnapshot, '本地列表被改动了');
  assert.deepStrictEqual(remote, remoteSnapshot, '远程列表被改动了');
  assert.notStrictEqual(out[0], remote[0], '返回的应是新对象，不是远程记录的引用');
});

scenario('输出归一化', '合并结果的 url 必须是归一化形式：它就是后面抓 feed 用的地址', () => {
  /* 这条防的是一个真实会犯的错：去重时用归一化 URL 算键，输出却把原始
     字符串塞回去。于是同一源的去重结果和抓取地址不是一个值，带 fragment
     的地址直接 404（实测 http://a.com/atom.xml/#top → 404，去掉才是 200）。
     规则：去重用的键 === 输出里的 url === parseURL 的入参。 */
  const local = [{ name: '本地', url: 'https://A.example/feed/' }];
  const remote = [{ id: 1, name: '远程', url: 'https://a.example/feed' }];
  const out = mergeSubscriptions(local, remote, 'remote-first');
  assert.strictEqual(out[0].url, 'https://a.example/feed');

  // 本地独有的源同样要归一化，否则它走的是另一套地址
  const out2 = mergeSubscriptions([{ name: '只本地', url: 'HTTPS://B.example/Feed/#x' }], [], 'remote-first');
  assert.strictEqual(out2[0].url, 'https://b.example/Feed');

  // remote-only / local-first 两个分支也不能漏
  assert.strictEqual(
    mergeSubscriptions([], [{ id: 1, url: 'https://c.example/feed/#frag' }], 'remote-only')[0].url,
    'https://c.example/feed'
  );
  assert.strictEqual(
    mergeSubscriptions([{ url: 'https://d.example/feed/' }], [], 'local-first')[0].url,
    'https://d.example/feed'
  );
});

scenario('三处同口径', '归一化输出与 hub / Chrome 插件逐字一致（同一源不能在页面上重两条）', () => {
  /* hub、插件、主题三方都按契约第 4 节实现同一套归一化。任何一处算法不同，
     症状都是「说不清」的：同一源在页面上重复两条、插件说已存在但构建当新源。
     下面这张表是从 hub / 插件实测输出抄过来的，改实现时它会立刻报错。

     重点看带 query 的三条：曾经的主题实现对整个 href 削尾斜杠，
     把 query 值里的 '/' 也削了（?next=/x/ → ?next=/x）。这不只是口径问题——
     归一化结果会被当成实际抓取地址，改错就等于把用户的源换成另一个地址。 */
  const cases = [
    // [输入, 期望（= hub / 插件 的实测输出）]
    ['https://a.com/?x=1',            'https://a.com?x=1'],
    ['https://a.com/feed?next=/x/',   'https://a.com/feed?next=/x/'],
    ['https://a.com/feed/?q=a/',      'https://a.com/feed?q=a/'],
    ['https://a.com/?',               'https://a.com'],
    ['https://a.com/feed/',           'https://a.com/feed'],
    ['https://A.com/Feed/#top',       'https://a.com/Feed'],   // 主机小写，路径大小写保留
    ['https://a.com//feed//',         'https://a.com//feed'],
    ['http://a.com:8080/feed/',       'http://a.com:8080/feed'],
    ['https://a.com',                 'https://a.com'],
    ['https://a.com/',                'https://a.com'],
  ];
  cases.forEach(([input, expected]) => {
    assert.strictEqual(normalizeFeedUrl(input), expected, '「' + input + '」归一化不对');
  });
});

scenario('键即地址', '去重用的键与合并结果里的 url 永远一致（后者才是抓取地址）', () => {
  /* 语义断言：mergeSubscriptions 用归一化 URL 判重，cloneRecord 又把 url
     换成归一化形式，两件事必须永远同步。一旦有人只改其中一处，就会出现
     「按 A 地址去重、拿 B 地址抓取」——带 query 或 fragment 的源当场抓不到。 */
  const inputs = [
    'https://a.com/feed/?q=a/',
    'https://A.com/Feed/#top',
    'https://a.com/?x=1',
    'https://a.com//feed//',
  ];
  const local = inputs.map((url, i) => ({ name: '本地' + i, url }));
  const out = mergeSubscriptions(local, [], 'remote-first');
  assert.strictEqual(out.length, inputs.length, '不同源不该被合并掉');
  out.forEach((item, i) => {
    assert.strictEqual(
      item.url,
      normalizeFeedUrl(inputs[i]),
      '输出的 url 与归一化结果不一致：' + item.url
    );
    // 再归一化一次必须幂等——否则抓取地址与下一次构建的去重键又不同
    assert.strictEqual(normalizeFeedUrl(item.url), item.url, '归一化必须幂等');
  });
});

scenario('脏数据', '非对象项跳过；缺 url 的项保留（交给抓取器报错），不崩', () => {
  const local = [null, { name: '无 url' }, { name: '正常', url: 'https://ok.example/feed' }];
  const remote = [undefined, { id: 2, name: '远程正常', url: 'https://r.example/feed' }];
  const out = mergeSubscriptions(local, remote, 'remote-first');
  /* 缺 url 的项**不能**在这里被丢掉：老模式（不开 remote）下这类项会渲染成
     一条「抓取失败」的占位，用户至少知道是自己写漏了。合并层悄悄吞掉它，
     等于换个开关就少了半条配置，反而更难查。 */
  assert.deepStrictEqual(names(out), ['远程正常', '无 url', '正常']);
});

/* ===== 汇总 ===== */

const ok = results.filter(Boolean).length;
console.log('');
console.log(ok + '/' + results.length + ' 通过');
process.exit(ok === results.length ? 0 : 1);
