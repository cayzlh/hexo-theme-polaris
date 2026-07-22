/**
 * Polaris — Clone detection + Code block copy
 */
(function() {
  // === Clone detection ===
  var originalHost = window.__POLARIS && window.__POLARIS.originalHost || 'www.cayzlh.com';
  var officialHosts = window.__POLARIS && window.__POLARIS.officialHosts || [];
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
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function() {
      var text = (block.querySelector('code') || block).textContent || '';
      var doCopy = function(t) {
        navigator.clipboard.writeText(t).then(function() {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(function() { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
        }).catch(function() {
          var ta = document.createElement('textarea');
          ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); copyBtn.textContent = 'Copied!'; }
          catch(e) { copyBtn.textContent = 'Failed'; }
          setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
          document.body.removeChild(ta);
        });
      };
      doCopy(text);
    });
    header.appendChild(langSpan);
    header.appendChild(copyBtn);
    wrap.insertBefore(header, block);
  });
})();
