// What stands in front of the page, as the packet marks it on an element
// (`./layers.ts` writes the marks), and the layer vocabulary they use: what a
// dialog or covering layer is, as the extension names it
// (`WebAutomationLayerKind`), read off untrusted JSON.

import type { WebAutomationLayerKind } from "../../page-evidence";
import { pageText } from "./untrusted-json";

/** The marks an element of the packet may carry about the layers in front of the page (t200). */
export type WebLlmLayerMarks = {
  /** This element is an open dialog: modal or not, a native `<dialog>` or not, and what kind of layer (a consent wall, a robot check). */
  isDialog?: { modal: boolean; native?: true; kind?: WebAutomationLayerKind };
  /** The handle of the open modal dialog this element sits in. */
  inDialog?: string;
  /** It is painted over other controls and takes their clicks: the handles of those the packet describes. */
  covers?: string[];
  /** How many controls it covers, where some of them are not in the packet. */
  coversCount?: number;
  /** What the covering layer is, where the capture recognised it. */
  kind?: WebAutomationLayerKind;
  /** The handles of what is painted over this control and takes its click. */
  coveredBy?: string[];
  /** The capture placed it in the layer in front of the page. */
  frontLayer?: true;
  /** One of the statements the page leads with about itself, such as "No results for ...". */
  statement?: true;
};

/** Every kind the contract names. A `Record` so a kind added to the contract fails to compile here until it is listed. */
const LAYER_KINDS: Readonly<Record<WebAutomationLayerKind, true>> = {
  consent: true,
  rate_limit: true,
  robot_check: true,
  promotion: true,
  assistant: true
};

/** The layer's kind when the capture gave one the contract names, else `undefined`. */
export function webLlmLayerKind(input: unknown): WebAutomationLayerKind | undefined {
  const kind = pageText(input)?.toLowerCase();
  return kind !== undefined && Object.hasOwn(LAYER_KINDS, kind) ? kind as WebAutomationLayerKind : undefined;
}
