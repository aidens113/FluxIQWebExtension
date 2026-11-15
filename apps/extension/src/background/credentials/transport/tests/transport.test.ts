import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ClientGatewayOutbox, FluxIQClientGatewayConnection, FluxIQClientGatewayWebSocketClient, clientGatewayMemoryOutboxStore } from "@fluxiq/client-gateway-websocket";
import { createHostedCredentialTokenStorage } from "../index";
import { adapterFixture, deferred, repositoryWithPorts } from "./fixture";
import { CredentialTestSocket, nextTask } from "./socket";

const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

test("actual direct transport waits for durable adapter rotation before ack, ready or later frames", async () => {
  const setup = await adapterFixture();
  const entered = deferred();
  const release = deferred();
  const committed = deferred();
  const repository = repositoryWithPorts(setup.repository, { commit: async input => {
    entered.resolve();
    await release.promise;
    const result = await setup.port.commit(input);
    committed.resolve();
    return result;
  } });
  const storage = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  const client = new FluxIQClientGatewayWebSocketClient({ url: setup.binding.gatewayUrl, client: { clientId: setup.snapshot.installId, clientType: "extension" }, WebSocketImpl: CredentialTestSocket, tokenStorage: storage });
  cleanup.push(() => client.close());
  const events: string[] = [];
  const ready = deferred();
  client.on("message", ({ message }) => { events.push(message.type); });
  client.on("session_ready", () => { ready.resolve(); });
  await client.connect();
  const socket = CredentialTestSocket.latest;
  assert.equal(socket.url, setup.binding.gatewayUrl);
  assert.equal(socket.sent[0]!.type, "client.hello");
  assert.equal((socket.sent[0]!.payload as { token: string }).token, setup.snapshot.credential);
  socket.ready(setup.grant.credential, setup.metadata);
  socket.recording();
  await entered.promise;
  assert.equal(socket.acknowledgements(), 0);
  assert.deepEqual(events, []);
  assert.equal((await setup.port.read())?.revision, 1);
  release.resolve();
  await committed.promise;
  await ready.promise;
  await nextTask();
  assert.equal(socket.acknowledgements(), 1);
  assert.deepEqual(events, ["server.session_ready", "server.start_recording"]);
  assert.equal((await setup.port.read())?.expiresAtMs, setup.metadata.credentialExpiresAt);
});

test("actual reconnecting transport adopts ready only after the private credential commit", async () => {
  const setup = await adapterFixture();
  const ready = deferred();
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore());
  await outbox.setLineage(setup.snapshot.lineageKey);
  let connection!: FluxIQClientGatewayConnection;
  connection = new FluxIQClientGatewayConnection({
    url: () => setup.binding.gatewayUrl,
    hello: () => ({ clientId: setup.snapshot.installId, clientType: "extension" }),
    tokenStorage: setup.adapter, WebSocketImpl: CredentialTestSocket,
    autoReconnect: () => false, outbox, context: () => ({ projectId: null, recordingId: null }), clientId: () => setup.snapshot.installId,
    emitStatus: () => undefined, reportError: () => undefined, clearError: () => undefined,
    handlers: { onSessionReady: () => {
      connection.markSessionReady();
      ready.resolve();
    } }
  });
  cleanup.push(() => {
    connection.stopReconnecting();
    connection.closeClient();
  });
  await connection.connect();
  CredentialTestSocket.latest.ready(setup.grant.credential, setup.metadata);
  await ready.promise;
  assert.equal(connection.state(), "connected");
  assert.equal(CredentialTestSocket.latest.acknowledgements(), 1);
  assert.equal((await setup.port.read())?.revision, 2);
  assert.equal(await outbox.lineage(), setup.snapshot.lineageKey);
});

test("direct transport refuses selection changed after commit without ack/ready or later frame dispatch", async () => {
  const setup = await adapterFixture();
  const repository = repositoryWithPorts(setup.repository, { commit: async input => {
    const result = await setup.port.commit(input);
    setup.selection.current = false;
    return result;
  } });
  const storage = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  const client = new FluxIQClientGatewayWebSocketClient({ url: setup.binding.gatewayUrl, client: { clientId: setup.snapshot.installId, clientType: "extension" }, WebSocketImpl: CredentialTestSocket, tokenStorage: storage });
  cleanup.push(() => client.close());
  const failed = deferred();
  const errors: Error[] = [];
  const messages: string[] = [];
  client.on("message", ({ message }) => { messages.push(message.type); });
  client.on("error", ({ event }) => {
    errors.push(event as Error);
    failed.resolve();
  });
  await client.connect();
  const socket = CredentialTestSocket.latest;
  socket.ready(setup.grant.credential, setup.metadata);
  socket.recording();
  await failed.promise;
  await nextTask();
  assert.equal(socket.acknowledgements(), 0);
  assert.equal(client.connected, false);
  assert.deepEqual(messages, []);
  assert.equal((await setup.port.read())?.revision, 2);
  assert.equal(errors[0]?.message, "FluxIQ could not save the connection credential. Reconnect when storage is available.");
  assert.equal(JSON.stringify(errors).includes(setup.grant.credential), false);
});
