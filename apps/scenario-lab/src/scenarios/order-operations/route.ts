import { fixtureClient } from "../../html.js";
import { orderDetailScript } from "./client-script.js";
import { orderDetailContent, orderSummaryPanel } from "./detail-page.js";
import { applyOrderChanges, ordersFor } from "./ledger.js";
import { dispatchedOrders, orderDocument, orderShell } from "./markup.js";
import { dispatchNoteMarkup } from "./order-table.js";
import { orderByReference } from "./orders.js";
import { orderClasses } from "./styles.js";
import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import type { CustomerOrder, OrderOperationsState } from "./types.js";

const ORDER_SUBPATH = /^orders\/(ORD-\d{5})$/;
const ORDER_SUMMARY_SUBPATH = /^orders\/(ORD-\d{5})\/summary$/;

/**
 * The documents beyond the order book.
 *
 * `orders/<reference>` is one order's own page, a full load rather than a
 * pane: the lines, the address and the refund control exist nowhere else, so
 * anything that needs them has to go there. `orders/<reference>/summary` and
 * `dispatch-note` serve the two regions that change after an action, so the
 * page updating itself never has to write state the desk would have written
 * differently.
 *
 * An order the book does not hold is a 404, so a reference invented rather
 * than read off the list cannot be opened.
 */
export function routeOrderOperations(
  state: OrderOperationsState,
  request: ScenarioRouteRequest,
  context: RenderContext,
): ScenarioRouteResponse | undefined {
  const css = orderClasses();
  const orders = applyOrderChanges(ordersFor(state.mode), state.refunds, state.dispatched, state.cancelled);
  if (request.subpath === "dispatch-note") {
    return { status: 200, body: dispatchNoteMarkup(css, dispatchedOrders(orders, state.dispatched)) };
  }
  const summaryOf = found(orders, ORDER_SUMMARY_SUBPATH.exec(request.subpath)?.[1]);
  if (summaryOf) return { status: 200, body: orderSummaryPanel(css, summaryOf, state.refunds[summaryOf.reference] ?? 0) };
  const order = found(orders, ORDER_SUBPATH.exec(request.subpath)?.[1]);
  if (!order) return undefined;
  const script = `${fixtureClient(context.runToken, "order-operations")}
${orderDetailScript(css, order.reference)}`;
  const content = orderDetailContent(css, order, state.refunds[order.reference] ?? 0);
  return { status: 200, body: orderDocument(order.reference, css, orderShell(css, "Orders", content), script) };
}

function found(orders: readonly CustomerOrder[], reference: string | undefined): CustomerOrder | undefined {
  return reference === undefined ? undefined : orderByReference(orders, reference);
}
