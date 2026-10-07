import type { ClientGatewayActivity } from "../../shared/activity";
import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelRelayResponse } from "../../shared/protocol";
import { createElement } from "../dom";
import type { PanelStore } from "../state";

/** Stop follows the raw live subject, with an owner lease checked again at click time. */
export function createStopControl(request: PanelStore["request"], eligible: () => boolean) {
  let current: ClientGatewayActivity | null = null;
  let pending: string | null = null;
  let notice = "";
  let generation = 0;
  const button = createElement("button", { className: "chat-stop", text: "Stop", attrs: { type: "button" } });
  const status = createElement("span", { className: "chat-stop-status", attrs: { role: "status", "aria-live": "polite" } });
  const element = createElement("div", { className: "chat-stop-control", hidden: true }, [button, status]);
  const active = () => current !== null && !current.final && current.phase !== "done" && current.phase !== "failed"
    && (current.subject.kind === "run" || Boolean(current.subject.flowId));
  function render() {
    element.hidden = !active() || !eligible();
    button.disabled = pending === current?.activityId;
    button.textContent = button.disabled ? "Stopping…" : current?.subject.kind === "build" ? "Stop build" : "Stop run";
    status.textContent = notice;
  }
  button.addEventListener("click", () => {
    if (!active() || !eligible() || pending === current?.activityId) return;
    const target = current!;
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
  });
  return { element, update(activity: ClientGatewayActivity | null) {
    if (current?.activityId !== activity?.activityId) { generation++; pending = null; notice = ""; }
    current = activity; render();
  } };
}
