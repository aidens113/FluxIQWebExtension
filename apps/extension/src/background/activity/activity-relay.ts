// What FluxIQ is doing now, as the background worker knows it. Core pushes
// `server.activity` over the gateway; the relay keeps the latest state and
// fans it out: the whole state to the panel pages, and the current event to the
// top frame of the tab the automation drives, where the overlay draws it.
//
// Activity is ephemeral (plan D2): nothing here is a durable record, and a
// worker restart forgets it. The overlay preference is the one thing kept, in
// `chrome.storage.local`, because it is the person's choice rather than Core's.
//
// Every delivery is best-effort. A panel that is not open, a page the content
// script cannot reach, or a tab that closed mid-send loses one frame of a
// status display and nothing else, so none of those failures reaches Core or
// the gateway.

import {
  ACTIVITY_MESSAGES,
  ACTIVITY_RECENT_LIMIT,
  type ActivityContentMessage,
  type ActivityOverlayPreference,
  type ClientGatewayActivity,
  type ExtensionActivityState
} from "../../shared/activity/index";

/** The top frame's id in every tab; the overlay lives only there. */
const TOP_FRAME_ID = 0;

/** What the relay reaches storage, the panel pages, and the page through. */
export type ActivityRelayDeps = {
  /** The stored overlay preference, or undefined when none was ever saved. */
  readonly readOverlay: () => Promise<ActivityOverlayPreference | undefined>;
  readonly writeOverlay: (overlay: ActivityOverlayPreference) => Promise<void>;
  /** Sends to every extension page (the side panel and the popup). */
  readonly broadcast: (message: { type: typeof ACTIVITY_MESSAGES.changed; state: ExtensionActivityState }) => Promise<void>;
  /** The tab the automation drives, or undefined when there is none the overlay may draw on. */
  readonly automationTabId: () => number | undefined;
  /** Makes the tab's top frame ready and hands it the message. May throw. */
  readonly deliverToTab: (tabId: number, message: ActivityContentMessage) => Promise<void>;
  /** A gateway session is ready, so Core can reach this browser. */
  readonly live: () => boolean;
};

export class ActivityRelay {
  private current: ClientGatewayActivity | null = null;
  private recent: ClientGatewayActivity[] = [];
  private overlay: ActivityOverlayPreference = "expanded";
  private lastSequence = Number.NEGATIVE_INFINITY;
  private loaded: Promise<void> | undefined;
  // One delivery to the page at a time, and only the latest state after it:
  // the page shows one status, so an event overtaken while a send was in
  // flight has nothing left to say.
  private delivering = false;
  private redeliver = false;

  constructor(private readonly deps: ActivityRelayDeps) {}

  state(): ExtensionActivityState {
    return { current: this.current, recent: [...this.recent], overlay: this.overlay, live: this.deps.live() };
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
    await this.fanOut();
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
    await this.fanOut();
    return this.state();
  }

  /**
   * A content script announced itself. When it is the automation tab's top
   * frame -- a navigation replaced the document the overlay was drawn in --
   * it gets the current state again.
   */
  async noteContentReady(tabId: number | undefined, frameId: number | undefined): Promise<void> {
    if (tabId === undefined || (frameId ?? TOP_FRAME_ID) !== TOP_FRAME_ID) return;
    if (this.current === null || tabId !== this.deps.automationTabId()) return;
    await this.load();
    await this.deliver();
  }

  private async fanOut(): Promise<void> {
    try {
      await this.deps.broadcast({ type: ACTIVITY_MESSAGES.changed, state: this.state() });
    } catch {
      /* best-effort: no panel page is open to receive it */
    }
    await this.deliver();
  }

  private async deliver(): Promise<void> {
    if (this.delivering) {
      this.redeliver = true;
      return;
    }
    this.delivering = true;
    try {
      do {
        this.redeliver = false;
        const tabId = this.deps.automationTabId();
        if (tabId === undefined) return;
        const message: ActivityContentMessage = {
          type: ACTIVITY_MESSAGES.content,
          activity: this.current,
          overlay: this.overlay,
          topFrameOnly: true
        };
        try {
          await this.deps.deliverToTab(tabId, message);
        } catch {
          /* best-effort: the page cannot host the overlay (closed, restricted, or navigating); contentReady re-sends */
        }
      } while (this.redeliver);
    } finally {
      this.delivering = false;
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
