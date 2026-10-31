import { webHostThrownFailure } from "../../host-failure";
import type { WebLlmEvidenceGateway } from "../capture";

type ActionResult = Awaited<ReturnType<WebLlmEvidenceGateway["executeAction"]>>;

/** The gateway may throw its original record; only an unclassified throw stays unknown. */
export async function executeWebEvidenceAction(dispatch: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await dispatch();
  } catch (error) {
    const failure = webHostThrownFailure(error);
    if (failure !== undefined) return { status: "failed", failure };
    return { status: "unknown", error: "The action acknowledgement was unavailable." };
  }
}
