import { escapeHtml, fixtureClient, page } from "../../../html.js";
import { ACCOUNT, type PaymentId } from "../state/index.js";
import type { PageKit } from "./page-kit.js";

/**
 * The payment-method chooser checkout embeds, served as its own document the
 * way a payment provider's widget is. Choosing a method reports it to the
 * store and tells the page around it, which reloads.
 */
export function renderPaymentFrame(kit: PageKit): string {
  const session = kit.state.checkout;
  if (!session) return page("Payment methods", "<p>Your checkout session has ended.</p>", "");
  const options = (Object.keys(ACCOUNT.payments) as PaymentId[]).map((id) => `<li><label><input type="radio" name="payment" value="${id}"${id === session.paymentId ? " checked" : ""}> ${escapeHtml(ACCOUNT.payments[id])}${id === "visa-4417" ? " (default)" : ""}</label></li>`).join("");
  const body = `<p><strong>Your credit and debit cards</strong></p><ul style="list-style:none;padding:0">${options}</ul><p><button type="button" data-use-payment>Use this payment method</button></p>`;
  const script = `${fixtureClient(kit.runToken, "everything-store")}
document.querySelector('[data-use-payment]').addEventListener('click', async () => {
  const chosen = document.querySelector('input[name="payment"]:checked');
  if (!chosen) return;
  await mutate('set-payment', { paymentId: chosen.value });
  parent.postMessage({ type: 'payment-changed' }, location.origin);
});`;
  return page("Payment methods", body, script);
}
