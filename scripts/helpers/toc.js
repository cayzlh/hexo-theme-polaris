'use strict';

// TOC Generator — extracts headings from rendered HTML and attaches to page.toc
hexo.extend.filter.register('after_post_render', function(data) {
  if (!hexo.theme.config.toc || !hexo.theme.config.toc.enable) return data;
  if (data.layout !== 'post' && data.layout !== 'page') return data;
  if (!data.content) return data;

  var maxDepth = hexo.theme.config.toc.max_depth || 3;
  var toc = [];
  var stack = [{ children: toc, level: 0 }];
  var headingRegex = /<h([1-6])\s+id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi;
  var match;

  while ((match = headingRegex.exec(data.content)) !== null) {
    var level = parseInt(match[1]);
    if (level > maxDepth) continue;
    var id = match[2];
    var text = match[3].replace(/<[^>]*>/g, '').trim();
    var item = { level: level, id: id, text: text, children: [] };

    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    if (stack[stack.length - 1].level < level) {
      stack[stack.length - 1].children.push(item);
      stack.push(item);
    }
  }

  data.toc = toc;
  return data;
});

// Helper: pass toc data to templates
hexo.extend.helper.register('toc_tree', function(toc) {
  if (!toc || toc.length === 0) return '';
  function render(items) {
    var html = '<ul class="toc-list">';
    items.forEach(function(item) {
      html += '<li class="toc-item toc-level-' + item.level + '">';
      html += '<a href="#' + item.id + '" class="toc-link">' + item.text + '</a>';
      if (item.children && item.children.length > 0) html += render(item.children);
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }
  return render(toc);
});
