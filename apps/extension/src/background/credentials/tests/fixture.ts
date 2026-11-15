import { IDBFactory } from "fake-indexeddb";
import { afterEach } from "node:test";
import type { ConnectTokenResponse } from "@fluxiq/contracts/platform";
import { checkHostedCredentialBinding, createHostedCredentialRepository, type HostedCredentialBinding, type HostedCredentialRepository } from "../index";

const repositories: HostedCredentialRepository[] = [];

afterEach(async () => { await Promise.all(repositories.splice(0).map(repository => repository.close())); });

export function discovery(origin = "https://core.example.test", instanceId = "instance-one") {
  return { fluxiqDiscoveryVersion: 1, instance: { id: instanceId, name: "Core", profile: "service" }, origin, gatewayUrl: `${origin.replace("https:", "wss:")}/client`, connect: { authorizeUrl: "/connect/authorize", tokenUrl: "/api/connect/token", revokeUrl: "/api/connect/revoke", codeEntryUrl: "/connect", flows: { authorizationCodePkce: true, referenceCode: false } }, protocols: { clientGateway: ["0.1", "0.2"] }, minimumClient: { "browser-extension": "0.1.0" } };
}

export function response(binding: HostedCredentialBinding, patch: Partial<ConnectTokenResponse> = {}): ConnectTokenResponse {
  return { credential: "synthetic-credential-".padEnd(48, "x"), credentialExpiresAt: 20_000, connectedClientId: "connected-client-one", user: { userId: "user-one", displayName: "Test Person", email: "person@example.test" }, workspace: { workspaceId: "workspace-one", name: "Test" }, gatewayUrl: binding.gatewayUrl, ...patch };
}

export function fixture() {
  const factory = new IDBFactory();
  const databaseName = "isolated-credential-tests";
  const state: { now: number; onTransaction?: (transaction: IDBTransaction) => void; opened?: IDBDatabase } = { now: 1_000 };
  const open = factory.open.bind(factory);
  factory.open = (name, version) => {
    const request = open(name, version);
    request.addEventListener("success", () => {
      const database = request.result;
      state.opened = database;
      const transact = database.transaction.bind(database);
      database.transaction = (stores, mode, options) => {
        const transaction = transact(stores, mode, options);
        state.onTransaction?.(transaction);
        return transaction;
      };
    });
    return request;
  };
  const reopen = () => {
    const repository = createHostedCredentialRepository({ indexedDB: factory, databaseName, now: () => state.now });
    repositories.push(repository);
    return repository;
  };
  const repository = reopen();
  const binding = checkHostedCredentialBinding(discovery(), "https://core.example.test");
  const port = repository.forBinding(binding);
  return { factory, databaseName, state, repository, reopen, binding, port };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => { resolve = complete; });
  return { promise, resolve };
}

export async function seed(fixture: ReturnType<typeof import("./fixture").fixture>) {
  await fixture.port.getOrCreateInstallation();
  return fixture.port.commit({ operationId: "initial-commit", expectedRevision: 0, kind: "new-trust", response: response(fixture.binding) });
}
