/**
 * What every page does: helpers, the one call that changes server state (and
 * rewrites the oracle scripts from what the server answered), toasts, keyboard
 * activation for the div-buttons, the navigation's panels, following and
 * messaging from a profile.
 *
 * The page finds its own controls by their style hooks, their text and their
 * icons' labels, the way a component tree holding references never needs an
 * attribute to find anything. Nothing here adds an attribute for the sake of
 * being found.
 */
export const CORE_SCRIPT = String.raw`
const H = FL.hook;
const C = FL.cls;
const ROOT = FL.root;
const app = document.querySelector('.' + H.app);
function esc(text) { return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]); }
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function icon(name, className, label) {
  const a11y = label === undefined ? 'aria-hidden="true"' : 'aria-label="' + esc(label) + '" role="img"';
  return '<svg class="' + className + '" ' + a11y + ' viewBox="0 0 24 24" width="24" height="24"><path d="' + GLYPHS[name] + '" fill="' + (name === 'badge' ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}
function labelOf(control) { const svg = control.querySelector('svg[aria-label]'); return svg ? svg.getAttribute('aria-label') : ''; }
function textOf(control) { return control.textContent.replace(/\s+/g, ' ').trim(); }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

const live = {
  consent: FL.consent, saved: new Set(FL.saved), liked: new Set(FL.liked), following: new Set(FL.following),
  collections: FL.collections.map((c) => Object.assign({}, c, { codes: c.codes.slice() })),
  blocked: FL.blocked, dockMinimized: FL.dockMinimized, sessionConfirmed: FL.sessionConfirmed, upsellDismissed: FL.upsellDismissed,
};

async function act(operation, payload) {
  const snapshot = await mutate(operation, payload || {});
  const s = snapshot.state;
  for (const key of Object.keys(FL.relay)) {
    const node = document.querySelector('script[data-testid="' + FL.relay[key] + '"]');
    if (node) node.textContent = s.relay[key];
  }
  live.consent = s.consent; live.saved = new Set(s.saved); live.liked = new Set(s.liked); live.following = new Set(s.following);
  live.blocked = s.blocked; live.dockMinimized = s.dockMinimized; live.sessionConfirmed = s.sessionConfirmed; live.upsellDismissed = s.upsellDismissed;
  for (const c of s.collections) {
    const known = live.collections.find((entry) => entry.slug === c.slug);
    if (known) known.codes = c.codes.slice();
    else live.collections.push({ name: c.name, slug: c.slug, codes: c.codes.slice(), count: c.codes.length, cover: '' });
  }
  live.collections = live.collections.filter((entry) => s.collections.some((c) => c.slug === entry.slug));
  return s;
}

function toast(text, ms) {
  const node = el('<div class="' + C.toast + '" role="status">' + esc(text) + '</div>');
  document.body.appendChild(node);
  setTimeout(() => node.remove(), ms || 4000);
}

function scrim(inner) {
  const node = el('<div class="' + C.scrim + '">' + inner + '</div>');
  document.body.appendChild(node);
  return node;
}

// Div-buttons answer Enter and Space as buttons do.
document.addEventListener('keydown', (event) => {
  const target = event.target.closest && event.target.closest('[role="button"],[role="link"],[role="checkbox"]');
  if (!target || target.isContentEditable) return;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); target.click(); }
});

function handleFromLink(scope) {
  for (const link of scope.querySelectorAll('a[href^="' + ROOT + '"]')) {
    const match = link.getAttribute('href').slice(ROOT.length).match(/^([a-z0-9._]+)\/$/);
    if (match && !['explore', 'reels', 'direct', 'p', 'l', 'accounts'].includes(match[1])) return match[1];
  }
  return FL.page.handle;
}

// Follow, unfollow, and Message on a profile.
document.addEventListener('click', async (event) => {
  const control = event.target.closest('[role="button"], button');
  if (!control || control.closest('fl-dock')) return;
  const text = textOf(control);
  if (text === 'Follow') {
    const scope = control.closest('article, header, .' + H.railRow + ', .' + H.tile) || document;
    const handle = handleFromLink(scope);
    if (!handle) return;
    await act('follow', { handle, following: true });
    control.textContent = 'Following';
  } else if (text === 'Following') {
    const scope = control.closest('article, header, .' + H.railRow + ', .' + H.tile) || document;
    const handle = handleFromLink(scope);
    const box = scrim('<div class="' + C.dialog + '" role="dialog" aria-modal="true"><div class="' + C.dialogBody + '" style="text-align:center"><p>Unfollow @' + esc(handle) + '?</p><div role="button" tabindex="0" class="' + C.secondary + '" style="color:#ed4956">Unfollow</div><div role="button" tabindex="0" class="' + C.secondary + '">Cancel</div></div></div>');
    box.addEventListener('click', async (inner) => {
      const choice = inner.target.closest('[role="button"]');
      if (!choice && inner.target !== box) return;
      if (choice && textOf(choice) === 'Unfollow') { await act('follow', { handle, following: false }); control.textContent = 'Follow'; }
      box.remove();
    });
  } else if (text === 'Message' && FL.page.kind === 'profile') {
    location.href = ROOT + 'direct/t/' + FL.page.handle + '/';
  }
});

// The navigation's panels: Search, Notifications, Create and More are divs, not links.
let panel = null;
function closePanel() { if (panel) { panel.remove(); panel = null; } }
let searchTimer = 0;
async function runSearch(query, results) {
  const response = await fetch(ROOT + 'explore/search?q=' + encodeURIComponent(query));
  results.innerHTML = await response.text();
}
document.addEventListener('click', (event) => {
  const item = event.target.closest('.' + H.nav + ' [role="link"]');
  if (!item) { if (panel && !event.target.closest('.' + H.search) && !event.target.closest('[role="menu"]')) closePanel(); return; }
  const name = labelOf(item);
  const was = panel && panel.getAttribute('aria-label');
  closePanel();
  if (was === name) return;
  if (name === 'Search') {
    panel = el('<div class="' + C.search + '" aria-label="Search"><h2 style="padding:0 24px;margin:8px 0 0">Search</h2><input class="' + C.searchInput + '" type="text" placeholder="Search" aria-label="Search input" autocomplete="off"><div></div></div>');
    document.body.appendChild(panel);
    const input = panel.querySelector('input');
    const results = panel.querySelector('div');
    runSearch('', results);
    input.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(input.value, results), 350); });
    input.focus();
  } else if (name === 'More') {
    panel = el('<div role="menu" aria-label="More" class="' + C.popover + '" style="position:fixed;left:12px;bottom:72px;right:auto;display:grid;gap:4px"><a role="menuitem" href="' + ROOT + FL.viewer + '/saved/">Saved</a><a role="menuitem" href="' + ROOT + 'accounts/edit/">Settings</a><a role="menuitem" href="' + ROOT + 'accounts/login/">Log out</a></div>');
    document.body.appendChild(panel);
  } else if (name === 'Notifications') {
    panel = el('<div class="' + C.search + '" aria-label="Notifications"><h2 style="padding:0 24px">Notifications</h2><p style="padding:0 24px">kiln.theory liked your photo. 2d</p><p style="padding:0 24px">lena.moss started following you. 1w</p></div>');
    document.body.appendChild(panel);
  } else if (name === 'Create') {
    const box = scrim('<div class="' + C.dialog + '" role="dialog" aria-modal="true"><div class="' + C.dialogHead + '">Create new post</div><div class="' + C.dialogBody + '" style="text-align:center"><p>Drag photos and videos here</p><div role="button" tabindex="0" class="' + C.primary + '">Select from computer</div></div></div>');
    box.addEventListener('click', (inner) => { if (inner.target === box) box.remove(); });
  }
});

// The app banner's close control has no name, only an icon.
const banner = document.querySelector('.' + H.banner);
if (banner) banner.querySelector('[role="button"]').addEventListener('click', () => banner.remove());
`;
