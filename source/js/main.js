/**
 * Polaris — Clone detection + Code block copy
 */
(function() {
  // === Clone detection ===
  var POLARIS = window.__POLARIS;
  if (POLARIS && POLARIS.originalHost) {
    var originalHost = POLARIS.originalHost;
    var officialHosts = POLARIS.officialHosts || [];
    var currentHost = window.location.hostname;
    var isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\]|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(currentHost);
    if (!isLocal && currentHost !== originalHost && officialHosts.indexOf(currentHost) === -1) {
      var banner = document.createElement('div');
      banner.style.cssText = 'background:#fff3cd;color:#856404;text-align:center;padding:8px;font-size:14px;position:fixed;top:0;left:0;right:0;z-index:99999;border-bottom:2px solid #ffc107';
      banner.innerHTML = '⚠ This is an unauthorized mirror of <a href="https://' + originalHost + '" style="color:#856404;text-decoration:underline">' + originalHost + '</a>. Please visit the original site.';
      document.body.insertBefore(banner, document.body.firstChild);
      document.body.style.paddingTop = '40px';
      var meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex, nofollow';
      document.head.appendChild(meta);
    }
  }

  // === Code block copy ===
  document.querySelectorAll('.post-body figure.highlight, .post-body pre:not(figure pre)').forEach(function(block) {
    if (block.closest('.code-block-wrap')) return;

    // Detect language from class
    var lang = 'text';
    if (block.tagName === 'FIGURE') {
      var cls = block.className.replace('highlight', '').trim();
      if (cls) lang = cls.split(' ')[0];
    }
    // Also check code tag
    var codeEl = block.querySelector('code[class*="language-"]');
    if (codeEl) {
      var m = codeEl.className.match(/language-(\w+)/);
      if (m) lang = m[1];
    }

    // Wrap everything in a container
    var wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    block.parentNode.insertBefore(wrap, block);
    wrap.appendChild(block);

    // Add header
    var header = document.createElement('div');
    header.className = 'code-header';
    var langSpan = document.createElement('span');
    langSpan.className = 'code-lang';
    langSpan.textContent = lang;
    var copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.innerHTML = '<span style="font-size:13px;line-height:1">📋</span> Copy';
    copyBtn.addEventListener('click', function() {
      var text = (block.querySelector('code') || block).textContent || '';
      var doCopy = function(t) {
        navigator.clipboard.writeText(t).then(function() {
          copyBtn.innerHTML = '<span style="font-size:13px;line-height:1">✓</span> Copied!';
          copyBtn.classList.add('copied');
          setTimeout(function() { copyBtn.innerHTML = '<span style="font-size:13px;line-height:1">📋</span> Copy'; copyBtn.classList.remove('copied'); }, 2000);
        }).catch(function() {
          var ta = document.createElement('textarea');
          ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); copyBtn.innerHTML = '<span style="font-size:13px;line-height:1">✓</span> Copied!'; }
          catch(e) { copyBtn.innerHTML = '<span style="font-size:13px;line-height:1">✗</span> Failed'; }
          setTimeout(function() { copyBtn.innerHTML = '<span style="font-size:13px;line-height:1">📋</span> Copy'; }, 2000);
          document.body.removeChild(ta);
        });
      };
      doCopy(text);
    });
    header.appendChild(langSpan);
    header.appendChild(copyBtn);
    wrap.insertBefore(header, block);
  });

  // === Dropdown Menu ===
  (function() {
    var isDesktop = window.matchMedia('(min-width: 768px)');
    var CLOSE_DELAY = 150;
    var closeTimer = null;

    function initDropdown() {
      var dropdowns = document.querySelectorAll('.nav .dropdown');

      // 先清理所有已绑定的事件
      dropdowns.forEach(function(dd) {
        dd.removeEventListener('mouseenter', onMouseEnter);
        dd.removeEventListener('mouseleave', onMouseLeave);
        dd.removeEventListener('click', onToggleClick);
      });

      if (isDesktop.matches) {
        // 桌面端：hover 展开/收起
        dropdowns.forEach(function(dd) {
          dd.addEventListener('mouseenter', onMouseEnter);
          dd.addEventListener('mouseleave', onMouseLeave);
        });
      } else {
        // 移动端由 mobile.js 处理，这里仅确保用 click 兜底
        dropdowns.forEach(function(dd) {
          dd.addEventListener('click', onToggleClick);
        });
      }
    }

    function onMouseEnter() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      // 关闭其他下拉菜单
      document.querySelectorAll('.nav .dropdown.open').forEach(function(d) {
        if (d !== this) d.classList.remove('open');
      }.bind(this));
      this.classList.add('open');
    }

    function onMouseLeave() {
      var self = this;
      closeTimer = setTimeout(function() {
        self.classList.remove('open');
        closeTimer = null;
      }, CLOSE_DELAY);
    }

    function onToggleClick(e) {
      var dd = this;
      // 如果点击的是链接且不是 dropdown-toggle，让它正常跳转
      if (e.target.closest('.dropdown-item')) return;
      if (e.target.closest('.dropdown-toggle') || dd.contains(e.target)) {
        e.preventDefault();
        dd.classList.toggle('open');
      }
    }

    // 点击页面其他区域关闭所有下拉菜单
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.nav .dropdown.open').forEach(function(dd) {
          dd.classList.remove('open');
        });
      }
    });

    // 监听窗口大小变化，重新绑定事件
    isDesktop.addEventListener('change', function() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      // 切换时关闭所有下拉
      document.querySelectorAll('.nav .dropdown.open').forEach(function(dd) {
        dd.classList.remove('open');
      });
      initDropdown();
    });

    // 页面加载后初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDropdown);
    } else {
      initDropdown();
    }
  })();
})();
