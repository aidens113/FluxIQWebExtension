// One activity feed for the whole panel. The shell owns the feed (it paces the
// display and decides when FluxIQ is working), starts and stops it, and
// replaces it when the owner changes; the chat hears it through this stable
// source (`ChatActivitySource`), so the same activity is read and listened to
// once, not once by the shell and again by the chat.

import type { ActivityFeed, ActivityFeedSnapshot, ChatWidgetOptions } from "@fluxiq/ui-components";

/** The feed as the chat hears it (the package does not export the type by name). */
type ChatActivitySource = NonNullable<ChatWidgetOptions["activity"]>;

/** The source the chat holds, and the shell's two calls that keep it true. */
export type SharedActivityFeed = {
  readonly source: ChatActivitySource;
  /** Points the source at `next` (the shell's current feed); undefined detaches it. Tells the chat. */
  use(next: ActivityFeed | undefined): void;
  /** The shell's feed changed (call it from that feed's `onChange`): tells the chat. */
  changed(): void;
};

const EMPTY: ActivityFeedSnapshot = {
  reach: "loading",
  state: { current: null, display: null, recent: [], overlay: "expanded", live: false },
  overlaySaving: false
};

/** Creates the source, attached to no feed yet. */
export function createSharedActivityFeed(): SharedActivityFeed {
  let target: ActivityFeed | undefined;
  const listeners = new Set<() => void>();
  const changed = (): void => { for (const listener of [...listeners]) listener(); };
  return {
    changed,
    use(next) {
      target = next;
      changed();
    },
    source: {
      snapshot: () => target?.snapshot() ?? EMPTY,
      read: () => target?.read() ?? Promise.resolve(),
      subscribe(listener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      }
    }
  };
}
