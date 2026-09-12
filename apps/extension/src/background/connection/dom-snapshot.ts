// The DOM snapshot payload the content script produces, and how the background
// worker collects one per frame and merges them into a single tab snapshot.
//
// Merging is per item, not per snapshot. The elements of every frame become one
// list, and so does every page-level evidence item that is additive: a dialog
// in a child frame is a dialog on the page, a covered control is covered
// whichever document paints over it, and the element totals only mean anything
// if they count the same frames the element list spans. The items that describe
// one document -- the navigation that reached it, its `readyState` -- are the
// top frame's deliberately, because a child frame's URL is not the page's URL
// and there is no honest way to average two `readyState`s. See
// `mergePageEvidence` for the item-by-item rule.
//
// This is the *second* producer of `PageEvidence`: the content script writes
// one per frame, and the two functions below rewrite and recombine them, so it
// carries the same obligation and used to carry none of it. Both built their
// result from conditional spreads (`...(evidence.regions ? { regions } : {})`)
// around a hand-written list of the contract's keys, and TypeScript
// excess-checks nothing through a spread: a renamed key left the wire in
// silence, a deleted clause dropped an item from every multi-frame page, and a
// key *added* to the contract was produced per frame and then silently dropped
// here -- two documents carrying less evidence than one, every gate green.
//
// Every object below is built by `present<T>()`, the writer the content
// producer uses, which requires the literal to mention every key of the
// contract type -- optional ones included, valued `undefined` when absent --
// and drops the undefined ones afterwards. That is what makes the merge
// exhaustive: a ninth key on `WebAutomationPageEvidence` stops both functions
// compiling until each says what it does with it.

import { createWebAutomationStateFromSnapshot } from "@fluxiq-web-extension/domain/client";
import { present } from "../../shared/present";
import type {
  DialogEvidence,
  DialogEvidenceItem,
  FormControlEvidence,
  FormEvidence,
  LoadingEvidence,
  LoadingIndicator,
  NativeDialogEvidence,
  OverlayEvidence,
  OverlayEvidenceItem,
  PageEvidence,
  RectDescriptor,
  RecordingEventPayload,
  RegionEvidence,
  RepeatingStructureEvidence,
  SnapshotElementTotals
} from "../../shared/protocol";
import { objectValue } from "./value-readers";
import { translateFrameElements } from "./frame-geometry";

export type DomSnapshotPayload = Parameters<typeof createWebAutomationStateFromSnapshot>[0];

/**
 * The payload as the content script actually sends it. `DomSnapshotPayload` is
 * the domain's *input* type, which declares only what the state projection
 * reads, so it says nothing about the page evidence Phase 1.4 added. The
 * evidence still travels -- the wire is JSON and every hop copies the object
 * whole -- so reading or writing it here needs the wider shape.
 */
export type DomSnapshotPayloadWithEvidence = DomSnapshotPayload & { evidence?: PageEvidence | undefined };

// A merged snapshot spans every frame, so each collection needs a budget of its
// own: the per-frame modules in `content/evidence/` cap themselves, but ten
// frames would otherwise contribute ten times the cap to one payload that is
// built on every recorded event. Each is roughly twice its per-frame cap, which
// is room for a handful of frames rather than for a frame bomb.
const MAX_MERGED_DIALOGS = 10;
const MAX_MERGED_BLOCKERS = 10;
const MAX_MERGED_BUSY_REGIONS = 16;
const MAX_MERGED_LOADING_INDICATORS = 16;
const MAX_MERGED_REGIONS = 40;
const MAX_MERGED_REPEATING = 12;
const MAX_MERGED_FORMS = 16;

// A frame that never answers must not hold up an event: every per-frame call
// falls back instead of waiting.
const FRAME_SNAPSHOT_TIMEOUT_MS = 150;

// The tab-messaging calls this module needs, supplied by the caller so the
// module stays free of the background worker's chrome wiring.
export type TabSnapshotTransport = {
  readonly sendToTab: <TResponse = unknown>(tabId: number, message: unknown, frameId?: number) => Promise<TResponse>;
  readonly allTabFrames: (tabId: number) => Promise<chrome.webNavigation.GetAllFrameResultDetails[]>;
};

export function isDomSnapshotPayload(value: unknown): value is {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  frame?: { isTop: boolean; viewportOffset?: { x: number; y: number; width: number; height: number } };
  focusedElement?: RecordingEventPayload["element"];
  selectedText?: string;
  interactiveElements: NonNullable<RecordingEventPayload["element"]>[];
} {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as {
    url?: unknown;
    title?: unknown;
    viewport?: { width?: unknown; height?: unknown; scrollX?: unknown; scrollY?: unknown };
    interactiveElements?: unknown;
  };
  return typeof snapshot.url === "string" &&
    typeof snapshot.title === "string" &&
    Boolean(snapshot.viewport) &&
    typeof snapshot.viewport?.width === "number" &&
    typeof snapshot.viewport.height === "number" &&
    typeof snapshot.viewport.scrollX === "number" &&
    typeof snapshot.viewport.scrollY === "number" &&
    Array.isArray(snapshot.interactiveElements);
}

export function hasSnapshotFrameViewportOffset(snapshot: DomSnapshotPayload): boolean {
  const frame = objectValue((snapshot as { frame?: unknown }).frame);
  const viewportOffset = objectValue(frame?.viewportOffset);
  return typeof viewportOffset?.x === "number" &&
    typeof viewportOffset.y === "number" &&
    typeof viewportOffset.width === "number" &&
    typeof viewportOffset.height === "number";
}

export async function captureSingleFrameSnapshot(
  transport: TabSnapshotTransport,
  tabId: number,
  frameId: number
): Promise<DomSnapshotPayload | undefined> {
  const snapshot = await withTimeout(transport.sendToTab(tabId, { type: "captureSnapshot" }, frameId), FRAME_SNAPSHOT_TIMEOUT_MS, undefined);
  return isDomSnapshotPayload(snapshot) ? snapshot : undefined;
}

export async function captureMergedTabSnapshot(
  transport: TabSnapshotTransport,
  tabId: number,
  seedSnapshot?: DomSnapshotPayload,
  seedFrameId?: number
): Promise<DomSnapshotPayloadWithEvidence | undefined> {
  const topFallback = await captureSingleFrameSnapshot(transport, tabId, 0);
  const fallback = topFallback ?? seedSnapshot;
  const frames = await withTimeout(transport.allTabFrames(tabId), FRAME_SNAPSHOT_TIMEOUT_MS, []);
  const frameSnapshots: Array<{ frameId: number; snapshot: DomSnapshotPayload }> = [];
  if (seedSnapshot && seedFrameId !== undefined) frameSnapshots.push({ frameId: seedFrameId, snapshot: seedSnapshot });
  await withTimeout(Promise.allSettled(frames.map(async (frame) => {
    if (seedFrameId !== undefined && frame.frameId === seedFrameId && seedSnapshot) return;
    const snapshot = await captureSingleFrameSnapshot(transport, tabId, frame.frameId);
    if (snapshot) frameSnapshots.push({ frameId: frame.frameId, snapshot });
  })), FRAME_SNAPSHOT_TIMEOUT_MS, []);
  if (!frameSnapshots.length) return fallback;
  const topSnapshot = frameSnapshots.find((entry) => entry.frameId === 0 || entry.snapshot.frame?.isTop)?.snapshot ?? topFallback;
  if (!topSnapshot) return undefined;
  const mergedElements: NonNullable<RecordingEventPayload["element"]>[] = [];
  // The top frame's evidence leads the merged collections: within one document
  // the content script reports dialogs and blockers top-most first, and no
  // stacking order exists across documents, so the page's own comes first and
  // the frames follow in the order they answered.
  let topEvidence: PageEvidence | undefined;
  const frameEvidence: PageEvidence[] = [];
  for (const entry of frameSnapshots) {
    const isTopEntry = entry.snapshot === topSnapshot || entry.snapshot.frame?.isTop === true;
    const elements = isTopEntry
      ? entry.snapshot.interactiveElements
      : translateFrameElements(entry.snapshot, topSnapshot, entry.frameId);
    mergedElements.push(...elements);
    const evidence = pageEvidenceOf(entry.snapshot);
    if (!evidence) continue;
    if (isTopEntry) topEvidence ??= evidence;
    else frameEvidence.push(frameEvidenceInTopFrameTerms(evidence, entry.snapshot, topSnapshot, entry.frameId));
  }
  const merged: DomSnapshotPayloadWithEvidence = {
    ...topSnapshot,
    interactiveElements: mergedElements
  };
  const evidence = mergePageEvidence(
    topEvidence ? [topEvidence, ...frameEvidence] : frameEvidence,
    topEvidence ?? pageEvidenceOf(topSnapshot)
  );
  if (evidence) merged.evidence = evidence;
  return merged;
}

/** The page evidence on a snapshot, which the domain's input type does not declare. */
export function pageEvidenceOf(snapshot: DomSnapshotPayload): PageEvidence | undefined {
  const evidence = (snapshot as DomSnapshotPayloadWithEvidence).evidence;
  return objectValue(evidence) ? evidence : undefined;
}

/**
 * One child frame's evidence, restated so it means the same thing on the merged
 * page: every selector qualified by the frame it belongs to, exactly as
 * `translateFrameElements` qualifies an element's, and every rect moved into
 * the top frame's document coordinates so it can be compared with the rest.
 *
 * A selector left bare would resolve against the wrong document, or against
 * nothing; a rect left bare would place a child frame's dialog at the top of
 * the page. Both are worse than saying less.
 *
 * Written key by key rather than as `{ ...evidence, <what changes> }`: besides
 * the reason in the file header, a blanket spread carries a *new* field through
 * untouched, so a contract field added tomorrow that holds a selector or a rect
 * would be copied out of the child frame bare -- resolving against the wrong
 * document, or drawn at the top of the page.
 */
function frameEvidenceInTopFrameTerms(
  evidence: PageEvidence,
  frameSnapshot: DomSnapshotPayload,
  topSnapshot: DomSnapshotPayload,
  frameId: number
): PageEvidence {
  const qualify = (selector: string): string => `frame[${frameId}] >> ${selector}`;
  // A rect that could not be placed on the top frame's page is omitted, never
  // carried through frame-local.
  const place = (bounds: RectDescriptor | undefined): RectDescriptor | undefined =>
    frameBoundsOnTopDocument(bounds, frameSnapshot, topSnapshot, frameId);
  const { dialogs, overlays } = evidence;
  return present<PageEvidence>({
    elements: evidence.elements,
    loading: present<LoadingEvidence>({
      documentState: evidence.loading.documentState,
      busy: evidence.loading.busy,
      busyRegions: evidence.loading.busyRegions.map(qualify),
      indicators: evidence.loading.indicators.map((indicator) =>
        present<LoadingIndicator>({ selector: qualify(indicator.selector), kind: indicator.kind, label: indicator.label })),
      pendingNavigation: evidence.loading.pendingNavigation
    }),
    navigation: evidence.navigation,
    dialogs: dialogs && present<DialogEvidence>({
      open: dialogs.open.map((dialog) => present<DialogEvidenceItem>({
        selector: qualify(dialog.selector), role: dialog.role, modal: dialog.modal,
        native: dialog.native, label: dialog.label, bounds: place(dialog.bounds)
      })),
      modal: dialogs.modal,
      armPending: dialogs.armPending,
      lastNative: dialogs.lastNative
    }),
    overlays: overlays && present<OverlayEvidence>({
      tested: overlays.tested,
      blockedCount: overlays.blockedCount,
      blockers: overlays.blockers.map((blocker) => present<OverlayEvidenceItem>({
        selector: qualify(blocker.selector), role: blocker.role, label: blocker.label,
        bounds: place(blocker.bounds), blocks: blocker.blocks, blocked: blocker.blocked.map(qualify)
      }))
    }),
    // Key order follows `content/evidence/regions.ts`, not the contract's declaration order, so the restated JSON stays byte-identical.
    regions: evidence.regions?.map((region) =>
      present<RegionEvidence>({ role: region.role, selector: qualify(region.selector), label: region.label, bounds: place(region.bounds) })),
    repeating: evidence.repeating?.map((structure) => present<RepeatingStructureEvidence>({
      containerSelector: qualify(structure.containerSelector),
      signature: structure.signature,
      itemCount: structure.itemCount,
      representative: present<RepeatingStructureEvidence["representative"]>({
        selector: qualify(structure.representative.selector), testId: structure.representative.testId, text: structure.representative.text
      }),
      fields: structure.fields
    })),
    forms: evidence.forms?.map((form) => present<FormEvidence>({
      selector: qualify(form.selector), name: form.name, label: form.label,
      action: form.action, method: form.method, controlCount: form.controlCount,
      controls: form.controls.map((control) => present<FormControlEvidence>({
        selector: qualify(control.selector), controlType: control.controlType, name: control.name, label: control.label, required: control.required,
        disabled: control.disabled, hasValue: control.hasValue, autocomplete: control.autocomplete, sensitive: control.sensitive
      })),
      submit: form.submit ? qualify(form.submit) : undefined
    }))
  });
}

/**
 * A rect measured inside one frame, placed on the top frame's page. The element
 * translator already knows this arithmetic and is the only place that should,
 * so a bounds-only descriptor is handed to it rather than the sums repeated
 * here. Like an element's, the rect is left alone when the frame's viewport
 * offset is unknown, so evidence and elements stay in the same coordinates.
 */
function frameBoundsOnTopDocument(
  bounds: RectDescriptor | undefined,
  frameSnapshot: DomSnapshotPayload,
  topSnapshot: DomSnapshotPayload,
  frameId: number
): RectDescriptor | undefined {
  if (!bounds) return undefined;
  const [placed] = translateFrameElements(
    { ...frameSnapshot, interactiveElements: [{ tagName: "div", selector: "", documentBounds: bounds }] },
    topSnapshot,
    frameId
  );
  return placed?.documentBounds;
}

/**
 * The page's evidence from every frame's, item by item. `contributions` are the
 * frames' evidence with the top frame's first, already restated in the top
 * frame's terms; `base` is the top frame's, which supplies the items that
 * describe one document and cannot be merged.
 *
 * - **Element totals** are summed, and `truncated` is true when any frame
 *   truncated. Merging the element lists without merging their counts is what
 *   made `elements.returned` read low against a merged snapshot.
 * - **Dialogs, overlays, regions, repeating structures and forms** are
 *   concatenated: each is a statement about a document, and every document on
 *   the page contributes. `modal` and the arming flag are true when any frame
 *   says so, because a modal in a child frame still blocks that frame, and
 *   `lastNative` is the most recent across frames.
 * - **Loading** is split. `busy`, `pendingNavigation`, the busy regions and the
 *   indicators merge -- a page is still working if any of its documents is --
 *   but `documentState` is `document.readyState`, which belongs to one
 *   document, so the top frame's is kept rather than invented. A merged
 *   snapshot can therefore read `complete` and still be busy, which is the
 *   honest answer for a page whose iframe is mid-load.
 * - **Navigation** is the top frame's, whole. A child frame's URL, referrer and
 *   history length are not the page's, and reporting an ad iframe's origin as
 *   the page's origin would be worse than reporting nothing.
 */
function mergePageEvidence(contributions: readonly PageEvidence[], base: PageEvidence | undefined): PageEvidence | undefined {
  if (!contributions.length) return base;
  const anchor = base ?? contributions[0];
  if (!anchor) return undefined;
  const regions = cappedList(contributions.flatMap((evidence) => evidence.regions ?? []), MAX_MERGED_REGIONS);
  const repeating = cappedList(contributions.flatMap((evidence) => evidence.repeating ?? []), MAX_MERGED_REPEATING);
  const forms = cappedList(contributions.flatMap((evidence) => evidence.forms ?? []), MAX_MERGED_FORMS);
  const dialogs = mergeDialogEvidence(contributions);
  const overlays = mergeOverlayEvidence(contributions);
  // Every key of the contract, named. This is the totality the merge lives or
  // dies by: an item left out here is produced by every frame and then dropped
  // from the page, which is invisible on a single-frame fixture.
  return present<PageEvidence>({
    elements: present<SnapshotElementTotals>({
      scanned: sumOf(contributions, (evidence) => evidence.elements.scanned),
      candidates: sumOf(contributions, (evidence) => evidence.elements.candidates),
      matched: sumOf(contributions, (evidence) => evidence.elements.matched),
      returned: sumOf(contributions, (evidence) => evidence.elements.returned),
      truncated: contributions.some((evidence) => evidence.elements.truncated),
      changed: sumOf(contributions, (evidence) => evidence.elements.changed),
      recentlyInteracted: sumOf(contributions, (evidence) => evidence.elements.recentlyInteracted)
    }),
    loading: present<LoadingEvidence>({
      documentState: anchor.loading.documentState,
      busy: contributions.some((evidence) => evidence.loading.busy),
      busyRegions: contributions.flatMap((evidence) => evidence.loading.busyRegions).slice(0, MAX_MERGED_BUSY_REGIONS),
      indicators: contributions.flatMap((evidence) => evidence.loading.indicators).slice(0, MAX_MERGED_LOADING_INDICATORS),
      pendingNavigation: contributions.some((evidence) => evidence.loading.pendingNavigation)
    }),
    navigation: anchor.navigation,
    dialogs,
    overlays,
    regions,
    repeating,
    forms
  });
}

function mergeDialogEvidence(contributions: readonly PageEvidence[]): DialogEvidence | undefined {
  const reported = contributions.flatMap((evidence) => (evidence.dialogs ? [evidence.dialogs] : []));
  if (!reported.length) return undefined;
  const native = reported
    .flatMap((dialogs) => (dialogs.lastNative ? [dialogs.lastNative] : []))
    .sort((left: NativeDialogEvidence, right: NativeDialogEvidence) => right.at - left.at)[0];
  return present<DialogEvidence>({
    open: reported.flatMap((dialogs) => dialogs.open).slice(0, MAX_MERGED_DIALOGS),
    modal: reported.some((dialogs) => dialogs.modal),
    armPending: reported.some((dialogs) => dialogs.armPending) ? true : undefined,
    lastNative: native
  });
}

function mergeOverlayEvidence(contributions: readonly PageEvidence[]): OverlayEvidence | undefined {
  const reported = contributions.flatMap((evidence) => (evidence.overlays ? [evidence.overlays] : []));
  if (!reported.length) return undefined;
  return present<OverlayEvidence>({
    tested: reported.reduce((total, overlays) => total + overlays.tested, 0),
    blockedCount: reported.reduce((total, overlays) => total + overlays.blockedCount, 0),
    // Most-blocking first, as within one frame. Array sort is stable, so frames
    // that block equally keep the order they answered in.
    blockers: reported.flatMap((overlays) => overlays.blockers).sort((left, right) => right.blocks - left.blocks).slice(0, MAX_MERGED_BLOCKERS)
  });
}

function sumOf(contributions: readonly PageEvidence[], read: (evidence: PageEvidence) => number): number {
  return contributions.reduce((total, evidence) => total + read(evidence), 0);
}

function cappedList<T>(items: T[], cap: number): T[] | undefined {
  return items.length ? items.slice(0, cap) : undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
