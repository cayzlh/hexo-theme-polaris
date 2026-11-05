/**
 * Vellum — Archive right-side timeline ruler
 * Reads archive-item positions, builds a vertical ruler with year/month labels
 * on the right edge. Labels are subtle by default, active on scroll or hover.
 */
(function() {
  'use strict';

  var ruler = document.querySelector('.timeline-ruler');
  var body = document.querySelector('.archive-timeline-body');
  var itemsContainer = body ? body.querySelector('.archive-items') : null;
  var items = itemsContainer ? itemsContainer.querySelectorAll('.archive-item') : [];

  if (!ruler || !items.length) return;

  // ============================================
  // 1. Group items by year-month
  // ============================================
  var groups = [];
  var lastDate = null;

  for (var i = 0; i < items.length; i++) {
    var date = items[i].getAttribute('data-date');
    if (!date) continue;

    if (date !== lastDate) {
      // Extract year and month from "YYYY-MM"
      var parts = date.split('-');
      var label = (window.tr('archive.year_month_label', parts[0], +parts[1]) || (parts[0] + '·' + (+parts[1]) + '月'));
      groups.push({
        date: date,
        label: label,
        firstItem: items[i]
      });
      lastDate = date;
    }
  }

  if (!groups.length) return;

  // ============================================
  // 2. Calculate positions and render ticks
  // ============================================
  function positionTicks() {
    var containerHeight = itemsContainer.offsetHeight;
    if (!containerHeight) return;

    ruler.style.height = containerHeight + 'px';

    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var offsetTop = group.firstItem.offsetTop;
      var percent = (offsetTop / containerHeight) * 100;

      // Create or update tick element
      var tick = group.tickEl;
      if (!tick) {
        tick = document.createElement('div');
        tick.className = 'ruler-tick';
        tick.setAttribute('data-date', group.date);
        tick.setAttribute('data-label', group.label);
        ruler.appendChild(tick);
        group.tickEl = tick;
      }
      tick.style.top = percent + '%';
    }
  }

  positionTicks();

  // Reposition on resize
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(positionTicks, 150);
  });

  // ============================================
  // 3. Scroll-aware active tick (IntersectionObserver)
  // ============================================
  var tickEls = ruler.querySelectorAll('.ruler-tick');

  function setActive(date) {
    for (var t = 0; t < tickEls.length; t++) {
      var el = tickEls[t];
      if (el.getAttribute('data-date') === date) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  }

  // Observe the first item of each group
  var observer = new IntersectionObserver(function(entries) {
    var activeDate = null;
    // Find the topmost visible group
    for (var e = 0; e < entries.length; e++) {
      if (entries[e].isIntersecting) {
        var date = entries[e].target.getAttribute('data-date');
        // Keep going to find the one closest to top of viewport
        if (!activeDate) activeDate = date;
      }
    }
    if (activeDate) setActive(activeDate);
  }, {
    rootMargin: '-10px 0px -50% 0px',
    threshold: 0
  });

  for (var g = 0; g < groups.length; g++) {
    observer.observe(groups[g].firstItem);
  }

  // Activate first group by default
  if (groups.length > 0) setActive(groups[0].date);
})();
