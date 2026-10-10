// The output dispatcher's reading of an interrupted command's result (plan B3).
//
// The extension decided committing from the record it kept; the dispatcher
// decides it again from the command it sent, with this domain's one rule
// (`./commits.ts`), and that answer is the one Core acts on. A result whose
// payload does not say `interrupted` is not this reading's to change.

import type { JsonObject } from "fluxiq/core";
import { webAutomationActionCommits } from "./commits";
import { webAutomationInterruptedOutcome, type WebAutomationInterruptedOutcome } from "./outcome";
import { WEB_AUTOMATION_INTERRUPTED_STATUS } from "./result";

export function webAutomationInterruptedDispatchReading(
  outputId: string,
  parameters: JsonObject | undefined,
  resultPayload: unknown
): WebAutomationInterruptedOutcome | undefined {
  const payload = typeof resultPayload === "object" && resultPayload !== null && !Array.isArray(resultPayload) ? resultPayload as Record<string, unknown> : undefined;
  if (payload?.status !== WEB_AUTOMATION_INTERRUPTED_STATUS) return undefined;
  return webAutomationInterruptedOutcome(webAutomationActionCommits(outputId, parameters));
}
