import { page } from "../../../html.js";

/** The card frame answers only to a store page on the lab's loopback ports. */
export const PAYMENT_FRAME_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:*";

/**
 * The payment provider's card form, served from the lab's second origin and
 * embedded by the checkout. It hands the checkout a token, never the card:
 * "Use this card" checks the number and posts `tok_<last four>card` to the
 * parent window. No card value leaves the frame or reaches the store.
 */
export function renderPaymentFrame(): string {
  const body = `<style>body{margin:0;padding:12px;font:14px system-ui,sans-serif;max-width:none}label{display:flex;flex-direction:column;gap:3px;margin:0 0 8px;font-size:12px;font-weight:600}input{border:1px solid #999;border-radius:6px;padding:7px;font:inherit}.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}</style>
<form><label>Card number<input name="cardnumber" inputmode="numeric" autocomplete="cc-number"></label><div class="row"><label>Expiration (MM/YY)<input name="exp" autocomplete="cc-exp"></label><label>Security code<input name="cvc" inputmode="numeric"></label></div><button type="submit">Use this card</button> <span role="status"></span></form>`;
  const script = `const form = document.querySelector('form'); const status = form.querySelector('[role=status]');
const luhn = (digits) => { let sum = 0; for (let i = 0; i < digits.length; i += 1) { let d = Number(digits[digits.length - 1 - i]); if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; } return digits.length >= 13 && sum % 10 === 0; };
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const digits = form.cardnumber.value.replace(/[^0-9]/g, '');
  const expiry = /^[0-9]{2}[/][0-9]{2}$/.test(form.exp.value.trim());
  const code = /^[0-9]{3,4}$/.test(form.cvc.value.trim());
  if (!luhn(digits) || !expiry || !code) { status.textContent = 'Check your card details.'; return; }
  status.textContent = 'Card ending ' + digits.slice(-4) + ' will be used.';
  parent.postMessage({ type: 'vr-card-token', token: 'tok_' + digits.slice(-4) + 'card' }, '*');
});`;
  return page("Secure card entry", body, script);
}
