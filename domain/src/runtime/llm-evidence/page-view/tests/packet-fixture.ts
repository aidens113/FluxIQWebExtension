// Small hand-built packets for the page view's rule tests: elements numbered
// in order, each visible on screen unless it says otherwise.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webLlmPageText } from "../page-text";

export const PAGE_LOCATION = "https://shop.test/store/s?k=kettle";
const BOX = { x: 10, y: 10, width: 200, height: 20 };

/** An element's fields; one given `undefined` (such as `box`) is left out, so a fixture can take away a default. */
export type FixtureElement = { [K in keyof WebLlmEvidenceElement]?: WebLlmEvidenceElement[K] | undefined } & { tag: string };

/** A packet of these elements, `t1` onward unless one names its own target. */
export function fixturePacket(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): WebLlmPageEvidence {
  return {
    schemaVersion: "web-llm-evidence.v2",
    trust: "untrusted-page-evidence",
    location: PAGE_LOCATION,
    truncated: false,
    ...page,
    elements: elements.map((element, index) => withoutUndefined({ target: `t${index + 1}`, box: BOX, onViewport: true, ...element }))
  };
}

/** The element lines of the page view, markers included: everything after the header's blank line. */
export function bodyLines(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): string[] {
  const text = webLlmPageText(fixturePacket(elements, page));
  return text.slice(text.indexOf("\n\n") + 2).split("\n").filter((line) => line !== "");
}

function withoutUndefined(fields: Record<string, unknown>): WebLlmEvidenceElement {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as WebLlmEvidenceElement;
}
