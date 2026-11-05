'use strict';

/**
 * Vellum — i18n 取词核心（脚本间共享）
 *
 * 为什么单独抽一个文件：主题里的「文案消费者」有两类，
 *   1. EJS 模板 —— 通过 hexo.extend.helper 注册的 tr() 取词；
 *   2. Hexo 脚本（scripts/*.js，跑在 loadPlugin 的 vm 里） —— **拿不到 helper**，
 *      只能自己 require。所以把取词逻辑放这里，两条路都走同一份实现，
 *      避免模板与生成器各维护一套回落规则。
 *
 * 用法：
 *   var i18n = require('./lib/i18n-core')(hexo);
 *   i18n.tr('toc.title')
 *   i18n.tr('archive.count_all', 12)
 *
 * 所有函数都以 hexo 实例为参数，不依赖全局的 `hexo` —— 这样在测试或
 * 别的手工调用里也能构造。
 */

/* 基准语言：所有回落都指向它，新增文案先加进 languages/zh-CN.yml */
var BASE_LANG = 'zh-CN';

/* 语言别名 → 主题内置的语言文件名。主题只发这三本；认不出来的语言
   一律回落到基准语言，不会渲染成乱码。 */
var LANG_ALIAS = {
  'zh': 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-sg': 'zh-CN',
  'cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  'zh-hant': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-mo': 'zh-TW',
  'tw': 'zh-TW',
  'en': 'en',
  'en-us': 'en',
  'en-gb': 'en'
};

/** 主题内置语言列表（用于构建期体检；顺序无关） */
var SHIPPED_LANGS = ['zh-CN', 'zh-TW', 'en'];

/**
 * 把任意的语言写法（'zh_CN'、'en-US'、'zh-Hant'…）归一化成主题认识的语言码。
 * 认不出来返回空字符串，交给调用方决定回落。
 */
function normalizeLang(raw) {
  if (!raw) return '';
  var s = String(raw).trim().replace(/_/g, '-');
  if (!s) return '';
  return LANG_ALIAS[s.toLowerCase()] || '';
}

module.exports = function createI18n(hexo) {
  /* 词典缓存：一个页面会调几百次 tr()，每次都让 hexo-i18n 重新合并
     上百个键是纯浪费。按语言缓存，构建全程复用。 */
  var dictCache = Object.create(null);

  /**
   * 解析当前应该显示的界面语言。
   * 显式配置优先，其次站点 config.language 的第一项，最后回落基准语言。
   */
  function resolveLang() {
    var themeCfg = (hexo.theme.config && hexo.theme.config.i18n) || {};
    var configured = normalizeLang(themeCfg.lang);
    if (configured) return configured;

    var siteLang = hexo.config.language;
    if (Array.isArray(siteLang)) {
      for (var i = 0; i < siteLang.length; i++) {
        var picked = normalizeLang(siteLang[i]);
        if (picked) return picked;
      }
    } else {
      var single = normalizeLang(siteLang);
      if (single) return single;
    }

    return BASE_LANG;
  }

  /**
   * 取某语言的「已回落」词典：先本语言，缺的键用基准语言补。
   * hexo-i18n 的 get() 按传入顺序合并、先出现的优先，所以本语言在前。
   */
  function dictFor(lang) {
    if (dictCache[lang]) return dictCache[lang];

    var merged = {};
    try {
      var pair = lang === BASE_LANG ? [lang] : [lang, BASE_LANG];
      var data = hexo.theme.i18n.get(pair) || {};
      Object.keys(data).forEach(function (k) {
        /* 只接受非空字符串：语言文件写错成对象/数字时，不该把 'a.b' 这种
           键名漏到页面上，直接跳过、让它回落到基准语言。 */
        var v = data[k];
        if (typeof v === 'string' && v !== '') merged[k] = v;
      });
    } catch (e) {
      hexo.log.warn('[vellum:i18n] 读取语言包失败（' + lang + '）: ' + e.message);
    }

    dictCache[lang] = merged;
    return merged;
  }

  /**
   * 迷你 printf：只认 %s / %d / %%，语言文件里不需要更复杂的东西。
   * 不直接用 vsprintf 是因为它对残缺的 % 会抛错，而文案里出现一个
   * 落单的百分号不该让整个构建挂掉。
   */
  function format(str, args) {
    if (!args || !args.length) return str;
    var i = 0;
    return String(str).replace(/%(s|d|%)/g, function (m, kind) {
      if (kind === '%') return '%';
      if (i >= args.length) return m;
      var v = args[i++];
      return String(v == null ? '' : v);
    });
  }

  /**
   * 按 key 取文案。找不到返回空字符串而不是 key 名：
   * 页面上出现「text.toc.title」比「少一行字」更像事故。
   */
  function translate(lang, key, args) {
    if (!key) return '';
    var raw = dictFor(lang)[key];
    if (raw == null) {
      if (hexo.env && hexo.env.debug) {
        hexo.log.debug('[vellum:i18n] 缺少文案 key: ' + key + '（' + lang + '）');
      }
      return '';
    }
    return format(raw, args);
  }

  /** 当前界面语言的取词入口：tr('a.b') / tr('a.b', 1, 2) */
  function tr(key) {
    return translate(resolveLang(), key, Array.prototype.slice.call(arguments, 1));
  }

  /**
   * <html lang> 该写什么。
   *
   * 优先级：显式配置的 i18n.lang > page.lang（Hexo 按站点语言自动填的）> 解析结果。
   *
   * 为什么显式配置要压过 page.lang：page.lang 由 Hexo 的 i18n filter 从站点
   * config.language 填进来，**每页都是同一个值**。用户把 i18n.lang 设成 zh-TW
   * 之后，页面文字已经全是繁体，lang 却还写着 zh-CN，等于自己跟自己对不上。
   */
  function htmlLang(pageLang) {
    var themeCfg = (hexo.theme.config && hexo.theme.config.i18n) || {};
    var configured = normalizeLang(themeCfg.lang);
    if (configured) return configured;
    if (pageLang) return String(pageLang);
    return resolveLang();
  }

  /**
   * 带配置覆盖的取词：配置项优先，其次语言包。
   *
   * 为什么需要它：站点总想把某句话改成自己的说法（「近日所思：」而不是
   * 「Recent Posts:」），但配置项是**单值**的；一旦站点切到英文，那句中文
   * 会跟着串到英文页面上去。所以允许把一个配置项写成按语言分的对象：
   *
   *   recent_posts_title:
   *     zh-CN: '近日所思：'
   *     zh-TW: '近日所思：'
   *     en: 'Recent thoughts:'
   *
   * 取值顺序：
   *   1. 配置值是对象 → 按当前语言取；取不到 → 取基准语言；再取不到 → 语言包
   *   2. 配置值是非空字符串 → 原样使用（老写法，行为完全不变）
   *   3. 配置值为空/未配置 → 语言包
   */
  function pick(cfgValue, key) {
    var lang = resolveLang();
    if (cfgValue && typeof cfgValue === 'object') {
      var byLang = cfgValue[lang];
      if (byLang == null && lang !== BASE_LANG) byLang = cfgValue[BASE_LANG];
      if (byLang != null) cfgValue = byLang;
      else cfgValue = '';
    }
    if (typeof cfgValue === 'string' && cfgValue !== '') return cfgValue;
    return tr(key);
  }

  /** 整本词典的 JSON，注入前端 window.__VELLUM_I18N */
  function dictJson() {
    return JSON.stringify(dictFor(resolveLang()));
  }

  return {
    BASE_LANG: BASE_LANG,
    SHIPPED_LANGS: SHIPPED_LANGS,
    normalizeLang: normalizeLang,
    resolveLang: resolveLang,
    dictFor: dictFor,
    translate: translate,
    tr: tr,
    pick: pick,
    htmlLang: htmlLang,
    dictJson: dictJson
  };
};
