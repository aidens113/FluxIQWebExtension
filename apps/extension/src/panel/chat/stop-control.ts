import type { ClientGatewayActivity } from "../../shared/activity";
import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelRelayResponse } from "../../shared/protocol";
import { createElement } from "../dom";
import type { PanelStore } from "../state";

const STOPPING_SOON = "Stopping as soon as it starts.";

/**
 * Stop follows the raw live subject, with an owner lease checked again at click time.
 *
 * It is offered from the moment the person's send says "Starting…", before
 * Core has named the build or run it starts: D9 of the t342 round 2 UI review
 * (run-muylu4pp-f9cb2121, moment 02) had no Stop at all while the panel and
 * the overlay said "Starting…". There is nothing to name in a stop request
 * yet, so a press then is held and sent for the first live work Core reports
 * after it; if the send starts nothing, the press is dropped with it.
 *
 * It reads "Stop" from that first moment to the end, whatever the work turns
 * out to be: it read "Stop" at the start and "Stop build" once Core named the
 * build (round 5), a button that changed under the person's pointer. Its
 * accessible name says what it stops once that is known ("Stop build", "Stop
 * run"), which still holds the word on the button.
 */
export function createStopControl(request: PanelStore["request"], eligible: () => boolean) {
  let current: ClientGatewayActivity | null = null;
  let starting = false;
  let held = false;
  let pending: string | null = null;
  let notice = "";
  let generation = 0;
  const button = createElement("button", { className: "chat-stop", text: "Stop", attrs: { type: "button" } });
  const status = createElement("span", { className: "chat-stop-status", attrs: { role: "status", "aria-live": "polite" } });
  const element = createElement("div", { className: "chat-stop-control", hidden: true }, [button, status]);
  const active = () => current !== null && !current.final && current.phase !== "done" && current.phase !== "failed"
    && (current.subject.kind === "run" || Boolean(current.subject.flowId));
  function render() {
    const waiting = starting && !active();
    element.hidden = !(active() || waiting) || !eligible();
    button.disabled = held || pending === current?.activityId;
    const label = button.disabled ? "Stopping…" : "Stop";
    if (button.textContent !== label) button.textContent = label;
    const named = button.disabled || waiting ? null : current?.subject.kind === "build" ? "Stop build" : "Stop run";
    if (named === null) button.removeAttribute("aria-label");
    else if (button.getAttribute("aria-label") !== named) button.setAttribute("aria-label", named);
    status.textContent = notice;
  }
  function send(target: ClientGatewayActivity) {
    const lease = generation;
    pending = target.activityId; notice = ""; render();
    void request<PanelRelayResponse>({ type: RUNTIME_MESSAGES.panelStopRun, projectId: target.subject.projectId,
      ...(target.subject.kind === "build" ? { flowId: target.subject.flowId } : { runId: target.subject.id })
    }).then((reply) => {
      if (generation !== lease || current?.activityId !== target.activityId || !eligible()) return;
      const value = reply.ok ? reply.value : undefined;
      if (!reply.ok || !value?.ok) { pending = null; notice = "Couldn't stop the work. Try again."; }
      else {
        notice = "Stop requested. Waiting for the work to finish.";
        if ((value.payload as { cancellationRequested?: boolean } | undefined)?.cancellationRequested === false) {
          pending = null; notice = "The build has already ended.";
        }
      }
      render();
    }).catch(/* best-effort: obsolete owner failures cannot update another project's control */ () => {
      if (generation !== lease || current?.activityId !== target.activityId || !eligible()) return;
      pending = null; notice = "Couldn't stop the work. Try again."; render();
    });
  }
  button.addEventListener("click", () => {
    if (!eligible() || held) return;
    if (!active()) {
      if (!starting) return;
      held = true; notice = STOPPING_SOON; render();
      return;
    }
    if (pending === current?.activityId) return;
    send(current!);
  });
  return { element,
    /** Shows `activity`'s Stop; `sendStarting` is true while the person's send says "Starting…" and Core has named no work yet. */
    update(activity: ClientGatewayActivity | null, sendStarting = false) {
      if (current?.activityId !== activity?.activityId) { generation++; pending = null; if (!held) notice = ""; }
      current = activity; starting = sendStarting;
      if (held && active()) {
        held = false;
        if (eligible()) { send(current!); return; }
        notice = "";
      } else if (held && !starting) { held = false; notice = ""; }
      render();
    } };
}
