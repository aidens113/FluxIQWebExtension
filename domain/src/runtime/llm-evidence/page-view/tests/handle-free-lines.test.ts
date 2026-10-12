// A page view read back as the lines two captures are compared by: handles
// gone, the page's `~` base written out, markers left out, the title unquoted.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmHandleFreeViewLines } from "../handle-free-lines";

test("element lines lose their handles, keep quoted words and write the base out", () => {
  const text = [
    "PAGE \"Kettles \\\"on sale\\\"\"",
    "URL ~/store   (~ = https://shop.test)",
    "",
    "[main]",
    "t1 button \"Go t9\"",
    "t12 link \"Cart\" ~/cart same href as t3",
    "t4 \"plain words\" covered-by t2,t7"
  ].join("\n");
  assert.deepEqual(webLlmHandleFreeViewLines(text), {
    title: "Kettles \"on sale\"",
    lines: ["button \"Go t9\"", "link \"Cart\" https://shop.test/cart same href as t*", "\"plain words\" covered-by t*,t*"]
  });
});

test("a view without a body or a title has no lines and no title", () => {
  assert.deepEqual(webLlmHandleFreeViewLines("URL https://shop.test/"), { title: undefined, lines: [] });
});
