// Which URL changes are worth recording. The browser reports a single page load
// several times over, and a click or form submit already explains the
// navigation that follows it, so this decides what survives. A navigation the
// page made itself survives only as the landing of the click that caused it,
// and then it names that click.
//
// A click explains only what commits before the next recorded action. Its
// window used to stay open for five seconds whatever happened in them, so on
// local-classifieds the search a key press ran 700 ms after "Allow all cookies"
// was recorded as that click's landing, and the replayed cookie click then
// failed for not reaching the search page (lane E). A key press, typed text or
// any other executable action now ends the window of the click before it, and
// the navigation is judged by the action in force when it committed.

const NAVIGATION_DEBOUNCE_MS = 250;
// A navigation to the URL a tab already had when recording started belongs to
// setup, not to the recording, for as long as this window lasts.
const INITIAL_NAVIGATION_GRACE_MS = 10_000;
// How long a click or submit keeps explaining the navigations that follow it.
const EXPLANATORY_ACTION_WINDOW_MS = 5_000;
// Recorded actions remembered per tab, so a navigation committed before the
// latest of them is still judged by the one in force when it committed.
const MAX_EXPLANATORY_ACTIONS = 16;

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
 * What can explain a navigation, and what ends an explanation. A click is
 * named by how it was recorded when it is executable and by nothing when it
 * cannot be replayed; a form submit is evidence, never a candidate, so it names
 * nothing of its own. Any other recorded action -- a key press, typed text, a
 * checked box -- explains nothing, but it ends the window of the click before
 * it: what commits after it is not that click's doing.
 */
export type NavigationExplainer =
  | { readonly kind: "click"; readonly recorded: RecordedClick | undefined }
  | { readonly kind: "submit" }
  | { readonly kind: "action" };

/**
 * What a debounced navigation becomes: nothing, a navigation in its own right,
 * or the landing of the executable click it names.
 */
export type NavigationVerdict =
  | { readonly kind: "drop" }
  | { readonly kind: "navigation" }
  | { readonly kind: "explained"; readonly click: RecordedClick };

/** One recorded action as navigation sees it: when it happened, whether it explains a navigation, and the click it names. */
type ExplanatoryAction = { readonly timestamp: number; readonly explains: boolean; readonly click: RecordedClick | undefined };

const DROP: NavigationVerdict = { kind: "drop" };
const NAVIGATION: NavigationVerdict = { kind: "navigation" };

function withinExplanatoryWindow(openedAt: number, timestamp: number): boolean {
  return timestamp - openedAt >= 0 && timestamp - openedAt < EXPLANATORY_ACTION_WINDOW_MS;
}

/** The last recorded action at or before `timestamp`, from a time-ordered history. */
function actionInForce(history: readonly ExplanatoryAction[], timestamp: number): ExplanatoryAction | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]!;
    if (entry.timestamp <= timestamp) return entry;
  }
  return undefined;
}

export class NavigationRecorder {
  private readonly pending = new Map<number, { url: string; timer: ReturnType<typeof setTimeout>; record: () => unknown; generation: number }>();
  private readonly running = new Map<Promise<void>, number>();
  private readonly failures: Array<{ error: unknown; generation: number }> = [];
  private generation = 0;
  private readonly lastRecorded = new Map<number, { url: string; timestamp: number }>();
  private readonly initialUrls = new Map<number, string>();
  private readonly explanatoryActions = new Map<number, ExplanatoryAction[]>();

  // Opens the window in which a navigation is this action's consequence, or,
  // for an action that explains nothing, closes the one before it. A submit
  // extends the window and keeps the click it follows, because a submit button
  // fires `click` and then `submit` and the click is the candidate; a click
  // that is itself outside the submit's window explained nothing, and neither
  // does one a later action ended -- pressing Enter in a field submits its form
  // with no click at all.
  noteExplanatoryAction(tabId: number, timestamp: number, explainer: NavigationExplainer): void {
    const history = this.explanatoryActions.get(tabId) ?? [];
    const previous = actionInForce(history, timestamp);
    const action: ExplanatoryAction = explainer.kind === "click"
      ? { timestamp, explains: true, click: explainer.recorded }
      : explainer.kind === "submit"
        ? { timestamp, explains: true, click: previous?.explains === true && withinExplanatoryWindow(previous.timestamp, timestamp) ? previous.click : undefined }
        : { timestamp, explains: false, click: undefined };
    // Kept in time order, a tie after what was noted first, so the action in
    // force at any instant is the last one at or before it.
    let at = history.length;
    while (at > 0 && history[at - 1]!.timestamp > timestamp) at -= 1;
    history.splice(at, 0, action);
    if (history.length > MAX_EXPLANATORY_ACTIONS) history.splice(0, history.length - MAX_EXPLANATORY_ACTIONS);
    this.explanatoryActions.set(tabId, history);
  }

  // Collapses the burst of URL, title, and status updates a single load emits
  // into one deferred call. A client redirect's second commit replaces the
  // first, so what is recorded is where the page settled.
  schedule(tabId: number, url: string, record: () => unknown): void {
    const existing = this.pending.get(tabId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      const pending = this.pending.get(tabId);
      if (pending?.timer !== timer) return;
      this.pending.delete(tabId);
      this.run(pending.record, pending.generation);
    }, NAVIGATION_DEBOUNCE_MS);
    this.pending.set(tabId, { url, timer, record, generation: this.generation });
  }

  // Stop drains the debounce queue immediately and waits for sends whose
  // callbacks have already begun. Keep draining until no work remains, since
  // settling one callback may synchronously expose another navigation.
  async flush(): Promise<void> {
    const generation = this.generation;
    do {
      const pending = [...this.pending.values()].filter((item) => item.generation === generation);
      this.pending.clear();
      for (const item of pending) {
        clearTimeout(item.timer);
        this.run(item.record, generation);
      }
      const running = [...this.running].filter(([, itemGeneration]) => itemGeneration === generation).map(([promise]) => promise);
      if (running.length > 0) await Promise.all(running);
    } while ([...this.pending.values()].some((item) => item.generation === generation)
      || [...this.running.values()].some((itemGeneration) => itemGeneration === generation));
    const failure = this.failures.find((item) => item.generation === generation);
    for (let index = this.failures.length - 1; index >= 0; index -= 1) {
      if (this.failures[index]?.generation === generation) this.failures.splice(index, 1);
    }
    if (failure !== undefined) throw failure.error;
  }

  private run(record: () => unknown, generation: number): void {
    let result: unknown;
    try {
      result = record();
    } catch (error) {
      if (generation === this.generation) this.failures.push({ error, generation });
      return;
    }
    let running: Promise<void>;
    running = Promise.resolve(result)
      .then(() => undefined)
      .catch((error: unknown) => {
        if (generation === this.generation) this.failures.push({ error, generation });
      })
      .finally(() => {
        this.running.delete(running);
      });
    this.running.set(running, generation);
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
    // The action in force when the navigation committed, not the latest one:
    // an action taken after the commit, before this debounced call, neither
    // explains the navigation nor takes it from the click that does.
    const action = actionInForce(this.explanatoryActions.get(tabId) ?? [], timestamp);
    const explanation = action?.explains === true && withinExplanatoryWindow(action.timestamp, timestamp) ? action : undefined;
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
    this.generation += 1;
    for (const item of this.pending.values()) clearTimeout(item.timer);
    this.pending.clear();
    this.failures.length = 0;
    this.lastRecorded.clear();
    this.initialUrls.clear();
    this.explanatoryActions.clear();
  }
}
