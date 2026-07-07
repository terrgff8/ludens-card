/* ==========================================================
   渲染層：ICONS 表 + renderLinks() + GSAP CDN 失效防護
   安全規則：使用者資料（label/sublabel）一律 textContent；
   innerHTML 只用於本地信任的 ICONS 表。
   ========================================================== */

/* 自繪簡化線稿 icon（Feather/Lucide 風，非官方精確 logo） */
const ICONS = {
  github:
    '<svg viewBox="0 0 20 20" fill="currentColor" stroke="none" aria-hidden="true"><path d="M10 1.6a8.4 8.4 0 0 0-2.66 16.37c.42.08.58-.18.58-.4v-1.4c-2.34.5-2.83-1.13-2.83-1.13-.38-.97-.93-1.23-.93-1.23-.76-.52.06-.51.06-.51.84.06 1.28.86 1.28.86.75 1.28 1.96.91 2.44.7.07-.54.29-.91.53-1.12-1.86-.21-3.82-.93-3.82-4.15 0-.92.33-1.67.86-2.26-.08-.21-.37-1.07.08-2.22 0 0 .7-.23 2.31.86a8 8 0 0 1 4.2 0c1.6-1.09 2.3-.86 2.3-.86.46 1.15.17 2.01.09 2.22.54.59.86 1.34.86 2.26 0 3.23-1.97 3.94-3.84 4.15.3.26.57.77.57 1.55v2.3c0 .22.15.48.58.4A8.4 8.4 0 0 0 10 1.6z"/></svg>',
  x:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16"/></svg>',
  instagram:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="4"/><circle cx="10" cy="10" r="3.4"/><circle cx="14.3" cy="5.7" r="0.8" fill="currentColor" stroke="none"/></svg>',
  youtube:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4.5" width="16" height="11" rx="3"/><path d="M8.5 7.8l4 2.2-4 2.2z" fill="currentColor" stroke="none"/></svg>',
  mail:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M2.5 5.5L10 11l7.5-5.5"/></svg>',
  globe:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15"/><ellipse cx="10" cy="10" rx="3.4" ry="7.5"/></svg>',
  file:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 2H5.5A1.5 1.5 0 0 0 4 3.5v13A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V6.5z"/><path d="M11.5 2v4.5H16"/></svg>',
  link:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M8.5 11.5a4 4 0 0 0 6 .4l2-2a4 4 0 0 0-5.6-5.6L9.8 5.4"/><path d="M11.5 8.5a4 4 0 0 0-6-.4l-2 2a4 4 0 0 0 5.6 5.6l1.1-1.1"/></svg>'
};

function renderLinks(list) {
  const ul = document.getElementById('link-list');
  if (!ul) return;

  list.forEach(function (item) {
    if (!item || !item.url) {
      console.warn('[links] 跳過缺少 url 的項目:', item);
      return;
    }

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'link-card' + (item.highlight ? ' is-highlight' : '');
    a.href = item.url;
    a.setAttribute('data-anim', 'link');

    // mailto: / tel: 不開新分頁
    const isDirect = /^(mailto:|tel:)/i.test(item.url);
    if (!isDirect) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }

    const iconSpan = document.createElement('span');
    iconSpan.className = 'link-card__icon';
    iconSpan.innerHTML = ICONS[item.icon] || ICONS.link; // 只注入信任的本地 SVG

    const textDiv = document.createElement('div');
    textDiv.className = 'link-card__text';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'link-card__label';
    labelSpan.textContent = item.label || item.url;
    textDiv.appendChild(labelSpan);

    if (item.sublabel) {
      const subSpan = document.createElement('span');
      subSpan.className = 'link-card__sublabel';
      subSpan.textContent = item.sublabel;
      textDiv.appendChild(subSpan);
    }

    a.appendChild(iconSpan);
    a.appendChild(textDiv);
    li.appendChild(a);
    ul.appendChild(li);
  });
}

renderLinks(LINKS);

/* GSAP CDN 失效防護：內容照常，只是沒動畫 */
if (typeof window.gsap === 'undefined') {
  document.documentElement.classList.add('no-motion');
}
