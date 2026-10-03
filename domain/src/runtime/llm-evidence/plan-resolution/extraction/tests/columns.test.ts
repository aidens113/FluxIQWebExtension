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
