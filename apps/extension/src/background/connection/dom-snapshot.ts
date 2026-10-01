// The DOM snapshot payload the content script produces, and how the background
// worker collects one per frame and merges them into a single tab snapshot.
//
// Merging is per item, not per snapshot. The elements of every frame become one
// list -- whole: there is no merged cap on it or on any collection beside it
// (t200) -- and so does every page-level evidence item that is additive: a
// dialog in a child frame is a dialog on the page, a covered control is covered
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
//
// An element's own facts cross the merge with it: a child frame's descriptors
// are carried whole, only their selector, bounds and frame attributes restated
// (`frame-geometry.ts`), so `frontLayer`, `leadStatement` and `repeatCount`
// arrive on the merged list as the frame wrote them, and so do `ownText` and
// `hidden`. `parent` is the one an element's own fact the merge restates: it is
// an index into its frame's list, and is moved to where that frame's block
// starts on the merged one (t223). A look asked `includeHidden` asks every
// frame for its hidden elements too. A dialog's or a blocker's
// `kind` is restated key by key like the rest of its entry.
//
// A frame that does not answer is named, not dropped: its id goes on the
// merged evidence as `unansweredFrameIds`. A robot check or a consent wall is
// often a child frame, and "the page has no wall" and "the frame holding the
// wall did not answer" must not read the same.

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

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

/**
 * How long the merge waits for the frame list, and for each frame's snapshot;
 * the frames are asked at once, so this is also about how long the whole merge
 * waits for them.
 *
 * It was 150 ms, sized for a capture of at most 2,000 ranked elements, and a
 * frame that answered after it was dropped without a word. A capture now
 * describes every element of its frame (t200) -- a selector, a name, a label
 * and a context for each -- so a large frame needs far longer than that; the
 * time a capture takes on a real page is measured on the Lab's scenarios, not
 * assumed here. Ten seconds is long enough for a large frame and still leaves
 * the look inside Core's thirty-second default wait for a command sent without
 * a timeout of its own, after the top frame's own capture. A frame with no
 * listener at all is refused by the browser at once and does not wait. A
 * caller with a deadline of its own passes a shorter wait (`waitMs`).
 */
const FRAME_SNAPSHOT_WAIT_MS = 10_000;

/** What a caller may say about how the merge waits. */
export type MergedSnapshotOptions = {
  /** How long to wait for the frame list and each frame; `FRAME_SNAPSHOT_WAIT_MS` when absent. */
  readonly waitMs?: number;
  /** Ask every frame for its hidden elements too (`shared/snapshot-capture-options.ts`); a seed snapshot is taken as given. */
  readonly includeHidden?: boolean;
};

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
  frameId: number,
  waitMs: number = FRAME_SNAPSHOT_WAIT_MS,
  includeHidden = false
): Promise<DomSnapshotPayload | undefined> {
  // The flag rides only when set, so every other capture asks exactly as it always did.
  const message = includeHidden ? { type: "captureSnapshot", includeHidden: true } : { type: "captureSnapshot" };
  const snapshot = await withTimeout(transport.sendToTab(tabId, message, frameId), waitMs, undefined);
  return isDomSnapshotPayload(snapshot) ? snapshot : undefined;
}

/**
 * Every frame of the tab, merged into one snapshot.
 *
 * `seedSnapshot` is a snapshot already in hand, from `seedFrameId`: the one a
 * recorded event carried, or the top frame's own look. It is not asked for
 * again, and it leads the element list, because the frame an interaction
 * happened in is what a reader looks at first (`tests/recording-evidence.test.ts`
 * pins it). The top frame follows, then every other frame in the order the
 * browser lists them -- a fixed order, where it used to be whichever answered
 * first.
 *
 * The top frame is read once, beside the frame list, and stands for frame 0
 * whether or not the list names it. Every other listed frame is asked at the
 * same time; one that has not answered when the wait ends is named in
 * `evidence.unansweredFrameIds`.
 */
export async function captureMergedTabSnapshot(
  transport: TabSnapshotTransport,
  tabId: number,
  seedSnapshot?: DomSnapshotPayload,
  seedFrameId?: number,
  options: MergedSnapshotOptions = {}
): Promise<DomSnapshotPayload | undefined> {
  const waitMs = options.waitMs ?? FRAME_SNAPSHOT_WAIT_MS;
  const includeHidden = options.includeHidden === true;
  const seed = seedSnapshot && seedFrameId !== undefined ? { frameId: seedFrameId, snapshot: seedSnapshot } : undefined;
  const topRead = seed?.frameId === TOP_FRAME_ID
    ? Promise.resolve(seed.snapshot)
    : captureSingleFrameSnapshot(transport, tabId, TOP_FRAME_ID, waitMs, includeHidden);
  const listed = await withTimeout(transport.allTabFrames(tabId), waitMs, []);
  const childIds = [...new Set(listed.map((frame) => frame.frameId))]
    .filter((frameId) => frameId !== TOP_FRAME_ID && frameId !== seed?.frameId);
  const [topAnswer, ...childAnswers] = await Promise.all([
    topRead,
    ...childIds.map((frameId) => captureSingleFrameSnapshot(transport, tabId, frameId, waitMs, includeHidden))
  ]);

  const answered: Array<{ frameId: number; snapshot: DomSnapshotPayload }> = [];
  if (seed) answered.push(seed);
  if (topAnswer && seed?.frameId !== TOP_FRAME_ID) answered.push({ frameId: TOP_FRAME_ID, snapshot: topAnswer });
  const unansweredFrameIds: number[] = [];
  childIds.forEach((frameId, index) => {
    const snapshot = childAnswers[index];
    if (snapshot) answered.push({ frameId, snapshot });
    else unansweredFrameIds.push(frameId);
  });

  const topSnapshot = topAnswer ?? answered.find((entry) => entry.snapshot.frame?.isTop === true)?.snapshot;
  if (!topSnapshot) return undefined;
  const collectedElements: NonNullable<RecordingEventPayload["element"]>[] = [];
  // The top frame's evidence leads the merged collections: within one document
  // the content script reports dialogs top-most first, and no stacking order
  // exists across documents, so the page's own comes first and the frames
  // follow in the order above.
  let topEvidence: PageEvidence | undefined;
  const frameEvidence: PageEvidence[] = [];
  for (const entry of answered) {
    const isTopEntry = entry.snapshot === topSnapshot || entry.snapshot.frame?.isTop === true;
    const elements = isTopEntry
      ? entry.snapshot.interactiveElements
      : translateFrameElements(entry.snapshot, topSnapshot, entry.frameId);
    // One at a time rather than `push(...elements)`: a spread passes every
    // element as an argument, and a large frame has more than a call accepts.
    // Each frame's `parent` indexes its own list; on the merged list its block
    // starts further down, so the index moves with it.
    const blockStart = collectedElements.length;
    for (const element of elements) collectedElements.push(withParentOffset(element, blockStart));
    const evidence = pageEvidenceOf(entry.snapshot);
    if (!evidence) continue;
    if (isTopEntry) topEvidence ??= evidence;
    else frameEvidence.push(frameEvidenceInTopFrameTerms(evidence, entry.snapshot, topSnapshot, entry.frameId));
  }
  const merged: DomSnapshotPayload = {
    ...topSnapshot,
    interactiveElements: collectedElements
  };
  const evidence = mergePageEvidence(
    topEvidence ? [topEvidence, ...frameEvidence] : frameEvidence,
    topEvidence ?? pageEvidenceOf(topSnapshot),
    unansweredFrameIds
  );
  if (evidence) merged.evidence = evidence;
  return merged;
}

/**
 * The element with its `parent` -- an index into its own frame's list -- moved
 * to where that frame's block starts on the merged list. The element itself is
 * returned when there is nothing to move, so a single-frame look is unchanged.
 */
function withParentOffset(element: NonNullable<RecordingEventPayload["element"]>, blockStart: number): NonNullable<RecordingEventPayload["element"]> {
  if (blockStart === 0 || typeof element.parent !== "number") return element;
  // Copied whole, as the merge carries every element (the header): only `parent` is restated.
  return Object.assign({}, element, { parent: element.parent + blockStart });
}

/** The page evidence on a snapshot, when what arrived under the domain input's `evidence` key is an object. */
export function pageEvidenceOf(snapshot: DomSnapshotPayload): PageEvidence | undefined {
  const evidence = snapshot.evidence;
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
        native: dialog.native, label: dialog.label, bounds: place(dialog.bounds), kind: dialog.kind
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
        bounds: place(blocker.bounds), blocks: blocker.blocks, blocked: blocker.blocked.map(qualify), kind: blocker.kind
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
    })),
    // Frame ids are the tab's, not the frame's, so a list a frame reported --
    // none does today; only the merge writes one -- needs no restating.
    unansweredFrameIds: evidence.unansweredFrameIds
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
 *   says it truncated -- which no capture does any more (t200); the merge
 *   drops nothing either, so `returned` is every frame's sum. Merging the
 *   element lists without merging their counts is what made
 *   `elements.returned` read low against a merged snapshot.
 * - **Dialogs, overlays, regions, repeating structures and forms** are
 *   concatenated, whole and in frame order: each is a statement about a
 *   document, and every document on the page contributes. `modal` and the
 *   arming flag are true when any frame says so, because a modal in a child
 *   frame still blocks that frame, and `lastNative` is the most recent across
 *   frames. Blockers keep each frame's document order; they are no longer
 *   sorted by how much they block and cut to ten.
 * - **Unanswered frames** are the child frames the merge asked and heard
 *   nothing from, named so their absence is not read as an empty frame.
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
function mergePageEvidence(contributions: readonly PageEvidence[], base: PageEvidence | undefined, unansweredFrameIds: readonly number[]): PageEvidence | undefined {
  if (!contributions.length) return base;
  const anchor = base ?? contributions[0];
  if (!anchor) return undefined;
  const regions = nonEmpty(contributions.flatMap((evidence) => evidence.regions ?? []));
  const repeating = nonEmpty(contributions.flatMap((evidence) => evidence.repeating ?? []));
  const forms = nonEmpty(contributions.flatMap((evidence) => evidence.forms ?? []));
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
      busyRegions: contributions.flatMap((evidence) => evidence.loading.busyRegions),
      indicators: contributions.flatMap((evidence) => evidence.loading.indicators),
      pendingNavigation: contributions.some((evidence) => evidence.loading.pendingNavigation)
    }),
    navigation: anchor.navigation,
    dialogs,
    overlays,
    regions,
    repeating,
    forms,
    unansweredFrameIds: nonEmpty([...unansweredFrameIds, ...contributions.flatMap((evidence) => evidence.unansweredFrameIds ?? [])])
  });
}

function mergeDialogEvidence(contributions: readonly PageEvidence[]): DialogEvidence | undefined {
  const reported = contributions.flatMap((evidence) => (evidence.dialogs ? [evidence.dialogs] : []));
  if (!reported.length) return undefined;
  const native = reported
    .flatMap((dialogs) => (dialogs.lastNative ? [dialogs.lastNative] : []))
    .sort((left: NativeDialogEvidence, right: NativeDialogEvidence) => right.at - left.at)[0];
  return present<DialogEvidence>({
    open: reported.flatMap((dialogs) => dialogs.open),
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
    // Each frame's blockers in its own document order, the frames in merge order.
    blockers: reported.flatMap((overlays) => overlays.blockers)
  });
}

function sumOf(contributions: readonly PageEvidence[], read: (evidence: PageEvidence) => number): number {
  return contributions.reduce((total, evidence) => total + read(evidence), 0);
}

/** The list, or `undefined` for an empty one: an item nothing reported is absent, not present and empty. */
function nonEmpty<T>(items: T[]): T[] | undefined {
  return items.length ? items : undefined;
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
