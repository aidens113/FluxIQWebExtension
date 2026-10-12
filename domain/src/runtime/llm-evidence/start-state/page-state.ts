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

import type { WebLlmEvidenceElement } from "../elements";
import { webIsLayer } from "../node-run/layer";
import { webLlmHandleFreeViewLines, webLlmPageText, webLlmPageTree } from "../page-view";
import { present } from "../present";
import type { WebLlmPageEvidence } from "../sanitize";
import { WEB_START_STATE_SCHEMA_VERSION } from "./schema-version";
import type { WebStartState } from "./state";

/** The state of the page `evidence` captured, interruptions left out. */
export function webStartStateFromEvidence(evidence: WebLlmPageEvidence): WebStartState {
  const tree = webLlmPageTree(evidence.elements);
  const interruption = (element: WebLlmEvidenceElement): boolean =>
    webIsLayer(element) || element.inDialog !== undefined || tree.ancestors(element).some(webIsLayer);
  const dropped = new Set(evidence.elements.filter(interruption).map((element) => element.target));
  const kept = evidence.elements.filter((element) => !dropped.has(element.target)).map((element) => {
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
    lines: [...summary.lines, ...hidden]
  });
}
