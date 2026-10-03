// What FluxIQ is doing now, as the background worker knows it. Core pushes
// `server.activity` over the gateway; the relay keeps the latest state, paces
// it into the one status a person reads (`pacer.ts`), and fans it
// out: the whole state to the panel pages, and the paced display to the top
// frame of the tab the automation drives and of the tab in front of the person
// when that is another one (`overlay-target.ts`), where the overlay draws it.
// A Flow's test can run in one tab while a result it opened sits in front
// (moment 8 and screenshot 00013 of the run-murwd8le-79e735a8 UI review), and
// the person must see the status on the page they are looking at.
//
// Fan-out is rate-bound (`fan-out-gate.ts`): at most four sends a second to
// each audience, the last change of a burst always sent, and only to whom it
// concerns -- the panels when the display or the event list changed, the page
// when the display or the overlay preference did.
//
// The chat tells every unit of work as step messages, so the relay also keeps
// each recent unit's whole story (`unit-history.ts`), beside `recent`, which
// stays the last 60 events of every kind. Neither feeds the pacer: it sees
// every event as it arrives.
//
// Activity is ephemeral (plan D2): nothing here is a durable record, and a
// worker restart forgets it. The overlay preference is the one thing kept, in
// `chrome.storage.local`, because it is the person's choice rather than Core's.
//
// Every delivery is best-effort and the two audiences are independent. A panel
// that is not open, a page the content script cannot reach, or a tab that
// closed mid-send loses one frame of a status display and nothing else: none
// of those failures reaches Core or the gateway, and a panel send that fails
// or never settles cannot hold back the page. A page send that never settles
// -- a document torn down by a navigation mid-send -- is given up after
// `PAGE_SEND_TIMEOUT_MS`, so it cannot hold back the next one either.
//
// A navigation replaces the document the overlay was drawn in (U7 of the t174
// live lane's UI review: the overlay dropped out on every navigation). The new
// document's content script announces itself at `document_start`, and the
// relay answers it at once with the current display: not through the page
// gate, and not behind a delivery still in flight to the old document. The
// overlay then draws without an entry animation (`status-pill.ts`), so the
// only gap a person or the Lab's sampler sees is the browser's own reload.

import {
  ACTIVITY_MESSAGES,
  ACTIVITY_RECENT_LIMIT,
  type ActivityContentMessage,
  type ActivityOverlayPreference,
  type ClientGatewayActivity,
  type ExtensionActivityState,
  ACTIVITY_DONE_VISIBLE_MS
} from "../../shared/activity/index";
import { systemActivityClock, type ActivityClock } from "./clock";
import { ActivityPacer } from "./pacer";
import { FanOutGate } from "./fan-out-gate";
import { UnitHistory } from "./unit-history";

/** The top frame's id in every tab; the overlay lives only there. */
const TOP_FRAME_ID = 0;

/** The longest one page send is waited for before the next may go. */
export const PAGE_SEND_TIMEOUT_MS = 3_000;

/** What the relay reaches storage, the panel pages, and the page through. */
export type ActivityRelayDeps = {
  /** The stored overlay preference, or undefined when none was ever saved. */
  readonly readOverlay: () => Promise<ActivityOverlayPreference | undefined>;
  readonly writeOverlay: (overlay: ActivityOverlayPreference) => Promise<void>;
  /** Sends to every extension page (the side panel and the popup). */
  readonly broadcast: (message: { type: typeof ACTIVITY_MESSAGES.changed; state: ExtensionActivityState }) => Promise<void>;
  /** The tab the automation drives, or undefined when there is none the overlay may draw on (`OverlayTarget.resolve`). */
  readonly automationTabId: () => Promise<number | undefined>;
  /**
   * Every tab the overlay is drawn in: the driven tab and the tab in front of
   * the person (`OverlayTarget.resolveAll`). When absent, the overlay is drawn
   * in `automationTabId` alone.
   */
  readonly overlayTabIds?: () => Promise<readonly number[]>;
  /** Makes the tab's top frame ready and hands it the message. May throw. */
  readonly deliverToTab: (tabId: number, message: ActivityContentMessage) => Promise<void>;
  /** A gateway session is ready, so Core can reach this browser. */
  readonly live: () => boolean;
  /** Defaults to the worker's own clock. */
  readonly clock?: ActivityClock;
};

export class ActivityRelay {
  private current: ClientGatewayActivity | null = null;
  private recent: ClientGatewayActivity[] = [];
  private readonly history = new UnitHistory();
  private overlay: ActivityOverlayPreference = "expanded";
  private lastSequence = Number.NEGATIVE_INFINITY;
  private loaded: Promise<void> | undefined;
  private readonly pacer: ActivityPacer;
  // One gate per audience, so the panels' traffic -- every event changes the
  // list they show -- never delays a display change on its way to the page.
  private readonly panelGate: FanOutGate;
  private readonly pageGate: FanOutGate;
  /** Something the panels show changed since the last broadcast. */
  private panelStale = false;
  // One delivery to the page at a time, and only the latest state after it:
  // the page shows one status, so a display overtaken while a send was in
  // flight has nothing left to say.
  private delivering = false;
  private redeliver = false;
  /** The tabs the overlay was last sent to, so it is taken down in any the target leaves. */
  private drawnIn: ReadonlySet<number> = new Set();
  /** When the display last changed, so a finished status that has had its time is not drawn again on a new page. */
  private displayChangedAt = Number.NEGATIVE_INFINITY;
  private readonly clock: ActivityClock;

  constructor(private readonly deps: ActivityRelayDeps) {
    const clock = deps.clock ?? systemActivityClock;
    this.clock = clock;
    this.pacer = new ActivityPacer({
      clock,
      onChange: () => {
        this.displayChangedAt = clock.now();
        this.displayChanged();
      }
    });
    this.panelGate = new FanOutGate(clock, () => this.broadcastIfStale());
    this.pageGate = new FanOutGate(clock, () => void this.deliver());
  }

  state(): ExtensionActivityState {
    return { current: this.current, display: this.pacer.display(), recent: [...this.recent], history: this.history.events(), overlay: this.overlay, live: this.deps.live() };
  }

  /** The state with the stored overlay preference read, for a panel asking now. */
  async read(): Promise<ExtensionActivityState> {
    await this.load();
    return this.state();
  }

  /**
   * Takes one `server.activity` payload. Returns whether it was kept: an event
   * that is malformed, or not newer than the last one kept, is dropped.
   */
  async accept(activity: unknown): Promise<boolean> {
    if (!isActivity(activity) || activity.sequence <= this.lastSequence) return false;
    this.lastSequence = activity.sequence;
    this.current = activity;
    this.recent = [...this.recent, activity].slice(-ACTIVITY_RECENT_LIMIT);
    this.history.accept(activity);
    await this.load();
    // Marked before the pacer runs, so a display change it makes goes out in
    // the same send as the event list rather than one interval later.
    this.panelStale = true;
    this.pacer.accept(activity);
    if (this.panelStale) this.panelGate.request();
    return true;
  }

  /**
   * A new gateway session. Core's sequence is per process, so a Core that
   * restarted counts from the start again; without this every event after its
   * restart would look stale until it passed the old count.
   */
  noteSessionReady(): void {
    this.lastSequence = Number.NEGATIVE_INFINITY;
  }

  async setOverlay(overlay: ActivityOverlayPreference): Promise<ExtensionActivityState> {
    await this.load();
    this.overlay = overlay;
    try {
      await this.deps.writeOverlay(overlay);
    } catch {
      /* best-effort: the preference still applies until the worker restarts */
    }
    this.displayChanged();
    return this.state();
  }

  /**
   * A content script announced itself. When it is the automation tab's top
   * frame -- a navigation replaced the document the overlay was drawn in --
   * it gets the current display again at once: outside the rate bound, since
   * it is one message per document, and outside the delivery queue, since a
   * send still in flight is to the document that just went away. A finished
   * status that has already had its time on screen is not drawn again.
   */
  async noteContentReady(tabId: number | undefined, frameId: number | undefined): Promise<void> {
    if (tabId === undefined || (frameId ?? TOP_FRAME_ID) !== TOP_FRAME_ID) return;
    const display = this.pacer.display();
    if (display === null) return;
    if (display.outcome === "done" && this.clock.now() - this.displayChangedAt >= ACTIVITY_DONE_VISIBLE_MS) return;
    await this.load();
    // A tab the overlay is drawn in is answered at once: a navigation there is
    // the common case, and every lookup before the answer is time the page
    // shows without the overlay (moment 7 of the run-murwd8le-79e735a8 review).
    if (!this.drawnIn.has(tabId)) {
      let targets: readonly number[];
      try {
        targets = await this.targets();
      } catch {
        /* best-effort: the tab list could not be read, so the new page stays without the overlay until the next change */
        return;
      }
      if (!targets.includes(tabId)) return;
      this.drawnIn = new Set([...this.drawnIn, tabId]);
    }
    await this.send(tabId, this.contentMessage());
  }

  /** What the page draws changed: the display, or the overlay preference. The panels show both too. */
  private displayChanged(): void {
    this.panelStale = true;
    this.panelGate.request();
    this.pageGate.request();
  }

  private broadcastIfStale(): void {
    if (!this.panelStale) return;
    this.panelStale = false;
    void this.broadcast();
  }

  private async broadcast(): Promise<void> {
    try {
      await this.deps.broadcast({ type: ACTIVITY_MESSAGES.changed, state: this.state() });
    } catch {
      /* best-effort: no panel page is open to receive it */
    }
  }

  /** Sends the display to the automation tab. */
  private async deliver(): Promise<void> {
    if (this.delivering) {
      this.redeliver = true;
      return;
    }
    this.delivering = true;
    try {
      do {
        this.redeliver = false;
        await this.deliverOnce();
      } while (this.redeliver);
    } finally {
      this.delivering = false;
    }
  }

  private async deliverOnce(): Promise<void> {
    let targets: readonly number[];
    try {
      targets = await this.targets();
    } catch {
      /* best-effort: the tab list could not be read, so this frame of the status is drawn nowhere */
      return;
    }
    const message = this.contentMessage();
    const previous = this.drawnIn;
    this.drawnIn = new Set(targets);
    // A tab the overlay no longer belongs in is cleared: the status left there
    // would go stale. The tabs are sent to side by side, so one that never
    // answers holds back none of the others.
    const leaving = [...previous].filter((tabId) => !this.drawnIn.has(tabId));
    await Promise.all([
      ...leaving.map((tabId) => this.send(tabId, { ...message, activity: null, display: null })),
      ...targets.map((tabId) => this.send(tabId, message))
    ]);
  }

  /** The tabs to draw in now, each once; the driven tab first. */
  private async targets(): Promise<readonly number[]> {
    if (this.deps.overlayTabIds) return [...new Set(await this.deps.overlayTabIds())];
    const tabId = await this.deps.automationTabId();
    return tabId === undefined ? [] : [tabId];
  }

  private contentMessage(): ActivityContentMessage {
    return {
      type: ACTIVITY_MESSAGES.content,
      activity: this.current,
      display: this.pacer.display(),
      overlay: this.overlay,
      topFrameOnly: true
    };
  }

  private async send(tabId: number, message: ActivityContentMessage): Promise<void> {
    let timer: unknown;
    const givenUp = new Promise<void>((resolve) => {
      timer = this.clock.setTimeout(resolve, PAGE_SEND_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.deps.deliverToTab(tabId, message), givenUp]);
    } catch {
      /* best-effort: the page cannot host the overlay (closed, restricted, or navigating); contentReady re-sends */
    } finally {
      this.clock.clearTimeout(timer);
    }
  }

  private load(): Promise<void> {
    this.loaded ??= this.deps.readOverlay().then(
      (stored) => {
        if (stored !== undefined) this.overlay = stored;
      },
      () => {
        /* best-effort: storage unreadable, the default preference stands */
      }
    );
    return this.loaded;
  }
}

function isActivity(value: unknown): value is ClientGatewayActivity {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ClientGatewayActivity>;
  return typeof candidate.activityId === "string"
    && typeof candidate.sequence === "number"
    && Number.isFinite(candidate.sequence)
    && typeof candidate.phase === "string"
    && typeof candidate.label === "string";
}
