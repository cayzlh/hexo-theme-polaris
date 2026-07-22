/**
 * Polaris — Archive search
 * Real-time filtering of archive articles by title / tags / categories / content.
 */
(function() {
  'use strict';

  // === DOM refs ===
  var input = document.querySelector('.archive-search-input');
  var list = document.querySelector('.archive-list');
  var items = list ? list.querySelectorAll('li') : [];
  var countEl = document.querySelector('.archive-search-count');
  var emptyEl = document.querySelector('.archive-empty');

  if (!input || !items.length) return;

  // === Config (from theme, with defaults) ===
  var debounceDelay = parseInt(input.getAttribute('data-debounce'), 10) || 200;
  var highlightEnabled = input.getAttribute('data-highlight') !== 'false';

  // === State ===
  var totalCount = items.length;

  // === Utilities ===

  // Escape special regex characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Highlight matching text in an element
  function highlightText(el, query) {
    if (!el) return;

    // Cache original text on first call
    if (!el.hasAttribute('data-original')) {
      el.setAttribute('data-original', el.textContent);
    }

    var original = el.getAttribute('data-original');

    if (!query) {
      el.textContent = original;  // restore plain text (removes previous highlights)
      return;
    }

    // Case-insensitive regex
    var regex = new RegExp('(' + escapeRegExp(query) + ')', 'gi');
    el.innerHTML = original.replace(regex, '<span class="search-highlight">$1</span>');
  }

  // Remove highlights from all title elements
  function clearHighlights() {
    var titles = list.querySelectorAll('.archive-title');
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      if (t.hasAttribute('data-original')) {
        t.textContent = t.getAttribute('data-original');
      }
    }
  }

  // === Main search ===
  function performSearch(query) {
    var trimmed = query.trim().toLowerCase();
    var matchCount = 0;

    // Clear old highlights first
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

        // Highlight matched text in title
        if (highlightEnabled && trimmed !== '') {
          var titleEl = item.querySelector('.archive-title');
          // Only highlight when title actually matches
          if (title.indexOf(trimmed) !== -1) {
            highlightText(titleEl, trimmed);
          }
        }
      } else {
        item.style.display = 'none';
      }
    }

    // Update count
    if (countEl) {
      if (trimmed === '') {
        countEl.textContent = '共 ' + totalCount + ' 篇文章';
      } else {
        countEl.textContent = '找到 ' + matchCount + ' 篇文章';
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
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  }

  // === Init ===
  var debouncedSearch = debounce(function() {
    performSearch(this.value);
  }, debounceDelay);

  input.addEventListener('input', debouncedSearch);

  // Initial render: show all
  performSearch('');
})();
