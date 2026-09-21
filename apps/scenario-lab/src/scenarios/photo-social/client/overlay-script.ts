/**
 * Everything that gets in the way, in the order a visitor meets it.
 *
 * 1. The cookie dialog, server-rendered while consent is unanswered, over a
 *    scrim that takes every click.
 * 2. Once it is answered: the messages dock, a web component with its own
 *    shadow root, which appears collapsed in the bottom right corner and
 *    expands by itself a moment later to show a message preview -- until the
 *    visitor collapses it once, which the account remembers. Its collapse
 *    control is an unnamed icon inside the shadow root.
 * 3. On the home feed, a notifications prompt a little after that, which
 *    makes the page inert until it is answered.
 * 4. Under `verified-upsell`, a subscription upsell over any post, a little
 *    after it opens, which also makes the page inert.
 */
export const OVERLAY_SCRIPT = String.raw`
const DOCK_APPEARS_MS = 300;
const DOCK_EXPANDS_MS = 1500;
const NOTIFICATIONS_MS = 1200;
const UPSELL_MS = 1500;

function blockingDialog(inner) {
  if (app) app.inert = true;
  const node = scrim(inner);
  return () => { node.remove(); if (!document.querySelector('.' + H.scrim)) { if (app) app.inert = false; } };
}

class FlDock extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.expanded = false;
  }
  connectedCallback() {
    this.style.cssText = 'position:fixed;right:16px;bottom:0;z-index:50;display:block';
    this.render();
    this.shadow.addEventListener('click', (event) => this.onClick(event));
  }
  render() {
    const style = '<style>:host{font:14px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;color:#0f1419}' +
      '[part~="pill"]{display:flex;align-items:center;gap:10px;width:300px;height:48px;box-sizing:border-box;padding:0 16px;border-radius:24px 24px 0 0;background:#fff;box-shadow:0 0 18px rgba(0,0,0,.18);cursor:pointer}' +
      '[part~="panel"]{display:flex;flex-direction:column;width:380px;height:min(460px,70vh);border-radius:16px 16px 0 0;background:#fff;box-shadow:0 0 22px rgba(0,0,0,.22)}' +
      'header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;font-weight:600;border-bottom:1px solid #efefef}' +
      '[part~="collapse-button"]{cursor:pointer;width:24px;height:24px}ul{list-style:none;margin:0;padding:6px 0;overflow:auto}li a{display:flex;gap:10px;padding:10px 16px;color:inherit;text-decoration:none}' +
      '.dot{width:28px;height:28px;border-radius:50%;display:inline-block;flex:none}small{color:#737373;display:block}</style>';
    const dot = (hue) => '<span class="dot" style="background:hsl(' + hue + ',55%,62%)"></span>';
    if (!this.expanded) {
      this.shadow.innerHTML = style + '<div part="pill" role="button" tabindex="0">' + dot(150) + dot(120) + dot(40) + '<span>Messages</span>' + icon('chevronUp', '', undefined) + '</div>';
      return;
    }
    this.shadow.innerHTML = style + '<section part="panel"><header><span>Messages</span><div part="collapse-button" role="button" tabindex="0">' + icon('chevronDown', '', undefined) + '</div></header><ul>' +
      '<li><a href="' + ROOT + 'direct/t/lena.moss/">' + dot(120) + '<span>Lena Moss<small>Are you going to the seconds sale on Saturday?</small></span></a></li>' +
      '<li><a href="' + ROOT + 'direct/t/saltmarsh.goods/">' + dot(150) + '<span>Saltmarsh Goods<small>Thanks for following! New pieces drop most Fridays.</small></span></a></li>' +
      '<li><a href="' + ROOT + 'direct/t/kofi.ade/">' + dot(40) + '<span>Kofi Ade<small>Thank you!! First one that didn\'t collapse</small></span></a></li></ul></section>';
  }
  expand() { this.expanded = true; this.render(); }
  async onClick(event) {
    const part = event.target.closest('[part]');
    if (!part) return;
    if (part.getAttribute('part') === 'pill') this.expand();
    else if (part.getAttribute('part') === 'collapse-button') {
      this.expanded = false;
      this.render();
      await act('dock', { minimized: true });
    }
  }
}
customElements.define('fl-dock', FlDock);

function startDock() {
  if (!FL.dock) return;
  setTimeout(() => {
    const dock = document.createElement('fl-dock');
    document.body.appendChild(dock);
    if (!live.dockMinimized) setTimeout(() => { if (!live.dockMinimized) dock.expand(); }, DOCK_EXPANDS_MS);
  }, DOCK_APPEARS_MS);
}

function startNotifications() {
  if (FL.page.kind !== 'home' || FL.notificationsAnswered) return;
  setTimeout(() => {
    const close = blockingDialog('<div class="' + C.dialog + '" role="dialog" aria-modal="true" aria-labelledby="' + FL.ids.notify + '"><div class="' + C.dialogBody + '" style="text-align:center;padding:28px">' + icon('heart', C.avatarLarge, undefined) + '<h2 id="' + FL.ids.notify + '" style="margin:0;font-size:20px">Turn on Notifications</h2><p class="' + C.meta + '">Know right away when people follow you or like and comment on your photos.</p><button type="button" class="' + C.primary + '">Turn On</button><button type="button" class="' + C.secondary + '" style="border:0">Not Now</button></div></div>');
    for (const button of document.querySelectorAll('[aria-labelledby="' + FL.ids.notify + '"] button')) {
      button.addEventListener('click', async () => { await act('notifications', { choice: textOf(button) === 'Turn On' ? 'on' : 'not-now' }); close(); });
    }
  }, NOTIFICATIONS_MS);
}

let upsellShown = false;
window.flUpsell = function () {
  if (FL.mode !== 'verified-upsell' || live.upsellDismissed || upsellShown || live.consent === 'pending') return;
  upsellShown = true;
  setTimeout(() => {
    if (live.upsellDismissed) return;
    const close = blockingDialog('<div class="' + C.upsell + '" role="dialog" aria-modal="true" aria-labelledby="' + FL.ids.upsell + '">' + icon('badge', C.avatarLarge, undefined) + '<h2 id="' + FL.ids.upsell + '" style="margin:0">Get verified on Framelight</h2><p>A verified badge, proactive account protection and a direct line to support. Show your followers it\'s really you.</p><p style="font-weight:600">€11.99/month</p><div role="button" tabindex="0" class="' + C.primary + '">Subscribe</div><div role="button" tabindex="0" class="' + C.secondary + '">Not now</div></div>');
    const box = document.querySelector('[aria-labelledby="' + FL.ids.upsell + '"]');
    box.addEventListener('click', async (event) => {
      const choice = event.target.closest('[role="button"]');
      if (!choice) return;
      if (textOf(choice) === 'Subscribe') { location.href = ROOT + 'verified/subscribe/'; return; }
      await act('upsell', {});
      upsellShown = false;
      close();
    });
  }, UPSELL_MS);
};

function afterConsent() {
  startDock();
  startNotifications();
  if (FL.page.kind === 'post') window.flUpsell();
}

const consentBox = document.querySelector('.' + H.consent);
if (consentBox) {
  consentBox.addEventListener('click', async (event) => {
    const choice = event.target.closest('[role="button"]');
    if (!choice) return;
    const text = textOf(choice);
    if (text === 'Manage options') {
      consentBox.querySelector('.' + H.consentActions).innerHTML = '<label><input type="checkbox"> Analytics</label><label><input type="checkbox"> Advertising</label><div role="button" tabindex="0" class="' + C.primary + '">Save choices</div>';
      return;
    }
    let answer = text === 'Allow all cookies' ? 'all' : 'essential';
    if (text === 'Save choices') answer = Array.from(consentBox.querySelectorAll('input[type="checkbox"]')).every((box) => box.checked) ? 'all' : 'essential';
    await act('consent', { choice: answer });
    consentBox.parentElement.remove();
    afterConsent();
  });
} else {
  afterConsent();
}
`;
