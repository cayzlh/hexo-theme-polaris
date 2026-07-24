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

    // 移动端子菜单切换
    var subToggles = drawer.querySelectorAll('.drawer-sub-toggle');
    subToggles.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var submenu = this.parentElement.nextElementSibling;
        if (submenu && submenu.classList.contains('drawer-submenu')) {
          submenu.classList.toggle('open');
          this.classList.toggle('open');
        }
      });
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
    var closeBtn = document.querySelector('.toc-panel-close');

    if (!fab || !panel) return;

    function openPanel() {
      panel.classList.add('open');
      if (panelOverlay) panelOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      // 打开面板时显示 FAB
      fab.classList.remove('hidden');
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

    // 关闭按钮
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closePanel();
      });
    }

    // 点击 TOC 链接后关闭面板
    var tocLinks = panel.querySelectorAll('.toc-link');
    tocLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        closePanel();
      });
    });

    // 点击面板内部不冒泡
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // ===== FAB 滚动自动隐藏 =====
    var lastScrollY = window.scrollY;
    var ticking = false;

    function handleScroll() {
      var currentScrollY = window.scrollY;
      var panelOpen = panel.classList.contains('open');

      // 面板打开时始终显示 FAB
      if (panelOpen) {
        fab.classList.remove('hidden');
        lastScrollY = currentScrollY;
        ticking = false;
        return;
      }

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        fab.classList.add('hidden');
      } else {
        fab.classList.remove('hidden');
      }
      lastScrollY = currentScrollY;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
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
  // 2.15 Dossier — 移动端顶部下拉导航
  // =============================================
  function initDossierMobileNav() {
    if (!isMobileView()) return;

    var navCurrent = document.querySelector('.dossier-mobile-nav-current');
    var navList = document.querySelector('.dossier-mobile-nav-list');
    var arrow = document.querySelector('.dossier-mobile-nav-arrow');

    if (!navCurrent || !navList) return;

    // 点击头部展开/收起
    navCurrent.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = navList.classList.toggle('open');
      if (arrow) arrow.classList.toggle('open', isOpen);
    });

    // 点击列表项后关闭
    var navItems = navList.querySelectorAll('.dossier-mobile-nav-item');
    navItems.forEach(function (item) {
      item.addEventListener('click', function () {
        navList.classList.remove('open');
        if (arrow) arrow.classList.remove('open');
      });
    });

    // 点击页面其他区域关闭
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.dossier-mobile-nav')) {
        navList.classList.remove('open');
        if (arrow) arrow.classList.remove('open');
      }
    });
  }

  // =============================================
  // 2.16 组合悬浮球（TOC + MENU 融合）
  // =============================================
  function initFabGroup() {
    if (!isMobileView()) return;

    var fabMain = document.getElementById('fabMain');
    var fabOverlay = document.getElementById('fabOverlay');
    var fabChildren = document.querySelectorAll('.fab-child');
    var fabToc = document.getElementById('fabToc');
    var fabMenu = document.getElementById('fabMenu');
    var fabDark = document.getElementById('fabDark');

    if (!fabMain || !fabOverlay) return;

    var isOpen = false;

    function toggleFab() {
      isOpen = !isOpen;
      fabMain.classList.toggle('open', isOpen);
      fabChildren.forEach(function (el) { el.classList.toggle('show', isOpen); });
      fabOverlay.classList.toggle('active', isOpen);
    }

    function closeFab() {
      if (isOpen) toggleFab();
    }

    fabMain.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFab();
    });

    fabOverlay.addEventListener('click', closeFab);

    // TOC 子球：复用现有 TOC 面板
    if (fabToc) {
      fabToc.addEventListener('click', function (e) {
        e.stopPropagation();
        closeFab();
        var panel = document.querySelector('.toc-panel');
        var panelOverlay = document.querySelector('.toc-panel-overlay');
        if (panel) {
          panel.classList.add('open');
          if (panelOverlay) panelOverlay.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      });
    }

    // MENU 子球：展开导航抽屉
    if (fabMenu) {
      fabMenu.addEventListener('click', function (e) {
        e.stopPropagation();
        closeFab();
        var drawer = document.querySelector('.nav-drawer');
        var navOverlay = document.querySelector('.nav-overlay');
        var toggle = document.querySelector('.nav-toggle');
        if (drawer) {
          drawer.classList.add('open');
          if (navOverlay) navOverlay.classList.add('active');
          if (toggle) toggle.classList.add('open');
          document.body.style.overflow = 'hidden';
        }
      });
    }

    // 暗色模式子球：切换日间/夜间模式
    if (fabDark) {
      fabDark.addEventListener('click', function (e) {
        e.stopPropagation();
        closeFab();
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('polaris-theme',
          document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      });
    }

    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeFab();
    });
  }

  // =============================================
  // 初始化
  // =============================================
  function init() {
    initMobileNav();
    initMobileToc();
    initDossierSidebar();
    initDossierMobileNav();
    initFabGroup();

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

        // 关闭组合悬浮球
        var fabMain = document.getElementById('fabMain');
        var fabOverlay = document.getElementById('fabOverlay');
        var fabChildren = document.querySelectorAll('.fab-child');
        if (fabMain) fabMain.classList.remove('open');
        if (fabOverlay) fabOverlay.classList.remove('active');
        fabChildren.forEach(function (el) { el.classList.remove('show'); });
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
