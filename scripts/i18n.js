'use strict';

/**
 * Polaris — 界面文案多语言（i18n）
 *
 * 目标很小：让主题自己产出的**界面文案**（按钮、aria-label、空状态、SEO 标题…
 * 这些不属于文章内容的东西）跟着语言走。文章正文不归这里管。
 *
 * 文案从哪里来
 * ------------
 * 主题根目录的 languages/<lang>.yml，由 Hexo 的 theme box 自动加载进
 * hexo.theme.i18n，键会被拍平成 'a.b.c'。zh-CN 是基准语言：其它语言缺哪个
 * 键就回落到 zh-CN，所以半翻译的 en.yml 也不会露出空字符串。
 *
 * 语言怎么定
 * ----------
 *   1. 主题配置 i18n.lang（显式写 zh-CN / zh-TW / en 时优先，写 auto 则跳过）
 *   2. 站点的 config.language（数组取第一个，字符串直接用）
 *   3. 兜底 zh-CN
 *
 * 为什么不用 page.lang 决定：page.lang 是 Hexo 给「每页」标的语言，用来选
 * 内容目录（source/en/…）。主题界面文案是**整站一致**的，跟着 page.lang 走
 * 会出现一个页面英文、另一个页面中文的分裂。page.lang 只用于 <html lang>。
 *
 * 模板里怎么用
 * ------------
 *   <%= tr('toc.title') %>                    // 纯文本
 *   <%= tr('archive.count_all', 12) %>        // printf 风格：%s / %d
 *   <%= tr('taxonomy.tag', page.tag) %>
 *   <%= tr_lang() %>                          // 当前界面语言（给 <html lang>）
 *
 * 前端脚本里怎么用
 * ----------------
 * head.ejs 会把整本词典塞进 window.__POLARIS_I18N，并提供 window.tr(key, ...)。
 * source/js/*.js 直接调 window.tr 即可，服务端不必为每个脚本单独开配置口子。
 *
 * Hexo 脚本（scripts/*.js）里怎么用
 * --------------------------------
 * 那些文件跑在 loadPlugin 的 vm 里，**拿不到模板 helper**，所以走共享核心：
 *
 *   var tr = require('./lib/i18n-core')(hexo).tr;
 *
 * 配置项仍然优先
 * --------------
 * 站点/主题配置里那些老字段（toc.back_to_top_text、archive.search_placeholder、
 * dossier.card.start_button_text、recent_posts_title…）继续存在，模板写的是
 * `theme.xxx || tr(...)`——配了就用配置，没配才用语言包。这样老站点升级后
 * 观感不变，新站点不配也有合理的默认文案。
 */

var createI18n = require('./lib/i18n-core');
var i18n = createI18n(hexo);

/* ------------------------------------------------------------------ */
/* 模板 helper                                                         */
/* ------------------------------------------------------------------ */

/** 主取词入口：<%= tr('toc.title') %> / <%= tr('archive.count_all', 12) %> */
hexo.extend.helper.register('tr', function (key) {
  return i18n.translate(i18n.resolveLang(), key, Array.prototype.slice.call(arguments, 1));
});

/**
 * 带配置覆盖的取词：<%= tr_cfg(theme.toc.back_to_top_text, 'common.back_to_top') %>
 *
 * 配置值可以是字符串（老写法，原样用），也可以是按语言分的对象
 * （{ 'zh-CN': '…', 'en': '…' }），后者让「站点自定义说法」也能跟着语言走。
 */
hexo.extend.helper.register('tr_cfg', function (cfgValue, key) {
  return i18n.pick(cfgValue, key);
});

/** 当前界面语言码 */
hexo.extend.helper.register('tr_lang', function () {
  return i18n.resolveLang();
});

/**
 * <html lang> 的值：显式配置的语言压过 Hexo 自动填的 page.lang，
 * 否则页面文字是繁体、属性却写着 zh-CN。
 */
hexo.extend.helper.register('tr_html_lang', function (pageLang) {
  return i18n.htmlLang(pageLang);
});

/** 整本词典的 JSON，注入前端的 window.__POLARIS_I18N */
hexo.extend.helper.register('tr_dict', function () {
  return i18n.dictJson();
});

/**
 * 构建期体检：i18n.lang 配了主题没发的语言时，说清楚会回落。
 * 否则页面静默全变中文，使用者只能猜。
 */
hexo.extend.filter.register('before_generate', function () {
  var configured = i18n.normalizeLang((hexo.theme.config.i18n || {}).lang);
  if (configured) return;

  var raw = (hexo.theme.config.i18n || {}).lang;
  if (raw && raw !== 'auto' && raw !== true) {
    hexo.log.warn('[polaris:i18n] 不认识的语言 "' + raw + '"，界面文案回落到 ' +
      i18n.resolveLang() + '（内置：' + i18n.SHIPPED_LANGS.join(' / ') + '）');
  }
  return;
}, 20);
