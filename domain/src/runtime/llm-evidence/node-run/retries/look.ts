// Looking at the page again, under Core's default retries, before a decision
// taken on one look (t355). See `./dispatch.ts` for the rule and the two layers.

import { automationStudioDispatchWithNodeRetries, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../../failure";
import type { WebNodeRun } from "../context";
import { webNodeRetryWait } from "./wait";

/**
 * Looks at the page until a step's target is there, under the same default
 * retries: the first look and three more, at Core's waits. Answers the last
 * look, how many there were, and whether the target was still absent from it.
 *
 * For a decision this domain takes on a read rather than on the page's answer
 * to a command -- a replayed press whose target the page does not show is
 * reported as a step the site remembers, without pressing (`../replay.ts`). One
 * look straight after the step before it made that call on a page that had not
 * drawn the control yet, which is the too-early attempt the user's rule forbids.
 * An absent target is told to Core's policy as the not-found fault a press would
 * have met, so it is waited on exactly as that press would have been.
 */
export async function webNodeLookUntilPresent<T>(
  run: Pick<WebNodeRun, "request">,
  definitionId: string,
  look: () => Promise<T>,
  absent: (seen: T) => boolean
): Promise<{ seen: T; looks: number; absent: boolean }> {
  const outcome = await automationStudioDispatchWithNodeRetries<T>({
    node: { id: definitionId, definitionId, metadata: { effect: "observe" } },
    dispatch: look,
    read: (seen) => absent(seen) ? { ok: false, failure: NOT_DRAWN_YET } : { ok: true },
    delay: webNodeRetryWait,
    signal: run.request.signal
  });
  return { seen: outcome.result, looks: outcome.attempts, absent: absent(outcome.result) };
}

/** The fault an absent target is, as the closed set records it. */
const NOT_DRAWN_YET: AutomationStudioFailureRecord = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, {
  expected: "the step's target on the page it acted on",
  actual: "not on the page read before the step"
});

