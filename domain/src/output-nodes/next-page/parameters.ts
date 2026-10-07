import type { AutomationNodeParameter, AutomationNodePort } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_NEXT_PAGE_GRAMMAR } from "./catalog-text";

/**
 * How long a next-page step may take, by default: the press, the wait for the
 * list to change, and a page that answers slowly. It is sent as the dispatch's
 * own timeout as well as the page's (`./dispatch.ts`), because Core waits a
 * command only as long as its dispatch payload names.
 */
export const WEB_AUTOMATION_NEXT_PAGE_TIMEOUT_MS = 30_000;

/**
 * The node's own parameters, before `expectedState`. `nextPage` is the request,
 * shaped as `actions/next-page/schema.ts` declares it; `timeoutMs` bounds the
 * whole step.
 */
export function webAutomationNextPageParameters(): AutomationNodeParameter[] {
  return [
    {
      id: "nextPage",
      label: "Next page",
      description: WEB_AUTOMATION_NEXT_PAGE_GRAMMAR,
      valueType: "object",
      example: { item: "li.result", pagination: { mode: "next", next: "a.next" } },
      ui: { control: "value" }
    },
    {
      id: "timeoutMs",
      label: "Timeout",
      description: "Milliseconds for the step: the press and the wait for the list to change.",
      valueType: "number",
      defaultValue: WEB_AUTOMATION_NEXT_PAGE_TIMEOUT_MS
    }
  ];
}

/**
 * The output a list's end routes down (contract C1). A succeeded step that
 * found no next page answers `route: "ended"`, which Core takes from the top of
 * the dispatch payload; this is the output that word names, so a loop over the
 * pages of a list has somewhere to leave by.
 */
export const WEB_AUTOMATION_NEXT_PAGE_ENDED_PORT: AutomationNodePort = { id: "ended", label: "Ended", valueType: "any", role: "branch" };
