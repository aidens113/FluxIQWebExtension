// A state summary read as the lines a diff compares (t223).
//
// A web attempt's state summary is the page as the model reads it, the compact
// view (`web-llm-page.v3`). One stored before t223 is a structured packet
// (`web-llm-evidence.v2`), which is first written as that same view, so a run
// recorded either side of the change still diffs.
//
// The lines compared are the view's element lines with what is positional
// taken out, read by the view's own module
// (`../llm-evidence/page-view/handle-free-lines.ts`), which a build's start
// state reads the same way.
//
// `documentTimeOrigin` is read beside the view, never from it: the document's
// identity the capture put on the summary (`../host-runtime.ts`), absent on a
// summary recorded before it or when it was not a finite number.

import type { JsonObject } from "fluxiq/core";
import { WEB_LLM_EVIDENCE_SCHEMA_VERSION, webLlmHandleFreeViewLines, webLlmPageText, type WebLlmEvidenceElement, type WebLlmPageEvidence } from "../llm-evidence";

export type WebStateSummaryLines = {
  location: string | undefined;
  /** Which document the summary was captured in (`performance.timeOrigin`), when it says. */
  documentTimeOrigin: number | undefined;
  title: string | undefined;
  /** The element lines, handle-free, in page order. */
  lines: string[];
};

/** The location, title and handle-free element lines of a state summary, or none of them for a summary that is neither shape. */
export function webStateSummaryLines(summary: JsonObject | undefined): WebStateSummaryLines {
  const location = typeof summary?.location === "string" ? summary.location : undefined;
  const origin = summary?.documentTimeOrigin;
  const documentTimeOrigin = typeof origin === "number" && Number.isFinite(origin) ? origin : undefined;
  const text = typeof summary?.page === "string" ? summary.page : legacyText(summary, location);
  if (text === undefined) return { location, documentTimeOrigin, title: typeof summary?.title === "string" ? summary.title : undefined, lines: [] };
  const { title, lines } = webLlmHandleFreeViewLines(text);
  return { location, documentTimeOrigin, title: title ?? (typeof summary?.title === "string" ? summary.title : undefined), lines };
}

/** A structured packet stored before t223, written as the view; `undefined` when it is not one. */
function legacyText(summary: JsonObject | undefined, location: string | undefined): string | undefined {
  if (summary?.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || !Array.isArray(summary.elements)) return undefined;
  const elements = summary.elements.filter((element): element is JsonObject => typeof element === "object" && element !== null && !Array.isArray(element)
    && typeof element.target === "string" && typeof element.tag === "string") as unknown as WebLlmEvidenceElement[];
  const packet: WebLlmPageEvidence = {
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: location ?? "",
    truncated: summary.truncated === true,
    elements
  };
  return webLlmPageText(packet);
}
