// Whether a recorded act closed something in front of the page, which may be gone the
// next time (rule 6). Read from the page the exploration last looked at: the control
// it pressed was marked as in the capture's front layer or inside an open dialog, or
// sat inside a cover the capture said was blocking the page. The act's own recorded
// element is asked as well, since it carries where the control sat when it was chosen.
//
// This marks an answer and changes nothing about it: the recorded answer is still what
// the rule gives. A press in a layer that is not a dismissal (a dialog's "Confirm") is
// marked too. It is a question for the live attempt, not a claim about the act.

import type { ClientGatewayTraceOperation, ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";

export function webTraceStateIsOneTimeLayerAct(operation: ClientGatewayTraceOperation, readBefore: ClientGatewayTraceRecordedPayload | null): boolean {
  const parameters = recordOf(operation.compared.parameters);
  const element = recordOf(parameters?.element);
  if (isLayerControl(element)) return true;
  const selector = stringOf(parameters?.selector) ?? stringOf(element?.selector) ?? stringOf(recordOf(operation.compared.target)?.selector);
  if (selector === null) return false;
  const snapshot = recordOf(recordOf(readBefore?.payload)?.snapshot);
  if (snapshot === undefined) return false;
  const elements = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements : [];
  if (elements.some((candidate: unknown) => stringOf(recordOf(candidate)?.selector) === selector && isLayerControl(recordOf(candidate)))) return true;
  const overlays = recordOf(recordOf(snapshot.evidence)?.overlays);
  const blockers = Array.isArray(overlays?.blockers) ? overlays.blockers : [];
  return blockers.some((blocker: unknown) => {
    const cover = stringOf(recordOf(blocker)?.selector);
    return cover !== null && (selector === cover || selector.startsWith(`${cover} `) || selector.startsWith(`${cover}>`));
  });
}

function isLayerControl(element: Record<string, unknown> | undefined): boolean {
  if (element === undefined) return false;
  return element.frontLayer === true || recordOf(element.context)?.dialog !== undefined;
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
