/**
 * Vellum — Page transition animation
 *
 * Primary:   View Transitions API (modern browsers, native)
 * Fallback:  JS-controlled fade-out/fade-in
 * CSS-only:  Page fade-in animation on every page load
 *
 * Design: minimal, fast (350ms), respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  var CONFIG = {
    duration: 350,        // ms — matches CSS animation duration
    fadeClass: 'page-fade-in'
  };

  // =============================================
  //  View Transitions API (primary)
  // =============================================
  var supportsViewTransition = typeof document.startViewTransition === 'function';

  if (supportsViewTransition) {
    document.addEventListener('click', function (e) {
      var link = resolveLink(e);
      if (!link) return;

      e.preventDefault();
      document.startViewTransition(function () {
        window.location.href = link;
      });
    });
    return; // View Transitions handles everything
  }

  // =============================================
  //  Fallback: JS fade-out then fade-in
  // =============================================

  // Intercept internal links for fade-out
  document.addEventListener('click', function (e) {
    var href = resolveLink(e);
    if (!href) return;

    e.preventDefault();
    document.body.classList.remove(CONFIG.fadeClass);

    // Trigger fade-out via CSS transition
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity ' + CONFIG.duration + 'ms ease';

    setTimeout(function () {
      window.location.href = href;
    }, CONFIG.duration);
  });

  // Intercept popstate (back/forward) — re-trigger fade-in
  // The new page will have its CSS fade-in animation anyway.
})();

/**
 * Resolve an internal link from a click event.
 * Returns the href string if it's an internal navigation, or null otherwise.
 */
function resolveLink(e) {
  var link = e.target.closest('a');
  if (!link) return null;

  var href = link.getAttribute('href');
  if (!href) return null;

  // Skip external, anchor, javascript, mailto, etc.
  if (href.startsWith('http://') || href.startsWith('https://') ||
      href.startsWith('#') || href.startsWith('javascript:') ||
      href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }

  // Skip links that open in a new tab
  if (link.target === '_blank') return null;

  // Skip modified clicks (ctrl/meta/shift — user wants new tab)
  if (e.ctrlKey || e.metaKey || e.shiftKey) return null;

  // Skip download links
  if (link.hasAttribute('download')) return null;

  return href;
}
