import assert from "node:assert/strict";
import test from "node:test";
import type { Locator } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";
import { selectOptionByKeyboard } from "../select-option.js";

type FakeOption = { value: string; label: string; disabled?: boolean };

/** A closed single-choice select that answers keys the way Chromium on Windows and Linux does. */
function fakeSelect(options: FakeOption[], selectedIndex = 0, overrides: { tagName?: string; multiple?: boolean; ignoreKeys?: boolean } = {}) {
  const state = { selectedIndex, keys: [] as string[], focused: false };
  const enabled = (index: number) => !options[index]!.disabled;
  const element = () => ({
    tagName: overrides.tagName ?? "SELECT",
    multiple: overrides.multiple ?? false,
    disabled: false,
    selectedIndex: state.selectedIndex,
    options: options.map((option) => ({ value: option.value, label: option.label, disabled: option.disabled ?? false, parentElement: null })),
  });
  const control = {
    waitFor: async () => undefined,
    focus: async () => { state.focused = true; },
    evaluate: async (callback: (value: unknown) => unknown) => callback(element()),
    press: async (key: string) => {
      state.keys.push(key);
      if (overrides.ignoreKeys) return;
      if (key === "ArrowDown") { for (let index = state.selectedIndex + 1; index < options.length; index += 1) if (enabled(index)) { state.selectedIndex = index; break; } return; }
      if (key === "ArrowUp") { for (let index = state.selectedIndex - 1; index >= 0; index -= 1) if (enabled(index)) { state.selectedIndex = index; break; } return; }
      for (let step = 1; step <= options.length; step += 1) {
        const index = (state.selectedIndex + step) % options.length;
        if (enabled(index) && options[index]!.label.toLowerCase().startsWith(key)) { state.selectedIndex = index; return; }
      }
    },
    inputValue: async () => options[state.selectedIndex]?.value ?? "",
  };
  return { control: control as unknown as Locator, state };
}

const plans = [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }];

test("a label with a unique initial is chosen by one typeahead key on the focused control", async () => {
  const { control, state } = fakeSelect(plans);
  await selectOptionByKeyboard(control, "team");
  assert.equal(state.focused, true);
  assert.deepEqual(state.keys, ["t"]);
  assert.equal(state.selectedIndex, 1);
});

test("a shared initial falls back to arrow keys, one per enabled option passed", async () => {
  const fruit = [{ value: "apple", label: "Apple" }, { value: "apricot", label: "Apricot" }, { value: "banana", label: "Banana" }];
  const down = fakeSelect(fruit, 0);
  await selectOptionByKeyboard(down.control, "apricot");
  assert.deepEqual(down.state.keys, ["ArrowDown"]);
  const up = fakeSelect([...fruit, { value: "avocado", label: "Avocado" }], 3);
  await selectOptionByKeyboard(up.control, "apple");
  assert.deepEqual(up.state.keys, ["ArrowUp", "ArrowUp", "ArrowUp"]);
});

test("disabled options neither block typeahead nor count as arrow steps", async () => {
  const typeahead = fakeSelect([{ value: "alpha", label: "Alpha" }, { value: "beta", label: "Beta", disabled: true }, { value: "bravo", label: "Bravo" }]);
  await selectOptionByKeyboard(typeahead.control, "bravo");
  assert.deepEqual(typeahead.state.keys, ["b"]);
  const arrows = fakeSelect([{ value: "alpha", label: "Alpha" }, { value: "axe", label: "Axe", disabled: true }, { value: "atom", label: "Atom" }]);
  await selectOptionByKeyboard(arrows.control, "atom");
  assert.deepEqual(arrows.state.keys, ["ArrowDown"]);
});

test("an option already selected presses nothing", async () => {
  const { control, state } = fakeSelect(plans, 1);
  await selectOptionByKeyboard(control, "team");
  assert.deepEqual(state.keys, []);
  assert.equal(state.focused, false);
});

test("the value may name an option by its label", async () => {
  const { control, state } = fakeSelect(plans);
  await selectOptionByKeyboard(control, "Enterprise");
  assert.equal(state.selectedIndex, 2);
});

test("fails closed for a missing or disabled option, a non-select, or a multi-select", async () => {
  await assert.rejects(selectOptionByKeyboard(fakeSelect(plans).control, "premium"), /no option matching/);
  await assert.rejects(selectOptionByKeyboard(fakeSelect([...plans, { value: "legacy", label: "Legacy", disabled: true }]).control, "legacy"), /disabled/);
  await assert.rejects(selectOptionByKeyboard(fakeSelect(plans, 0, { tagName: "INPUT" }).control, "team"), /requires a <select>/);
  await assert.rejects(selectOptionByKeyboard(fakeSelect(plans, 0, { multiple: true }).control, "team"), /single-choice/);
});

test("a selection the keys did not reach is reported, not assumed", async () => {
  const { control } = fakeSelect(plans, 0, { ignoreKeys: true });
  await assert.rejects(selectOptionByKeyboard(control, "team"), (error: unknown) => error instanceof RunnerFailure && /did not reach/.test(error.message) && error.details?.actual === "starter");
});
