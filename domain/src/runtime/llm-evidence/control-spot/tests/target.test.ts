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

test("preserves the trusted opaque resource across source scopes and omits it when absent", () => {
  assert.equal(webTargetSpot({ ...page, resetResource: "p:trusted-resource" }, "t1").resource, "p:trusted-resource");
  assert.equal(webTargetSpot({ ...page, resetResource: "p:trusted-resource" }, "t2").resource, "p:trusted-resource");
  assert.equal(webTargetSpot(page, "t1").resource, undefined);
  assert.deepEqual(webTargetSpot({ ...page, resetResource: "p:trusted-resource" }, undefined), {});
});

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

// Core t719: an add on a detail page sits in no row, and the line it made is on
// another page. What both are about is one token, so Core can tie the undo of
// the add to that line and to no other.
test("names what a control and its page are about by one kind of token, so a detail page's heading and the line titled alike are equal", () => {
  const detail = { records: new Map<string, string>(), subjects: new Map([["t1", "Sold by Fernhill Goods"]]), pageSubject: "Copper Pour-Over Kettle 1 L" };
  const basket = {
    records: new Map([["t5", `text${SEP}Copper Pour-Over Kettle 1 L`], ["t6", `text${SEP}Beeswax Wraps, Set of 3`]]),
    subjects: new Map([["t5", "Copper Pour-Over Kettle 1 L"], ["t6", "Beeswax Wraps, Set of 3"]]),
    pageSubject: "Your basket"
  };
  const add = webTargetSpot(detail, "t1");
  assert.deepEqual(add, { subject: webControlSpotToken("subject", "Sold by Fernhill Goods"), page: webControlSpotToken("subject", "Copper Pour-Over Kettle 1 L") });
  const kettleLine = webTargetSpot(basket, "t5"), wrapsLine = webTargetSpot(basket, "t6");
  assert.equal(kettleLine.subject, add.page);
  assert.notEqual(wrapsLine.subject, add.page);
  assert.equal(kettleLine.page, webControlSpotToken("subject", "Your basket"));
  for (const token of [add.subject, add.page, kettleLine.subject]) {
    assert.match(token ?? "", /^s:[0-9a-f]{32}$/);
    assert.ok(!(token ?? "").includes("Kettle"));
  }
  // A page that said nothing of either gives neither.
  assert.deepEqual(webTargetSpot({ records: new Map() }, "t1"), {});
});
