import assert from "node:assert/strict";
import test from "node:test";
import { admitRecordedAttempt, recordedReplyCursor, startRecordedModelServer, type RecordedAttemptArtifact } from "../index.js";

function artifact(): RecordedAttemptArtifact {
  const exchange = (stream: string, ordinal: number, request: string) => ({ stream, ordinal, request, response: Buffer.from("{malformed billed reply"), status: 200, contentType: "application/json", historicalUsd: 0.01 });
  return { version: 1, provenance: "synthetic-fixture", scenarioId: "company-website", taskId: "company-website-apprentices", oracleDigest: "a".repeat(64), source: { core: "core-fixture", extension: "extension-fixture" }, startingStore: { copied: true, digest: "b".repeat(64) }, domainEvidenceDigest: "c".repeat(64), exchanges: [exchange("one", 1, '{"model":"haiku","evidence":[1,2]}'), exchange("two", 1, '{"model":"haiku","evidence":[3]}'), exchange("one", 2, '{"model":"haiku","evidence":[4]}')] };
}

test("concurrent streams retain order and preserve raw malformed reply/status/bill", () => {
  const input = artifact();
  const cursor = recordedReplyCursor(input);
  assert.equal(cursor.take("two", input.exchanges[1]!.request)?.historicalUsd, 0.01);
  const first = cursor.take("one", '{"evidence":[1,2],"model":"haiku"}')!;
  assert.equal(Buffer.from(first.response!).toString(), "{malformed billed reply");
  first.response!.fill(0);
  assert.equal(Buffer.from(input.exchanges[0]!.response!).toString(), "{malformed billed reply");
  assert.equal(cursor.report().complete, false);
  assert.equal(cursor.take("one", input.exchanges[2]!.request)?.status, 200);
  assert.deepEqual(cursor.report(), { divergence: null, logicalCalls: 3, externalUsd: 0, complete: true });
});

test("changed model/evidence/grammar stops on first divergence with no lookahead", () => {
  for (const request of ['{"model":"sonnet","evidence":[1,2]}', '{"model":"haiku","evidence":[2,1]}', '{"model":"haiku","evidence":[4]}', '{"model":"haiku","evidence":[1,2],"tools":[]}']) {
    const cursor = recordedReplyCursor(artifact());
    assert.equal(cursor.take("one", request), null);
    assert.equal(cursor.report().divergence?.code, "request_changed");
    assert.equal(cursor.take("two", artifact().exchanges[1]!.request), null);
    assert.equal(cursor.report().logicalCalls, 0);
  }
});

test("missing raw response/status is an admission gap, never a decoded substitute", () => {
  const input = artifact();
  const missing = { ...input, exchanges: [{ ...input.exchanges[0]!, response: null, status: null }] };
  assert.deepEqual(admitRecordedAttempt(missing).gaps, ["missing_response:one:1", "missing_status:one:1"]);
  assert.throws(() => recordedReplyCursor(missing), /not_admitted/u);
});

test("transport-only admission keeps missing starting/domain evidence explicit without claiming build parity", () => {
  const input = { ...artifact(), startingStore: { copied: false, digest: "" }, domainEvidenceDigest: null };
  assert.equal(admitRecordedAttempt(input).admitted, true);
  assert.deepEqual(admitRecordedAttempt(input).buildGaps, ["unproved_starting_copy", "unproved_starting_position", "missing_domain_evidence"]);
  assert.equal(admitRecordedAttempt(input, true).admitted, false);
});

test("raw local transport returns exact malformed bytes and status without stream synthesis", async () => {
  const input = artifact();
  const server = await startRecordedModelServer({ artifact: input, key: "synthetic-only", streamForCorrelation: { uncorrelated: "one" } });
  try {
    const reply = await fetch(`${server.origin}/v1/messages`, { method: "POST", headers: { authorization: "Bearer synthetic-only" }, body: input.exchanges[0]!.request });
    assert.equal(reply.status, 200);
    assert.equal(reply.headers.get("content-type"), "application/json");
    assert.equal(await reply.text(), "{malformed billed reply");
    assert.equal(server.replay().logicalCalls, 1);
    assert.equal(server.replay().externalUsd, 0);
  } finally { await server.close(); }
});

test("cursor snapshots Buffer bytes before callers mutate the admitted artifact", () => {
  const input = artifact();
  const cursor = recordedReplyCursor(input);
  input.exchanges[0]!.response!.fill(0);
  const reply = cursor.take("one", input.exchanges[0]!.request);
  assert.equal(Buffer.from(reply!.response!).toString(), "{malformed billed reply");
});
