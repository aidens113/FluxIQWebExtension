// Which tab changes a recording keeps as actions: moving to another page, and
// closing the tab the recording is in. Each becomes a `browser.tab` event that
// carries `tab`, which the domain maps to `web.browser.tab`
// (`domain/src/io/input-model.ts`). It enters the recording through the
// facade's public intake, like any recorded event, so it is sent with its input
// id and counted once, by the code that counts a click.
//
// A tab is named by the pathname of its URL, never by its id: ids do not
// survive to a replay, origins differ run to run, and a query may carry tokens.
// The rule is `recordablePageAddress`, which a replayed switch's confirmation
// shares.
//
// Not recorded:
// - A page a recording cannot see (`unsupportedPageForUrl`): the browser's own
//   pages and the extension's control page. Passing through one is not a
//   switch, because the recording is still in the last page it could see.
// - A tab change FluxIQ made while running a command. A runtime action enters
//   the recording as its own confirmation, so the tab change it caused would
//   otherwise be counted twice.
// - Closing a tab the recording is not in. Replay closes the tab it is driving,
//   so that close would replay against the wrong tab.

import type { RecordingEventPayload, RecordingState } from "../../shared/protocol";
import type { EventSequence } from "./event-sequence";
import { recordablePageAddress } from "./recordable-page-address";

/** How long a switch to a tab with no page yet waits for that tab's first committed URL. */
const SWITCH_COMMIT_WAIT_MS = 10_000;

/** The page the extension last saw in front, as the recorder is told of it. */
export type KnownActiveTab = { readonly tabId: number; readonly url: string | undefined };

export type TabRecorderDeps = {
  readonly recordingState: () => RecordingState;
  readonly recordingId: () => string | undefined;
  // Whether FluxIQ is running a command now, and so moved the tab if it moved.
  readonly runtimeBusy: () => boolean;
  readonly sequence: EventSequence;
  // Re-entry through the facade, so a tab change takes the public intake path.
  readonly recordEvent: (payload: RecordingEventPayload, tabId?: number, frameId?: number) => Promise<void>;
};

type PendingSwitch = { readonly tabId: number; readonly since: number; readonly byRuntime: boolean };

type RecordedTab = NonNullable<RecordingEventPayload["tab"]>;

// A tab with no page yet: a link's new tab before its first commit.
function isBlankPage(url: string | undefined): boolean {
  return !url || url === "about:blank";
}

export class TabRecorder {
  private joined: string | undefined;
  private currentTabId: number | undefined;
  private pending: PendingSwitch | undefined;
  private readonly locations = new Map<number, string>();

  constructor(private readonly deps: TabRecorderDeps) {}

  async noteTabUpdate(tab: chrome.tabs.Tab, lastActive: KnownActiveTab | undefined): Promise<void> {
    if (tab.id === undefined || !this.join(lastActive)) return;
    const tabId = tab.id;
    const address = recordablePageAddress(tab.url);
    if (address !== undefined) this.locations.set(tabId, address.location);
    if (!tab.active) return;
    if (address === undefined) {
      // A new tab is in front before its URL commits, so the switch waits for
      // the path to name it by. Any other page without an address is one the
      // recording cannot see.
      if (isBlankPage(tab.url) && tabId !== this.currentTabId && this.pending?.tabId !== tabId) {
        this.pending = { tabId, since: Date.now(), byRuntime: this.deps.runtimeBusy() };
      }
      return;
    }
    // A page in front ends any wait: this is the tab awaited, or the user moved on.
    const awaited = this.pending?.tabId === tabId ? this.pending : undefined;
    this.pending = undefined;
    if (tabId === this.currentTabId) return;
    const previousTabId = this.currentTabId;
    this.currentTabId = tabId;
    // The first page a recording sees in front is where it already is.
    if (previousTabId === undefined) return;
    if (this.deps.runtimeBusy() || awaited?.byRuntime === true) return;
    if (awaited !== undefined && Date.now() - awaited.since > SWITCH_COMMIT_WAIT_MS) return;
    await this.record(tabId, { operation: "switch", urlPath: address.path }, address.location, tab.title ?? "");
  }

  async noteTabRemoved(tabId: number, lastActive: KnownActiveTab | undefined): Promise<void> {
    if (!this.join(lastActive)) return;
    if (this.pending?.tabId === tabId) this.pending = undefined;
    const location = this.locations.get(tabId);
    this.locations.delete(tabId);
    if (tabId !== this.currentTabId || this.deps.runtimeBusy()) return;
    // The closed tab stays current, so whichever page comes to the front next
    // is recorded as the switch to it. The tab is gone, so no tab id is sent:
    // there is no page left to snapshot.
    await this.record(undefined, { operation: "close" }, location ?? "", "");
  }

  // State belongs to one recording. The first tab event of a new one starts it
  // from the page the extension already had in front.
  private join(lastActive: KnownActiveTab | undefined): boolean {
    if (this.deps.recordingState() !== "recording") return false;
    const recordingId = this.deps.recordingId();
    if (recordingId === this.joined) return true;
    this.joined = recordingId;
    this.pending = undefined;
    this.locations.clear();
    this.currentTabId = lastActive?.tabId;
    const address = recordablePageAddress(lastActive?.url);
    if (lastActive !== undefined && address !== undefined) this.locations.set(lastActive.tabId, address.location);
    return true;
  }

  private async record(tabId: number | undefined, tab: RecordedTab, location: string, title: string): Promise<void> {
    await this.deps.recordEvent({
      kind: "browser.tab",
      sequence: this.deps.sequence.next(),
      url: location,
      title,
      eventTimestampMs: Date.now(),
      tab
    }, tabId);
  }
}
