import assert from "node:assert/strict";
import test from "node:test";
import { ClientGatewayTraceMemoryStore, type ClientGatewayTraceEvent, type ClientGatewayTraceJsonValue } from "fluxiq/client-gateway";
import { WITHHELD_NAME, deliveryTail } from "../index.js";
import { SESSION_PAYLOAD_MARKER, recordGatewaySession } from "./gateway-session.js";

async function recordedEvents(): Promise<readonly ClientGatewayTraceEvent[]> {
  const memory = new ClientGatewayTraceMemoryStore();
  await recordGatewaySession(memory, "trace.tail");
  return await memory.readEventRange("trace.tail", 1, Number.MAX_SAFE_INTEGER);
}

test("the tail names the last delivery points, the commands by ordinal and what Core derived, without payload text", async () => {
  const events = await recordedEvents();
  const tail = deliveryTail(events, null, 3);
  assert.deepEqual(tail.rows.map(row => row.sequence), events.slice(-3).map(event => event.sequence));
  assert.equal(tail.commands, 2);
  assert.deepEqual(tail.unanswered, []);
  assert.equal(tail.lastEventMs, events.at(-1)?.time.logicalMs);
  const full = deliveryTail(events, null, events.length);
  const press = full.rows.find(row => row.kind === "outbound" && row.names.action === "example.press");
  assert.equal(press?.command, "c1");
  const result = full.rows.find(row => row.kind === "inbound" && row.messageType === "client.action_result");
  assert.deepEqual({ command: result?.command, status: result?.names.status }, { command: "c1", status: "succeeded" });
  assert.equal(full.rows.find(row => row.kind === "disposition" && row.command === "c1")?.names.disposition, "settled");
  const outcome = full.rows.find(row => row.kind === "synthesized");
  assert.deepEqual({ command: outcome?.command, outcome: outcome?.names.outcome }, { command: "c2", outcome: "answer_never_came" });
  assert.ok(full.rows.every(row => row.parity === null));
  assert.equal(JSON.stringify(full).includes(SESSION_PAYLOAD_MARKER), false);
  assert.ok(full.rows.every(row => !JSON.stringify(row).includes("client.parity")), "no client id or session id");
});

test("a command without an answer is listed, a value that is not a protocol name is withheld, and parity entries are joined by sequence", async () => {
  const events = await recordedEvents();
  const outcomeAt = events.findIndex(event => event.kind === "synthesized");
  const changed = events.filter((_, index) => index !== outcomeAt).map(event => {
    if (event.kind !== "outbound" || event.payload.encoding !== "json") return event;
    const value = event.payload.value as { readonly [key: string]: ClientGatewayTraceJsonValue };
    const payload = value.payload as { readonly [key: string]: ClientGatewayTraceJsonValue };
    const changedValue: ClientGatewayTraceJsonValue = { ...value, payload: { ...payload, actionType: `${SESSION_PAYLOAD_MARKER} with spaces` } };
    return { ...event, payload: { encoding: "json" as const, value: changedValue } };
  });
  const last = changed.at(-1);
  assert.ok(last);
  const tail = deliveryTail(changed, [{ sequence: last.sequence, kind: last.kind, messageType: last.messageType, status: "diverged", replaySequence: null }], changed.length);
  assert.deepEqual(tail.unanswered, ["c2"]);
  assert.ok(tail.rows.filter(row => row.kind === "outbound").every(row => row.names.action === WITHHELD_NAME));
  assert.equal(tail.rows.at(-1)?.parity, "diverged");
  assert.equal(JSON.stringify(tail).includes(SESSION_PAYLOAD_MARKER), false);
});
