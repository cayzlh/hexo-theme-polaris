/**
 * DeepSeek 风格代码块渲染
 *
 * 本文件包含：
 * 1. before_post_render — 支持 ```java UserService.java 语法（自动转为 Hexo codeblock tag）
 * 2. after_post_render  — 对 Hexo 标准渲染管线输出的 post/page 应用代码块转换
 * 3. 全局函数 __transformCodeBlocks — 供 dossier 等自定义渲染路径调用
 *    - Pass 1: 处理带 figcaption 的代码块（{% codeblock %} tag 输出）
 *    - Pass 2: 处理不带 figcaption 的代码块（标准 markdown ``` 经 Hexo highlight 管线输出）
 *    - Pass 3: 处理裸 <pre><code> 格式（hexo.render.renderSync 直接输出，未经过 highlight 管线）
 *
 * DeepSeek 风格特征：
 * - 圆角 10px（移动端 6px），舒适的边距
 * - 头部：左侧文件名 + 右侧语言标签和复制按钮
 * - 日间模式浅色背景（GitHub 风格语法高亮），夜间模式深色背景（One Dark 配色）
 * - 无行号（简洁）
 */

'use strict';

/**
 * 代码块里的「复制」按钮文案要跟界面语言走，而 Hexo 脚本（loadPlugin 的 vm）
 * **拿不到模板 helper**，所以从共享核心取词。
 */
var tr = require('./lib/i18n-core')(hexo).tr;

/* ==========================================
   before_post_render
   - 将 ```lang filename.ext 格式转为 Hexo codeblock tag
   - 无文件名的代码块保持原样（由 Hexo highlight 正常处理）
   ========================================== */
hexo.extend.filter.register('before_post_render', function (data) {
  if (!data.content) return data;

  // 匹配 ```lang filename 格式（filename 不含空格、#、特殊字符）
  data.content = data.content.replace(
    /```(\w+)\s+([^\s#"'{}\]\[\(\)]+?)\n([\s\S]*?)```/g,
    function (match, lang, filename, code) {
      filename = filename.trim();
      return '{% codeblock ' + filename + ' lang:' + lang + ' %}\n' + code + '\n{% endcodeblock %}';
    }
  );

  return data;
});

/* ==========================================
   after_post_render
   - 对 Hexo 标准渲染的 post/page 应用代码块转换
   ========================================== */
hexo.extend.filter.register('after_post_render', function (data) {
  if (!data.content) return data;
  data.content = __transformCodeBlocks(data.content, false);
  return data;
});

/* ==========================================
   全局函数 __transformCodeBlocks
   - 将 Hexo highlight HTML 或裸 <pre><code> 重写为 DeepSeek 风格结构
   - 供 dossier 的 render_md 和主渲染路径调用（dossier.js）
   ========================================== */
global.__transformCodeBlocks = function (html, fromRawMarkdown) {
  if (!html) return html;

  // -----------------------
  // Pass 1: 处理带 figcaption 的代码块（由 {% codeblock %} tag 生成，包含文件名）
  // -----------------------
  html = html.replace(
    /<figure\s+class="highlight\s+(\w+)[^"]*"[^>]*>\s*<figcaption>([\s\S]*?)<\/figcaption>([\s\S]*?)<\/figure>/gi,
    function (match, lang, caption, body) {
      var filename = stripHtml(caption).trim();
      return buildDeepSeekBlock(lang, filename, body);
    }
  );

  // -----------------------
  // Pass 2: 处理不带 figcaption 的代码块（由标准 markdown ``` 生成，无文件名）
  // -----------------------
  html = html.replace(
    /<figure\s+class="highlight\s+(\w+)[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi,
    function (match, lang, body) {
      // 跳过已处理（带 figcaption）的块
      if (/<figcaption>/i.test(body)) return match;
      return buildDeepSeekBlock(lang, '', body);
    }
  );

  // -----------------------
  // Pass 3: 处理裸 <pre><code> 格式（出自 hexo.render.renderSync 直接输出的 markdown）
  //         这种格式没有经过 Hexo highlight 管线，需要先着色再包装
  //         注意：仅当 fromRawMarkdown=true 时运行，避免重复处理已包装的 <pre>
  // -----------------------
  if (fromRawMarkdown) {
    html = html.replace(
      /<pre><code(?:\s+class="(?:language-)?(\w+)[^"]*")?>([\s\S]*?)<\/code><\/pre>/gi,
      function (match, lang, rawCode) {
        var langName = lang || 'text';

        try {
          // 解码 HTML 实体（markdown renderer 输出的 &quot;,&lt;,&gt; 等）
          var decodedCode = rawCode
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');

          var highlightFn = null;
          if (typeof hexo !== 'undefined' && hexo.util && typeof hexo.util.highlight === 'function') {
            highlightFn = hexo.util.highlight;
          } else {
            try { highlightFn = require('hexo-util').highlight; } catch(e) {}
          }

          var highlighted;
          if (highlightFn) {
            highlighted = highlightFn(decodedCode, {
              lang: langName,
              gutter: false,
              tab: '  ',
              auto_detect: false,
              wrap: true
            });
          } else {
            highlighted = '<pre><code>' + escapeHtml(decodedCode) + '</code></pre>';
            return buildDeepSeekBlock(langName, '', highlighted);
          }

          var bodyMatch = highlighted.match(/<figure[^>]*>([\s\S]*)<\/figure>/i);
          var body = bodyMatch ? bodyMatch[1] : highlighted;
          return buildDeepSeekBlock(langName, '', body);
        } catch (e) {
          return buildDeepSeekBlock(langName, '', '<pre><code>' + escapeHtml(decodedCode) + '</code></pre>');
        }
      }
    );
  }

  return html;
};

/* ==========================================
   buildDeepSeekBlock — 构建 DeepSeek 风格代码块 HTML
   ========================================== */
function buildDeepSeekBlock(lang, filename, body) {
  // 从 body 中提取 <td class="code"> 内的内容，去除 table/gutter 包装
  var codeContent = body;
  var codeMatch = body.match(/<td\s+class="code">([\s\S]*?)<\/td>/i);
  if (codeMatch) {
    codeContent = codeMatch[1];
  } else {
    // 后备：直接提取 <pre><code> 内容
    var preMatch = body.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/i);
    if (preMatch) {
      codeContent = preMatch[1];
    } else {
      // 最后后备：提取 <pre> 内容
      var preFallback = body.match(/<pre>([\s\S]*?)<\/pre>/i);
      if (preFallback) {
        codeContent = preFallback[1];
      }
    }
  }

  // 清理代码内容中的额外包裹
  codeContent = codeContent.replace(/^\s*<code>/i, '').replace(/<\/code>\s*$/i, '');

  var langSafe = escapeAttr(lang || 'text');
  var filenameAttr = filename ? ' data-filename="' + escapeAttr(filename) + '"' : '';

  var html = '';
  html += '<figure class="code-block" data-lang="' + langSafe + '"' + filenameAttr + '>';
  html += '  <figcaption class="code-header">';
  html += '    <span class="code-filename">' + (filename ? escapeHtml(filename) : '') + '</span>';
  html += '    <div class="code-header-right">';
  html += '      <span class="code-lang-badge">' + langSafe + '</span>';
  html += '      <button class="code-copy-btn" title="' + escapeAttr(tr('code.copy_code')) + '"><span class="copy-icon">📋</span> <span class="copy-text">' + escapeAttr(tr('code.copy')) + '</span></button>';
  html += '    </div>';
  html += '  </figcaption>';
  html += '  <div class="code-body"><pre><code>' + codeContent + '</code></pre></div>';
  html += '</figure>';

  return html;
}

/* ==========================================
   辅助函数
   ========================================== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 移除 HTML 标签，提取纯文本
 */
function stripHtml(str) {
  return String(str).replace(/<[^>]*>/g, '').trim();
}
