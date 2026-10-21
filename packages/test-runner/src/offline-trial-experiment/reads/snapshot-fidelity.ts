// One recorded read run over its own recorded snapshot (the P5 gate's
// fidelity check): the recorded command, read as the domain reads a gateway
// command, run once by the snapshot page over the page snapshot recorded with
// its own result (`webOfflineReadRecordedSnapshot`, D32), and the answer --
// built as the reevaluator builds one (`webOfflineReadAnsweredResult`) --
// compared with what the read returned live (`./answer-comparison.ts`),
// beside the domain's own verdict on it as a control
// (`webOfflineReadControlReproduced`, D37). This is the control every changed
// read over that snapshot depends on.

import {
  webAutomationActionFromGatewayCommand,
  webOfflineReadAnsweredResult,
  webOfflineReadControlReproduced,
  webOfflineReadGatewayCommand,
  webOfflineReadRecordedSnapshot,
  type WebSnapshotPage,
} from "@fluxiq-web-extension/domain/node";
import { compareReadAnswer } from "./answer-comparison.js";
import type { FidelityOutcome, TracedRead } from "./types.js";

export async function readFidelity(input: { read: TracedRead; page: WebSnapshotPage }): Promise<FidelityOutcome> {
  const request = input.read.request;
  if (request === null) return notEvaluated("its segment holds no single readable result");
  const command = webOfflineReadGatewayCommand(request.recordedCommand);
  if (command === undefined) return notEvaluated("its recorded command was withheld or cannot be read back");
  const action = webAutomationActionFromGatewayCommand(command);
  if ("status" in action) return notEvaluated(`the domain rejects its recorded command (${action.failure?.code ?? action.status})`);
  try {
    const snapshot = await webOfflineReadRecordedSnapshot(request);
    if (snapshot === undefined) return Object.freeze({ status: "unavailable", reason: "snapshot_unavailable" });
    const evaluation = await input.page.evaluate(snapshot, action);
    if (evaluation.status === "unavailable") return Object.freeze({ status: "unavailable", reason: evaluation.reason });
    const answered = webOfflineReadAnsweredResult(evaluation.result, request.recordedResult);
    return Object.freeze({
      status: "evaluated",
      comparison: compareReadAnswer(answered, request.recordedResult),
      controlReproduced: webOfflineReadControlReproduced(answered, request.recordedResult),
      observations: Object.freeze({ ...evaluation.observations }),
    });
  } catch (error) {
    return Object.freeze({ status: "threw", error: error instanceof Error ? error.constructor.name : typeof error });
  }
}

function notEvaluated(reason: string): FidelityOutcome {
  return Object.freeze({ status: "not_evaluated", reason });
}
