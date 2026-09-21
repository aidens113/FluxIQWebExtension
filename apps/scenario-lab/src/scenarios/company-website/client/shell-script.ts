import { fixtureClient } from "../../../html.js";
import type { SiteClasses } from "../styles.js";

export type ShellFlags = {
  consentPending: boolean;
  newsletterDue: boolean;
  greetingDue: boolean;
};

/** How long after a page loads the newsletter offer opens, once consent is answered. */
export const NEWSLETTER_DELAY_MS = 4_000;
/** How long after a page loads the chat widget's greeting card opens. */
export const CHAT_GREETING_DELAY_MS = 1_800;

/**
 * Every page's own script: the consent banner's buttons (the banner itself is
 * server-rendered into a declarative shadow root, as a consent platform's tag
 * would be), the newsletter offer that opens a few seconds after the visitor
 * has answered consent, the chat widget a vendor script injects into a shadow
 * root of its own, and the winter notice when the site is running one.
 *
 * `mutate` and the class names are the page's; the chat widget's classes are
 * the vendor's, hashed separately.
 */
export function shellScript(runToken: string, c: SiteClasses, chatClasses: Record<string, string>, flags: ShellFlags): string {
  return `${fixtureClient(runToken, "company-website")}
const flags = ${JSON.stringify(flags)};
const cls = ${JSON.stringify({ modalScrim: c.modalScrim, modal: c.modal, modalClose: c.modalClose, noticeModal: c.noticeModal, input: c.input, buttonPrimary: c.buttonPrimary, muted: c.muted, linkButton: c.linkButton })};
const chat = ${JSON.stringify(chatClasses)};
let consentAnswered = !flags.consentPending;
const consentHost = document.querySelector('[data-testid="cookie-consent"]');
if (consentHost && consentHost.shadowRoot) {
  consentHost.shadowRoot.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const choice = button.getAttribute('data-choice');
    if (choice === 'customise') {
      const panel = consentHost.shadowRoot.querySelector('[data-panel="purposes"]');
      if (panel) panel.hidden = !panel.hidden;
      return;
    }
    if (choice !== 'all' && choice !== 'essential') return;
    await mutate('set-consent', { choice });
    consentHost.remove();
    consentAnswered = true;
    scheduleNewsletter();
  });
}

function scheduleNewsletter() {
  if (!flags.newsletterDue) return;
  flags.newsletterDue = false;
  setTimeout(openNewsletter, ${NEWSLETTER_DELAY_MS});
}

function openNewsletter() {
  if (document.querySelector('[aria-label="Newsletter"]')) return;
  const scrim = document.createElement('div');
  scrim.className = cls.modalScrim;
  scrim.innerHTML = '<div class="' + cls.modal + '" role="dialog" aria-modal="true" aria-label="Newsletter">'
    + '<div class="' + cls.modalClose + '">&times;</div>'
    + '<h2>Get 10% off your next service</h2>'
    + '<p>Join 6,000 local households who get our seasonal reminders and offers. One email a month, never more.</p>'
    + '<label>Email address <input class="' + cls.input + '" type="email" name="newsletterEmail" autocomplete="email"></label>'
    + '<p><button type="button" class="' + cls.buttonPrimary + '" data-act="subscribe">Subscribe</button></p>'
    + '<p><span class="' + cls.linkButton + '" data-act="decline">No thanks, I will pay full price</span></p>'
    + '<p class="' + cls.muted + '">By subscribing you agree to receive marketing email from Kestrel Lane.</p></div>';
  document.body.append(scrim);
  scrim.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.closest('[data-act="subscribe"]')) {
      const email = scrim.querySelector('input').value;
      if (!email.includes('@')) return;
      await mutate('subscribe-newsletter', { email });
      scrim.remove();
      return;
    }
    if (target.closest('[data-act="decline"]') || target.classList.contains(cls.modalClose)) {
      await mutate('dismiss-newsletter', {});
      scrim.remove();
    }
  });
}

function mountChat() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483000';
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>'
    + '.' + chat.launcher + '{position:fixed;right:16px;bottom:16px;width:60px;height:60px;border-radius:50%;background:#e0762b;color:#fff;display:grid;place-items:center;font:700 13px system-ui;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}'
    + '.' + chat.greeting + '{position:fixed;right:16px;bottom:16px;width:340px;min-height:120px;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:16px 40px 16px 16px;font:14px/1.4 system-ui;color:#1f2a2e;cursor:pointer}'
    + '.' + chat.close + '{position:absolute;top:8px;right:12px;font-size:20px;color:#66767c;cursor:pointer}'
    + '.' + chat.panel + '{position:fixed;right:16px;bottom:88px;width:340px;height:420px;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:14px system-ui;display:flex;flex-direction:column}'
    + '.' + chat.panelHead + '{background:#0b3b45;color:#fff;padding:12px 16px;border-radius:14px 14px 0 0}'
    + '.' + chat.log + '{flex:1;padding:12px 16px;overflow:auto}'
    + '</style>'
    + '<div class="' + chat.launcher + '" title="Chat">Chat</div>';
  const launcher = root.querySelector('.' + chat.launcher);
  launcher.addEventListener('click', () => openPanel(root));
  if (flags.greetingDue) setTimeout(() => showGreeting(root, launcher), ${CHAT_GREETING_DELAY_MS});
}

function showGreeting(root, launcher) {
  const card = document.createElement('div');
  card.className = chat.greeting;
  card.innerHTML = '<div class="' + chat.close + '" title="Close">&times;</div>'
    + '<strong>Kes from Kestrel Lane</strong><br>Hi there! Looking for a quote, or need an engineer today? Ask me anything and I will point you the right way.';
  launcher.hidden = true;
  root.append(card);
  card.addEventListener('click', async (event) => {
    card.remove();
    launcher.hidden = false;
    if (event.target.closest('.' + chat.close)) { await mutate('dismiss-chat-greeting', {}); return; }
    await openPanel(root);
  });
}

async function openPanel(root) {
  if (root.querySelector('.' + chat.panel)) return;
  const panel = document.createElement('div');
  panel.className = chat.panel;
  panel.innerHTML = '<div class="' + chat.panelHead + '">Kes &middot; usually replies in a few minutes</div>'
    + '<div class="' + chat.log + '"><p>Hi! Our office is open 8am to 5:30pm. For a quote, use the Get a free quote button at the top of any page.</p></div>'
    + '<div style="padding:8px 16px 16px"><input type="text" placeholder="Type a message" style="width:100%;padding:8px"></div>';
  root.append(panel);
  await mutate('open-chat', {});
}

function mountNotice() {
  const scrim = document.querySelector('[data-testid="winter-notice"]');
  if (!scrim) return;
  scrim.querySelector('button').addEventListener('click', async () => {
    await mutate('dismiss-notice', {});
    scrim.remove();
  });
}

mountNotice();
mountChat();
if (consentAnswered) scheduleNewsletter();
`;
}
