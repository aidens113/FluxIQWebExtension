import type { AuthenticationTabSessionArea } from "../../authentication-tabs";
import type { HostedPkceStoredAttempt } from "../../connect/pkce";
import { browserSessionPkceAttemptStore } from "..";

export const KEY = "fluxiq.authenticationAttempts.pkce";
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

export function fixture() {
  const state = { session: "browser-session.1" as string | null, unavailable: false, values: {} as Record<string, unknown>, writes: 0, reads: 0, access: [] as string[] };
  const hooks: { beforeGet?: () => Promise<void>; beforeSet?: () => Promise<void>; afterSet?: () => Promise<void>; access?: () => Promise<void> } = {};
  const area: AuthenticationTabSessionArea = {
    async get(keys) {
      state.reads += 1;
      await hooks.beforeGet?.();
      return Object.fromEntries(keys.filter(key => Object.hasOwn(state.values, key)).map(key => [key, structuredClone(state.values[key])]));
    },
    async set(values) {
      await hooks.beforeSet?.();
      state.values = { ...state.values, ...structuredClone(values) };
      state.writes += 1;
      await hooks.afterSet?.();
    },
    async setAccessLevel(options) {
      state.access.push(options.accessLevel);
      await hooks.access?.();
    }
  };
  const authenticationTabs = { ready: async () => { if (state.unavailable) throw new Error("private storage path"); }, sessionIdentity: () => state.session };
  const store = browserSessionPkceAttemptStore({ authenticationTabs, area });
  return { state, hooks, area, authenticationTabs, store };
}

export function attempt(session = "browser-session.1"): HostedPkceStoredAttempt {
  return {
    version: 1, attemptId: "attempt.fixture", browserSessionId: session, selectionId: "selection-a", installId: "install-fixture", expectedCredentialRevision: 0, createdAtMs: 1000,
    binding: { origin: "https://cloud.example.test", instanceId: "instance-a", gatewayUrl: "wss://cloud.example.test/client-gateway", authorizeUrl: "https://cloud.example.test/connect/authorize", tokenUrl: "https://cloud.example.test/connect/token", revokeUrl: "https://cloud.example.test/connect/revoke" },
    phase: "waiting", tabId: 7, state: "s".repeat(43), verifier: "v".repeat(43)
  };
}
