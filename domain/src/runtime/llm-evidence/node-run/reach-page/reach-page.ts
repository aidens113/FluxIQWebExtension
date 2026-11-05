// Getting to the page a step was found on, before a forward run sends it (t869,
// `AS/runtime/llm/node-tools/replay/forward.ts`).
//
// A forward run walks a list from wherever the page stands. In paid run `run-mw37vz9n-a77a02c2` it stood on another page
// altogether, and a pass that does not come back by its own way leaves it on a row's page. So a call marked `reach` moves
// there first: a navigation to the address the step recorded, the same move a reset makes, and nothing else. It lasts
// nothing and is put to the same gate, and it never clears site data or logs the person out. A page already there is not
// touched, since a reload would lose what the page holds that its address does not say.
//
// Nothing is answered here. A move that could not be made leaves the step to run where the page stands, and the step
// answers for itself: its target is not found, on a page that is not its own.

import type { JsonObject } from "fluxiq/core";
import { webAutomationResolvedActionEffect } from "../../../../actions/action-effect";
import { WEB_AUTOMATION_CLOSE_OPENED_TABS_PARAMETER } from "../../../../client";
import { executeWebEvidenceAction } from "../../action-failure";
import { assertActive, toolMetadata } from "../../capture";
import { webActionPermission } from "../../permission";
import { isJsonRecord } from "../../untrusted-json";
import type { WebNodeRun } from "../context";
import { webNodeReplayPage } from "../replay-answer";

/** The key Core marks such a call with (`AS/runtime/llm/node-tools/replay/replay.ts`). */
const REACH_KEY = "reach";

/** The move, the same one the Flow's own navigate makes. */
const NAVIGATE_ACTION = "web.browser.navigate";

/** Whether a call asks for its page to be reached first. */
export function webNodeReplayAsksToReach(value: JsonObject): boolean {
  return value[REACH_KEY] === true;
}

/** Move to the address the call's step recorded, unless the page is already there (header). */
export async function webNodeReplayReach(run: WebNodeRun): Promise<void> {
  const from = isJsonRecord(run.request.value.from) ? run.request.value.from : undefined;
  const location = typeof from?.location === "string" ? from.location : undefined;
  if (location === undefined || !/^https?:/u.test(location)) return;
  const page = await webNodeReplayPage(run, false);
  assertActive(run.request.signal);
  if (page?.evidence.location === location) return;
  const permission = await webActionPermission({ check: run.request.permission, declared: [], control: { name: undefined, kind: "page" }, verb: "go to", effect: "mutate", actionEffect: webAutomationResolvedActionEffect(NAVIGATE_ACTION) });
  if (permission.kind === "refused" || permission.kind === "invalid") return;
  await executeWebEvidenceAction(() => run.gateway.executeAction(run.sessionId, { actionType: NAVIGATE_ACTION, parameters: { url: location, [WEB_AUTOMATION_CLOSE_OPENED_TABS_PARAMETER]: true }, metadata: toolMetadata(run.request) }));
  assertActive(run.request.signal);
}
