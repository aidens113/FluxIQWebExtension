import { AuthenticationTabsError } from "./failure";
import { isAuthenticationTabIdentifier } from "./identifier";
import type { AuthenticationTabSessionArea, AuthenticationTabSessionStore } from "./model";
import { readAuthenticationTabOwnership } from "./read-ownership";

const SESSION_KEY = "fluxiq.authenticationTabs.browserSession";
const OWNERS_KEY = "fluxiq.authenticationTabs.ownership";
const pendingByArea = new WeakMap<AuthenticationTabSessionArea, Promise<void>>();

function enqueue<T>(area: AuthenticationTabSessionArea, operation: () => Promise<T>): Promise<T> {
  const result = (pendingByArea.get(area) ?? Promise.resolve()).then(operation);
  // Preserve the original result for its caller; this tail only sequences the next operation.
  pendingByArea.set(area, result.then(() => undefined, () => undefined));
  return result;
}

async function safeStorage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new AuthenticationTabsError("storage_unavailable");
  }
}

/** Browser-session storage only: no local/sync or worker-memory substitute. Access is checked lazily. */
export function browserSessionAuthenticationTabStore(
  suppliedArea?: AuthenticationTabSessionArea,
  mintSessionId: () => string = () => crypto.randomUUID()
): AuthenticationTabSessionStore {
  const area = (): AuthenticationTabSessionArea => {
    const selected = suppliedArea ?? (globalThis as { chrome?: { storage?: { session?: AuthenticationTabSessionArea } } }).chrome?.storage?.session;
    if (!selected) throw new AuthenticationTabsError("storage_unavailable");
    return selected;
  };
  return {
    load: () => safeStorage(async () => {
      const selected = area();
      return await enqueue(selected, async () => {
        await selected.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
        const saved = await selected.get([SESSION_KEY, OWNERS_KEY]);
        let browserSessionId = saved[SESSION_KEY];
        if (browserSessionId === undefined) {
          browserSessionId = mintSessionId();
          if (!isAuthenticationTabIdentifier(browserSessionId)) throw new AuthenticationTabsError("invalid_state");
          await selected.set({ [SESSION_KEY]: browserSessionId });
        }
        if (!isAuthenticationTabIdentifier(browserSessionId)) throw new AuthenticationTabsError("invalid_state");
        return { browserSessionId, ownership: saved[OWNERS_KEY] };
      });
    }),
    save: (ownership) => safeStorage(async () => {
      const selected = area();
      await enqueue(selected, async () => {
        await selected.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
        const clean = readAuthenticationTabOwnership(ownership);
        if (!clean) throw new AuthenticationTabsError("invalid_state");
        const saved = await selected.get([SESSION_KEY]);
        if (saved[SESSION_KEY] !== clean.browserSessionId) throw new AuthenticationTabsError("invalid_state");
        await selected.set({ [OWNERS_KEY]: clean });
      });
    })
  };
}
