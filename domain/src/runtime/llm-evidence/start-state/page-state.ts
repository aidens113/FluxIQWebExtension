// The page's own state from one passive capture (t462): the page view's lines
// without their handles, and the non-rendered state rows a result check reads
// (`../result-observation/observe.ts`), with whatever stands in front of the
// page left out.
//
// A dialog or a covering layer is an interruption, not the site's state: a
// cookie banner that opened between two asks must not read as something the
// build left behind. Left out are the layers the capture marks
// (`../node-run/layer/element.ts`: a dialog, a cover of a recognised kind, the
// front layer), every element described beneath one, and every element the
// capture placed inside an open modal (`inDialog`). Geometry alone is not
// used: a layer's box may span the page, and the page behind it is state. A
// `covered-by` naming a layer left out is dropped from the line it is on,
// since the line would otherwise differ only by the interruption.
//
// **The page's own pinned header keeps its hidden state (t505).** The front
// layer is a paint fact: the capture puts there anything under a `fixed` or
// `sticky` ancestor, and a site's header pinned while scrolling is one. Lane B
// round 18 (`run-mv6p76yw-701793d0`) added an item from a detail page; the
// item showed only in the confirmation panel (a layer, rightly left out) and in
// the header's hidden summary of the visitor's list -- the lines the result
// check read to pass the build -- and the header's badge was never redrawn. The
// whole header was left out as a layer, so the read after the add saw nothing,
// and Core recorded the add as having no effect. So a hidden element is kept
// when the outermost front layer above it is the page's banner landmark and no
// dialog or recognised cover holds it: hidden, it stands in front of nothing,
// and the banner is on the page before and after any press rather than opening
// over it. The banner's rendered elements stay out -- what a pinned header
// covers moves with every scroll -- and so does the hidden content of any other
// front layer, such as a pinned panel a press opened.
//
// **Focus is not state (FluxIQ Core t475).** Which element holds focus moves
// with every press and every look; lane B round 10 (`run-mv5tusj4-b7ee0630`)
// was asked to undo "marked focused" as an act's effect. The focus mark is
// left off every line.
//
// **Items (t475).** Given the read's records, the state lists the opaque
// tokens of the records its kept elements sit in, as the permission
// declaration names a control's record, so Core can tell which items an act
// created.

import type { WebLlmEvidenceElement } from "../elements";
import { webIsLayer } from "../node-run/layer";
import { webLlmHandleFreeViewLines, webLlmPageText, webLlmPageTree } from "../page-view";
import { present } from "../present";
import type { WebLlmPageEvidence } from "../sanitize";
import { webControlSpotToken } from "../control-spot";
import { WEB_START_STATE_SCHEMA_VERSION } from "./schema-version";
import type { WebStartState } from "./state";

/** The state of the page `evidence` captured, interruptions and focus left out, the pinned banner's hidden state kept; with `records`, the items its kept elements sit in. */
export function webStartStateFromEvidence(evidence: WebLlmPageEvidence, records?: ReadonlyMap<string, string>): WebStartState {
  const tree = webLlmPageTree(evidence.elements);
  const interruption = (element: WebLlmEvidenceElement): boolean => {
    if (webIsLayer(element) || element.inDialog !== undefined) return true;
    const above = tree.ancestors(element);
    if (!above.some(webIsLayer)) return false;
    return !(element.hidden === true && !above.some(interruptsByWhatItIs) && outermostFrontLayer(above)?.landmark === BANNER);
  };
  const dropped = new Set(evidence.elements.filter(interruption).map((element) => element.target));
  const kept = evidence.elements.filter((element) => !dropped.has(element.target)).map((focusable) => {
    const { focused: _focused, ...element } = focusable;
    const coveredBy = element.coveredBy;
    if (coveredBy === undefined || !coveredBy.some((handle) => dropped.has(handle))) return element;
    const { coveredBy: _covered, ...rest } = element;
    const still = coveredBy.filter((handle) => !dropped.has(handle));
    return still.length > 0 ? { ...rest, coveredBy: still } : rest;
  });
  const page = webLlmPageText({ ...evidence, elements: kept });
  const summary = webLlmHandleFreeViewLines(page);
  // The same projection a result check prints under PASSIVE NON-RENDERED STATE.
  const hidden = kept.filter((element) => element.hidden === true).map((element) => JSON.stringify({
    hidden: true,
    tag: element.tag,
    text: element.text ?? element.name ?? element.label,
    value: element.value,
    checked: element.checked,
    selectedValue: element.selectedValue
  }));
  return present<WebStartState>({
    schemaVersion: WEB_START_STATE_SCHEMA_VERSION,
    location: evidence.location,
    title: summary.title,
    lines: [...summary.lines, ...hidden],
    items: records ? [...new Set(kept.flatMap((element) => {
      const record = records.get(element.target);
      return record ? [webControlSpotToken("item", record)] : [];
    }))] : undefined
  });
}

/** The landmark role of the page's own header (header). */
const BANNER = "banner";

/** A dialog, or a cover the capture recognised by kind: an interruption by what it is, painted or not (header). */
function interruptsByWhatItIs(element: WebLlmEvidenceElement): boolean {
  return element.isDialog !== undefined || element.kind !== undefined;
}

/** The farthest of `above` (nearest first) the capture put in the front layer. */
function outermostFrontLayer(above: readonly WebLlmEvidenceElement[]): WebLlmEvidenceElement | undefined {
  return [...above].reverse().find((element) => element.frontLayer === true);
}
