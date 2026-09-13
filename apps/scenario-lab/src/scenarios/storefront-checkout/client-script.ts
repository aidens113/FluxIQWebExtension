import { fixtureClient } from "../../html.js";
import { formatAddress, storefrontOrder } from "./order.js";
import { styleClass as cx } from "./styles.js";

/**
 * How long the two reveals take. Both are short enough to keep a recording
 * brisk and long enough that a step which fires before the answer arrives is
 * a real race rather than a theoretical one.
 */
const LOOKUP_DELAY_MS = 450;
const QUOTE_DELAY_MS = 350;

/** The address book as the browser needs it: postcode to id and printed label. */
function addressBookForClient(): Record<string, { id: string; label: string }[]> {
  return Object.fromEntries(Object.entries(storefrontOrder.addressBook).map(([postcode, entries]) => [
    postcode,
    entries.map(entry => ({ id: entry.id, label: formatAddress(entry, postcode) })),
  ]));
}

/**
 * Browser behaviour for the store page.
 *
 * Three things here are the point of the fixture. The postcode lookup and the
 * delivery quote both answer after a delay and then *add* an element the page
 * did not have, so the document changes shape after the action that triggered
 * it. The payment result arrives as a `message` from the card frame, so the
 * observable effect of the click a shopper makes inside the iframe lands in
 * the top document. And nothing typed into a card, gift-card, security-code or
 * password field is ever sent anywhere: the store posts no card value, and the
 * gift-card control answers from the browser alone.
 */
export function storefrontCheckoutClientScript(runToken: string): string {
  return `${fixtureClient(runToken, "storefront-checkout")}
const ADDRESS_BOOK = ${JSON.stringify(addressBookForClient())};
const LOOKUP_DELAY_MS = ${LOOKUP_DELAY_MS};
const QUOTE_DELAY_MS = ${QUOTE_DELAY_MS};
const STEP_IDS = ['cart', 'address', 'delivery', 'payment'];
const byTestId = id => document.querySelector('[data-testid="' + id + '"]');
const setText = (id, text) => { const node = byTestId(id); if (node) node.textContent = text; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// One mutation at a time, so a status line never shows an older answer.
let pending = Promise.resolve();
function send(operation, payload = {}) {
  const next = pending.then(() => mutate(operation, payload));
  pending = next.then(() => undefined, () => undefined);
  return next;
}

function openStep(step) {
  for (const id of STEP_IDS) {
    const body = byTestId('step-' + id + '-body');
    if (body) body.hidden = id !== step;
    const done = STEP_IDS.indexOf(id) < STEP_IDS.indexOf(step) || step === 'confirmed';
    markComplete(id, done);
  }
  byTestId('checkout-accordion').hidden = step === 'confirmed';
  byTestId('order-confirmation').hidden = step !== 'confirmed';
}

function markComplete(stepId, done) {
  const head = byTestId('step-' + stepId).querySelector('.${cx.stepHead}');
  const existing = byTestId('step-' + stepId + '-done');
  if (done && !existing) {
    const badge = document.createElement('span');
    badge.className = '${cx.stepDone}';
    badge.dataset.testid = 'step-' + stepId + '-done';
    badge.textContent = 'Complete';
    head.append(badge);
  } else if (!done && existing) existing.remove();
}

/** Every string the server derives, written back onto the page in one place. */
function applySnapshot(state) {
  setText('checkout-progress', state.status.progress);
  setText('promotion-status', state.status.promotion);
  setText('summary-subtotal', state.status.subtotal);
  setText('summary-discount', state.status.discount);
  byTestId('summary-discount-row').hidden = state.totals.discountCents === 0;
  setText('summary-delivery', state.status.deliveryCost);
  setText('summary-total', state.status.total);
  setText('order-total-paid', 'Paid today: ' + state.status.total);
  setText('order-delivery-estimate', state.status.deliveryEstimate);
  setText('payment-total', 'Your card will be charged ' + state.status.total + '.');
  const decline = byTestId('payment-decline-notice');
  decline.textContent = state.status.payment;
  decline.hidden = state.payment.outcome !== 'declined';
  openStep(state.step);
}

// The banner is rendered only while consent is pending, so a reload after it
// was answered finds nothing to wire up.
if (byTestId('cookie-consent')) {
  byTestId('cookie-accept-all').addEventListener('click', () => dismissConsent('all'));
  byTestId('cookie-essential-only').addEventListener('click', () => dismissConsent('essential'));
  byTestId('cookie-manage').addEventListener('click', () => {
    const preferences = byTestId('cookie-preferences');
    preferences.hidden = !preferences.hidden;
  });
}
function dismissConsent(choice) {
  send('set-consent', { choice });
  byTestId('cookie-consent').remove();
  byTestId('cookie-consent-scrim').remove();
}

const chatPanel = byTestId('support-chat-panel');
const chatLauncher = byTestId('support-chat-launcher');
chatLauncher.addEventListener('click', () => setChatOpen(chatPanel.hidden));
byTestId('support-chat-close').addEventListener('click', () => setChatOpen(false));
function setChatOpen(open) {
  chatPanel.hidden = !open;
  chatLauncher.setAttribute('aria-expanded', String(open));
  send('toggle-chat', { open });
}
byTestId('support-chat-send').addEventListener('click', () => {
  const input = byTestId('support-chat-input');
  if (!input.value.trim()) return;
  const log = byTestId('support-chat-log');
  const mine = document.createElement('li');
  mine.textContent = 'You: ' + input.value.trim();
  const reply = document.createElement('li');
  reply.dataset.testid = 'support-chat-reply';
  reply.textContent = 'Robin: thanks, someone will pick this up shortly.';
  log.append(mine, reply);
  input.value = '';
});

// The gift-card number never leaves the browser: no mutation carries it and
// no state field could hold it. If it shows up in captured evidence, the page
// is the only place it can have come from.
byTestId('gift-card-apply').addEventListener('click', () => {
  const entered = byTestId('gift-card-number').value.trim();
  setText('gift-card-status', entered ? 'This gift card has no balance remaining.' : 'Enter a gift card number first.');
});

byTestId('apply-promotion').addEventListener('click', async () => {
  const snapshot = await send('apply-promotion', { code: byTestId('promo-code').value });
  applySnapshot(snapshot.state);
});

byTestId('continue-to-address').addEventListener('click', async () => {
  applySnapshot((await send('confirm-cart')).state);
});

byTestId('find-address').addEventListener('click', async () => {
  const postcode = byTestId('postcode').value;
  setText('address-lookup-status', 'Searching for addresses...');
  const existing = byTestId('address-suggestions');
  if (existing) existing.remove();
  const snapshot = await send('lookup-address', { postcode });
  await wait(LOOKUP_DELAY_MS);
  const state = snapshot.state;
  const entries = (ADDRESS_BOOK[state.address.postcode] ?? []).filter(entry => state.address.suggestionIds.includes(entry.id));
  setText('address-lookup-status', entries.length === 0
    ? 'No addresses found for ' + state.address.postcode
    : entries.length + ' addresses found for ' + state.address.postcode);
  setText('address-chosen', 'No address chosen');
  if (entries.length > 0) byTestId('address-lookup-status').insertAdjacentElement('afterend', suggestionList(entries));
});

function suggestionList(entries) {
  const list = document.createElement('ul');
  list.className = '${cx.suggestions}';
  list.dataset.testid = 'address-suggestions';
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.testid = 'address-option-' + (index + 1);
    button.dataset.addressId = entry.id;
    button.textContent = entry.label;
    item.append(button);
    list.append(item);
  });
  return list;
}

// Delegated on the step, not on the list: a suggestion list the server
// rendered after a reload is the same markup and must behave the same way.
byTestId('step-address-body').addEventListener('click', async event => {
  const button = event.target.closest('button[data-address-id]');
  if (!button) return;
  await send('choose-address', { addressId: button.dataset.addressId });
  setText('address-chosen', button.textContent);
  byTestId('address-validation').hidden = true;
});

byTestId('continue-to-delivery').addEventListener('click', async () => {
  const snapshot = await send('confirm-address');
  byTestId('address-validation').hidden = snapshot.state.step !== 'address';
  applySnapshot(snapshot.state);
});

byTestId('step-delivery-body').addEventListener('change', async event => {
  if (event.target.name !== 'deliveryOption') return;
  setText('delivery-cost-status', 'Working out delivery for your address...');
  byTestId('continue-to-payment').disabled = true;
  const estimate = byTestId('delivery-estimate');
  if (estimate) estimate.remove();
  const snapshot = await send('choose-delivery', { optionId: event.target.value });
  await wait(QUOTE_DELAY_MS);
  const state = snapshot.state;
  setText('delivery-cost-status', state.status.deliveryOption);
  showDeliveryEstimate(state.status.deliveryEstimate);
  byTestId('continue-to-payment').disabled = false;
  applySnapshot(state);
});

function showDeliveryEstimate(text) {
  let estimate = byTestId('delivery-estimate');
  if (!estimate) {
    estimate = document.createElement('p');
    estimate.className = '${cx.notice}';
    estimate.dataset.testid = 'delivery-estimate';
    byTestId('delivery-cost-status').insertAdjacentElement('afterend', estimate);
  }
  estimate.textContent = text;
}

byTestId('continue-to-payment').addEventListener('click', async () => {
  const state = (await send('confirm-delivery')).state;
  applySnapshot(state);
  // The provider is told what to charge only now, which is why the frame that
  // has been loading in the collapsed section shows the right amount.
  byTestId('payment-frame').contentWindow.postMessage({ channel: 'northlake-payments', type: 'amount', total: state.status.total }, window.location.origin);
});

// The card frame reports its result here, and the store then asks its own
// backend what happened rather than trusting the message for anything but the
// nudge. Same-origin, so the origin check is exact.
window.addEventListener('message', async event => {
  if (event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.channel !== 'northlake-payments') return;
  applySnapshot((await send('read-order')).state);
});`;
}
