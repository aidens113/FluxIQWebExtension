// Which screen fills the panel: the tabs, the gear, and the getting-started
// steps that replace the chat until the browser is connected.

import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_SHELL, reduceShell, shellScreen, type ShellState } from "../screen-state";

test("the panel opens on the chat, with settings closed", () => {
  assert.deepEqual(INITIAL_SHELL, { tab: "chat", settings: false });
  assert.equal(shellScreen(INITIAL_SHELL, false), "chat");
});

test("picking a tab shows it; picking the one already shown changes nothing", () => {
  const automations = reduceShell(INITIAL_SHELL, { type: "tab", tab: "automations" });
  assert.deepEqual(automations, { tab: "automations", settings: false });
  assert.equal(shellScreen(automations, false), "automations");
  assert.equal(reduceShell(automations, { type: "tab", tab: "automations" }), automations);
});

test("the gear opens settings in place of the tab, and pressing it again goes back", () => {
  const onAutomations: ShellState = { tab: "automations", settings: false };
  const open = reduceShell(onAutomations, { type: "gear" });
  assert.equal(shellScreen(open, false), "settings");
  const closed = reduceShell(open, { type: "gear" });
  assert.equal(shellScreen(closed, false), "automations", "back to where the person was");
});

test("closing settings, or picking a tab, leaves settings", () => {
  const open = reduceShell(INITIAL_SHELL, { type: "gear" });
  assert.equal(shellScreen(reduceShell(open, { type: "closeSettings" }), false), "chat");
  assert.equal(shellScreen(reduceShell(open, { type: "tab", tab: "automations" }), false), "automations");
  assert.equal(shellScreen(reduceShell(open, { type: "tab", tab: "chat" }), false), "chat", "the tab already chosen still closes settings");
  assert.equal(reduceShell(INITIAL_SHELL, { type: "closeSettings" }), INITIAL_SHELL);
});

test("while not connected the getting-started steps replace both tabs, but settings still open over them", () => {
  assert.equal(shellScreen(INITIAL_SHELL, true), "getting-started");
  assert.equal(shellScreen({ tab: "automations", settings: false }, true), "getting-started");
  assert.equal(shellScreen(reduceShell(INITIAL_SHELL, { type: "gear" }), true), "settings", "the connection address is in settings");
});
