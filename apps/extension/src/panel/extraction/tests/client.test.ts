import assert from "node:assert/strict";
import test from "node:test";
import { cancelExtraction, confirmExtraction, readExtractionSession, startExtractionPick } from "../client";
import { extractionConfirmPayload } from "../confirm-payload";
import { extractionDraftFromProposal } from "../view-model";
import { withDialogDom } from "./dialog-dom";
import { proposalFixture } from "./proposal-fixture";

const request = () => extractionConfirmPayload(extractionDraftFromProposal(proposalFixture(), "Synthetic dataset"));
const valid = { ok: true, datasetId: "synthetic", label: "Synthetic dataset", recordCount: 2, pagesRead: 1, durationMs: 0.5, truncated: false };

for (const key of ["recordCount", "pagesRead", "durationMs"] as const) {
  for (const value of [NaN, Infinity, -Infinity, -1, ...(key === "durationMs" ? [] : [0.5])]) {
    test(`malformed receipt ${key}=${String(value)} retains accepted legacy outcome fallback`, async () => withDialogDom(async world => {
      world.reply = () => ({ ...valid, [key]: value });
      assert.equal(await confirmExtraction(request()), undefined);
      assert.equal(world.sent.length, 1, "accepted confirmation is never replayed");
    }));
  }
}

test("truthful zero counts and fractional elapsed time remain valid", async () => withDialogDom(async world => {
  world.reply = () => ({ ...valid, recordCount: 0, pagesRead: 0 });
  assert.deepEqual(await confirmExtraction(request()), { datasetId: valid.datasetId, label: valid.label, recordCount: 0, pagesRead: 0, durationMs: 0.5, truncated: false });
}));

test("bare older acknowledgement and incomplete receipts remain accepted without counts", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true });
  assert.equal(await confirmExtraction(request()), undefined);
  world.reply = () => ({ ...valid, label: undefined });
  assert.equal(await confirmExtraction(request()), undefined);
}));

test("valid truncated receipt normalizes only literal true without changing sent structure", async () => withDialogDom(async world => {
  world.reply = () => ({ ...valid, truncated: true });
  assert.equal((await confirmExtraction(request()))?.truncated, true);
  world.reply = () => ({ ...valid, truncated: "true" });
  assert.equal((await confirmExtraction(request()))?.truncated, false);
  assert.deepEqual(world.sent[0]?.request, request());
}));

test("missing listener and explicit refusal retain existing error handling", async () => withDialogDom(async world => {
  world.reply = () => undefined;
  await assert.rejects(confirmExtraction(request()), /background worker did not answer/u);
  world.reply = () => ({ ok: false, error: "Synthetic refusal" });
  await assert.rejects(confirmExtraction(request()), /Synthetic refusal/u);
}));

test("only fulfilled background refusals carry local presentation provenance", async () => withDialogDom(async world => {
  const calls = [() => confirmExtraction(request()), readExtractionSession, startExtractionPick, cancelExtraction];
  world.reply = () => ({ ok: false, error: "Synthetic background refusal" });
  for (const call of calls) await assert.rejects(call(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Synthetic background refusal");
    assert.equal((error as Error & { extractionRefusal?: boolean }).extractionRefusal, true);
    assert.equal(Object.keys(error).includes("extractionRefusal"), false);
    return true;
  });
  const rejection = new Error("Synthetic transport rejection");
  world.reply = () => Promise.reject(rejection);
  for (const call of calls) await assert.rejects(call(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, rejection.message);
    assert.equal((error as Error & { extractionRefusal?: boolean }).extractionRefusal, undefined);
    return true;
  });
}));
