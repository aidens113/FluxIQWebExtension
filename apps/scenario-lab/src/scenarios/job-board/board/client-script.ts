/**
 * What every Rolefinch page does in the browser, switched on `CONFIG.kind`.
 *
 * The page defends itself the way a real one behaves under a real pointer:
 * while the consent banner is open it ignores every click, key press and
 * submit made outside the banner, and at any time a click on a control whose
 * centre is covered by something else -- the job-alert offer, the chat
 * panel, the sign-in wall -- is dropped, whether it came from a mouse or from
 * a script calling `click()`. A control scrolled out of view is not covered;
 * only one with something on top of it is.
 *
 * The board's real bugs, all deterministic:
 * - the first save of each page load fails with "Couldn't save this job. Try
 *   again." and saves nothing; the second press works;
 * - the second job pane opened on a page never finishes loading until its
 *   Retry link is pressed;
 * - the header's My jobs badge is never updated after a save;
 * - past page one, the pager's Next points at the page it is on.
 *
 * Expects `CONFIG` and `mutate` in scope.
 */
export function boardClientScript(): string {
  return `
const css = CONFIG.css;
const cls = (name) => '.' + css[name];
const $ = (selector, root) => (root || document).querySelector(selector);
const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
const saved = new Set(CONFIG.saved);
const follows = new Set(CONFIG.follows);
let consentHost = null;
if (CONFIG.consent === 'pending') {
  consentHost = document.createElement('rf-consent');
  document.body.appendChild(consentHost);
  window.addEventListener('rf-consent-answered', () => { consentHost = null; });
}
document.body.appendChild(document.createElement('rf-assistant'));

const consentOpen = () => consentHost !== null && consentHost.isConnected;
const PROTECTED = ['a', 'button', 'select', 'input', 'textarea', 'label', cls('heart'), cls('moreButton'), cls('menuItem'), cls('card'), cls('pill')].join(',');
function reachable(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return true;
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true;
  const top = document.elementFromPoint(x, y);
  return top !== null && (top === element || element.contains(top));
}
document.addEventListener('click', (event) => {
  if (consentOpen()) {
    if (!event.composedPath().includes(consentHost)) { event.preventDefault(); event.stopImmediatePropagation(); }
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  const control = target && target.closest(PROTECTED);
  if (control && !reachable(control)) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
document.addEventListener('keydown', (event) => {
  if (consentOpen() && !event.composedPath().includes(consentHost) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
document.addEventListener('submit', (event) => { if (consentOpen()) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);

let toastTimer = 0;
function toast(text, action) {
  let element = $(cls('toast'));
  if (!element) { element = document.createElement('div'); element.className = css.toast; element.setAttribute('role', 'status'); document.body.appendChild(element); }
  element.textContent = '';
  const message = document.createElement('span');
  message.textContent = text;
  element.appendChild(message);
  if (action) { const link = document.createElement('a'); link.className = css.toastAction; link.href = action.href; link.textContent = action.label; element.appendChild(link); }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.remove(), 4000);
}

function keyOf(element) {
  const holder = element.closest('[data-jk],[data-ad]');
  if (!holder) return null;
  if (holder.getAttribute('data-jk')) return holder.getAttribute('data-jk');
  return (CONFIG.ads || {})[holder.getAttribute('data-ad')] || null;
}
const companyOf = (key) => (CONFIG.companies || {})[key] || null;
function paintHearts() {
  $$(cls('heart')).forEach((heart) => {
    const key = keyOf(heart);
    if (!key) return;
    const followsCompany = CONFIG.kind !== 'myjobs' && CONFIG.mode === 'overflow-save';
    heart.classList.toggle(css.heartOn, followsCompany ? follows.has(companyOf(key)) : saved.has(key));
  });
  $$(cls('menu')).forEach((menu) => {
    const key = keyOf(menu);
    if (key && menu.firstElementChild) menu.firstElementChild.textContent = saved.has(key) ? 'Unsave job' : 'Save job';
  });
}

let saveAttempted = false;
async function toggleSave(key, busy) {
  if (!key) return;
  const saving = !saved.has(key);
  if (saving && !saveAttempted) {
    saveAttempted = true;
    if (busy) busy.classList.add(css.heartBusy);
    setTimeout(() => { if (busy) busy.classList.remove(css.heartBusy); toast("Couldn't save this job. Try again."); }, 500);
    return;
  }
  toast(saving ? 'Saving\u2026' : 'Removing\u2026');
  try { await mutate(saving ? 'save' : 'unsave', { key }); } catch (error) { console.warn('save failed', error); toast("Couldn't save this job. Try again."); return; }
  if (saving) saved.add(key); else saved.delete(key);
  paintHearts();
  toast(saving ? 'Job saved' : 'Removed from saved jobs', saving ? { href: '/scenarios/job-board/myjobs', label: 'View saved jobs' } : null);
}
async function toggleFollow(company) {
  if (!company) return;
  const following = !follows.has(company);
  try { await mutate(following ? 'follow' : 'unfollow', { company }); } catch (error) { console.warn('follow failed', error); return; }
  if (following) follows.add(company); else follows.delete(company);
  paintHearts();
  toast(following ? "You're now following " + company : 'You unfollowed ' + company);
}

let paneLoads = 0;
let currentKey = null;
function skeleton() {
  return '<div class="' + css.skeleton + '">' + [70, 45, 55, 90, 85, 60, 92, 40].map((width) => '<div class="' + css.skeletonLine + '" style="width:' + width + '%"></div>').join('') + '</div>';
}
async function openPane(key) {
  const pane = $(cls('pane'));
  if (!key || !pane) return;
  currentKey = key;
  paneLoads += 1;
  const load = paneLoads;
  pane.innerHTML = skeleton();
  const url = new URL(location.href);
  url.searchParams.set('vjk', key);
  history.replaceState(null, '', url);
  const started = Date.now();
  if (load === 2) {
    setTimeout(() => { if (paneLoads === load) pane.innerHTML = '<div class="' + css.slow + '"><p>This is taking longer than usual.</p><a href="#">Retry</a></div>'; }, 3000);
    return;
  }
  let html = '';
  try {
    const response = await fetch('/scenarios/job-board/pane?jk=' + encodeURIComponent(key));
    if (!response.ok) throw new Error('pane answered ' + response.status);
    html = await response.text();
  } catch (error) {
    console.warn('job pane failed', error);
    pane.innerHTML = '<div class="' + css.slow + '"><p>We could not load this job.</p><a href="#">Retry</a></div>';
    return;
  }
  setTimeout(() => { if (paneLoads === load) { pane.innerHTML = html; paintHearts(); } }, Math.max(0, 700 - (Date.now() - started)));
}

document.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const heart = target.closest(cls('heart'));
  if (heart) {
    event.preventDefault();
    event.stopPropagation();
    const key = keyOf(heart);
    if (CONFIG.kind === 'myjobs' || CONFIG.mode !== 'overflow-save') toggleSave(key, heart); else toggleFollow(companyOf(key));
    return;
  }
  const more = target.closest(cls('moreButton'));
  if (more) { const menu = more.nextElementSibling; if (menu) menu.hidden = !menu.hidden; return; }
  const item = target.closest(cls('menuItem'));
  if (item) {
    const menu = item.parentElement;
    const index = Array.from(menu.children).indexOf(item);
    menu.hidden = true;
    if (index === 0) toggleSave(keyOf(item), null);
    else if (index === 1) toast("We'll show you fewer jobs like this");
    else toast('Thanks. Our team will review this job.');
    return;
  }
  const pill = target.closest(cls('pill'));
  if (pill) {
    const menu = pill.nextElementSibling;
    const wasHidden = menu.hidden;
    $$(cls('pillMenu')).forEach((other) => { other.hidden = true; });
    menu.hidden = !wasHidden;
    return;
  }
  if (!target.closest(cls('pillMenu'))) $$(cls('pillMenu')).forEach((menu) => { menu.hidden = true; });
  if (target.closest(cls('easyButton'))) { toast('Sign in to apply with your Rolefinch profile.'); return; }
  if (target.closest(cls('wallButton'))) { toast('Signing in is not available right now. Please try again later.'); return; }
  if (target.closest(cls('wallLater'))) {
    event.preventDefault();
    try { await mutate('dismiss-wall'); } catch (error) { console.warn('wall state was not recorded', error); }
    openPane(currentKey);
    return;
  }
  if (target.closest(cls('slow') + ' a')) { event.preventDefault(); openPane(currentKey); return; }
  if (CONFIG.kind !== 'results') return;
  const card = target.closest('article');
  if (!card || !card.closest(cls('list'))) return;
  if (target.closest('a') && (event.ctrlKey || event.metaKey || event.shiftKey)) return;
  event.preventDefault();
  $$(cls('cardSelected')).forEach((selected) => selected.classList.remove(css.cardSelected));
  card.classList.add(css.cardSelected);
  openPane(keyOf(card));
});

const limit = $('select[name="limit"]');
if (limit) limit.addEventListener('change', () => { const href = (CONFIG.limitHrefs || {})[limit.value]; if (href && !consentOpen()) location.assign(href); });

function showAlertOffer() {
  if ($(cls('backdrop'))) return;
  const backdrop = document.createElement('div');
  backdrop.className = css.backdrop;
  backdrop.innerHTML = '<div class="' + css.modal + '"><div class="' + css.modalClose + '">\\u00d7</div><h2>Never miss a new job</h2><p></p>'
    + '<input class="' + css.modalInput + '" type="email" placeholder="Email address"><button type="button" class="' + css.modalButton + '">Get job alerts</button>'
    + '<a href="#" class="' + css.modalLater + '">No thanks</a></div>';
  backdrop.querySelector('p').textContent = 'Get new ' + (CONFIG.words ? '\\u201c' + CONFIG.words + '\\u201d ' : '') + 'jobs sent to your inbox every morning.';
  document.body.appendChild(backdrop);
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  const close = async () => {
    document.removeEventListener('keydown', onKey, true);
    try { await mutate('dismiss-alert-offer'); } catch (error) { console.warn('offer state was not recorded', error); }
    backdrop.remove();
  };
  document.addEventListener('keydown', onKey, true);
  backdrop.querySelector(cls('modalClose')).addEventListener('click', close);
  backdrop.querySelector(cls('modalLater')).addEventListener('click', (event) => { event.preventDefault(); close(); });
  backdrop.querySelector(cls('modalButton')).addEventListener('click', async () => {
    const email = backdrop.querySelector('input').value.trim();
    if (!email) return;
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    try { await mutate('subscribe-alert', { email }); toast('Job alert created'); } catch (error) { console.warn('alert was not created', error); }
  });
}
if (CONFIG.kind === 'results' && !CONFIG.alertOfferDismissed) setTimeout(showAlertOffer, 4000);

if (CONFIG.kind === 'notice') {
  const button = $(cls('retry'));
  let left = CONFIG.retryAfter || 5;
  const tick = () => {
    left -= 1;
    if (left <= 0) { button.disabled = false; button.textContent = 'Try again'; return; }
    button.textContent = 'Try again in ' + left;
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
  button.addEventListener('click', () => location.reload());
}
paintHearts();
`;
}
