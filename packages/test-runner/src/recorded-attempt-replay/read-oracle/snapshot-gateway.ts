import { randomUUID } from "node:crypto";
import { gatewayActionResultFromBrowserResult, webAutomationActionFromGatewayCommand, type WebAutomationActionCommand, type WebLlmEvidenceGateway, type WebPageSnapshot, type WebSnapshotPage, type WebSnapshotPageEvaluation } from "@fluxiq-web-extension/domain/node";

/** One command the evidence runtime sent, as the domain mapped it, and what the sandbox answered. */
export type RecordedSnapshotCommand = Readonly<{ action: WebAutomationActionCommand; evaluation: WebSnapshotPageEvaluation }>;

/**
 * One recorded page as the web evidence runtime's only client. Every command the runtime sends is mapped by the
 * domain's own gateway mapping and run by the extension's content code over that snapshot, page scripts and network
 * off; the answer is built by the same builder the extension's background answers a live command with. A command the
 * domain rejects is answered as rejected; a snapshot the sandbox cannot run throws, so nothing is invented.
 */
export function recordedSnapshotGateway(input: { page: WebSnapshotPage; snapshot: WebPageSnapshot; sessionId: string }): { gateway: WebLlmEvidenceGateway; commands: RecordedSnapshotCommand[] } {
  const commands: RecordedSnapshotCommand[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => [input.sessionId],
    structureDetectionSessionIds: () => [input.sessionId],
    async executeAction(sessionId, command) {
      if (sessionId !== input.sessionId) throw new Error("recorded_oracle_session_unknown");
      const commandId = randomUUID();
      const action = webAutomationActionFromGatewayCommand({ commandId, actionType: command.actionType, parameters: command.parameters, metadata: command.metadata, ...(command.timeoutMs === undefined ? {} : { timeoutMs: command.timeoutMs }) });
      if ("status" in action) return { status: action.status, error: action.message, failure: action.failure };
      const evaluation = await input.page.evaluate(input.snapshot, action);
      commands.push({ action, evaluation });
      if (evaluation.status === "unavailable") throw new Error(`recorded_oracle_snapshot_${evaluation.reason}`);
      return gatewayActionResultFromBrowserResult(evaluation.result);
    },
  };
  return { gateway, commands };
}
