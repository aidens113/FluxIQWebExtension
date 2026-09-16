// T1 coverage of what the list reader decides before it touches the page: an
// `encrypt` field, a request whose every field is excluded, and a request with
// no field or no item are each refused first. Node has no `document`, so a
// reader that read anything before refusing would throw a ReferenceError
// instead of these refusals. Records, pagination, optional fields and the
// sensitive-control refusal are proven on real fixtures by
// `e2e/content/tests/extract-list.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../list-reader";

test("an encrypt field refuses the read as not implemented before the page is read", async () => {
  await assert.rejects(
    extractList({ item: ".row", fields: { name: ".name", card: { kind: "value", selector: ".card", handling: "encrypt" } } }),
    (error: unknown) => {
      assert.ok(error instanceof Error, String(error));
      assert.equal((error as { failure?: { code?: unknown } }).failure?.code, "web.action.not_implemented", error.message);
      return true;
    }
  );
});

test("a request whose every field is excluded would read nothing, so it is refused", async () => {
  await assert.rejects(
    extractList({ item: ".row", fields: { password: { kind: "value", selector: "input", handling: "exclude" } } }),
    /every field it names is excluded/u
  );
});

test("a request naming no field, or no item, is refused", async () => {
  await assert.rejects(extractList({ item: ".row", fields: {} }), /names no fields/u);
  await assert.rejects(extractList({ item: "   ", fields: { name: ".name" } }), /needs an item selector/u);
});
