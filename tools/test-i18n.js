#!/usr/bin/env node
'use strict';

/**
 * 多语言（i18n）回归测试
 *
 * 锁定三件事，任何一条挂了就说明模板里又混进了硬编码文案：
 *
 *   1. 语言包一致性 —— zh-TW / en 缺的键必须能在 zh-CN 里找到，
 *      并且三本语言的键集合不能出现「基准语言里根本没有」的野键。
 *   2. 占位符一致 —— 同一个键在三种语言里的 %s / %d 数量必须相同，
 *      否则 tr('a.b', x) 传两个参数、语言包里只写一个占位符，页面就会丢字。
 *   3. 模板取词覆盖 —— layout/ 下不应再有「用户可见且写死」的中文文案；
 *      允许的例外（专有名词、纯符号）在 WHITELIST 里列清楚。
 *
 * 用法：
 *   node tools/test-i18n.js
 *   node tools/test-i18n.js --verbose     # 连通过项一起打印
 *
 * 退出码：0 全部通过，1 有失败项。
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var LANG_DIR = path.join(ROOT, 'languages');
var BASE = 'zh-CN';
var LANGS = ['zh-CN', 'zh-TW', 'en'];

var verbose = process.argv.indexOf('--verbose') !== -1;
var failures = [];
var passes = 0;

function pass(msg) {
  passes++;
  if (verbose) console.log('  ok   ' + msg);
}

function fail(msg) {
  failures.push(msg);
  console.log('  FAIL ' + msg);
}

function section(title) {
  console.log('\n' + title);
}

/* ------------------------------------------------------------------ */
/* 极简 YAML 读取                                                     */
/* ------------------------------------------------------------------ */

/**
 * 只认本主题语言包用到的那一小撮语法：两级 section、key: value、
 * 以及 # 注释。不引第三方依赖是**有意的**——这个测试要在既没有
 * node_modules 缓存、也没有网络的环境里跑起来（CI 的 release 检查）。
 */
function parseLangYaml(text) {
  var out = {};
  var section = '';
  text.split(/\r?\n/).forEach(function (raw) {
    var line = raw.replace(/(^|\s)#.*$/, '');
    if (!line.trim()) return;

    /* 缩进是「层级」的唯一信号：顶格是 section，缩进两格才是键。
       早期版本漏掉了行首空白，于是所有键都被当成 section，
       解析出 0 条文案、测试却「全部通过」——比不测更危险。 */
    var indentMatch = line.match(/^(\s*)/);
    var indent = indentMatch ? indentMatch[1].length : 0;
    var body = line.trim();

    var m = body.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) return;

    var key = m[1];
    var val = m[2].trim();

    if (indent === 0 && val === '') {
      section = key;
      out[section] = out[section] || {};
      return;
    }
    if (indent === 0) {
      out[''] = out[''] || {};
      out[''][key] = val;
      return;
    }
    out[section] = out[section] || {};
    out[section][section + '.' + key] = val;
  });
  /* 拍平成 'a.b' → value，跟 hexo-i18n 的行为对齐 */
  var flat = {};
  Object.keys(out).forEach(function (sec) {
    Object.keys(out[sec]).forEach(function (k) {
      flat[k] = out[sec][k];
    });
  });
  return flat;
}

/** 把 YAML 的标量写法统一成裸字符串（去引号），只为了数占位符 */
function stripQuotes(v) {
  if (typeof v !== 'string') return '';
  var s = v.trim();
  if ((s[0] === "'" && s[s.length - 1] === "'") ||
      (s[0] === '"' && s[s.length - 1] === '"')) {
    s = s.slice(1, -1);
  }
  return s;
}

/** 数占位符个数：%s / %d 都算一个；%% 是字面百分号，不算 */
function countPlaceholders(str) {
  var s = stripQuotes(str).replace(/%%/g, '');
  var found = s.match(/%[sd]/g);
  return found ? found.length : 0;
}

/* ------------------------------------------------------------------ */
/* 1 & 2. 语言包一致性与占位符                                         */
/* ------------------------------------------------------------------ */

section('[1] 语言包一致性');

var dicts = {};
var missingLangFiles = [];
LANGS.forEach(function (lang) {
  var file = path.join(LANG_DIR, lang + '.yml');
  if (!fs.existsSync(file)) { missingLangFiles.push(lang); return; }
  dicts[lang] = parseLangYaml(fs.readFileSync(file, 'utf8'));
});

missingLangFiles.forEach(function (lang) {
  fail('缺少语言包文件 languages/' + lang + '.yml');
});

if (dicts[BASE]) {
  var baseKeys = Object.keys(dicts[BASE]);
  pass('基准语言 ' + BASE + ' 共 ' + baseKeys.length + ' 条文案');

  LANGS.filter(function (l) { return l !== BASE && dicts[l]; }).forEach(function (lang) {
    var keys = Object.keys(dicts[lang]);

    /* 野键：语言包里出现了基准语言没有的键 —— 多半是打错字，
       这种键永远取不到（模板不会去取一个基准语言里不存在的 key）。 */
    keys.filter(function (k) { return !(k in dicts[BASE]); }).forEach(function (k) {
      fail(lang + ' 里有基准语言不存在的键：' + k + '（是不是拼错了？）');
    });

    /* 缺键：允许（会回落到基准语言），但要清楚地数出来，
       免得以为「加了 50 条」其实只生效 3 条。 */
    var missing = baseKeys.filter(function (k) { return !(k in dicts[lang]); });
    if (missing.length) {
      console.log('  note ' + lang + ' 缺 ' + missing.length + ' 条，将回落到 ' + BASE +
        (missing.length <= 5 ? '：' + missing.join(', ') : ''));
    } else {
      pass(lang + ' 覆盖全部 ' + baseKeys.length + ' 条');
    }

    /* 占位符必须与基准语言一致 */
    keys.forEach(function (k) {
      if (!(k in dicts[BASE])) return;
      var a = countPlaceholders(dicts[BASE][k]);
      var b = countPlaceholders(dicts[lang][k]);
      if (a !== b) {
        fail('占位符数量不一致：' + k + '（' + BASE + ' ' + a + ' 个，' + lang + ' ' + b + ' 个）');
      }
    });
  });
}

/* 空值：翻译后留空字符串等于「这条文案消失」，比缺键更隐蔽 */
Object.keys(dicts).forEach(function (lang) {
  Object.keys(dicts[lang]).forEach(function (k) {
    if (stripQuotes(dicts[lang][k]) === '' && !/unit_ten_thousand|todo/.test(k)) {
      fail(lang + ' 的 ' + k + ' 是空字符串（页面会少一行字；不需要就删掉这条）');
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. 模板取词覆盖                                                     */
/* ------------------------------------------------------------------ */

section('[2] 模板里不应有写死的用户可见文案');

/**
 * 允许硬编码的例外。只放**专有名词**和**纯符号**；任何能翻译的东西
 * 都应该进语言包，否则它就成了下一次切语言时漏网的那一条。
 */
var WHITELIST = [
  'Dossier',   // 主题给「档案」系统的产品名，中英文都叫这个
  'Hexo',      // 上游产品名
  'Polaris',   // 主题名
  'RSS',       // 协议名
  'Hacker News'
];

var CJK = /[\u4e00-\u9fff]/;

function walkEjs(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    var p = path.join(dir, ent.name);
    if (ent.isDirectory()) { walkEjs(p, acc); return; }
    if (!ent.name.endsWith('.ejs')) return;
    acc.push(p);
  });
  return acc;
}

var templates = walkEjs(path.join(ROOT, 'layout'), []);
var scannedTextNodes = 0;

templates.forEach(function (file) {
  var rel = path.relative(ROOT, file);
  var lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  /* 块注释要跨行跟踪：模板里的说明性注释常常写好几行，
     逐行判断会把中间几行当成用户可见文案（实测 header.ejs 就踩到了）。 */
  var inBlockComment = false;

  lines.forEach(function (line, idx) {
    var s = line.trim();

    /* 拼接出「去掉注释之后」的一行，同时维护块注释状态。
       顺序：先抠掉本行内的块注释，再处理行首的续行状态。 */
    var code = '';
    var rest = line;
    while (rest.length) {
      if (inBlockComment) {
        var endIdx = rest.indexOf('*/');
        if (endIdx === -1) { rest = ''; break; }
        rest = rest.slice(endIdx + 2);
        inBlockComment = false;
      } else {
        var startIdx = rest.indexOf('/*');
        var htmlIdx = rest.indexOf('<!--');
        if (startIdx === -1 && htmlIdx === -1) { code += rest; rest = ''; break; }
        var cut = startIdx === -1 ? htmlIdx : (htmlIdx === -1 ? startIdx : Math.min(startIdx, htmlIdx));
        code += rest.slice(0, cut);
        var closer = rest.slice(cut, cut + 4) === '<!--' ? '-->' : '*/';
        var closeIdx = rest.indexOf(closer, cut + closer.length);
        if (closeIdx === -1) {
          inBlockComment = true;
          rest = '';
        } else {
          rest = rest.slice(closeIdx + closer.length);
        }
      }
    }

    /* 行注释：整行注释 / 行尾注释都不算用户可见内容 */
    if (!s || s.indexOf('//') === 0 || s.indexOf('<%#') === 0) return;
    code = code.replace(/(^|\s)\/\/.*$/, '$1');
    if (!code.trim()) return;

    /* (a) HTML 文本节点：标签之间的裸文字。这条覆盖「<h1>标签：<%= … %></h1>」
       这种最直观的写法——上一版只扫字符串字面量，把整个 <h1> 漏掉了，
       是自测时用变异测试才发现的。 */
    var textRe = />([^<>]+)</g;
    var tm;
    while ((tm = textRe.exec(code)) !== null) {
      var nodeText = tm[1].replace(/<%[-=]?[\s\S]*?%>/g, '').trim();
      if (!nodeText || !CJK.test(nodeText)) continue;
      if (WHITELIST.some(function (w) { return nodeText === w || nodeText.indexOf(w) !== -1; })) continue;
      scannedTextNodes++;
      fail(rel + ':' + (idx + 1) + ' 写死的界面文案「' + nodeText.slice(0, 40) +
        '」—— 应改为 tr(\'…\')');
    }

    /* (b) EJS 脚本块里的字符串字面量：只查**用户可见**的位置，
       即被拼进 HTML 的字符串（含标签或中文短语）。注释里的中文在上一步已去掉。 */
    var m;
    var strRe = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    while ((m = strRe.exec(code)) !== null) {
      var text = m[1] != null ? m[1] : m[2];
      if (!text || !CJK.test(text)) continue;
      /* 纯 CSS/选择器/正则/配置键不是用户可见文案 */
      if (/^[.#\-_a-zA-Z0-9\s:;,{}()\[\]=>+*~|^$!?%]+$/.test(text)) continue;
      /* 已经是 tr()/tr_cfg() 参数的（理论上不会命中中文，兜底跳过） */
      if (/tr(_cfg)?\(\s*$/.test(code.slice(0, m.index))) continue;
      scannedTextNodes++;
      fail(rel + ':' + (idx + 1) + ' 写死的界面文案「' + text.slice(0, 40) +
        '」—— 应改为 tr(\'…\')');
    }
  });
});

if (scannedTextNodes === 0) {
  pass('扫过 ' + templates.length + ' 个模板，没有写死的界面文案');
}

/* ------------------------------------------------------------------ */
/* 汇总                                                                */
/* ------------------------------------------------------------------ */

console.log('\n' + '-'.repeat(56));
if (failures.length) {
  console.log('✗ ' + failures.length + ' 项失败，' + passes + ' 项通过');
  process.exit(1);
}
console.log('✓ 全部通过（' + passes + ' 项检查）');
