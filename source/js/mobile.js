/**
 * Polaris — 移动端专有 JavaScript
 *
 * 所有逻辑通过 matchMedia 或 window.innerWidth 判断设备类型，
 * 仅在移动端（< 768px）执行，不对 PC 端产生任何影响。
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // =============================================
  // 设备判断
  // =============================================
  var isMobile = window.matchMedia('(max-width: 767px)');
  var isTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');

  function isMobileView() {
    return isMobile.matches;
  }

  function isTabletView() {
    return isTablet.matches;
  }

  function isMobileOrTablet() {
    return isMobileView() || isTabletView();
  }

  // =============================================
  // 2.3 导航 — 汉堡菜单
  // =============================================
  function initMobileNav() {
    if (!isMobileView()) return;

    var toggle = document.querySelector('.nav-toggle');
    var drawer = document.querySelector('.nav-drawer');
    var overlay = document.querySelector('.nav-overlay');

    if (!toggle || !drawer || !overlay) return;

    function openDrawer() {
      drawer.classList.add('open');
      overlay.classList.add('active');
      toggle.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      overlay.classList.remove('active');
      toggle.classList.remove('open');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (drawer.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    overlay.addEventListener('click', closeDrawer);

    // 点击导航链接后关闭抽屉
    var drawerLinks = drawer.querySelectorAll('a');
    drawerLinks.forEach(function (link) {
      link.addEventListener('click', closeDrawer);
    });

    // 按 ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeDrawer();
      }
    });
  }

  // =============================================
  // 2.7 TOC — 浮动按钮 + 底部面板
  // =============================================
  function initMobileToc() {
    if (!isMobileView()) return;

    var fab = document.querySelector('.toc-fab');
    var panel = document.querySelector('.toc-panel');
    var panelOverlay = document.querySelector('.toc-panel-overlay');

    if (!fab || !panel) return;

    function openPanel() {
      panel.classList.add('open');
      if (panelOverlay) panelOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      panel.classList.remove('open');
      if (panelOverlay) panelOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.classList.contains('open')) {
        closePanel();
      } else {
        openPanel();
      }
    });

    if (panelOverlay) {
      panelOverlay.addEventListener('click', closePanel);
    }

    // 点击 TOC 链接后关闭面板
    var tocLinks = panel.querySelectorAll('.toc-link');
    tocLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        closePanel();
      });
    });

    // 点击面板外部（但面板自身不关闭）
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  // =============================================
  // 2.8 Dossier — 侧边栏折叠
  // =============================================
  function initDossierSidebar() {
    if (!isMobileView()) return;

    var sidebarHeader = document.querySelector('.dossier-sidebar-header');
    var sidebarBody = document.querySelector('.dossier-sidebar-body');
    var arrow = document.querySelector('.dossier-sidebar-arrow');

    if (!sidebarHeader || !sidebarBody) return;

    sidebarHeader.addEventListener('click', function () {
      var isOpen = sidebarBody.classList.toggle('open');
      if (arrow) arrow.classList.toggle('open', isOpen);
    });
  }

  // =============================================
  // 初始化
  // =============================================
  function init() {
    initMobileNav();
    initMobileToc();
    initDossierSidebar();

    // 监听视口变化：当从移动端切换到 PC 端时，
    // 清理可能残留的移动端状态
    var mql = window.matchMedia('(min-width: 768px)');
    mql.addEventListener('change', function (e) {
      if (e.matches) {
        // 恢复 body overflow
        document.body.style.overflow = '';

        // 关闭可能打开的抽屉/面板
        var drawer = document.querySelector('.nav-drawer');
        var overlay = document.querySelector('.nav-overlay');
        var toggle = document.querySelector('.nav-toggle');
        var panel = document.querySelector('.toc-panel');
        var panelOverlay = document.querySelector('.toc-panel-overlay');

        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        if (toggle) toggle.classList.remove('open');
        if (panel) panel.classList.remove('open');
        if (panelOverlay) panelOverlay.classList.remove('active');
      }
    });
  }

  // DOM 就绪后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
