// Whether a column a read names from a detection is required.
//
// `run-murdouox-c5294247` (social-network-feed, confirm-requests): the build read
// the eight friend requests with a `confirm` column, the Confirm button every
// card had when the list was detected, so the detection proposed it
// `required: true`. It then confirmed one request, whose card lost its Confirm
// button, and the Flow's own listing failed `required_fields_missing` when the
// build's test ran it again -- as it would have on every later run of the
// person's page. A column is required only when the read itself says so.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractField } from "../../../../../actions/extraction";
import { keptWebExtractionColumns } from "../columns";

/** Columns as a detection proposes them: `required` from the coverage it measured. */
const DETECTED: Record<string, WebAutomationExtractField> = {
  name: { kind: "text", selector: ".card > a", required: true },
  confirm: { kind: "text", selector: ".card > .actions > div", required: true },
  profile: { kind: "link", selector: ".card > a", required: true },
  badge: { kind: "text", selector: ".card > .badge", required: false }
};

test("an explicitly marked link keeps identity through required-field mapping, while a raw attribute does not", () => {
  const detected: Record<string, WebAutomationExtractField> = { link: { kind: "link", selector: "a", identity: "tracking-free" } };
  const result = keptWebExtractionColumns({ identity: { key: "link", required: true }, raw: "link@href" }, detected, ["fields"]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.fields.identity, { kind: "link", selector: "a", required: true, identity: "tracking-free" });
  assert.deepEqual(result.fields.raw, { kind: "attribute", selector: "a", attribute: "href" });
});

test("a column the detection saw on every item is not required by the read that names it", () => {
  assert.deepEqual(keptWebExtractionColumns({ name: "name", confirm: "Confirm", href: "profile@href", badge: "badge" }, DETECTED, ["fields"]), {
    ok: true,
    // `Confirm` found its column in another case: the one assumption, and still not required.
    assumed: [{ path: ["fields", "confirm"], written: "Confirm", field: "confirm", how: "normalized", score: 1, among: "detected" }],
    fields: {
      name: { kind: "text", selector: ".card > a", required: false },
      confirm: { kind: "text", selector: ".card > .actions > div", required: false },
      href: { kind: "attribute", selector: ".card > a", attribute: "href", required: false },
      badge: { kind: "text", selector: ".card > .badge", required: false }
    }
  });
});

test("a read that names no columns keeps every detected one, none of them required", () => {
  const kept = keptWebExtractionColumns(undefined, DETECTED, ["fields"]);
  assert.equal(kept.ok, true);
  assert.deepEqual(kept.ok ? Object.values(kept.fields).map((field) => typeof field === "string" ? field : field.required) : [], [false, false, false, false]);
});

test("a column the read itself marks required stays required, and only that one", () => {
  assert.deepEqual(keptWebExtractionColumns({ name: { key: "name", required: true }, confirm: { key: "confirm" } }, DETECTED, ["fields"]), {
    ok: true,
    assumed: [],
    fields: {
      name: { kind: "text", selector: ".card > a", required: true },
      confirm: { kind: "text", selector: ".card > .actions > div", required: false }
    }
  });
});

test("the detection's own columns are not changed by a read that names them", () => {
  keptWebExtractionColumns({ name: "name" }, DETECTED, ["fields"]);
  assert.deepEqual(DETECTED.name, { kind: "text", selector: ".card > a", required: true });
});

test("definition identity survives exact, default and required column copies without aliasing", () => {
  for (const fields of [undefined, { edition: "edition" }, { edition: { key: "edition", required: true } }]) {
    const definition = { term: "Edition", part: "value" as const };
    const detected: Record<string, WebAutomationExtractField> = { edition: { kind: "text", selector: "dl", definition, required: true } };
    const result = keptWebExtractionColumns(fields, detected, ["fields"]);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const field = result.fields.edition;
    assert.notEqual(typeof field, "string");
    if (typeof field === "string" || field === undefined) continue;
    assert.deepEqual(field.definition, { term: "Edition", part: "value" });
    assert.notEqual(field.definition, definition);
    definition.term = "changed";
    assert.equal(field.definition?.term, "Edition");
  }
});

test("an attribute override cannot erase a text definition's field identity", () => {
  const detected: Record<string, WebAutomationExtractField> = { edition: { kind: "text", definition: { term: "Edition", part: "value" } } };
  const result = keptWebExtractionColumns({ edition: "edition@title" }, detected, ["fields"]);
  assert.deepEqual(result, { ok: false, issue: "web.handle.malformed", path: ["fields", "edition"] });
});
