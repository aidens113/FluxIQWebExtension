import { escapeHtml } from "../../../html.js";
import { STORE_PATHS } from "../catalog/index.js";
import { confirmationTexts } from "./confirmation-texts.js";
import type { PageKit } from "./page-kit.js";
import { storePage } from "./shell.js";

/**
 * The thank-you page for one placed order. Each statement about the order is
 * its own element with its own test id and nothing inside it but its text:
 * these are the page's facts, and the purchase task's goal is judged on them.
 */
export function renderConfirmationPage(kit: PageKit, orderId: string | null): string {
  const { css } = kit;
  const order = kit.state.orders.find((candidate) => candidate.orderId === orderId);
  if (!order) {
    return storePage(kit, { title: "Order not found", body: `<div class="${css.confirmBox}"><h1>We couldn't find that order.</h1><p><a href="${STORE_PATHS.home}">Continue shopping</a></p></div>`, script: "" });
  }
  const texts = confirmationTexts(order);
  const body = `<div class="${css.confirmBox}">
<h1 data-testid="order-status">${escapeHtml(texts.status)}</h1>
<p>Confirmation will be sent to your email.</p>
<p class="${css.confirmLine}" data-testid="order-ship-to">${escapeHtml(texts.shipTo)}</p>
<p class="${css.confirmLine}" data-testid="order-delivery">${escapeHtml(texts.delivery)}</p>
<ul>${texts.lines.map((line, index) => `<li class="${css.confirmLine}" data-testid="order-line-${index + 1}">${escapeHtml(line)}</li>`).join("")}</ul>
<p class="${css.confirmLine}" data-testid="order-payment">${escapeHtml(texts.payment)}</p>
<p class="${css.confirmLine}" data-testid="order-total">${escapeHtml(texts.total)}</p>
${texts.plusTrial === null ? "" : `<p class="${css.confirmLine}" data-testid="plus-trial">${escapeHtml(texts.plusTrial)}</p>`}
<p>Order number: <b>${escapeHtml(order.orderId)}</b></p>
<p><a href="${STORE_PATHS.home}">Continue shopping</a></p>
</div>`;
  return storePage(kit, { title: "Brightaisle.com: Thank You", body, script: "" });
}
