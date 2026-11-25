// What leaves the domain for a model in place of a page packet (t223,
// "Published page"): `web-llm-page.v4`.
//
// The structured packet, `WebLlmPageEvidence` (`../sanitize.ts`), stays the
// domain's own form of the page; every domain reader keeps reading it. Where a
// page is handed to a model, this is handed instead: the exact screened
// `location` (plan resolution compares it), `truncated` (Core reads it for
// provenance), the failure marks a failure packet carries, and `pageView`, the
// page's key and its keyed lines (`./keyed-view.ts`, t1036), which Core's page
// channel delivers whole the first time a run meets the key and as the lines
// that changed after that. The lines' texts, joined by "\n", are the page
// string `web-llm-page.v3` carried as `page` (`./joined-text.ts`); a reader of
// either form reads through `../shown-page/`. `title`, `frame`, `loading`,
// `navigation`, `dialogs`, `blockedBy`, `selectedText`, `captureTruncated` and
// `elements` are no longer keys; what they said is in the page's header lines.

import { present } from "../present";
import type { WebLlmPageEvidence } from "../sanitize";
import type { WebLlmPageView } from "./keyed-view";
import { webLlmPageView } from "./evidence-view";
import { WEB_LLM_PAGE_SCHEMA_VERSION } from "./schema-version";
import { webJudgeStateFacts } from "../judge-evidence/state";
import type { JsonObject } from "fluxiq/core";

export type WebLlmPublishedPage = Pick<WebLlmPageEvidence,
  "trust" | "location" | "truncated" | "failedTarget" | "failedTargetMissing" | "failedTargetUnknown" | "repairParameters" | "repairCandidates"> & {
  schemaVersion: typeof WEB_LLM_PAGE_SCHEMA_VERSION;
  /** The page's key and its header lines, blank line and element lines, each keyed. */
  pageView: WebLlmPageView;
  /** Optional for old published views; new producers supply versioned passive semantic facts from the same capture. */
  judgeState?: JsonObject;
};

/** The page as a model is shown it; `view` is the ordinary view unless a caller shows more (`./full-view.ts`). */
export function publishedWebLlmPage(evidence: WebLlmPageEvidence, view: WebLlmPageView = webLlmPageView(evidence)): WebLlmPublishedPage {
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
    pageView: view,
    judgeState: webJudgeStateFacts(evidence)
  });
}
