import { webHostThrownFailure } from "../../host-failure";
import { webActionabilityPayloadCopy, webActionabilityProperty } from "../../../actions/actionability";
import type { WebLlmEvidenceGateway } from "../capture";

type ActionResult = Awaited<ReturnType<WebLlmEvidenceGateway["executeAction"]>>;

/** The gateway may throw its original record; only an unclassified throw stays unknown. */
export async function executeWebEvidenceAction(dispatch: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return webActionabilityPayloadCopy(await dispatch());
  } catch (error) {
    const failure = webHostThrownFailure(error);
    const result: ActionResult = failure === undefined
      ? { status: "unknown", error: "The action acknowledgement was unavailable." }
      : { status: "failed", failure };
    const actionability = webActionabilityProperty(error);
    if (actionability !== undefined) result.payload = { actionability };
    return result;
  }
}
