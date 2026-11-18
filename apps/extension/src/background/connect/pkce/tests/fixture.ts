import { IDBFactory } from "fake-indexeddb";
import { webcrypto } from "node:crypto";
import { afterEach } from "node:test";
import type { FluxIQDiscoveryDocument, ConnectTokenResponse } from "@fluxiq/contracts/platform";
import { AuthenticationTabs, type AuthenticationTabOwnership } from "../../../authentication-tabs";
import { checkHostedCredentialBinding, createHostedCredentialRepository, type BoundHostedCredentials, type HostedCredentialRepository } from "../../../credentials";
import { createHostedPkceProtocol, type HostedPkceAttemptEnvelope, type HostedPkceOptions, type HostedPkceStoredAttempt } from "..";

const repositories: HostedCredentialRepository[] = [];
afterEach(async () => { await Promise.all(repositories.splice(0).map(repository => repository.close())); });

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}

export function discovery(): FluxIQDiscoveryDocument {
  return { fluxiqDiscoveryVersion: 1, instance: { id: "instance-one", name: "Core", profile: "service" }, origin: "https://core.example.test", gatewayUrl: "wss://core.example.test/client", connect: { authorizeUrl: "/connect/authorize", tokenUrl: "/api/connect/token", revokeUrl: "/api/connect/revoke", codeEntryUrl: "/connect", flows: { authorizationCodePkce: true, referenceCode: false } }, protocols: { clientGateway: ["0.1", "0.2"] }, minimumClient: { "browser-extension": "0.1.0" } };
}

export function tokenResponse(patch: Partial<ConnectTokenResponse> = {}): ConnectTokenResponse {
  return { credential: "synthetic-pkce-credential-".padEnd(48, "x"), credentialExpiresAt: 20_000, connectedClientId: "connected-client-one", user: { userId: "user-one", displayName: "Test Person", email: "person@example.test" }, workspace: { workspaceId: "workspace-one", name: "Test" }, gatewayUrl: "wss://core.example.test/client", ...patch };
}

export function fixture() {
  const state = {
    current: true, now: 1_000, browserSessionId: "browser-session.1", revision: 0, attempt: null as HostedPkceStoredAttempt | null,
    document: discovery() as unknown, loadsFail: false, savesFail: false, ownershipFail: false,
    ownership: undefined as AuthenticationTabOwnership | undefined,
    requests: [] as { url: string; options: RequestInit }[], events: [] as string[], navigations: [] as Parameters<HostedPkceOptions["tabs"]["navigateOwned"]>[0][],
    beforeLoad: undefined as undefined | (() => Promise<void>), beforeSave: undefined as undefined | ((next: HostedPkceStoredAttempt | null) => Promise<void>),
    beforeBlank: undefined as undefined | (() => Promise<void>), beforeOwn: undefined as undefined | (() => Promise<void>), beforeNavigate: undefined as undefined | (() => Promise<void>),
    onDiscovery: undefined as undefined | (() => Promise<Response>), onToken: undefined as undefined | (() => Promise<Response>),
    wrapBound: (bound: BoundHostedCredentials): BoundHostedCredentials => bound
  };
  const repository = createHostedCredentialRepository({ indexedDB: new IDBFactory(), databaseName: "isolated-pkce-tests", now: () => state.now });
  repositories.push(repository);
  const binding = checkHostedCredentialBinding(discovery(), "https://core.example.test");
  const bound = repository.forBinding(binding);
  const authenticationTabs = new AuthenticationTabs({ routes: [], store: {
    load: async () => ({ browserSessionId: state.browserSessionId, ownership: state.ownership }),
    save: async ownership => {
      await state.beforeOwn?.();
      if (state.ownershipFail) throw new Error("synthetic-private-ownership");
      state.ownership = structuredClone(ownership);
      state.events.push("owned");
    }
  } });
  const selection = { id: "selected-profile.1", origin: "https://core.example.test", clientLabel: "Test extension", extensionVersion: "1.2.3" };
  const options: HostedPkceOptions = {
    selection, isCurrent: () => state.current, credentials: { forBinding: checked => state.wrapBound(repository.forBinding(checked)), close: () => repository.close() },
    attempts: {
      load: async () => {
        await state.beforeLoad?.();
        if (state.loadsFail) throw new Error("synthetic-private-attempt");
        return structuredClone({ browserSessionId: state.browserSessionId, revision: state.revision, attempt: state.attempt });
      },
      compareAndSwap: async (expected, next) => {
        await state.beforeSave?.(next);
        if (state.savesFail) throw new Error("synthetic-private-attempt");
        if (expected.browserSessionId !== state.browserSessionId || expected.revision !== state.revision) return false;
        state.attempt = structuredClone(next);
        state.revision += 1;
        state.events.push(next?.phase ?? "empty");
        return true;
      }
    }, authenticationTabs,
    tabs: {
      createBlank: async () => {
        await state.beforeBlank?.();
        state.events.push("blank");
        return 12;
      },
      navigateOwned: async input => {
        await state.beforeNavigate?.();
        if (!input.stillCurrent()) throw new Error("synthetic-stale-navigation");
        state.navigations.push(input);
        state.events.push("navigate");
      }
    },
    fetch: async (url, request) => {
      state.requests.push({ url, options: request });
      if (request.method === "GET") return state.onDiscovery ? await state.onDiscovery() : Response.json(state.document);
      return state.onToken ? await state.onToken() : Response.json(tokenResponse());
    }, crypto: webcrypto as unknown as Crypto, now: () => state.now
  };
  const protocol = createHostedPkceProtocol(options);
  return { state, selection, options, protocol, repository, binding, bound, authenticationTabs, restart: () => createHostedPkceProtocol(options) };
}

export function waiting(test: ReturnType<typeof fixture>): Extract<HostedPkceStoredAttempt, { phase: "waiting" }> {
  if (test.state.attempt?.phase !== "waiting") throw new Error("Expected synthetic waiting fixture");
  return structuredClone(test.state.attempt);
}

export function callback(test: ReturnType<typeof fixture>, patch: { tabId?: number; url?: string } = {}) {
  const record = waiting(test);
  return { tabId: 12, url: `https://core.example.test/connect/done#code=${"c".repeat(43)}&state=${record.state}`, ...patch };
}

export function envelope(test: ReturnType<typeof fixture>): HostedPkceAttemptEnvelope {
  return structuredClone({ browserSessionId: test.state.browserSessionId, revision: test.state.revision, attempt: test.state.attempt });
}
