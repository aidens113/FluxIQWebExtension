import type { AutomationStudioLlmEvidenceSummary } from "fluxiq/automation";
import { webLlmEvidencePageText } from "./page-text";

export { webLlmEvidencePageText };

/** The web domain's reading of tool evidence, given to Core's step log through the implementation bundle. */
export const webLlmEvidenceSummary: AutomationStudioLlmEvidenceSummary = { pageText: webLlmEvidencePageText };
