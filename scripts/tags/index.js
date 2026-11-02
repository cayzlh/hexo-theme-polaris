'use strict';

// Register no-op tag handlers for Stellar tag plugins used in existing posts.
// These simply render their content without special styling.

const noopTag = function(args, content) {
  return content;
};

const voidTag = function(args) {
  return '';
};

// Tags that wrap content.
// 注意：不要把 'folding' 放进来——它需要把标签体当 Markdown 渲染后再输出，
// 用 noopTag 会让 `<details>` 里的 `**粗体**`、链接、列表原样漏成纯文本。
// folding 在下面单独注册，与 'fold' 共用同一实现。
const contentTags = ['box', 'note', 'spoiler', 'folders', 'banner', 'okr'];
contentTags.forEach(t => {
  hexo.extend.tag.register(t, noopTag, { ends: true });
});

// copy tag - self-closing: {% copy text %}
hexo.extend.tag.register('copy', function(args) {
  var text = args.join(' ');
  return '<code class="tag-copy" onclick="navigator.clipboard.writeText(\'' + text.replace(/'/g, "\\'") + '\')">' + text + '</code>';
});

// quot tag - self-closing: {% quot text icon:hashtag %}
hexo.extend.tag.register('quot', function(args) {
  var text = args.filter(function(a) { return !a.startsWith('icon:'); }).join(' ');
  return '<blockquote class="quot">' + text + '</blockquote>';
});

// codeblock - render as raw code block (doesn't need special processing)
hexo.extend.tag.register('codeblock', function(args, content) {
  return content;
}, { ends: true });

// Tags that are self-closing
const voidTags = ['emoji', 'icon'];
voidTags.forEach(t => {
  hexo.extend.tag.register(t, voidTag);
});

// mark tag - self-closing, renders highlighted text: {% mark text color:red %}
hexo.extend.tag.register('mark', function(args) {
  var color = 'yellow';
  var texts = [];
  args.forEach(function(a) {
    if (a.startsWith('color:')) {
      color = a.split(':')[1];
    } else {
      texts.push(a);
    }
  });
  return '<mark class="highlight-' + color + '">' + texts.join(' ') + '</mark>';
});

// hashtag tag - self-closing
hexo.extend.tag.register('hashtag', function(args) {
  return '<span class="hashtag">#' + args.join(' ') + '</span>';
});

// checkbox - self-closing: {% checkbox checked text %}
hexo.extend.tag.register('checkbox', function(args) {
  var checked = args.includes('checked');
  var text = args.filter(function(a) { return a !== 'checked'; }).join(' ');
  return '<span>' + (checked ? '☑' : '☐') + ' ' + text + '</span>';
});

// image tag - renders as markdown image
hexo.extend.tag.register('image', function(args) {
  var src = args[0] || '';
  var alt = args[1] || '';
  return '<img src="' + src + '" alt="' + alt + '">';
});

// kbd tag - renders as <kbd> (self-closing: {% kbd Command %})
hexo.extend.tag.register('kbd', function(args) {
  return '<kbd>' + args.join(' ') + '</kbd>';
});
hexo.extend.tag.register('button', function(args, content) {
  var url = args[1] || '/';
  var text = content || args[0] || 'Link';
  return '<a href="' + url + '" class="tag-button">' + text + '</a>';
}, { ends: true });

// link tag - self-closing: {% link url text %}
hexo.extend.tag.register('link', function(args) {
  var url = args[0] || '#';
  var text = args.slice(1).join(' ') || url;
  return '<a href="' + url + '">' + text + '</a>';
});

// gallery tag
hexo.extend.tag.register('gallery', noopTag, { ends: true });

// timeline tag
hexo.extend.tag.register('timeline', noopTag, { ends: true });
hexo.extend.tag.register('tl', noopTag, { ends: true });

// folding / details tag
// 标签体是 Markdown 源码，必须渲染成 HTML 再塞进 <details>，
// 否则 marked 不会处理 <details> 内部的文本，`**`、`[]()`、列表都会原样输出。
const detailsTag = function(args, content) {
  var summary = args.join(' ') || 'Details';
  var html = content;
  try {
    html = hexo.render.renderSync({ text: content, engine: 'markdown' });
  } catch (e) {
    // 渲染失败就退回原始内容，至少不丢信息
  }
  return '<details class="tag-fold"><summary>' + summary + '</summary>' + html + '</details>';
};

hexo.extend.tag.register('fold', detailsTag, { ends: true });
hexo.extend.tag.register('folding', detailsTag, { ends: true });

// friends / sites tags - self-closing data-fetching tags
hexo.extend.tag.register('friends', function(args) {
  return '<div class="tag-friends"></div>';
});
hexo.extend.tag.register('sites', function(args) {
  return '<div class="tag-sites"></div>';
});
hexo.extend.tag.register('ghrepo', voidTag);

// okr tag
hexo.extend.tag.register('okr', noopTag, { ends: true });

// swiper (slideshow)
hexo.extend.tag.register('swiper', noopTag, { ends: true });
hexo.extend.tag.register('swiperlide', noopTag, { ends: true });

// navbar
hexo.extend.tag.register('navbar', noopTag, { ends: true });

// row / col grid
hexo.extend.tag.register('row', noopTag, { ends: true });
hexo.extend.tag.register('col', noopTag, { ends: true });
