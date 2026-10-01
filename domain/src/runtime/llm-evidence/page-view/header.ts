// The page view's header lines (t223, "Header lines"): each only when it has
// something to say, in this order.
//
//   PAGE "<title>"
//   URL <location written with ~>   (~ = <base>)
//   VIEW <w>x<h> at the top · <n> elements with visible words or a control, in page order · find_on_page searches the rest
//   COVERING <handle> "<name>" <kind> covers <n> · ...
//   DIALOG <handle> "<name>" modal <kind> · ...
//   LOADING <readyState> busy <kind> "<label>" ... pending-navigation
//   FRAMES <ids> did not answer
//   ARRIVED <type> <n> redirects from <referrer> at <url>
//   SELECTED "<text>"
//   CAPTURE incomplete: the browser left elements out
//
// These say what the dropped packet keys said: the title, the frame, loading,
// navigation, dialogs, blockers, selection and a short capture.

import type { WebLlmPageEvidence } from "../sanitize";
import { quotedWords } from "./element";
import type { WebLlmLinkWriter } from "./link-writer";

/** The header lines for a page whose view has `lineCount` element lines. */
export function webLlmPageHeader(evidence: WebLlmPageEvidence, links: WebLlmLinkWriter, lineCount: number): string[] {
  const lines: Array<string | undefined> = [
    evidence.title === undefined ? undefined : `PAGE ${quotedWords(evidence.title)}`,
    `URL ${links.write(evidence.location)}   (~ = ${links.base})`,
    viewLine(evidence, lineCount),
    coveringLine(evidence),
    dialogLine(evidence),
    loadingLine(evidence),
    framesLine(evidence),
    arrivedLine(evidence, links),
    evidence.selectedText === undefined ? undefined : `SELECTED ${quotedWords(evidence.selectedText)}`,
    evidence.captureTruncated === true ? "CAPTURE incomplete: the browser left elements out" : undefined
  ];
  return lines.filter((line): line is string => line !== undefined);
}

function viewLine(evidence: WebLlmPageEvidence, lineCount: number): string {
  const scope = `${lineCount} elements with visible words or a control, in page order · find_on_page searches the rest`;
  const viewport = evidence.viewport;
  if (viewport === undefined) return `VIEW · ${scope}`;
  const scrolled = viewport.scrollX === 0 && viewport.scrollY === 0 ? "at the top"
    : viewport.scrollX === 0 ? `scrolled to y=${viewport.scrollY}`
    : `scrolled to x=${viewport.scrollX} y=${viewport.scrollY}`;
  return `VIEW ${viewport.width}x${viewport.height} ${scrolled} · ${scope}`;
}

function coveringLine(evidence: WebLlmPageEvidence): string | undefined {
  const entries = (evidence.blockedBy ?? []).map((blocker) => joined([
    blocker.target,
    blocker.name === undefined ? undefined : quotedWords(blocker.name),
    blocker.kind,
    blocker.blocks === undefined ? undefined : `covers ${blocker.blocks}`
  ]) ?? blocker.role ?? "layer");
  return entries.length > 0 ? `COVERING ${entries.join(" · ")}` : undefined;
}

function dialogLine(evidence: WebLlmPageEvidence): string | undefined {
  const entries = (evidence.dialogs ?? []).map((dialog) => joined([
    dialog.target,
    dialog.name === undefined ? undefined : quotedWords(dialog.name),
    dialog.modal === true ? "modal" : undefined,
    dialog.kind
  ]) ?? dialog.role ?? "dialog");
  return entries.length > 0 ? `DIALOG ${entries.join(" · ")}` : undefined;
}

function loadingLine(evidence: WebLlmPageEvidence): string | undefined {
  const loading = evidence.loading;
  if (loading === undefined) return undefined;
  const parts = joined([
    loading.readyState,
    loading.busy === true ? "busy" : undefined,
    ...(loading.indicators ?? []).map((indicator) => joined([indicator.kind, indicator.label === undefined ? undefined : quotedWords(indicator.label)])),
    loading.pendingNavigation === true ? "pending-navigation" : undefined
  ]);
  return parts === undefined ? undefined : `LOADING ${parts}`;
}

function framesLine(evidence: WebLlmPageEvidence): string | undefined {
  const ids = evidence.frame?.unansweredFrameIds ?? [];
  return ids.length > 0 ? `FRAMES ${ids.join(",")} did not answer` : undefined;
}

function arrivedLine(evidence: WebLlmPageEvidence, links: WebLlmLinkWriter): string | undefined {
  const navigation = evidence.navigation;
  if (navigation === undefined) return undefined;
  const redirects = navigation.redirects;
  const parts = joined([
    navigation.type,
    redirects === undefined ? undefined : `${redirects} ${redirects === 1 ? "redirect" : "redirects"}`,
    navigation.referrer === undefined ? undefined : `from ${links.write(navigation.referrer)}`,
    navigation.url === undefined || navigation.url === evidence.location ? undefined : `at ${links.write(navigation.url)}`
  ]);
  return parts === undefined ? undefined : `ARRIVED ${parts}`;
}

/** The parts that say something, joined by spaces, or `undefined` when none does. */
function joined(parts: ReadonlyArray<string | undefined>): string | undefined {
  const said = parts.filter((part): part is string => part !== undefined && part !== "");
  return said.length > 0 ? said.join(" ") : undefined;
}
