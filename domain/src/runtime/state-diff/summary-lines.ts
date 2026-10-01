// A state summary read as the lines a diff compares (t223).
//
// A web attempt's state summary is the page as the model reads it, the compact
// view (`web-llm-page.v3`). One stored before t223 is a structured packet
// (`web-llm-evidence.v2`), which is first written as that same view, so a run
// recorded either side of the change still diffs.
//
// The lines compared are the view's element lines with what is positional
// taken out: the leading handle, and any handle the line names (`same href as
// t12`, `covered-by t3,t4`), since `t1` names the first element of whichever
// capture it came from. A link written on the page's own base (`~/cart`) is
// written out in full, since two pages may have different bases. Structure
// markers -- `[main]`, `- 3/16`, `--- below the fold ---` -- are where things
// are, not what is there, and are left out.

import type { JsonObject } from "fluxiq/core";
import { WEB_LLM_EVIDENCE_SCHEMA_VERSION, webLlmPageText, type WebLlmEvidenceElement, type WebLlmPageEvidence } from "../llm-evidence";

export type WebStateSummaryLines = {
  location: string | undefined;
  title: string | undefined;
  /** The element lines, handle-free, in page order. */
  lines: string[];
};

const QUOTED = /"(?:[^"\\]|\\.)*"/gu;

/** The location, title and handle-free element lines of a state summary, or none of them for a summary that is neither shape. */
export function webStateSummaryLines(summary: JsonObject | undefined): WebStateSummaryLines {
  const location = typeof summary?.location === "string" ? summary.location : undefined;
  const text = typeof summary?.page === "string" ? summary.page : legacyText(summary, location);
  if (text === undefined) return { location, title: typeof summary?.title === "string" ? summary.title : undefined, lines: [] };
  const blank = text.indexOf("\n\n");
  const header = (blank < 0 ? text : text.slice(0, blank)).split("\n");
  const body = blank < 0 ? [] : text.slice(blank + 2).split("\n");
  const base = header.map((line) => /^URL .*\(~ = (\S+)\)$/u.exec(line)?.[1]).find((found) => found !== undefined);
  const lines = body.flatMap((line) => {
    const element = /^t[1-9][0-9]*(?: (.*))?$/u.exec(line);
    return element ? [handleFree(element[1] ?? "", base)] : [];
  });
  return { location, title: titleOf(header) ?? (typeof summary?.title === "string" ? summary.title : undefined), lines };
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

/** The `PAGE "<title>"` header line's title, unquoted. */
function titleOf(header: string[]): string | undefined {
  const quoted = header.map((line) => /^PAGE ("(?:[^"\\]|\\.)*")$/u.exec(line)?.[1]).find((found) => found !== undefined);
  return quoted === undefined ? undefined : quoted.slice(1, -1).replace(/\\"/gu, "\"");
}

/** The line with every handle outside quoted words written `t*`, and the page's `~` base written out. */
function handleFree(line: string, base: string | undefined): string {
  let out = "";
  let at = 0;
  for (const match of line.matchAll(QUOTED)) {
    out += unquoted(line.slice(at, match.index), base) + match[0];
    at = match.index + match[0].length;
  }
  return out + unquoted(line.slice(at), base);
}

function unquoted(part: string, base: string | undefined): string {
  const handles = part.replace(/\bt[1-9][0-9]*\b/gu, "t*");
  return base === undefined ? handles : handles.replace(/(^|\s)~(?=[/?#]|\s|$)/gu, `$1${base}`);
}
