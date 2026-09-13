// Which URL changes are worth recording. The browser reports a single page load
// several times over, and a click or form submit already explains the
// navigation that follows it, so this decides what survives. A navigation the
// page made itself survives only as the landing of the click that caused it,
// and then it names that click.

const NAVIGATION_DEBOUNCE_MS = 250;
// A navigation to the URL a tab already had when recording started belongs to
// setup, not to the recording, for as long as this window lasts.
const INITIAL_NAVIGATION_GRACE_MS = 10_000;
// How long a click or submit keeps explaining the navigations that follow it.
const EXPLANATORY_ACTION_WINDOW_MS = 5_000;

/**
 * Where a committed navigation came from, as far as recording it goes.
 *
 * - `typed`: the omnibox. Intentional, and recorded whatever preceded it.
 * - `page`: a top-frame `link` or `form_submit` commit, which is the page
 *   navigating itself (script navigation such as `location.assign` included).
 *   It is recorded only as the landing of an executable click.
 * - `other`: anything else, a history-state update included. Recorded unless a
 *   click or submit explains it.
 */
export type NavigationOrigin = "typed" | "page" | "other";

/**
 * An executable click as the recording knows it. `sequence` is the content
 * script's counter, which restarts in every document, so two clicks in one
 * recording can share it; `eventId` is the recording event id the click was
 * sent under, which names exactly one.
 */
export type RecordedClick = { readonly sequence: number; readonly eventId: string };

/**
 * What can explain a navigation. A click is named by how it was recorded when
 * it is executable and by nothing when it cannot be replayed; a form submit is
 * evidence, never a candidate, so it names nothing of its own.
 */
export type NavigationExplainer =
  | { readonly kind: "click"; readonly recorded: RecordedClick | undefined }
  | { readonly kind: "submit" };

/**
 * What a debounced navigation becomes: nothing, a navigation in its own right,
 * or the landing of the executable click it names.
 */
export type NavigationVerdict =
  | { readonly kind: "drop" }
  | { readonly kind: "navigation" }
  | { readonly kind: "explained"; readonly click: RecordedClick };

type ExplanatoryAction = { readonly timestamp: number; readonly click: RecordedClick | undefined };

const DROP: NavigationVerdict = { kind: "drop" };
const NAVIGATION: NavigationVerdict = { kind: "navigation" };

function withinExplanatoryWindow(openedAt: number, timestamp: number): boolean {
  return timestamp - openedAt >= 0 && timestamp - openedAt < EXPLANATORY_ACTION_WINDOW_MS;
}

export class NavigationRecorder {
  private readonly pending = new Map<number, { url: string; timer: ReturnType<typeof setTimeout> }>();
  private readonly lastRecorded = new Map<number, { url: string; timestamp: number }>();
  private readonly initialUrls = new Map<number, string>();
  private readonly explanatoryActions = new Map<number, ExplanatoryAction>();

  // Opens the window in which a navigation is this action's consequence. A
  // submit extends it and keeps the click it follows, because a submit button
  // fires `click` and then `submit` and the click is the candidate; a click
  // that is itself outside the submit's window explained nothing.
  noteExplanatoryAction(tabId: number, timestamp: number, explainer: NavigationExplainer): void {
    const previous = this.explanatoryActions.get(tabId);
    const click = explainer.kind === "click"
      ? explainer.recorded
      : previous !== undefined && withinExplanatoryWindow(previous.timestamp, timestamp) ? previous.click : undefined;
    this.explanatoryActions.set(tabId, { timestamp, click });
  }

  // Collapses the burst of URL, title, and status updates a single load emits
  // into one deferred call. A client redirect's second commit replaces the
  // first, so what is recorded is where the page settled.
  schedule(tabId: number, url: string, record: () => void): void {
    const existing = this.pending.get(tabId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.pending.delete(tabId);
      record();
    }, NAVIGATION_DEBOUNCE_MS);
    this.pending.set(tabId, { url, timer });
  }

  // Decides what a debounced navigation becomes, and claims a navigation in its
  // own right so a repeat of the same URL is not recorded twice. A landing
  // claims nothing: it is evidence about a click, not the tab's own navigation.
  shouldRecord(tabId: number, url: string, timestamp: number, origin: NavigationOrigin, recordingStartedAt: number | undefined): NavigationVerdict {
    // A navigation committed before recording can still be waiting in the
    // debounce queue when the session starts. It belongs to setup, not the recording.
    if (recordingStartedAt !== undefined && timestamp <= recordingStartedAt) return DROP;
    const initialUrl = this.initialUrls.get(tabId);
    if (initialUrl === url && recordingStartedAt !== undefined && Date.now() - recordingStartedAt < INITIAL_NAVIGATION_GRACE_MS) {
      this.initialUrls.delete(tabId);
      return DROP;
    }
    const action = this.explanatoryActions.get(tabId);
    const explanation = action !== undefined && withinExplanatoryWindow(action.timestamp, timestamp) ? action : undefined;
    if (origin === "page") {
      return explanation?.click === undefined ? DROP : { kind: "explained", click: explanation.click };
    }
    // Let the click message arrive before classifying the URL update. A typed
    // omnibox navigation remains intentional even if it follows a click.
    if (origin !== "typed" && explanation !== undefined) return DROP;
    const previous = this.lastRecorded.get(tabId);
    if (previous?.url === url) return DROP;
    this.lastRecorded.set(tabId, { url, timestamp });
    return NAVIGATION;
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

  // A new recording starts from nothing. A click from the last one must not
  // explain, or be named by, a navigation in this one.
  clearRecordingTabs(): void {
    this.lastRecorded.clear();
    this.initialUrls.clear();
    this.explanatoryActions.clear();
  }
}
