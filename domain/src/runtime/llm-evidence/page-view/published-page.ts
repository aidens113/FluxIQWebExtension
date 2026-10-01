// What leaves the domain for a model in place of a page packet (t223,
// "Published page"): `web-llm-page.v3`.
//
// The structured packet, `WebLlmPageEvidence` (`../sanitize.ts`), stays the
// domain's own form of the page; every domain reader keeps reading it. Where a
// page is handed to a model, this is handed instead: the exact screened
// `location` (plan resolution compares it), `truncated` (Core reads it for
// provenance), the failure marks a failure packet carries, and `page`, the one
// string the model reads (`./page-text.ts`). `title`, `frame`, `loading`,
// `navigation`, `dialogs`, `blockedBy`, `selectedText`, `captureTruncated` and
// `elements` are no longer keys; what they said is in the page's header lines.

import { present } from "../present";
import type { WebLlmPageEvidence } from "../sanitize";
import { webLlmPageText } from "./page-text";
import { WEB_LLM_PAGE_SCHEMA_VERSION } from "./schema-version";

export type WebLlmPublishedPage = Pick<WebLlmPageEvidence,
  "trust" | "location" | "truncated" | "failedTarget" | "failedTargetMissing" | "failedTargetUnknown" | "repairParameters" | "repairCandidates"> & {
  schemaVersion: typeof WEB_LLM_PAGE_SCHEMA_VERSION;
  /** Header lines, a blank line and the element lines, joined by "\n". */
  page: string;
};

/** The page as a model is shown it. */
export function publishedWebLlmPage(evidence: WebLlmPageEvidence): WebLlmPublishedPage {
  return present<WebLlmPublishedPage>({
    schemaVersion: WEB_LLM_PAGE_SCHEMA_VERSION,
    trust: evidence.trust,
    location: evidence.location,
    truncated: evidence.truncated,
    failedTarget: evidence.failedTarget,
    failedTargetMissing: evidence.failedTargetMissing,
    failedTargetUnknown: evidence.failedTargetUnknown,
    repairParameters: evidence.repairParameters,
    repairCandidates: evidence.repairCandidates,
    page: webLlmPageText(evidence)
  });
}
