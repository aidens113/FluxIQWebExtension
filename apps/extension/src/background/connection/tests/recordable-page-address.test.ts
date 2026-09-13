import assert from "node:assert/strict";
import { test } from "node:test";
import { recordablePageAddress } from "../recordable-page-address";

test("a page a recording can see is named by origin and path, and by its path alone, never by its query or fragment", () => {
  assert.deepEqual(
    recordablePageAddress("http://127.0.0.1:4174/scenarios/multi-tab/orders?token=withheld#row-3"),
    { location: "http://127.0.0.1:4174/scenarios/multi-tab/orders", path: "/scenarios/multi-tab/orders" }
  );
});

test("a page with no recordable path has no address, including a pathname whose first segment is a host", () => {
  for (const url of [undefined, "", "not a url", "about:blank", "chrome://settings/", "data:text/html,page", "http://127.0.0.1:4174//evil.test/list"]) {
    assert.equal(recordablePageAddress(url), undefined, String(url));
  }
});
