// The recording log's newest entries as steps a person recognises.
//
// The log (`getRecordingLog`) holds everything the background noted during the
// recording, newest first: the person's actions, and also connection notes,
// snapshots, page changes and "Evidence:" copies. Only the person's own actions
// are steps, so only they are listed, each as a verb and the element's human
// name. The log's detail falls back to a CSS selector when an element has no
// name, and a navigation's detail is a URL; neither is shown -- a selector is
// dropped by `plainWords`, and a URL is cut to its hostname.

import { pageHostname } from "../../../copy";
import { payloadFields } from "../payload-fields";
import { plainWords } from "../plain-words";

/** One step in the list: its log entry id (sent back to remove it), and its words. */
export type StepRow = { id: string; label: string; detail?: string };

const VERBS: Readonly<Record<string, string>> = {
  "dom.click": "Clicked",
  "dom.input": "Typed into",
  "dom.change": "Changed",
  "dom.submit": "Submitted a form",
  "dom.wheel": "Scrolled the page",
  "dom.scroll": "Scrolled the page",
  "browser.navigation": "Opened a page"
};

// These steps' details are coordinates or a form's selector, never a name.
const NO_DETAIL = new Set(["dom.wheel", "dom.scroll", "dom.submit"]);

function rowOf(raw: unknown): StepRow | undefined {
  const entry = payloadFields(raw);
  if (entry === undefined || typeof entry.id !== "string" || entry.id === "" || typeof entry.kind !== "string") return undefined;
  if (typeof entry.label === "string" && entry.label.startsWith("Evidence:")) return undefined;
  const { id, kind } = entry;
  if (kind === "dom.keydown") {
    const key = plainWords(typeof entry.label === "string" ? entry.label.replace(/^Key\s*/, "") : undefined, 20);
    return { id, label: key === undefined ? "Pressed a key" : `Pressed ${key}` };
  }
  const verb = VERBS[kind];
  if (verb === undefined) return undefined;
  const detail = kind === "browser.navigation"
    ? pageHostname(typeof entry.detail === "string" ? entry.detail : undefined)
    : NO_DETAIL.has(kind) ? undefined : plainWords(entry.detail, 48);
  if (detail === undefined) return { id, label: kind === "dom.click" ? "Clicked something" : kind === "dom.input" || kind === "dom.change" ? `${verb} a field` : verb };
  return { id, label: verb, detail: kind === "browser.navigation" ? detail : `"${detail}"` };
}

/** The steps in a `getRecordingLog` reply (`{ ok, log: { items } }`), newest first; anything unreadable is skipped. */
export function stepRows(reply: unknown): StepRow[] {
  const items = payloadFields(payloadFields(reply)?.log)?.items;
  if (!Array.isArray(items)) return [];
  return items.map(rowOf).filter((row): row is StepRow => row !== undefined);
}
