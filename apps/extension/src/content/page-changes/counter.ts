// A cheap count of everything that can change what a look at this frame would
// see (task speed S4).
//
// A step's look before its act repeated the look after the previous step's act,
// although nothing had changed between them: two full captures a step where one
// would do. The worker keeps the last look and asks each frame for this count
// before taking another; a count that has not moved since that look, from the
// same copy of this script, means the look still stands
// (`../../runtime/look-reuse/`).
//
// What moves the count is anything a look reads:
// - the document's structure, attributes and text (a `MutationObserver` over
//   the whole document, open shadow roots included as they are met);
// - what is typed or chosen, which changes a control's value and no attribute
//   (`input`, `change`), where the page is scrolled and how big it is drawn
//   (`scroll`, `resize`), where focus is (`focusin`, `focusout`), a `<details>`
//   opened (`toggle`), a picture or frame that finished loading (`load`,
//   `error`), a transition or animation that ended, and fonts that loaded;
// - the document beginning to go or coming back (`pagehide`, `beforeunload`,
//   `pageshow`, `popstate`, `hashchange`).
//
// FluxIQ's own page UI (`../owned-ui/`) is not the page: a mutation of its
// closed host alone does not count, so the activity overlay showing a step does
// not throw away the look of the page under it.
//
// The count only ever grows, and moves at the slightest sign; it errs toward a
// fresh look and never toward a stale one. Pending observer records are taken
// before the count is read, so a change made just before the question is in the
// answer.

import type { PageChangesResponse } from "../../shared/page-changes-message";
import { ownedUiHosts } from "../owned-ui";

const WINDOW_EVENTS = ["pagehide", "beforeunload", "pageshow", "popstate", "hashchange", "resize"] as const;
const DOCUMENT_EVENTS = ["input", "change", "scroll", "focusin", "focusout", "toggle", "load", "error", "transitionend", "animationend"] as const;

let changes = 0;
let observer: MutationObserver | undefined;
const observedRoots = new WeakSet<Node>();

/** Whether every node a record names is FluxIQ's own closed UI host. */
function ownUiOnly(record: MutationRecord): boolean {
  if (record.type !== "childList") return ownedUiHosts.ownsHost(record.target);
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
  return nodes.length > 0 && nodes.every((node) => ownedUiHosts.ownsHost(node));
}

function counted(records: readonly MutationRecord[]): void {
  for (const record of records) {
    if (!ownUiOnly(record)) changes += 1;
    for (const node of Array.from(record.addedNodes)) observeShadowRoots(node);
  }
}

/** Every open shadow root at or beneath `node`, observed as the document is. */
function observeShadowRoots(node: Node): void {
  if (!observer || !(node instanceof Element)) return;
  const elements = [node, ...Array.from(node.querySelectorAll("*"))];
  for (const element of elements) {
    const root = element.shadowRoot;
    if (root && !observedRoots.has(root)) {
      observedRoots.add(root);
      observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    }
  }
}

/** Starts counting in this frame, once. */
function install(): void {
  if (observer) return;
  observer = new MutationObserver(counted);
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) observeShadowRoots(document.documentElement);
  const bump = () => { changes += 1; };
  for (const type of WINDOW_EVENTS) window.addEventListener(type, bump, { capture: true, passive: true });
  for (const type of DOCUMENT_EVENTS) document.addEventListener(type, bump, { capture: true, passive: true });
  document.fonts?.addEventListener?.("loadingdone", bump);
}

/** This frame's mark now, with every change already made counted in it. */
function mark(instance: string): PageChangesResponse {
  if (observer) counted(observer.takeRecords());
  return { instance, changes };
}

/** This frame's count of what could change a look at it: started once by the content entry, read by the worker's question. */
export const pageChangeCounter = { install, mark };
