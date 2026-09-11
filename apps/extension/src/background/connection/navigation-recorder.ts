// Which URL changes are worth recording. The browser reports a single page load
// several times over, and a click or form submit already explains the
// navigation that follows it, so this decides what survives.

const NAVIGATION_DEBOUNCE_MS = 250;
// A navigation to the URL a tab already had when recording started belongs to
// setup, not to the recording, for as long as this window lasts.
const INITIAL_NAVIGATION_GRACE_MS = 10_000;
// How long a click or submit keeps explaining the navigations that follow it.
const EXPLANATORY_ACTION_WINDOW_MS = 5_000;

export class NavigationRecorder {
  private readonly pending = new Map<number, { url: string; timer: ReturnType<typeof setTimeout> }>();
  private readonly lastRecorded = new Map<number, { url: string; timestamp: number }>();
  private readonly initialUrls = new Map<number, string>();
  private readonly explanatoryActions = new Map<number, number>();

  noteExplanatoryAction(tabId: number, timestamp: number): void {
    this.explanatoryActions.set(tabId, timestamp);
  }

  // Collapses the burst of URL, title, and status updates a single load emits
  // into one deferred call.
  schedule(tabId: number, url: string, record: () => void): void {
    const existing = this.pending.get(tabId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.pending.delete(tabId);
      record();
    }, NAVIGATION_DEBOUNCE_MS);
    this.pending.set(tabId, { url, timer });
  }

  // Decides whether a debounced navigation is recordable, and claims it when it
  // is so a repeat of the same URL is not recorded twice.
  shouldRecord(tabId: number, url: string, timestamp: number, explicitlyTyped: boolean, recordingStartedAt: number | undefined): boolean {
    // A navigation committed before recording can still be waiting in the
    // debounce queue when the session starts. It belongs to setup, not the recording.
    if (recordingStartedAt !== undefined && timestamp <= recordingStartedAt) return false;
    const initialUrl = this.initialUrls.get(tabId);
    if (initialUrl === url && recordingStartedAt !== undefined && Date.now() - recordingStartedAt < INITIAL_NAVIGATION_GRACE_MS) {
      this.initialUrls.delete(tabId);
      return false;
    }
    const explainedAt = this.explanatoryActions.get(tabId);
    // Let the click message arrive before classifying the URL update. A typed
    // omnibox navigation remains intentional even if it follows a click.
    if (!explicitlyTyped && explainedAt !== undefined && timestamp - explainedAt >= 0 && timestamp - explainedAt < EXPLANATORY_ACTION_WINDOW_MS) return false;
    const previous = this.lastRecorded.get(tabId);
    if (previous?.url === url) return false;
    this.lastRecorded.set(tabId, { url, timestamp });
    return true;
  }

  hasRecordedTab(tabId: number): boolean {
    return this.lastRecorded.has(tabId);
  }

  noteRecordedTab(tabId: number, url: string, timestamp: number): void {
    this.lastRecorded.set(tabId, { url, timestamp });
  }

  // Every tab a recording starts with already sits on a URL. Remembering both
  // stops that URL being recorded as a navigation the user made.
  seedRecordingTab(tabId: number, url: string, timestamp: number): void {
    this.lastRecorded.set(tabId, { url, timestamp });
    this.initialUrls.set(tabId, url);
  }

  clearRecordingTabs(): void {
    this.lastRecorded.clear();
    this.initialUrls.clear();
  }
}
