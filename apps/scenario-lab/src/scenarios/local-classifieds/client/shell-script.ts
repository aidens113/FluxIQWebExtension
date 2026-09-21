/**
 * What every page does in the browser, before its own script runs.
 *
 * The class names arrive as data (`cfg.k` is each role's styling hash,
 * `cfg.n` the full class attribute), the same arrangement a real bundle has
 * with the markup its build emitted; the script finds its own elements by
 * them and never by a test id or an authored id.
 *
 * `settled` resolves once nothing the site put in front of the page is still
 * waiting for an answer: the cookie question, and in the `location-check`
 * rendering the location question after it. Everything the site does on a
 * timer -- the notification prompt, the chat window -- counts from then.
 */
export const SHELL_SCRIPT = String.raw`
const k = cfg.k;
const n = cfg.n;
const root = cfg.root;
function $(role, scope) { return (scope || document).querySelector('.' + k[role]); }
function $$(role, scope) { return Array.from((scope || document).querySelectorAll('.' + k[role])); }
function el(tag, role, attributes, html) {
  const node = document.createElement(tag);
  if (role) node.className = n[role];
  for (const [name, value] of Object.entries(attributes || {})) node.setAttribute(name, value);
  if (html !== undefined) node.innerHTML = html;
  return node;
}
function esc(text) { return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function onActivate(node, handler) {
  node.addEventListener('click', handler);
  node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handler(event); } });
}
function byText(scope, role, text) { return $$(role, scope).find((node) => node.textContent.trim() === text); }
function toast(text, ms) {
  const region = $('toastRegion');
  const item = el('div', 'toast');
  item.textContent = text;
  region.append(item);
  setTimeout(() => item.remove(), ms || 4000);
}

let settle;
const settled = new Promise((resolve) => { settle = resolve; });

function askLocation() {
  const prompt = document.querySelector('[data-testid="marketplace_location_prompt"]');
  if (!prompt) { settle(); return; }
  prompt.hidden = false;
  onActivate(byText(prompt, 'buttonPrimary', "Yes, that's right"), async () => {
    await mutate('location-check', { choice: 'confirm' });
    prompt.remove();
    settle();
  });
  onActivate(byText(prompt, 'buttonPlain', 'Change location'), async () => {
    await mutate('location-check', { choice: 'change' });
    prompt.remove();
    settle();
    const picker = document.querySelector('kf-location');
    if (picker) picker.dispatchEvent(new CustomEvent('kf-open'));
  });
}

(function consent() {
  const dialog = $$('dialogTitle').find((node) => node.textContent.startsWith('Allow the use of cookies'));
  if (!dialog) { askLocation(); return; }
  const scrim = dialog.closest('.' + k.scrim);
  const answer = async (choice) => {
    await mutate('consent', { choice });
    scrim.remove();
    askLocation();
  };
  onActivate(byText(scrim, 'buttonPlain', 'Decline optional cookies'), () => answer('essential'));
  onActivate(byText(scrim, 'buttonPrimary', 'Allow all cookies'), () => answer('all'));
})();

$('topSearchInput').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !event.target.value.trim()) return;
  location.href = root + 'people/?' + new URLSearchParams({ q: event.target.value.trim() });
});
$('sideSearchInput').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !event.target.value.trim()) return;
  const params = new URLSearchParams({ query: event.target.value.trim() });
  const radius = new URLSearchParams(location.search).get('radius');
  if (radius) params.set('radius', radius);
  location.href = root + 'search/?' + params;
});
onActivate($('createButton'), () => toast('Selling is paused on your account while we verify your details.'));

function promptForNotifications() {
  if (cfg.session.notificationPrompt !== 'pending') return;
  settled.then(() => delay(cfg.timing.notifyDelay)).then(() => {
    const scrim = el('div', 'scrim');
    const dialog = el('div', 'dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': cfg.ids.notifyTitle });
    dialog.innerHTML = '<h2 class="' + n.dialogTitle + '" id="' + cfg.ids.notifyTitle + '">Turn on notifications?</h2>'
      + '<div class="' + n.dialogBody + '"><p>Get notified when sellers reply to you and when new listings match your searches.</p></div>'
      + '<div class="' + n.dialogFoot + '"><div class="' + n.buttonPlain + '" role="button" tabindex="0">Not now</div><div class="' + n.buttonPrimary + '" role="button" tabindex="0">Turn on</div></div>';
    scrim.append(dialog);
    document.body.append(scrim);
    const close = async (choice) => { scrim.remove(); await mutate('notifications', { choice }); };
    onActivate(byText(dialog, 'buttonPlain', 'Not now'), () => close('not-now'));
    onActivate(byText(dialog, 'buttonPrimary', 'Turn on'), () => close('turn-on'));
  });
}
`;
