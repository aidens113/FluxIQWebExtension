// What FluxIQ is doing now, as the background worker knows it. Core pushes
// `server.activity` over the gateway; the relay keeps the latest state, paces
// it into the one status a person reads (`pacer.ts`), and fans it
// out: the whole state to the panel pages, and the paced display to the top
// frame of the tab the automation drives (`overlay-target.ts`), where the
// overlay draws it.
//
// Fan-out is rate-bound (`fan-out-gate.ts`): at most four sends a second to
// each audience, the last change of a burst always sent, and only to whom it
// concerns -- the panels when the display or the event list changed, the page
// when the display or the overlay preference did.
//
// Activity is ephemeral (plan D2): nothing here is a durable record, and a
// worker restart forgets it. The overlay preference is the one thing kept, in
// `chrome.storage.local`, because it is the person's choice rather than Core's.
//
// Every delivery is best-effort and the two audiences are independent. A panel
// that is not open, a page the content script cannot reach, or a tab that
// closed mid-send loses one frame of a status display and nothing else: none
// of those failures reaches Core or the gateway, and a panel send that fails
// or never settles cannot hold back the page.

import {
  ACTIVITY_MESSAGES,
  ACTIVITY_RECENT_LIMIT,
  type ActivityContentMessage,
  type ActivityOverlayPreference,
  type ClientGatewayActivity,
  type ExtensionActivityState
} from "../../shared/activity/index";
import { systemActivityClock, type ActivityClock } from "./clock";
import { ActivityPacer } from "./pacer";
import { FanOutGate } from "./fan-out-gate";

/** The top frame's id in every tab; the overlay lives only there. */
const TOP_FRAME_ID = 0;

/** What the relay reaches storage, the panel pages, and the page through. */
export type ActivityRelayDeps = {
  /** The stored overlay preference, or undefined when none was ever saved. */
  readonly readOverlay: () => Promise<ActivityOverlayPreference | undefined>;
  readonly writeOverlay: (overlay: ActivityOverlayPreference) => Promise<void>;
  /** Sends to every extension page (the side panel and the popup). */
  readonly broadcast: (message: { type: typeof ACTIVITY_MESSAGES.changed; state: ExtensionActivityState }) => Promise<void>;
  /** The tab the automation drives, or undefined when there is none the overlay may draw on (`OverlayTarget.resolve`). */
  readonly automationTabId: () => Promise<number | undefined>;
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
  /** The tab the overlay was last sent to, so it is taken down there when the target moves. */
  private drawnIn: number | undefined;

  constructor(private readonly deps: ActivityRelayDeps) {
    const clock = deps.clock ?? systemActivityClock;
    this.pacer = new ActivityPacer({ clock, onChange: () => this.displayChanged() });
    this.panelGate = new FanOutGate(clock, () => this.broadcastIfStale());
    this.pageGate = new FanOutGate(clock, () => void this.deliver());
  }

  state(): ExtensionActivityState {
    return { current: this.current, display: this.pacer.display(), recent: [...this.recent], overlay: this.overlay, live: this.deps.live() };
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
   * it gets the current display again, outside the rate bound: it is one
   * message per document.
   */
  async noteContentReady(tabId: number | undefined, frameId: number | undefined): Promise<void> {
    if (tabId === undefined || (frameId ?? TOP_FRAME_ID) !== TOP_FRAME_ID) return;
    if (this.pacer.display() === null) return;
    await this.load();
    await this.deliver(tabId);
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

  /** Sends the display to the automation tab; with `onlyTo`, only when that tab is the automation tab. */
  private async deliver(onlyTo?: number): Promise<void> {
    if (this.delivering) {
      this.redeliver = true;
      return;
    }
    this.delivering = true;
    try {
      let only = onlyTo;
      do {
        this.redeliver = false;
        await this.deliverOnce(only);
        only = undefined;
      } while (this.redeliver);
    } finally {
      this.delivering = false;
    }
  }

  private async deliverOnce(onlyTo: number | undefined): Promise<void> {
    let tabId: number | undefined;
    try {
      tabId = await this.deps.automationTabId();
    } catch {
      /* best-effort: the tab list could not be read, so this frame of the status is drawn nowhere */
      return;
    }
    if (onlyTo !== undefined && onlyTo !== tabId) return;
    const message: ActivityContentMessage = {
      type: ACTIVITY_MESSAGES.content,
      activity: this.current,
      display: this.pacer.display(),
      overlay: this.overlay,
      topFrameOnly: true
    };
    const previous = this.drawnIn;
    this.drawnIn = tabId;
    // The automation moved to another tab: the status left there would go stale.
    if (previous !== undefined && previous !== tabId) await this.send(previous, { ...message, activity: null, display: null });
    if (tabId !== undefined) await this.send(tabId, message);
  }

  private async send(tabId: number, message: ActivityContentMessage): Promise<void> {
    try {
      await this.deps.deliverToTab(tabId, message);
    } catch {
      /* best-effort: the page cannot host the overlay (closed, restricted, or navigating); contentReady re-sends */
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
