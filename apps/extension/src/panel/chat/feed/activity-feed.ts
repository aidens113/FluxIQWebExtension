// What the chat knows about FluxIQ's live activity, and every request it makes
// for it. No DOM and no `chrome`: the request and the push subscription come
// in, so each rule below is tested directly.
//
// The background owns the state (`background/activity/activity-relay.ts`): it
// answers `ACTIVITY_MESSAGES.read` and `setOverlay` with `{ ok: true, state }`
// and broadcasts `{ type: ACTIVITY_MESSAGES.changed, state }` after each kept
// event or overlay change. This holds the latest of those, nothing merged.
//
// Reach, by what the background last answered:
//   loading      nothing yet
//   ready        a state arrived (a read reply or a push)
//   unsupported  "Unknown FluxIQ extension message.": this build has no relay,
//                so the chat shows offline and the overlay control is off, for
//                as long as the feed is mounted
//   failed       the read failed otherwise (typically a worker restart); the
//                next `read()` tries again
//
// A read reply that was asked for before a push arrived is older than that
// push, so it is dropped. The relay forgets everything on a worker restart,
// so `current: null` and `recent: []` are an ordinary state, not an error.

import { ACTIVITY_MESSAGES, type ActivityOverlayPreference, type ExtensionActivityState } from "../../../shared/activity/index";
import type { PanelStore } from "../../state";

/** How the background last answered. */
export type ActivityFeedReach = "loading" | "ready" | "unsupported" | "failed";

/** Everything the chat renders from the feed. */
export type ActivityFeedSnapshot = {
  reach: ActivityFeedReach;
  state: ExtensionActivityState;
  /** Why the last read failed, while `reach` is `failed`. */
  readError?: string | undefined;
  /** Why the last overlay change did not go; cleared by the next one. */
  overlayError?: string | undefined;
  /** An overlay change is on its way. */
  overlaySaving: boolean;
};

/** A background push, as `chrome.runtime.onMessage` hands it over. */
export type ActivityPushListener = (message: unknown) => void;

/** What the feed reaches the background through. */
export type ActivityFeedDeps = {
  readonly request: PanelStore["request"];
  /** Subscribes to background pushes; answers an unsubscribe. */
  readonly listen: (listener: ActivityPushListener) => () => void;
};

export type ActivityFeed = {
  snapshot(): ActivityFeedSnapshot;
  /** Starts listening for pushes. Idempotent. */
  start(): void;
  stop(): void;
  /** Reads the state again. Never rejects. */
  read(): Promise<void>;
  /** Asks the background to show the on-page overlay as `overlay`. Never rejects. */
  setOverlay(overlay: ActivityOverlayPreference): Promise<void>;
};

const EMPTY_STATE: ExtensionActivityState = { current: null, display: null, recent: [], overlay: "expanded", live: false };
const READ_FAILED = "Couldn't read activity. Try again.";
const OVERLAY_FAILED = "Couldn't change the on-page status. Try again.";

/** Creates the feed. `onChange` is called after every change to `snapshot()`. */
export function createActivityFeed(deps: ActivityFeedDeps, onChange: () => void): ActivityFeed {
  let reach: ActivityFeedReach = "loading";
  let state: ExtensionActivityState = EMPTY_STATE;
  let readError: string | undefined;
  let overlayError: string | undefined;
  let overlaySaving = false;
  let unsubscribe: (() => void) | undefined;
  // Lifecycle invalidates stopped subscriptions and requests. Observations
  // protect newer state; read generations also order replies without a push.
  let lifecycle = 0;
  let readGeneration = 0;
  let observations = 0;
  let listening = false;
  let overlayOperation: object | undefined;

  function take(next: ExtensionActivityState): void {
    observations += 1;
    state = next;
    if (reach !== "unsupported") reach = "ready";
    readError = undefined;
  }

  function onPush(message: unknown): void {
    const typed = message as { type?: unknown; state?: unknown } | null;
    if (typed?.type !== ACTIVITY_MESSAGES.changed || !isActivityState(typed.state)) return;
    take(typed.state);
    onChange();
  }

  return {
    snapshot: () => ({ reach, state, readError, overlayError, overlaySaving }),
    start() {
      if (listening) return;
      listening = true;
      const started = lifecycle;
      const cleanup = deps.listen((message) => {
        if (listening && started === lifecycle) onPush(message);
      });
      if (listening && started === lifecycle) unsubscribe = cleanup;
      else cleanup();
    },
    stop() {
      lifecycle += 1;
      readGeneration += 1;
      listening = false;
      overlayOperation = undefined;
      overlaySaving = false;
      const cleanup = unsubscribe;
      unsubscribe = undefined;
      cleanup?.();
    },
    async read() {
      if (reach === "unsupported") return;
      const asked = lifecycle, generation = ++readGeneration, observed = observations;
      const current = () => asked === lifecycle && generation === readGeneration && observed === observations && reach !== "unsupported";
      try {
        const result = await deps.request<{ state?: unknown }>({ type: ACTIVITY_MESSAGES.read });
        if (!current()) return;
        if (result.ok && isActivityState(result.value.state)) take(result.value.state);
        else if (!result.ok && result.unsupported) reach = "unsupported";
        else if (reach !== "ready") {
          reach = "failed";
          readError = result.ok ? "The extension answered with activity this panel can't read." : result.sentence;
        }
        onChange();
      } catch {
        if (!current()) return;
        if (reach !== "ready") { reach = "failed"; readError = READ_FAILED; }
        onChange();
      }
    },
    async setOverlay(overlay) {
      if (reach === "unsupported" || overlaySaving || overlay === state.overlay) return;
      const asked = lifecycle, observed = observations, operation = {};
      overlayOperation = operation;
      const current = () => asked === lifecycle && overlayOperation === operation;
      const supported = () => reach !== "unsupported";
      overlaySaving = true;
      overlayError = undefined;
      onChange();
      if (!current()) return;
      try {
        const result = await deps.request<{ state?: unknown }>({ type: ACTIVITY_MESSAGES.setOverlay, overlay });
        if (!current()) return;
        if (result.ok && isActivityState(result.value.state)) {
          if (observed === observations && supported()) take(result.value.state);
        } else if (!result.ok && result.unsupported) reach = "unsupported";
        else overlayError = OVERLAY_FAILED;
      } catch {
        if (current()) overlayError = OVERLAY_FAILED;
      } finally {
        if (current()) {
          overlayOperation = undefined;
          overlaySaving = false;
          onChange();
        }
      }
    }
  };
}

function isActivityState(value: unknown): value is ExtensionActivityState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ExtensionActivityState>;
  return Array.isArray(candidate.recent)
    && (candidate.history === undefined || Array.isArray(candidate.history))
    && (candidate.current === null || (typeof candidate.current === "object" && candidate.current !== undefined))
    && (candidate.overlay === "expanded" || candidate.overlay === "collapsed" || candidate.overlay === "hidden")
    && typeof candidate.live === "boolean";
}
