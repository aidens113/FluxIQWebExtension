import type { StorefrontCheckoutState } from "./state.js";
import { styleClass as cx } from "./styles.js";

/**
 * The two things every real checkout carries and no fixture here had: a
 * consent banner that owns the page until it is answered, and a support chat
 * widget that never leaves.
 *
 * Both are interference on purpose. The banner is a full-viewport scrim under
 * a dialog, so until it is dismissed a click aimed at any control on the page
 * lands on the scrim instead -- the first step of every workflow on this
 * fixture has to deal with it, exactly as a person would. The chat widget is
 * fixed to the bottom-right corner for the whole session, so it is in every
 * snapshot of every step and it covers whatever the page put underneath it.
 */
export function renderStoreOverlays(state: StorefrontCheckoutState): string {
  return `${consentBanner(state)}${supportChat(state)}`;
}

function consentBanner(state: StorefrontCheckoutState): string {
  if (state.consent !== "pending") return "";
  return `<div class="${cx.consentBackdrop}" data-testid="cookie-consent-scrim"></div>
    <div class="${cx.consentBanner}" id="cmp-consent-banner" data-testid="cookie-consent" role="dialog" aria-modal="true" aria-labelledby="cmp-title" aria-describedby="cmp-body">
      <h2 id="cmp-title">We value your privacy</h2>
      <p id="cmp-body">We and 41 partners store or access information on your device, such as cookies, and process personal data to personalise advertising and content, measure performance, and develop products. You can change your choice at any time from the footer.</p>
      <div data-testid="cookie-preferences" hidden>
        <label class="${cx.field}"><input type="checkbox" checked disabled> Strictly necessary</label>
        <label class="${cx.field}"><input type="checkbox" data-testid="cookie-analytics"> Analytics and performance</label>
        <label class="${cx.field}"><input type="checkbox" data-testid="cookie-marketing"> Personalised advertising</label>
      </div>
      <div class="${cx.consentActions}">
        <button type="button" class="${cx.primaryButton}" data-testid="cookie-accept-all">Accept all</button>
        <button type="button" class="${cx.quietButton}" data-testid="cookie-essential-only">Reject non-essential</button>
        <button type="button" class="${cx.quietButton}" data-testid="cookie-manage">Manage preferences</button>
      </div>
    </div>`;
}

function supportChat(state: StorefrontCheckoutState): string {
  const messages = [
    { from: "Robin (Northlake support)", text: "Hi, I am here if you need a hand with sizing or delivery." },
    { from: "Robin (Northlake support)", text: "Orders placed before 3pm PT ship the same day." },
  ];
  const log = messages.map((message, index) => `<li data-testid="support-chat-message-${index + 1}"><strong>${message.from}</strong><br>${message.text}</li>`).join("");
  return `<div class="${cx.chatRoot}" data-testid="support-chat">
      <div class="${cx.chatPanel}" id="support-chat-panel" data-testid="support-chat-panel"${state.support.chatOpen ? "" : " hidden"}>
        <strong>Northlake support</strong>
        <button type="button" class="${cx.quietButton}" data-testid="support-chat-close" aria-label="Close chat">x</button>
        <ul class="${cx.chatLog}" data-testid="support-chat-log">${log}</ul>
        <label class="${cx.field}" for="support-chat-input">Message
          <input id="support-chat-input" data-testid="support-chat-input" name="supportMessage" type="text" autocomplete="off">
        </label>
        <button type="button" class="${cx.primaryButton}" data-testid="support-chat-send">Send</button>
      </div>
      <button type="button" class="${cx.chatLauncher}" data-testid="support-chat-launcher" aria-expanded="${state.support.chatOpen ? "true" : "false"}" aria-controls="support-chat-panel">
        Chat with us<span class="${cx.chatBadge}" data-testid="support-chat-badge">2</span>
      </button>
    </div>`;
}
