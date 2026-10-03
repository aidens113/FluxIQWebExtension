// The shapes a run's UI review is kept in (`recorder.ts` says why the review exists).

/** Where in a run a moment was taken. */
export type UiReviewLabel = "start" | "mid-build" | "flow-run" | "end" | "failure";

/** What the run is doing, as the spine's hooks report it. `end` and `failure` are terminal. */
export type UiReviewPhase = "start" | "build" | "flow-run" | "end" | "failure";

/** One read of `<fluxiq-activity-overlay>` in the scenario tab's top frame. */
export type OverlaySample = {
  /** Milliseconds from the start of its window. */
  atMs: number;
  /** A host element is in the document. */
  present: boolean;
  /** How many hosts the document holds; more than one means two overlays disagree. */
  hostCount: number;
  /** Present, displayed, not `visibility: hidden`, opacity above 0.05, with a non-empty box that meets the viewport. */
  visible: boolean;
  rect?: { x: number; y: number; width: number; height: number };
  display?: string;
  visibility?: string;
  opacity?: number;
  /** The box meets the viewport. */
  inViewport?: boolean;
  /** The host's attributes, screened. */
  attributes?: Record<string, string>;
  /** Every text node under the host, its closed shadow root included, in document order, screened. */
  textParts?: string[];
  /** `textParts` joined with " | ": what is compared for a change. */
  text?: string;
  /** The first text part, which the overlay's layout (`content/activity-overlay/overlay.ts`) gives to the phase name. */
  phaseName?: string;
  /** The part the card writes as `· <step>`, when there is one. */
  step?: string;
  /** `document.visibilityState` of the sampled tab: a hidden tab does not paint, whatever the overlay says. */
  documentVisibility?: string;
  /**
   * `performance.timeOrigin` of the document the read was taken in: it changes
   * whenever the tab loads a new document and only then, so two samples with
   * different values were read from different documents. Absent on a failed read.
   */
  documentOrigin?: number;
  /** The location of the document the read was taken in, screened as other recorded locations are (`screenLocation`). Absent on a failed read. */
  pageUrl?: string;
  /** Why this read failed; the other fields are then absent. */
  error?: string;
};

/** What a window of samples shows. */
export type OverlayChangeCounts = {
  samples: number;
  readFailures: number;
  presentSamples: number;
  visibleSamples: number;
  /** A present sample whose text differs from the previous present sample's. */
  textChanges: number;
  /** Present flipped between consecutive readable samples, a page load's gap excluded. */
  presenceToggles: number;
  /** Visible flipped between consecutive readable samples, a page load's gap excluded. */
  visibilityToggles: number;
  /**
   * Every change of document between consecutive readable samples that name
   * theirs (`documentOrigin`): the tab loaded a new page, whether or not the
   * overlay was absent across it.
   */
  pageLoads: number;
  /**
   * A single absent sample whose immediate neighbours were both readable, present,
   * and read from different documents: the browser swapping documents, which no
   * product code can bridge. It is counted here and as no toggle of either kind.
   */
  pageLoadGaps: number;
  /** A change back to a text already shown earlier in the window (A, B, A). */
  textRevisits: number;
  distinctTexts: number;
  /** A reading of the counts: `flickering` is a revisit, two or more toggles of either kind, or three or more text changes. */
  status: "absent" | "stable" | "changed" | "flickering";
};

export type OverlaySampleWindow = { startedAt: string; intervalMs: number; durationMs: number; pageUrl?: string; samples: OverlaySample[]; counts: OverlayChangeCounts; error?: string };

/** One PNG, or why there is none. `file` is relative to the runs directory. */
export type UiReviewCapture = {
  file?: string;
  /** What was photographed: `scenario-tab`, or for the panel `side-panel`, `popup`, or `control-page` when neither was found. */
  source: string;
  /** Screened location of what was photographed: origin and path. */
  location?: string;
  documentVisibility?: string;
  /** Scenario tab only: whether it was a tab the browser had in front (`chooseScenarioTab`); a tab that is not does not paint. */
  inFront?: boolean | "unknown";
  /** Scenario tab only: the screened locations of every tab the browser had in front. */
  frontTabs?: string[];
  /** How many regions were blacked out (the panel's pairing code). */
  masked?: number;
  /** The picture was not kept, and why. */
  withheld?: string;
  error?: string;
  ms?: number;
  /** When the capture began. */
  takenAt?: string;
  /** The capture's span in ms on its moment's overlay window clock (from `overlay.startedAt`); negative before the first read (`placeCaptureInWindow`). */
  windowMs?: { from: number; to: number };
  /** Indices into the moment's overlay samples: the last read begun before the capture and the first begun after it. */
  overlaySamples?: { lastBefore?: number; firstAfter?: number };
};

export type UiReviewMoment = { index: number; label: UiReviewLabel; phase: UiReviewPhase; at: string; atMs: number; scenario: UiReviewCapture; panel: UiReviewCapture; overlay: OverlaySampleWindow };
