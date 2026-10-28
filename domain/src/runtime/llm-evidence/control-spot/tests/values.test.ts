// Every shown value of a read by its own place (t772 value witness): a value a
// person sees on the page -- words, a field's value, a chosen option -- named by
// where it sits, so a value a press replaced can be seen set back. Controls are
// read by their state (`../states.ts`), and a dialog or a layer in front of the
// page is an interruption, not the page's state. The site is a choir's
// rehearsal planner.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webResetResource, webValueStates } from "..";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../sanitize";

const PLANNER = "https://choir.test/planner";

function page(elements: JsonObject[], url = PLANNER, source: string | null = "tab:1:frame:0"): WebLlmSnapshotBinding {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url, title: "Planner", interactiveElements: elements });
  if (source) binding.resetResource = webResetResource("session", source)!;
  return binding;
}

const planner = (room: string, notes = "Bring folders"): JsonObject[] => [
  { tagName: "main", selector: "main" },
  { tagName: "p", selector: "#room", visibleText: room, parent: 0 },
  { tagName: "input", selector: "#notes", accessibleName: "Notes", value: notes, parent: 0 },
  { tagName: "select", selector: "#section", accessibleName: "Section", selectedValue: "tenor", options: [{ value: "tenor", label: "Tenor" }, { value: "bass", label: "Bass" }], parent: 0 },
  { tagName: "button", selector: "#save", implicitRole: "button", visibleText: "Save", parent: 0 },
  { tagName: "input", selector: "#remind", implicitRole: "checkbox", inputType: "checkbox", accessibleName: "Remind me", checked: true, parent: 0 },
  { tagName: "p", selector: "#ledger", visibleText: "Ledger", hidden: true, parent: 0 },
  { tagName: "div", selector: "#banner", visibleText: "Pinned notice", frontLayer: true },
  { tagName: "p", selector: "#dialog-text", visibleText: "In a dialog", context: { dialog: "Help" } }
];

test("words, a field's value and a chosen option each have a place; controls, hidden elements, dialogs and layers do not", () => {
  const values = webValueStates(page(planner("Room A")));
  assert.equal(Object.keys(values).length, 3, "the room's words, the notes field and the section select");
  for (const [place, value] of Object.entries(values)) {
    assert.match(place, /^p:[0-9a-f]{32}$/u);
    assert.match(value, /^p:[0-9a-f]{32}$/u);
  }
  assert.doesNotMatch(JSON.stringify(values), /Room|folders|tenor|Save|Remind|Ledger|Pinned|dialog/u);
});

test("a place keeps its name while its value changes, and another address or tab names other places", () => {
  const was = webValueStates(page(planner("Room A")));
  const now = webValueStates(page(planner("Room B", "Bring pencils")));
  assert.deepEqual(Object.keys(now), Object.keys(was), "same page, same places");
  const changed = Object.keys(was).filter((place) => was[place] !== now[place]);
  assert.equal(changed.length, 2, "the room and the notes field changed; the section did not");
  const elsewhere = webValueStates(page(planner("Room A"), "https://choir.test/planner/basses"));
  assert.equal(Object.keys(elsewhere).filter((place) => place in was).length, 0);
  const otherTab = webValueStates(page(planner("Room A"), PLANNER, "tab:2:frame:0"));
  assert.equal(Object.keys(otherTab).filter((place) => place in was).length, 0);
});

test("a page with no trusted source has no value places", () => {
  assert.deepEqual(webValueStates(page(planner("Room A"), PLANNER, null)), {});
});
