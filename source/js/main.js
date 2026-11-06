/**
 * Vellum — Clone detection + Code block copy (DeepSeek style)
 */
(function() {
  // === Clone detection ===
  var VELLUM = window.__VELLUM;
  if (VELLUM && VELLUM.originalHost) {
    var originalHost = VELLUM.originalHost;
    var officialHosts = VELLUM.officialHosts || [];
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

  // === Code block copy (DeepSeek 风格 — 服务端已生成结构，仅绑事件) ===
  // 三态图标（.copy-icon--copy / --check / --error）常驻 DOM，状态只切
  // .copied / .failed 类，由 CSS 换图标和底色。
  // 文案**始终是"复制"**：换成"已复制"会让按钮变宽 14px、把语言徽标推左，
  // 整行元信息抖一下。状态改由 aria-live 播报，读屏器听得到、视觉上不跳。
  var liveRegion = (function() {
    var el = document.getElementById('code-copy-live');
    if (!el) {
      el = document.createElement('span');
      el.id = 'code-copy-live';
      el.className = 'sr-only';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  })();

  document.querySelectorAll('.code-block .code-copy-btn').forEach(function(btn) {
    var resetTimer = null;

    function setState(state) {
      btn.classList.toggle('copied', state === 'copied');
      btn.classList.toggle('failed', state === 'failed');
      if (state === 'copied') liveRegion.textContent = window.tr('code.copied');
      else if (state === 'failed') liveRegion.textContent = window.tr('code.failed');
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(function() {
        btn.classList.remove('copied');
        btn.classList.remove('failed');
        liveRegion.textContent = '';
        resetTimer = null;
      }, 2000);
    }

    btn.addEventListener('click', function() {
      var block = btn.closest('.code-block');
      var codeBody = block.querySelector('.code-body code, .code-body pre');
      var text = codeBody ? codeBody.textContent || '' : '';

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          setState('copied');
        }).catch(function() {
          legacyCopy(text);
        });
        return;
      }
      legacyCopy(text);

      // 老浏览器 / 非安全上下文（http）没有 Clipboard API，退回 execCommand。
      function legacyCopy(t) {
        var ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        setState(ok ? 'copied' : 'failed');
      }
    });
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
