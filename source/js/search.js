/**
 * Polaris — Archive search
 * Real-time filtering of archive articles.
 * Supports continuous timeline (.archive-item) and list (.archive-list li) modes.
 */
(function() {
  'use strict';

  // === DOM refs ===
  var input = document.querySelector('.archive-search-input');
  var timeline = document.querySelector('.archive-timeline');
  var list = document.querySelector('.archive-list');
  var countEl = document.querySelector('.archive-search-count');
  var emptyEl = document.querySelector('.archive-empty');

  if (!input) return;

  // === Detect mode ===
  var isTimeline = !!timeline;
  var items = isTimeline
    ? timeline.querySelectorAll('.archive-item')
    : (list ? list.querySelectorAll('li') : []);

  if (!items.length) return;

  // === Config ===
  var debounceDelay = parseInt(input.getAttribute('data-debounce'), 10) || 200;
  var highlightEnabled = input.getAttribute('data-highlight') !== 'false';

  // === State ===
  var totalCount = items.length;

  // === Utilities ===

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightText(el, query) {
    if (!el) return;
    if (!el.hasAttribute('data-original')) {
      el.setAttribute('data-original', el.textContent);
    }
    var original = el.getAttribute('data-original');
    if (!query) {
      el.textContent = original;
      return;
    }
    var regex = new RegExp('(' + escapeRegExp(query) + ')', 'gi');
    el.innerHTML = original.replace(regex, '<span class="search-highlight">$1</span>');
  }

  function clearHighlights() {
    var container = isTimeline ? timeline : list;
    var titles = container.querySelectorAll('.archive-title');
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      if (t.hasAttribute('data-original')) {
        t.textContent = t.getAttribute('data-original');
      }
    }
  }

  // Toggle marker visibility based on visible items after it
  function updateMarkers() {
    if (!isTimeline) return;
    var markers = timeline.querySelectorAll('.archive-marker');
    for (var m = 0; m < markers.length; m++) {
      var marker = markers[m];
      var item = marker.nextElementSibling;
      var hasVisible = false;
      // Scan forward until next marker or end
      while (item && !item.classList.contains('archive-marker')) {
        if (item.classList.contains('archive-item') && item.style.display !== 'none') {
          hasVisible = true;
          break;
        }
        item = item.nextElementSibling;
      }
      marker.style.display = hasVisible ? '' : 'none';
    }
  }

  // === Main search ===
  function performSearch(query) {
    var trimmed = query.trim().toLowerCase();
    var matchCount = 0;

    clearHighlights();

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var title = (item.getAttribute('data-title') || '').toLowerCase();
      var tags = (item.getAttribute('data-tags') || '').toLowerCase();
      var cats = (item.getAttribute('data-categories') || '').toLowerCase();
      var content = (item.getAttribute('data-content') || '').toLowerCase();

      var haystack = title + ' ' + tags + ' ' + cats + ' ' + content;

      if (trimmed === '' || haystack.indexOf(trimmed) !== -1) {
        item.style.display = '';
        matchCount++;

        if (highlightEnabled && trimmed !== '') {
          var titleEl = item.querySelector('.archive-title');
          if (title.indexOf(trimmed) !== -1) {
            highlightText(titleEl, trimmed);
          }
        }
      } else {
        item.style.display = 'none';
      }
    }

    // Sync marker visibility with filtered items
    updateMarkers();

    // Update count
    if (countEl) {
      if (trimmed === '') {
        countEl.textContent = window.tr('archive.count_all', totalCount);
      } else {
        countEl.textContent = window.tr('archive.count_found', matchCount);
      }
    }

    // Empty state
    if (emptyEl) {
      emptyEl.style.display = (matchCount === 0 && trimmed !== '') ? 'block' : 'none';
    }
  }

  // === Debounce ===
  function debounce(fn, delay) {
    var timer = null;
    return function() {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  }

  // === Init ===
  var debouncedSearch = debounce(function() {
    performSearch(this.value);
  }, debounceDelay);

  input.addEventListener('input', debouncedSearch);

  performSearch('');
})();
