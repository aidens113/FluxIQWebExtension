/**
 * A post's own behaviour, wherever the post is shown: the feed, its own page,
 * or the grid's modal.
 *
 * - The bookmark saves to "All posts" and, for a few seconds, offers "Save to
 *   collection". Pressed when filled, it unsaves: the post leaves saved and
 *   every collection holding it.
 * - The save dialog's rows add to and remove from a collection. Their counts
 *   are the ones the page loaded with and do not move.
 * - "Load more comments" ignores the first press it gets on each post: the
 *   comment list has not hydrated yet. The second press loads.
 * - Replies stay out of the page until "View replies" fetches them.
 */
export const POST_SCRIPT = String.raw`
const POPOVER_MS = 8000;
const hydratedLists = new WeakSet();
const commentOffsets = new WeakMap();
const replyCounts = new WeakMap();

function codeOf(scope) {
  for (const link of scope.querySelectorAll('a[href*="/p/"]')) {
    const match = link.getAttribute('href').match(/\/p\/([A-Za-z0-9_-]+)\//);
    if (match) return match[1];
  }
  return FL.page.code;
}
function postScope(control) { return control.closest('article') || document; }

function setIconLabel(control, label) { const svg = control.querySelector('svg'); if (svg) svg.setAttribute('aria-label', label); }

function openPopover(actions, code) {
  const old = actions.querySelector('.' + H.popover);
  if (old) old.remove();
  const node = el('<div class="' + C.popover + '"><span>Saved</span><div role="button" tabindex="0" class="' + C.linkButton + '">Save to collection</div></div>');
  actions.appendChild(node);
  node.querySelector('[role="button"]').addEventListener('click', (event) => { event.stopPropagation(); node.remove(); openSaveDialog(code, actions); });
  const timer = setTimeout(() => node.remove(), POPOVER_MS);
  setTimeout(() => document.addEventListener('click', function away(event) {
    if (node.contains(event.target)) return;
    clearTimeout(timer); node.remove(); document.removeEventListener('click', away);
  }), 0);
}

function collectionRow(collection, code) {
  const holds = collection.codes.includes(code);
  const cover = collection.cover ? '<img alt="" src="' + collection.cover + '" width="44" height="44" style="border-radius:6px;object-fit:cover">' : '<span style="width:44px;height:44px;border-radius:6px;background:#efefef;display:inline-block"></span>';
  const count = collection.count === 1 ? '1 post' : collection.count + ' posts';
  return '<div role="button" tabindex="0" class="' + C.dialogRow + '">' + cover + '<span>' + esc(collection.name) + '</span><span class="' + C.meta + '">' + count + '</span>' + (holds ? icon('check', C.check, 'Selected') : '') + '</div>';
}

function openSaveDialog(code, actions) {
  const box = scrim('<div class="' + C.dialog + '" role="dialog" aria-modal="true" aria-labelledby="' + FL.ids.dialog + '"></div>');
  const dialog = box.firstElementChild;
  const close = () => box.remove();
  box.addEventListener('click', (event) => { if (event.target === box) close(); });
  const head = (title) => '<div class="' + C.dialogHead + '"><h2 id="' + FL.ids.dialog + '" style="margin:0;font-size:16px">' + title + '</h2><div role="button" tabindex="0" style="position:absolute;right:12px;top:12px">' + icon('close', C.navIcon, 'Close') + '</div></div>';
  function list() {
    dialog.innerHTML = head('Save to') + '<div>' + live.collections.map((c) => collectionRow(c, code)).join('') + '<div role="button" tabindex="0" class="' + C.dialogRow + '">' + icon('plus', C.navIcon, undefined) + '<span>New collection</span></div></div>';
    dialog.querySelector('.' + H.dialogHead + ' [role="button"]').addEventListener('click', close);
    const rows = dialog.querySelectorAll('.' + H.dialogRow);
    rows.forEach((row, index) => row.addEventListener('click', async () => {
      if (index === live.collections.length) { create(); return; }
      const collection = live.collections[index];
      await act('collection-toggle', { slug: collection.slug, code });
      list();
    }));
  }
  function create() {
    dialog.innerHTML = head('New collection') + '<div class="' + C.dialogBody + '"><input class="' + C.input + '" type="text" placeholder="Collection name" maxlength="50" autocomplete="off"><p role="alert" class="' + C.meta + '" hidden></p><div style="display:flex;gap:8px;justify-content:flex-end"><div role="button" tabindex="0" class="' + C.secondary + '">Cancel</div><div role="button" tabindex="0" class="' + C.primary + '" aria-disabled="true">Create</div></div></div>';
    dialog.querySelector('.' + H.dialogHead + ' [role="button"]').addEventListener('click', close);
    const input = dialog.querySelector('input');
    const [cancel, confirm] = dialog.querySelectorAll('.' + H.dialogBody + ' [role="button"]');
    input.addEventListener('input', () => confirm.setAttribute('aria-disabled', String(input.value.trim() === '')));
    cancel.addEventListener('click', list);
    confirm.addEventListener('click', async () => {
      const name = input.value.trim();
      if (name === '') return;
      const before = live.collections.length;
      await act('collection-create', { name, codes: [code] });
      if (live.collections.length === before) {
        const alert = dialog.querySelector('[role="alert"]');
        alert.textContent = 'You already have a collection with that name.';
        alert.hidden = false;
        return;
      }
      close();
      toast('Saved to ' + name);
      for (const control of actions.querySelectorAll('.' + H.iconButton)) if (labelOf(control) === 'Save') setIconLabel(control, 'Remove');
    });
    input.focus();
  }
  list();
}

document.addEventListener('click', async (event) => {
  const control = event.target.closest('[role="button"]');
  if (!control || control.closest('.' + H.dialog) || control.closest('.' + H.consent)) return;
  const scope = postScope(control);
  const label = labelOf(control);
  const inActions = control.parentElement && control.parentElement.classList.contains(H.actions);
  if (inActions && (label === 'Like' || label === 'Unlike')) {
    const liked = label === 'Like';
    setIconLabel(control, liked ? 'Unlike' : 'Like');
    await act('like', { code: codeOf(scope), liked });
  } else if (inActions && label === 'Save') {
    const code = codeOf(scope);
    await act('save', { code, saved: true });
    setIconLabel(control, 'Remove');
    openPopover(control.parentElement, code);
  } else if (inActions && label === 'Remove') {
    await act('save', { code: codeOf(scope), saved: false });
    setIconLabel(control, 'Save');
    toast('Removed from saved');
  } else if (inActions && label === 'Share Post') {
    toast('Link copied to clipboard');
  } else if (control.classList.contains(H.carouselArrow)) {
    const media = control.parentElement;
    const slides = Array.from(media.querySelector('ul').children);
    const current = slides.findIndex((slide) => !slide.hidden);
    const next = Math.max(0, Math.min(slides.length - 1, current + (label === 'Next' ? 1 : -1)));
    slides.forEach((slide, index) => { slide.hidden = index !== next; });
    const [back, forward] = media.querySelectorAll('.' + H.carouselArrow);
    back.hidden = next === 0; forward.hidden = next === slides.length - 1;
  } else if (label === 'Load more comments') {
    const list = control.closest('ul');
    if (!hydratedLists.has(list)) { hydratedLists.add(list); return; }
    const item = control.closest('li');
    const offset = commentOffsets.get(list) || 12;
    item.innerHTML = '<div class="' + C.skeleton + '"></div><div class="' + C.skeleton + '" style="width:70%"></div><div class="' + C.skeleton + '" style="width:40%"></div>';
    const [response] = await Promise.all([fetch(ROOT + 'p/' + codeOf(scope) + '/comments?offset=' + offset), wait(450)]);
    const html = await response.text();
    item.remove();
    list.insertAdjacentHTML('beforeend', html);
    commentOffsets.set(list, offset + 12);
  } else if (control.classList.contains(H.repliesToggle)) {
    const holder = control.nextElementSibling;
    if (holder.children.length > 0) { holder.innerHTML = ''; control.textContent = 'View replies (' + replyCounts.get(control) + ')'; return; }
    const permalink = control.parentElement.querySelector('a[href*="/c/"]').getAttribute('href');
    const count = control.textContent.match(/\d+/)[0];
    holder.innerHTML = '<li class="' + C.skeleton + '"></li>';
    const [response] = await Promise.all([fetch(permalink + 'replies'), wait(350)]);
    holder.innerHTML = await response.text();
    control.textContent = 'Hide replies';
    replyCounts.set(control, count);
  } else if (control.classList.contains(H.more)) {
    const hidden = control.parentElement.querySelector('span[hidden]');
    if (hidden) hidden.hidden = false;
    control.previousSibling && control.previousSibling.nodeType === 3 && (control.previousSibling.textContent = ' ');
    control.remove();
  } else if (control.classList.contains(H.postButton)) {
    if (control.getAttribute('aria-disabled') === 'true') return;
    toast('Couldn\'t post comment. Try again later.');
  }
});

document.addEventListener('input', (event) => {
  const box = event.target.closest && event.target.closest('.' + H.composer + ' textarea');
  if (!box) return;
  box.closest('form').querySelector('.' + H.postButton).setAttribute('aria-disabled', String(box.value.trim() === ''));
});
`;
