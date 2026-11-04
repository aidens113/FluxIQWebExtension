// How each question Core asks is worded in the extension, and above all which ones
// may ever ask for a PIN: only a `panel-command.` confirmation naming a gated class,
// and never while a task is working.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES, AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES } from "fluxiq/automation/action-permissions";
import { presentAsk, type AskPresentContext } from "../present-ask";
import { askTakesPin } from "../takes-pin";

const idle: AskPresentContext = { surface: () => "sidepanel", working: () => false, pinDialog: true };
const working: AskPresentContext = { ...idle, working: () => true };
const CLASSES = ["move_money", "delete", "send_or_publish", "modify_existing", "create_new"];

function permission(missing: readonly string[], askId = "request.1") {
  return {
    askId, kind: "permission", status: "pending", parks: true, missing, consequences: missing,
    control: { name: "Place bid", kind: "button" },
    permissionRequest: { action: { kind: "exploration", verb: "press" }, control: { name: "Place bid", kind: "button" }, missing }
  };
}
function panelCommand(consequences: readonly string[]) {
  return { askId: "panel-command.7", kind: "confirm", status: "pending", parks: false, consequences, missing: null, control: { name: "Delete the automation", kind: "panel action" } };
}
const personCheck = {
  askId: "person-needed.1", kind: "choice", status: "pending", parks: true, consequences: [],
  options: [{ id: "person_done", label: "Continue", route: null }, { id: "person_stop", label: "Stop", route: "failed" }],
  control: { name: "robot check", kind: "person_check" }
};

test("a permission ask names the act and what would change, and offers Allow and Don't allow", () => {
  const shown = presentAsk(permission(["move_money"]), idle)!;
  assert.equal(shown.title, 'Allow FluxIQ to press "Place bid"?');
  assert.equal(shown.description, "This would:");
  assert.deepEqual(shown.consequences, [AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES.move_money]);
  assert.deepEqual(shown.actions.map((action) => [action.label, action.kind, action.tone]), [["Allow", "grant", "primary"], ["Don't allow", "deny", "secondary"]]);
  assert.equal(shown.takesText, false);
});

test("a permission ask with no name for the control still asks, without making one up", () => {
  const shown = presentAsk({ ...permission(["delete"]), control: { name: null, kind: null }, permissionRequest: null }, idle)!;
  assert.equal(shown.title, "Allow FluxIQ to do this?");
});

test("no permission ask of any class ever asks for a PIN, working or not", () => {
  for (const context of [idle, working]) {
    for (const consequence of CLASSES) {
      const shown = presentAsk(permission([consequence]), context)!;
      assert.ok(shown.actions.every((action) => action.reauthorize === undefined), `${consequence} asked for a PIN`);
    }
    // Not even one whose id looks like a panel command's: it is the kind, a confirmation, that takes one.
    const lookalike = presentAsk(permission(["delete"], "panel-command.2"), context)!;
    assert.ok(lookalike.actions.every((action) => action.reauthorize === undefined));
  }
});

test("a question a task waits on takes no PIN, whatever class it names", () => {
  const confirm = presentAsk({ askId: "ask.1", kind: "confirm", status: "pending", parks: true, consequences: ["delete"] }, idle)!;
  assert.ok(confirm.actions.every((action) => action.reauthorize === undefined));
  assert.deepEqual(confirm.actions.map((action) => action.label), ["Yes", "No"], "the Lab presses these names");
  const choice = presentAsk({ askId: "ask.2", kind: "choice", status: "pending", parks: true, consequences: ["move_money"], options: [{ id: "a", label: "The red one" }] }, idle)!;
  assert.ok(choice.actions.every((action) => action.reauthorize === undefined));
});

test("only a panel command naming a gated class asks for a PIN, and says what confirming will do", () => {
  for (const consequence of AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES) {
    const shown = presentAsk(panelCommand([consequence]), idle)!;
    const confirm = shown.actions.find((action) => action.kind === "grant")!;
    assert.equal(confirm.label, "Confirm");
    assert.match(confirm.reauthorize!.description, new RegExp(AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES[consequence]));
    assert.equal(shown.actions.find((action) => action.kind === "deny")?.reauthorize, undefined, "a refusal is safe");
  }
  assert.equal(askTakesPin({ askId: "panel-command.7", commits: ["modify_existing"] }), false);
  assert.equal(askTakesPin({ askId: "ask.7", commits: ["delete"] }), false);
});

test("no PIN while a task is working: only Cancel stays, and the question says when it can be answered", () => {
  const shown = presentAsk(panelCommand(["delete"]), working)!;
  assert.deepEqual(shown.actions.map((action) => action.label), ["Cancel"]);
  assert.ok(shown.actions.every((action) => action.reauthorize === undefined));
  assert.equal(shown.note, "You can confirm this once the task has ended.");
});

test("with no PIN dialog the question says plainly that this panel cannot take it", () => {
  const shown = presentAsk(panelCommand(["delete"]), { ...idle, pinDialog: false })!;
  assert.equal(shown.note, "This panel can't take your PIN.");
  assert.ok(shown.actions.find((action) => action.kind === "grant")?.reauthorize, "the chat swaps an action it cannot take for the Open FluxIQ control");
});

test("a person-only check: Continue is primary, Stop keeps the name the Lab presses and says what it does", () => {
  const shown = presentAsk(personCheck, idle)!;
  assert.equal(shown.title, "", "the turn's own sentence is the question");
  assert.equal(shown.description, "");
  assert.deepEqual(shown.actions.map((action) => [action.label, action.kind, action.value, action.tone, action.description]), [
    ["Continue", "choice", "person_done", "primary", undefined],
    ["Stop", "choice", "person_stop", "secondary", "Stop the task"]
  ]);
});

test("on the popup a person-only check says the window closes before the person clicks", () => {
  const shown = presentAsk(personCheck, { ...idle, surface: () => "popup" })!;
  assert.equal(shown.description, "This window closes when you click the page. Press the FluxIQ button to come back and press Continue.");
  assert.equal(presentAsk(permission(["delete"]), { ...idle, surface: () => "popup" })!.description, "This would:", "only a check sends them to the page");
});

test("an open question takes text with Core's limit; a choice shows its options", () => {
  const open = presentAsk({ askId: "ask.3", kind: "open", status: "pending", parks: true }, idle)!;
  assert.equal(open.takesText, true);
  assert.equal(open.textMax, 8_000);
  assert.deepEqual(open.actions, []);
  const choice = presentAsk({ askId: "ask.4", kind: "choice", status: "pending", parks: true, options: [{ id: "csv", label: "CSV", description: "A spreadsheet" }] }, idle)!;
  assert.deepEqual(choice.actions, [{ id: "csv", label: "CSV", tone: "secondary", kind: "choice", value: "csv", description: "A spreadsheet" }]);
});

test("what it cannot read goes back to the chat's own words", () => {
  assert.equal(presentAsk(null, idle), null);
  assert.equal(presentAsk({ askId: "ask.5" }, idle), null);
  assert.equal(presentAsk({ askId: "ask.6", kind: "signature" }, idle), null);
  assert.equal(presentAsk({ askId: "ask.7", kind: "choice", options: [] }, idle), null, "the chat says to answer it in FluxIQ");
});

test("no word a person reads names a machine thing", () => {
  const all = [permission(["move_money"]), panelCommand(["delete"]), personCheck].flatMap((ask) => [idle, working, { ...idle, pinDialog: false }, { ...idle, surface: () => "popup" }].map((context) => JSON.stringify(presentAsk(ask, context))));
  for (const said of all) assert.doesNotMatch(said.replace(/"(?:id|kind|value|tone)":"[^"]*"/gu, ""), /\b(?:Flow|build|promoted|candidate|trial|judge|Core)\b/u);
});
