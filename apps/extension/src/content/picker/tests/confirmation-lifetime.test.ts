import assert from "node:assert/strict";
import test from "node:test";
import { onConfirmationPage } from "./confirmation-fixture";
import { EXTRACTION_PICK_CANCELLED_MESSAGE } from "../../../shared/extraction-messages";

test("genuine inference followed by ordinary drain confirms through the public recorder", async () => {
  await onConfirmationPage(page => {
    const definition = page.pick("chosen");
    page.fire("click");
    assert.deepEqual(page.command("record", "chosen", definition), { ok: true });
    const recorded = page.sent.filter(message => message.payload?.kind === "data.extract");
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]!.payload!.element, undefined);
    assert.doesNotMatch(JSON.stringify(recorded), /CELL_SENTINEL|"records"|"preview"/u);
  });
});

for (const drain of ["auxclick", "timer", "Escape"] as const) {
  test(`successful choice remains confirmable after ${drain} drain`, async () => {
    await onConfirmationPage(page => {
      const definition = page.pick("chosen");
      if (drain === "timer") [...page.timers.values()].at(-1)!();
      else if (drain === "Escape") page.fire("keydown", undefined, "Escape");
      else page.fire(drain);
      assert.equal(page.listeners.get("pointerdown")?.length, 0);
      assert.equal(page.sent.filter(message => message.type === EXTRACTION_PICK_CANCELLED_MESSAGE).length, 0);
      assert.deepEqual(page.command("record", "chosen", definition), { ok: true });
      assert.equal(page.sent.filter(message => message.payload?.kind === "data.extract").length, 1);
    });
  });
}

test("duplicate start preserves the successful choice and explicit confirmation invocations", async () => {
  await onConfirmationPage(page => {
    const definition = page.pick("chosen");
    page.fire("click");
    assert.deepEqual(page.command("pickStart", "chosen"), { ok: true });
    assert.equal(page.listeners.get("pointerdown")?.length, 0);
    assert.deepEqual(page.command("record", "chosen", definition), { ok: true });
    const revised = { ...definition, label: "Revised choice" };
    assert.deepEqual(page.command("record", "chosen", revised), { ok: true });
    const events = page.sent.filter(message => message.payload?.kind === "data.extract");
    assert.equal(events.length, 2);
    assert.equal(events[1]!.payload!.extraction!.label, "Revised choice");
    assert.doesNotMatch(JSON.stringify(events), /CELL_SENTINEL/u);
    assert.ok(events[0]!.payload!.extraction!.form === "list");
    assert.ok(Object.values(events[0]!.payload!.extraction!.request.fields).some(field => typeof field === "object" && field.handling === "exclude"));
  });
});

test("invalid-definition and recording-off refusals preserve a retryable successful lease", async () => {
  await onConfirmationPage(page => {
    const definition = page.pick("chosen");
    page.fire("click");
    assert.deepEqual(page.command("record", "chosen", {}), { ok: false, refused: "invalid_definition" });
    page.recording(false);
    assert.deepEqual(page.command("record", "chosen", definition), { ok: false, refused: "not_recording" });
    assert.equal(page.sent.filter(message => message.payload?.kind === "data.extract").length, 0);
    page.recording(true);
    assert.deepEqual(page.command("record", "chosen", definition), { ok: true });
  });
});

test("idle never-retired definition compatibility preserves the real definition/recording gates", async () => {
  await onConfirmationPage(page => {
    const definition = { form: "list", datasetId: "idle", label: "Explicit idle definition", itemCount: 3, request: { item: '[data-testid="synthetic-item"]', fields: { name: { kind: "text", selector: '[data-testid="synthetic-name"]' } } } };
    assert.deepEqual(page.command("record", "never-picked", definition), { ok: true });
    assert.equal(page.sent.filter(message => message.payload?.kind === "data.extract").length, 1);
    page.command("pickCancel", "retired");
    assert.deepEqual(page.command("record", "retired", definition), { ok: false, refused: "stale_session" });
    assert.deepEqual(page.command("record", "other-idle", {}), { ok: false, refused: "invalid_definition" });
  });
});
