import { fixtureClient } from "../../html.js";
import { ticketPaneMarkup } from "./detail-pane.js";
import { ESCALATION_LOG_SUBPATH, escalationLogMarkup, escalationsClientScript, escalationsPageContent } from "./escalations.js";
import { deskDocument, deskShell } from "./markup.js";
import { applyDeskChanges, ticketsFor } from "./queue.js";
import { deskClasses } from "./styles.js";
import { ticketByReference } from "./tickets.js";
import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import type { SupportDeskState } from "./types.js";

const TICKET_SUBPATH = /^tickets\/(TCK-\d{4})$/;

/**
 * The three documents beyond the queue.
 *
 * `tickets/<reference>` is the detail pane, fetched when a ticket is opened.
 * Serving it rather than rendering it into the queue is what keeps the
 * requester's account, the full subject and the conversation out of the
 * queue's markup: they exist only once a ticket has actually been opened.
 *
 * `escalations` is a screen of its own, reached from the desk's navigation,
 * and `escalations/log` serves its log region alone so that raising one needs
 * no page reload. Both render from the same state the queue does, so what a
 * run left behind is on every screen at once.
 *
 * A ticket the desk does not hold is a 404, so a reference invented rather
 * than read off the queue cannot be opened.
 */
export function routeSupportDesk(
  state: SupportDeskState,
  request: ScenarioRouteRequest,
  context: RenderContext,
): ScenarioRouteResponse | undefined {
  const css = deskClasses();
  if (request.subpath === ESCALATION_LOG_SUBPATH) return { status: 200, body: escalationLogMarkup(css, state) };
  if (request.subpath === "escalations") {
    const references = ticketsFor(state.mode).map((ticket) => ticket.reference);
    const script = `${fixtureClient(context.runToken, "support-desk")}
${escalationsClientScript(references)}`;
    return { status: 200, body: deskDocument("Escalations", css, deskShell(css, "Escalations", escalationsPageContent(css, state)), script) };
  }
  const reference = TICKET_SUBPATH.exec(request.subpath)?.[1];
  if (reference === undefined) return undefined;
  const ticket = ticketByReference(applyDeskChanges(ticketsFor(state.mode), state.assignments, state.resolved), reference);
  return ticket ? { status: 200, body: ticketPaneMarkup(css, ticket) } : undefined;
}
