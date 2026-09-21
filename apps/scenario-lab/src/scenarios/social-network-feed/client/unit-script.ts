/**
 * What a feed unit does wherever it appears -- the home feed, a group's
 * discussion, a post's own page. Everything is wired by delegation from the
 * document, because units keep arriving after the page loads.
 *
 * - "See more" puts the rest of a long post back. The rest is not in the
 *   document until then: it lives in the script's own data, as a real client
 *   keeps it, and the message is rendered again with a new id.
 * - The post menu is built on demand. Maya's boosted post refuses Edit post,
 *   Edit audience and Move to archive, each with the reason; Move to trash
 *   asks for confirmation and then removes the post for good.
 * - Share opens a menu whose first item, "Share now (Friends)", publishes on
 *   the spot, as the real one does.
 */
export const UNIT_SCRIPT = String.raw`
const articleOf = (node) => node.closest('[role="article"]');
function postIdOf(article) {
  for (const link of article.querySelectorAll('a[href*="/posts/"]')) {
    if (link.closest('.' + cls('sharedBox'))) continue;
    const match = /\/posts\/([a-z0-9_]+)\//.exec(link.getAttribute('href') || '');
    if (match) return match[1];
  }
  return null;
}
function ownerOf(article) {
  const link = article.querySelector('h3 a');
  const match = link && /\/people\/([^/]+)\//.exec(link.getAttribute('href') || '');
  return match ? match[1] : null;
}
function authorNameOf(article) {
  const link = article.querySelector('h3 a');
  return link ? link.textContent.trim() : '';
}
let openMenu = null;
function closeMenu() {
  if (!openMenu) return;
  openMenu.button.setAttribute('aria-expanded', 'false');
  openMenu.node.remove();
  openMenu = null;
}
function showMenu(button, items) {
  closeMenu();
  const html = '<div class="' + C.menu + '" role="menu">' + items.map((item) =>
    '<div class="' + C.menuItem + (item.disabled ? ' ' + C.menuItemDisabled : '') + '" role="menuitem" tabindex="-1"' + (item.disabled ? ' aria-disabled="true"' : '') + '>' + esc(item.label) + (item.note ? '<span class="' + C.menuNote + '">' + esc(item.note) + '</span>' : '') + '</div>').join('') + '</div>';
  const [node] = fromHtml(html);
  const box = button.getBoundingClientRect();
  node.style.top = (box.bottom + window.scrollY + 4) + 'px';
  node.style.left = Math.max(8, box.right + window.scrollX - 344) + 'px';
  document.body.appendChild(node);
  button.setAttribute('aria-expanded', 'true');
  qa('menuItem', node).forEach((entry, index) => onPress(entry, (event) => {
    event.stopPropagation();
    const item = items[index];
    if (item.disabled) return;
    closeMenu();
    item.run();
  }));
  openMenu = { node, button };
}
document.addEventListener('click', (event) => { if (openMenu && !openMenu.node.contains(event.target) && !openMenu.button.contains(event.target)) closeMenu(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

function postMenu(article, button) {
  const id = postIdOf(article);
  const boosted = CFG.boosted.includes(id);
  if (ownerOf(article) === CFG.me) {
    const boostNote = 'Boosted posts can\'t be ';
    showMenu(button, [
      { label: 'Pin post', run: () => toast('Post pinned to your profile.') },
      { label: 'Save post', run: () => toast('Post saved.') },
      { label: 'Edit post', disabled: boosted, note: boosted ? boostNote + 'edited. To change what it says, move it to your trash and create a new post.' : '', run: () => toast('Editing is not available for this post.') },
      { label: 'Edit audience', disabled: boosted, note: boosted ? boostNote + 'given a different audience.' : '', run: () => toast('Audience updated.') },
      { label: 'Turn off notifications for this post', run: () => toast('Notifications turned off for this post.') },
      { label: 'Move to archive', disabled: boosted, note: boosted ? boostNote + 'archived while the boost is running.' : '', run: () => toast('Archiving is not available for this post.') },
      { label: 'Move to trash', run: () => confirmTrash(article, id, boosted) },
    ]);
    return;
  }
  const name = authorNameOf(article);
  const first = name.split(' ')[0];
  showMenu(button, [
    { label: 'Save post', run: () => toast('Post saved.') },
    { label: 'Hide post', run: () => hidePost(article) },
    { label: 'Snooze ' + first + ' for 30 days', run: () => toast('You won\'t see posts from ' + name + ' for 30 days.') },
    { label: 'Unfollow ' + name, run: () => toast('You\'ll no longer see posts from ' + name + ' in Feed.') },
    { label: 'Report post', run: () => toast('Thanks, we\'ll take a look.') },
  ]);
}
function confirmTrash(article, id, boosted) {
  const scrim = mount(dialogHtml('Move to your trash?', '<p style="margin:0">Items in your trash will be automatically deleted after 30 days. You can delete them from your trash earlier by going to your activity log.</p>' + (boosted ? '<p class="' + C.muted + '" style="margin:0">This post is being boosted. Moving it to your trash will stop the boost.</p>' : ''), '<div class="' + C.secondaryButton + '" role="button" tabindex="0">Cancel</div><div class="' + C.primaryButton + '" role="button" tabindex="0">Move</div>', { close: true }));
  onPress(q('secondaryButton', scrim), () => scrim.remove());
  onPress(q('dialogClose', scrim), () => scrim.remove());
  onPress(q('primaryButton', scrim), async () => {
    scrim.remove();
    await mutate('trash-post', { id });
    article.remove();
    toast('Post moved to your trash.');
  });
}
function hidePost(article) {
  const id = postIdOf(article) || article.getAttribute('aria-posinset');
  const kept = Array.from(article.childNodes);
  article.replaceChildren(...fromHtml('<div class="' + C.contextBar + '" style="border:0;margin:0;padding:16px"><span>Hidden. Hiding posts helps Circleway personalise your Feed.</span><div class="' + C.secondaryButton + '" role="button" tabindex="0">Undo</div></div>'));
  mutate('hide-post', { id });
  onPress(q('secondaryButton', article), () => { article.replaceChildren(...kept); mutate('unhide-post', { id }); });
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const article = articleOf(target);
  const seeMore = target.closest('.' + cls('seeMore'));
  if (seeMore && article) {
    const message = seeMore.closest('.' + cls('message'));
    const id = postIdOf(article);
    const whole = id && CFG.texts[id];
    if (!message || !whole) return;
    const fresh = document.createElement('div');
    fresh.className = message.className;
    fresh.setAttribute('dir', 'auto');
    fresh.setAttribute('data-ad-comet-preview', 'message');
    fresh.textContent = whole;
    fresh.id = ':r' + (idSeq++).toString(36) + ':';
    message.replaceWith(fresh);
    if (article.getAttribute('aria-describedby') === message.id) article.setAttribute('aria-describedby', fresh.id);
    return;
  }
  const menuButton = target.closest('.' + cls('unitMenu'));
  if (menuButton && article) { event.stopPropagation(); postMenu(article, menuButton); return; }
  const hide = target.closest('.' + cls('unitHide'));
  if (hide && article && !target.closest('.' + cls('chat'))) { hidePost(article); return; }
  const action = target.closest('.' + cls('action'));
  if (action && article) {
    const label = action.getAttribute('aria-label');
    const id = postIdOf(article);
    if (label === 'Like' || label === 'Remove Like') {
      const liked = label === 'Like';
      action.setAttribute('aria-label', liked ? 'Remove Like' : 'Like');
      action.classList.toggle(cls('actionActive'), liked);
      if (id) mutate('like', { id });
    } else if (label === 'Leave a comment') {
      toast('Comments are loading...');
    } else if (id) {
      showMenu(action, [
        { label: 'Share now (Friends)', run: () => { mutate('share-post', { id }); toast('Shared to your profile.'); } },
        { label: 'Send in Messenger', run: () => toast('Choose who to send it to.') },
        { label: 'Share to a group', run: () => toast('Choose a group.') },
        { label: 'Copy link', run: () => toast('Link copied.') },
      ]);
      event.stopPropagation();
    }
    return;
  }
  const count = target.closest('.' + cls('countButton'));
  if (count && count.hasAttribute('aria-expanded')) {
    const open = count.getAttribute('aria-expanded') !== 'true';
    count.setAttribute('aria-expanded', String(open));
    const existing = article && q('memoryCard', article);
    if (!open && existing) existing.remove();
    if (open && article) article.appendChild(fromHtml('<div class="' + C.memoryCard + '"><p style="margin:0" class="' + C.muted + '">Most relevant comments are shown first.</p></div>')[0]);
    return;
  }
  const add = target.closest('.' + cls('secondaryButton'));
  if (add && add.getAttribute('aria-label') === 'Add friend') {
    const card = add.closest('.' + cls('carouselCard')) || add.closest('.' + cls('requestCard'));
    const link = card && card.querySelector('a[href*="/people/"]:not([aria-hidden])');
    const match = link && /\/people\/([^/]+)\//.exec(link.getAttribute('href') || '');
    if (match) mutate('add-friend', { person: match[1] });
    add.setAttribute('aria-label', 'Cancel request');
    add.textContent = 'Request sent';
    return;
  }
  const join = target.closest('.' + cls('joinButton'));
  if (join && article) { toast(join.textContent === 'Follow' ? 'You\'re now following this page.' : 'Your request to join has been sent.'); return; }
});
`;
