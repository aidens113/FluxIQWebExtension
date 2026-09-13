const INTENT_LIFETIME_MS = 30_000;
const REDIRECT_DEBOUNCE_MS = 250;
const MAX_URL_LENGTH = 2_048;
const MAX_PATHNAME_LENGTH = 1_024;

type Timer = ReturnType<typeof setTimeout>;
type FailureCode =
  | "invalid_request"
  | "not_recording"
  | "no_automation_tab"
  | "busy"
  | "expired"
  | "cancelled"
  | "recording_stopped"
  | "tab_closed"
  | "destination_mismatch"
  | "send_failed"
  | "unknown_intent";
type IntentResult = { readonly ok: true; readonly intentId: string } | { readonly ok: false; readonly code: FailureCode };
type IntentState = "armed" | "sending" | "terminal";

type Intent = {
  readonly id: string;
  readonly tabId: number;
  readonly url: string;
  readonly origin: string;
  readonly pathname: string;
  readonly completion: Promise<IntentResult>;
  readonly resolve: (result: IntentResult) => void;
  readonly deadlineAt: number;
  state: IntentState;
  result?: IntentResult;
  expiryTimer: Timer | undefined;
  debounceTimer: Timer | undefined;
  retentionTimer: Timer | undefined;
};

type ScriptedNavigationIntentDeps = {
  readonly recordingState: () => string;
  readonly activeTabId: () => number | undefined;
  readonly recordNavigation: (tabId: number, url: string, timestamp: number) => Promise<void>;
  readonly createId?: () => string;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, delayMs: number) => Timer;
  readonly clearTimer?: (timer: Timer | undefined) => void;
};

function safeDestination(value: unknown, requireBare = true): { url: string; origin: string; pathname: string } | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) return undefined;
  try {
    const parsed = new URL(value);
    if (!(["http:", "https:"] as string[]).includes(parsed.protocol)) return undefined;
    if (!["127.0.0.1", "[::1]", "localhost"].includes(parsed.hostname)) return undefined;
    if (parsed.username || parsed.password || (requireBare && (parsed.search || parsed.hash))) return undefined;
    if (parsed.pathname.length > MAX_PATHNAME_LENGTH) return undefined;
    return { url: parsed.href, origin: parsed.origin, pathname: parsed.pathname };
  } catch {
    return undefined;
  }
}

export class ScriptedNavigationIntent {
  private readonly byId = new Map<string, Intent>();
  private readonly byTab = new Map<number, string>();
  private readonly createId: () => string;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, delayMs: number) => Timer;
  private readonly clearTimer: (timer: Timer | undefined) => void;

  constructor(private readonly deps: ScriptedNavigationIntentDeps) {
    this.createId = deps.createId ?? (() => crypto.randomUUID());
    this.now = deps.now ?? Date.now;
    this.setTimer = deps.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = deps.clearTimer ?? ((timer) => clearTimeout(timer));
  }

  arm(url: unknown): IntentResult {
    const destination = safeDestination(url);
    if (!destination) return { ok: false, code: "invalid_request" };
    if (this.deps.recordingState() !== "recording") return { ok: false, code: "not_recording" };
    const tabId = this.deps.activeTabId();
    if (tabId === undefined || !Number.isSafeInteger(tabId) || tabId < 0) return { ok: false, code: "no_automation_tab" };
    if (this.byTab.has(tabId)) return { ok: false, code: "busy" };

    const id = this.createId();
    let resolve: (result: IntentResult) => void = () => undefined;
    const completion = new Promise<IntentResult>((done) => { resolve = done; });
    const intent: Intent = { id, tabId, ...destination, completion, resolve, deadlineAt: this.now() + INTENT_LIFETIME_MS, state: "armed", expiryTimer: undefined, debounceTimer: undefined, retentionTimer: undefined };
    intent.expiryTimer = this.setTimer(() => this.finish(intent, { ok: false, code: "expired" }), INTENT_LIFETIME_MS);
    this.byId.set(id, intent);
    this.byTab.set(tabId, id);
    return { ok: true, intentId: id };
  }

  async await(intentId: unknown): Promise<IntentResult> {
    if (typeof intentId !== "string" || intentId.length === 0 || intentId.length > 128) {
      return { ok: false, code: "unknown_intent" };
    }
    const intent = this.byId.get(intentId);
    if (!intent) return { ok: false, code: "unknown_intent" };
    const result = await intent.completion;
    this.remove(intent);
    return result;
  }

  cancel(intentId: unknown): boolean {
    if (typeof intentId !== "string") return false;
    const intent = this.byId.get(intentId);
    if (!intent || intent.state === "terminal") return false;
    this.finish(intent, { ok: false, code: "cancelled" });
    return true;
  }

  cancelTab(tabId: number): void {
    const intent = this.intentForTab(tabId);
    if (intent) this.finish(intent, { ok: false, code: "tab_closed" });
  }

  cancelAll(code: "cancelled" | "recording_stopped"): void {
    for (const intent of [...this.byId.values()]) {
      if (intent.state !== "terminal") this.finish(intent, { ok: false, code });
    }
  }

  claimCommit(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): boolean {
    if (details.frameId !== 0) return false;
    const intent = this.intentForTab(details.tabId);
    if (!intent) return false;
    if (intent.state === "armed") {
      this.clearTimer(intent.debounceTimer);
      intent.debounceTimer = this.setTimer(() => {
        intent.debounceTimer = undefined;
        void this.settleCommit(intent.id, details.url, details.timeStamp);
      }, REDIRECT_DEBOUNCE_MS);
    }
    return true;
  }

  private async settleCommit(intentId: string, committedUrl: string, timestamp: number): Promise<void> {
    const intent = this.byId.get(intentId);
    if (!intent || intent.state !== "armed") return;
    const committed = safeDestination(committedUrl, false);
    if (!committed || committed.origin !== intent.origin || committed.pathname !== intent.pathname) {
      this.finish(intent, { ok: false, code: "destination_mismatch" });
      return;
    }
    intent.state = "sending";
    try {
      await this.deps.recordNavigation(intent.tabId, intent.url, timestamp);
      this.finish(intent, { ok: true, intentId: intent.id });
    } catch {
      this.finish(intent, { ok: false, code: "send_failed" });
    }
  }

  private intentForTab(tabId: number): Intent | undefined {
    const id = this.byTab.get(tabId);
    return id === undefined ? undefined : this.byId.get(id);
  }

  private finish(intent: Intent, result: IntentResult): void {
    if (intent.state === "terminal") return;
    intent.state = "terminal";
    intent.result = result;
    if (this.byTab.get(intent.tabId) === intent.id) this.byTab.delete(intent.tabId);
    this.clearTimer(intent.expiryTimer);
    this.clearTimer(intent.debounceTimer);
    intent.expiryTimer = undefined;
    intent.debounceTimer = undefined;
    intent.resolve(result);
    const remaining = intent.deadlineAt - this.now();
    if (remaining > 0) intent.retentionTimer = this.setTimer(() => this.remove(intent), remaining);
    else this.remove(intent);
  }

  private remove(intent: Intent): void {
    if (this.byId.get(intent.id) !== intent) return;
    this.byId.delete(intent.id);
    if (this.byTab.get(intent.tabId) === intent.id) this.byTab.delete(intent.tabId);
    this.clearTimer(intent.expiryTimer);
    this.clearTimer(intent.debounceTimer);
    this.clearTimer(intent.retentionTimer);
    intent.expiryTimer = undefined;
    intent.debounceTimer = undefined;
    intent.retentionTimer = undefined;
  }
}
