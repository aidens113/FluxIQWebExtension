// Whether a `where` condition holds of a value (C5), judged against the
// strings the fixtures really produce.
//
// The rows here are the whole of what "under $50" means, in the one place it is
// decided: the content script asks this function of a value it read off a card,
// and the plan resolver accepts a model's condition on the strength of the same
// function. A price is `$49.00` on one site, `16.00 USD` on another and
// `3.7 out of 5 stars` where a rating is meant, so a comparison that only
// understood a bare number would silently keep no rows and report a page with
// nothing on it.

import assert from "node:assert/strict";
import test from "node:test";
import {
  webAutomationExtractConditionHolds,
  webAutomationExtractConditionNumber,
  webAutomationExtractConditionPattern
} from "../condition-match";
import type { WebAutomationExtractItemCondition } from "../request";

function holds(says: WebAutomationExtractItemCondition, value: string | undefined): boolean {
  return webAutomationExtractConditionHolds(says, value);
}

test("a condition that compares nothing asks whether the page has the value", () => {
  assert.equal(holds({}, "Sponsored"), true);
  assert.equal(holds({}, undefined), false);
  assert.equal(holds({ is: "present" }, "Sponsored"), true);
  assert.equal(holds({ is: "present" }, undefined), false);
  // The test a mark wants: the item that does not carry the ad label.
  assert.equal(holds({ is: "absent" }, undefined), true);
  assert.equal(holds({ is: "absent" }, "Sponsored"), false);
});

test("a number is read off the value in the formats the fixtures write it in", () => {
  const rows: Array<[string, number | undefined]> = [
    ["16.00 USD", 16],
    ["$49.00", 49],
    ["3.7 out of 5 stars", 3.7],
    ["4.0", 4],
    ["$1,299.00", 1299],
    // A price written twice -- once for a screen reader, once for the eye.
    ["$39.99$39.99", 39.99],
    ["    $12.50 ", 12.5],
    ["-5.00", -5],
    ["Free", undefined],
    ["Plus", undefined],
    ["", undefined]
  ];
  for (const [value, number] of rows) assert.equal(webAutomationExtractConditionNumber(value), number, value);
});

test("every numeric comparison reads that number, and a value with none fails", () => {
  assert.equal(holds({ atLeast: 4 }, "4.0"), true);
  assert.equal(holds({ atLeast: 4 }, "3.7 out of 5 stars"), false);
  assert.equal(holds({ atLeast: 4 }, "4.5 out of 5 stars"), true);
  assert.equal(holds({ atMost: 50 }, "50.00 USD"), true);
  assert.equal(holds({ atMost: 50 }, "$50.01"), false);
  assert.equal(holds({ lessThan: 50 }, "$49.00"), true);
  assert.equal(holds({ lessThan: 50 }, "16.00 USD"), true);
  assert.equal(holds({ lessThan: 50 }, "$1,299.00"), false);
  assert.equal(holds({ greaterThan: 0 }, "$0.00"), false);
  assert.equal(holds({ greaterThan: 0 }, "$0.01"), true);
  // Two bounds on one column are one range, and both must hold.
  assert.equal(holds({ atLeast: 10, atMost: 50 }, "$49.00"), true);
  assert.equal(holds({ atLeast: 10, atMost: 50 }, "$9.99"), false);
  // A row with no price is not a row under $50, and nor is a row with no value.
  for (const says of [{ atLeast: 4 }, { atMost: 4 }, { lessThan: 4 }, { greaterThan: 4 }]) {
    assert.equal(holds(says, "Free"), false, JSON.stringify(says));
    assert.equal(holds(says, undefined), false, JSON.stringify(says));
  }
});

test("equals compares a number against the number and a string against the text, and a list means any of them", () => {
  assert.equal(holds({ equals: 4 }, "4.0"), true);
  assert.equal(holds({ equals: 4 }, "4.00 out of 5 stars"), true);
  assert.equal(holds({ equals: 4 }, "3.7 out of 5 stars"), false);
  assert.equal(holds({ equals: 49 }, "$49.00"), true);
  assert.equal(holds({ equals: "Plus" }, "plus"), true);
  assert.equal(holds({ equals: "Plus" }, " Plus\n "), true);
  assert.equal(holds({ equals: "Plus" }, "Plus eligible"), false);
  assert.equal(holds({ equals: ["Plus", "Prime"] }, "prime"), true);
  assert.equal(holds({ equals: [4, "free"] }, "Free"), true);
  assert.equal(holds({ equals: [4, "free"] }, "$4.00"), true);
  assert.equal(holds({ equals: [4, "free"] }, "$5.00"), false);
  assert.equal(holds({ equals: "Plus" }, undefined), false);
});

test("a textual comparison reads the value's words, not its layout or its case", () => {
  const title = "Acme  Wireless\n Earbuds  Charging Case (Black)";
  assert.equal(holds({ contains: "charging case" }, title), true);
  assert.equal(holds({ contains: "CHARGING CASE" }, title), true);
  assert.equal(holds({ contains: ["ear tips", "charging case"] }, title), true);
  assert.equal(holds({ contains: ["ear tips", "screen protector"] }, title), false);
  assert.equal(holds({ startsWith: "acme wireless" }, title), true);
  assert.equal(holds({ startsWith: "wireless" }, title), false);
  assert.equal(holds({ endsWith: "(black)" }, title), true);
  assert.equal(holds({ endsWith: "case" }, title), false);
  assert.equal(holds({ contains: "case" }, undefined), false);
});

test("matches takes a regular expression, case-insensitive unless the /pattern/flags form says otherwise", () => {
  const title = "Acme Wireless Earbuds -- Charging Case";
  assert.equal(holds({ matches: "ear ?tips|charging case" }, title), true);
  assert.equal(holds({ matches: "^Acme" }, title), true);
  assert.equal(holds({ matches: "^Wireless" }, title), false);
  // A bare source ignores case, because a person naming words rarely means
  // their capitalisation.
  assert.equal(holds({ matches: "charging case" }, title), true);
  // The delimited form says what the flags say, which is how case is asked for.
  assert.equal(holds({ matches: "/Charging Case/" }, title), true);
  assert.equal(holds({ matches: "/charging case/" }, title), false);
  assert.equal(holds({ matches: "/charging case/i" }, title), true);
  // Any of a list satisfies one comparison.
  assert.equal(holds({ matches: ["^Zeta", "Case$"] }, title), true);
  // A stateful flag is dropped, so a row's verdict never depends on the rows
  // before it: the same condition answers the same way twice running.
  const stateful = { matches: "/Case/g" } satisfies WebAutomationExtractItemCondition;
  assert.equal(holds(stateful, title), true);
  assert.equal(holds(stateful, title), true);
});

test("not inverts the whole condition, which is how an exclusion is written", () => {
  assert.equal(holds({ contains: ["ear tips", "charging case"], not: true }, "Acme Wireless Earbuds"), true);
  assert.equal(holds({ contains: ["ear tips", "charging case"], not: true }, "Acme Charging Case"), false);
  assert.equal(holds({ lessThan: 50, not: true }, "$79.99"), true);
  assert.equal(holds({ is: "absent", not: true }, "Sponsored"), true);
  // A value the page did not have is kept by an exclusion: "no charging case in
  // the title" is not a reason to drop an item with no title.
  assert.equal(holds({ contains: "charging case", not: true }, undefined), true);
  assert.equal(holds({ not: false, contains: "case" }, "Acme Case"), true);
});

test("a condition may compare the same value several ways, and every comparison must hold", () => {
  // The everything-store instruction, on one column at a time: rated 4.0 or
  // higher, under $50, and not an accessory.
  assert.equal(holds({ atLeast: 4, atMost: 5 }, "4.3 out of 5 stars"), true);
  assert.equal(holds({ atLeast: 4, atMost: 5 }, "3.9 out of 5 stars"), false);
  assert.equal(holds({ startsWith: "Acme", contains: "earbuds" }, "Acme Wireless Earbuds"), true);
  assert.equal(holds({ startsWith: "Acme", contains: "earbuds" }, "Acme Charging Case"), false);
  assert.equal(holds({ contains: "acme", matches: "Case$", not: true }, "Acme Charging Case"), false);
  assert.equal(holds({ contains: "acme", matches: "Case$", not: true }, "Acme Earbuds"), true);
});

test("a pattern the page could not run is no pattern at all", () => {
  assert.notEqual(webAutomationExtractConditionPattern("ear tips"), undefined);
  assert.notEqual(webAutomationExtractConditionPattern("/ear tips/i"), undefined);
  assert.equal(webAutomationExtractConditionPattern(""), undefined);
  // Unbalanced, so `new RegExp` throws rather than matching nothing.
  assert.equal(webAutomationExtractConditionPattern("(unclosed"), undefined);
  // A flag no expression has.
  assert.equal(webAutomationExtractConditionPattern("/ear tips/z"), undefined);
  // Longer than a condition may carry, which bounds what a bad pattern costs
  // inside the page.
  assert.equal(webAutomationExtractConditionPattern(`${"a".repeat(201)}`), undefined);
  assert.notEqual(webAutomationExtractConditionPattern(`${"a".repeat(200)}`), undefined);
  // An expression that does not compile fails its comparison rather than the
  // read, since the reader refuses it before the page ever sees it.
  assert.equal(holds({ matches: "(unclosed" }, "anything"), false);
});
