// Where a library call's control sits, as Core's declaration takes it (Core
// t475): opaque tokens of its record and dialog, equal for the same record
// and different for another row, and in the shape Core reads.

import assert from "node:assert/strict";
import test from "node:test";
import { webControlSpotToken, webTargetSpot } from "..";

const SEP = String.fromCharCode(31);
const page = {
  records: new Map([["t1", `text${SEP}Amara Osei`], ["t2", `text${SEP}Tom Becker`], ["t3", `text${SEP}Amara Osei`]]),
  dialogNames: new Map([["t4", "You're going too fast"]])
};

test("names a control's record and dialog by opaque tokens: the same row alike, another row not", () => {
  const amara = webTargetSpot(page, "t1");
  assert.deepEqual(amara, { item: webControlSpotToken("item", `text${SEP}Amara Osei`) });
  assert.deepEqual(webTargetSpot(page, "t3"), amara);
  assert.notDeepEqual(webTargetSpot(page, "t2"), amara);
  assert.deepEqual(webTargetSpot(page, "t4"), { dialog: webControlSpotToken("dialog", "You're going too fast") });
  assert.deepEqual(webTargetSpot(page, "t9"), {});
  assert.deepEqual(webTargetSpot(page, undefined), {});
});

test("is a token Core's declaration reader takes, and carries none of the row's words", () => {
  for (const token of [webControlSpotToken("item", `text${SEP}Amara Osei`), webControlSpotToken("dialog", "Chat with Elena")]) {
    assert.match(token, /^[A-Za-z0-9:_-]{1,128}$/);
    assert.ok(!token.includes("Amara") && !token.includes("Elena"));
  }
  assert.notEqual(webControlSpotToken("item", "x"), webControlSpotToken("dialog", "x"));
});
