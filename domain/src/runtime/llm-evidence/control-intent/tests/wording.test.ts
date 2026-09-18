// What a label tells a person pressing the control will do.
//
// English uses the same words as nouns and as verbs, which is the whole reason
// this is not one word list. "Post" commits and "New post" does not; "Order
// details" opens and "Order now" commits; "Close composer" dismisses and
// "Close ticket" commits. A single list refused all six.

import assert from "node:assert/strict";
import test from "node:test";
import { webControlWording, type WebControlReading, type WebControlWording } from "../wording";

type Row = [label: string, wording: WebControlWording];

const COMMANDS: Row[] = [
  // Words that commit wherever they stand: nobody labels a control "Bulk
  // delete" unless it deletes.
  ["Send", "commits"],
  ["Send reply", "commits"],
  ["Save changes", "commits"],
  ["Bulk delete", "commits"],
  ["Issue a refund", "commits"],
  ["Confirm", "commits"],
  ["Retry failed posts", "commits"],
  ["Dispatch run", "commits"],
  ["Assign to me", "commits"],
  ["Mark as resolved", "commits"],
  ["Log out", "commits"],
  ["Check out", "commits"],

  // Words that commit only as the verb of a command. This is the pair that
  // made an order-management fixture unexplorable and a composer unopenable.
  ["Post", "commits"],
  ["Post now", "commits"],
  ["New post", "opens"],
  ["Post actions", "unstated"],
  ["Order now", "commits"],
  ["Order details", "unstated"],
  ["Schedule post", "commits"],

  // Openers: the press that puts the thing the Flow must fill on the page.
  ["New post", "opens"],
  ["Compose", "opens"],
  ["Reply", "opens"],
  ["Edit", "opens"],
  ["More actions", "opens"],
  ["View order", "opens"],
  ["Show details", "opens"],

  // Row selection, which is what makes the actions for chosen rows appear.
  ["Select order ORD-40100", "selects"],
  ["Select all posts", "selects"],

  // Dismissals, and the record-closing ones that are not dismissals at all.
  ["Close composer", "dismisses"],
  ["Hide the details", "dismisses"],
  ["Close", "dismisses_whatever_is_open"],
  ["Cancel", "dismisses_whatever_is_open"],
  ["Cancel order", "commits"],
  ["Close ticket", "commits"],

  ["", "unstated"],
  ["ORD-40100", "unstated"],
];

for (const [label, expected] of COMMANDS) {
  test(`reads "${label}" as a command that ${expected}`, () => {
    assert.equal(webControlWording({ name: label }, "command"), expected);
  });
}

// A link's words name where it goes, so a noun in first place is expected and
// is not a command. What still refuses it is a word that commits anywhere,
// in the label or in the path.
const DESTINATIONS: Array<[label: string, href: string, wording: WebControlWording]> = [
  ["Order ORD-40100", "https://shop.test/orders/ORD-40100", "unstated"],
  ["Post", "https://social.test/posts/14", "unstated"],
  ["Sam Okafor", "https://social.test/logout", "commits"],
  ["Unsubscribe", "https://mail.test/preferences", "commits"],
  ["Cancel order", "https://shop.test/orders/1/cancel", "commits"],
  // The host is not something the link says it does. Reading it would refuse
  // every link on a site that happens to be served from `send.example.test`.
  ["Queue", "https://send.example.test/queue", "unstated"],
];

for (const [label, href, expected] of DESTINATIONS) {
  test(`reads the link "${label}" as a destination that ${expected}`, () => {
    assert.equal(webControlWording({ name: label, href }, "destination"), expected);
  });
}

test("reads the accessible name first, and falls back to the visible text", () => {
  assert.equal(webControlWording({ name: "New post", text: "Delete" }, "command"), "commits", "a committing word anywhere in either label still commits");
  assert.equal(webControlWording({ text: "New post" }, "command"), "opens");
  assert.equal(webControlWording({ name: "New post" }, "command"), "opens");
});

test("ignores punctuation and case, so a decorated label reads as its words", () => {
  for (const label of ["+ New post…", "NEW POST", "  new   post  "]) {
    assert.equal(webControlWording({ name: label }, "command"), "opens", label);
  }
});

// The only input is the label and, for a link, the path. There is no parameter
// for a selector here and none in `webControlIntent` either: the packet element
// those take carries no selector at all, which is what makes reading one
// impossible rather than merely discouraged.
test("takes nothing but what the page says, for either reading", () => {
  const readings: WebControlReading[] = ["command", "destination"];
  for (const reading of readings) {
    assert.equal(webControlWording({ name: "Row actions" }, reading), "unstated", reading);
  }
});
