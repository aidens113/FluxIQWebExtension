import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { PurchaseOrder } from "./purchase-orders.js";
import type { MultiTabState } from "./transitions.js";

/**
 * The start page: the order table, whose "Open details" links open a new tab
 * (`target="_blank"`), and one control that opens the newest order through
 * `window.open`. When the `popup-blocked` variant is armed, both open paths
 * are refused and an inline notice says so instead.
 */
export function listPage(state: MultiTabState, runToken: string): string {
  const newest = state.orders[state.orders.length - 1]!;
  const rows = state.orders.map((order) => orderRow(order, state.reviewedOrders.includes(order.order))).join("");
  const body = `<main>
    <h1>Purchase orders</h1>
    <p>Order details open in a new tab, so this list keeps its place.</p>
    <p><button type="button" data-testid="open-newest-window" data-open-order="${escapeHtml(newest.order)}">Open newest order in a new window</button></p>
    <p data-testid="open-notice" role="alert"></p>
    <table data-testid="order-list">
      <caption>Open purchase orders</caption>
      <thead><tr><th scope="col">Order</th><th scope="col">Supplier</th><th scope="col">Status</th><th scope="col">Review</th><th scope="col">Details</th><th scope="col">Confirm</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p data-testid="review-result" aria-live="polite"></p>
  </main>`;
  return page("Purchase orders", body, listScript(state.popupsBlocked, runToken));
}

function orderRow(order: PurchaseOrder, reviewed: boolean): string {
  const number = escapeHtml(order.order);
  const slug = number.toLowerCase();
  return `<tr data-testid="order-row-${slug}" data-entity-id="${number}">
        <th scope="row">${number}</th>
        <td>${escapeHtml(order.supplier)}</td>
        <td>${escapeHtml(order.status)}</td>
        <td data-testid="review-state-${slug}">${reviewed ? `<strong data-testid="reviewed-${slug}">Reviewed</strong>` : "Not reviewed"}</td>
        <td><a href="/scenarios/multi-tab/details/${number}?via=link" target="_blank" rel="noopener" data-open-order="${number}" data-testid="open-details-${slug}" aria-label="Open ${number} details in a new tab">Open details</a></td>
        <td><button type="button" data-confirm-order="${number}" data-testid="confirm-review-${slug}" aria-label="Confirm review of ${number}">Confirm review</button></td>
      </tr>`;
}

// The armed page stands in for a pop-up blocker: the link's default action is
// prevented and the window control gets no window, as `window.open` returns
// null when a browser blocks it. Either way the notice is the only output.
function listScript(popupsBlocked: boolean, runToken: string): string {
  return `${fixtureClient(runToken, "multi-tab")}
const popupsBlocked = ${JSON.stringify(popupsBlocked)};
const notice = document.querySelector('[data-testid="open-notice"]');
async function refuseToOpen(order, via) {
  notice.textContent = 'Pop-up blocked: ' + order + ' did not open. Allow pop-ups for this site, then try again.';
  await mutate('record-blocked-open', { order, via });
}
for (const link of document.querySelectorAll('a[data-open-order]')) {
  link.addEventListener('click', (event) => {
    if (!popupsBlocked) return;
    event.preventDefault();
    void refuseToOpen(link.dataset.openOrder, 'link');
  });
}
const windowButton = document.querySelector('[data-testid="open-newest-window"]');
windowButton.addEventListener('click', () => {
  const order = windowButton.dataset.openOrder;
  const opened = popupsBlocked ? null : window.open('/scenarios/multi-tab/details/' + order + '?via=window', '_blank');
  if (!opened) void refuseToOpen(order, 'window');
});
for (const button of document.querySelectorAll('button[data-confirm-order]')) {
  button.addEventListener('click', async () => {
    const order = button.dataset.confirmOrder;
    const slug = order.toLowerCase();
    const snapshot = await mutate('confirm-review', { order });
    const reviewed = snapshot.state.reviewedOrders.includes(order);
    if (reviewed) document.querySelector('[data-testid="review-state-' + slug + '"]').innerHTML = '<strong data-testid="reviewed-' + slug + '">Reviewed</strong>';
    document.querySelector('[data-testid="review-result"]').textContent = reviewed ? order + ' review confirmed.' : 'Open the ' + order + ' details before confirming its review.';
  });
}`;
}
