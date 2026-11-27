import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, scriptedTaskProcess } from "../index.js";

const hubs = {
  where: [{ field: "price", atMost: 10 }, { field: "shipping", equals: "Free shipping" }, { field: "ad", is: "absent" }],
  sort: [{ field: "price", order: "asc", as: "number" }], columns: ["title", "store", "price", "rating"],
};
const cases = [
  { task: "company-website-apprentices", forms: [undefined], process: { where: [{ field: "role", contains: "apprentice" }], columns: ["name", "role", "branch"] } },
  { task: "company-website-saturday-certificate", forms: ["plain"], process: {
    where: [{ field: "group heading", contains: "Sat" }, { field: "disabled", is: "absent" }],
    sort: [{ field: "date", order: "asc", as: "date" }, { field: "time", order: "asc", as: "text" }], columns: ["date", "time"],
  } },
  { task: "bigbox-retail-rated-delivery-towels", forms: [undefined], process: {
    where: [{ field: "name", contains: "paper towel" }, { field: "name", contains: ["holder", "dispenser"], not: true }, { field: "rating", atLeast: 4.5 }, { field: "ad", is: "absent" }, { field: "fulfillment", contains: "Delivery" }],
    sort: [{ field: "rating", order: "desc", as: "number" }], columns: ["name", "price", "rating"],
  } },
  { task: "crossborder-marketplace-free-hubs-under-ten", forms: ["plain", "left-out", "timed-check"], process: hubs },
  { task: "crossborder-marketplace-free-hubs-under-ten-timed-check", forms: ["plain", "left-out", "timed-check"], process: hubs },
  { task: "everything-store-batteries-and-descaler", forms: [undefined], process: { columns: ["item", "quantity", "price"] } },
  { task: "professional-network-accept-messaged-invitations", forms: ["plain", "reshape", "thin", "notes-back"], process: { where: [{ field: "message", is: "present" }], columns: ["name", "message"] } },
  { task: "local-classifieds-save-dining-tables", forms: ["plain", "reshape", "row-link", "open-save-back", "by-hand", "by-hand-unread", "again-check", "again-press", "run-again"], process: { sort: [{ field: "price", order: "asc", as: "number" }], columns: ["title", "price", "status"] } },
];

for (const fixture of cases) {
  test(`${fixture.task} declares its written data criteria in every fresh interpretation`, () => {
    const message = "The original instruction is passed through unchanged";
    for (const form of fixture.forms) {
      const script = scriptedModelScriptFor(fixture.task, form);
      const replies = script.replies.panel_command;
      assert.ok(replies && replies.length > 0);
      for (const [index, reply] of replies.entries()) {
        assert.deepEqual(reply({ kind: "panel_command", ordinal: index + 1, model: "fixture", jsonText: false, message, payload: undefined }), {
          do: "flow.createHere", with: { instruction: message }, process: fixture.process,
        });
      }
    }
  });
}

test("processing declarations cannot become a default or be changed by an earlier reply", () => {
  assert.throws(() => scriptedTaskProcess("unsupported-task"), /No processing fixture/u);
  assert.throws(() => scriptedTaskProcess("social-network-feed-delete-stranger-requests"), /No processing fixture/u);
  const first = scriptedTaskProcess("crossborder-marketplace-free-hubs-under-ten");
  first.columns = [];
  assert.deepEqual(scriptedTaskProcess("crossborder-marketplace-free-hubs-under-ten-timed-check"), hubs);
  assert.deepEqual(scriptedTaskProcess("crossborder-marketplace-free-hubs-under-ten"), hubs);
});

test("the Kestrel auctions declaration names the site's columns and its pound ceiling", () => {
  const process = scriptedTaskProcess("auction-marketplace-kestrel-auctions") as { columns: string[]; anyOf: unknown[][]; sort: unknown[] };
  assert.deepEqual(process.columns, ["link_text", "price", "text_5", "text_9"]);
  assert.equal(process.anyOf.length, 2);
  assert.deepEqual(process.sort, [{ field: "ends", order: "asc", as: "date" }]);
});
