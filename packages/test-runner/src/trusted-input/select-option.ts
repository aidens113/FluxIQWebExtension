import type { Locator } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

export type SelectOptionByKeyboardOptions = { timeoutMs?: number };

type SelectOptionState = { value: string; label: string; disabled: boolean };
type SelectState = { isSelect: boolean; multiple: boolean; disabled: boolean; selectedIndex: number; options: SelectOptionState[] };
type PageSelect = {
  tagName: string;
  multiple: boolean;
  disabled: boolean;
  selectedIndex: number;
  options: ArrayLike<{ value: string; label: string; disabled: boolean; parentElement: { tagName: string; disabled?: boolean } | null }>;
};

/**
 * Chooses a `<select>` option with the keyboard on the focused control, so the
 * browser itself dispatches trusted `input` and `change` events. The recorder
 * ignores untrusted ones, and Playwright's `selectOption` dispatches untrusted
 * ones. A target whose label starts with a letter or digit that no other
 * enabled option starts with is reached by one typeahead key, firing one
 * change; otherwise arrow keys step to it, one change per step. Arrow keys
 * change a closed select on Windows and Linux (macOS opens it instead). The
 * selected value is verified afterwards.
 */
export async function selectOptionByKeyboard(control: Locator, value: string, options: SelectOptionByKeyboardOptions = {}): Promise<void> {
  const timeout = options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs };
  await control.waitFor({ state: "visible", ...timeout });
  const state = await readSelectState(control, timeout);
  const targetIndex = optionIndex(state, value);
  const target = state.options[targetIndex]!;
  if (state.selectedIndex !== targetIndex) {
    await control.focus(timeout);
    const key = typeaheadKey(state, targetIndex);
    if (key) await control.press(key, timeout);
    else {
      const { key: arrow, presses } = arrowSteps(state, targetIndex);
      for (let press = 0; press < presses; press += 1) await control.press(arrow, timeout);
    }
  }
  const selected = await control.inputValue(timeout);
  if (selected !== target.value) {
    throw new RunnerFailure("runtime.behavior", "Keyboard selection did not reach the requested option", { details: { expected: target.value, actual: selected } });
  }
}

async function readSelectState(control: Locator, timeout: { timeout?: number }): Promise<SelectState> {
  const state = await control.evaluate((element) => {
    const select = element as unknown as PageSelect;
    if (select.tagName !== "SELECT") return { isSelect: false, multiple: false, disabled: false, selectedIndex: -1, options: [] };
    return {
      isSelect: true,
      multiple: select.multiple,
      disabled: select.disabled,
      selectedIndex: select.selectedIndex,
      options: Array.from(select.options, (option) => ({
        value: option.value,
        label: option.label.trim(),
        disabled: option.disabled || (option.parentElement?.tagName === "OPTGROUP" && option.parentElement.disabled === true),
      })),
    };
  }, undefined, timeout);
  if (!state.isSelect) throw new RunnerFailure("runtime.behavior", "Keyboard selection requires a <select> control");
  if (state.multiple) throw new RunnerFailure("runtime.behavior", "Keyboard selection supports single-choice <select> controls only");
  if (state.disabled) throw new RunnerFailure("runtime.behavior", "Keyboard selection target is disabled");
  return state;
}

function optionIndex(state: SelectState, value: string): number {
  let index = state.options.findIndex((option) => option.value === value);
  if (index < 0) index = state.options.findIndex((option) => option.label === value.trim());
  if (index < 0) throw new RunnerFailure("runtime.behavior", "Select control has no option matching the requested value", { details: { value } });
  if (state.options[index]!.disabled) throw new RunnerFailure("runtime.behavior", "Requested select option is disabled", { details: { value } });
  return index;
}

function typeaheadKey(state: SelectState, targetIndex: number): string | undefined {
  const initial = state.options[targetIndex]!.label.charAt(0).toLowerCase();
  if (!/^[a-z0-9]$/u.test(initial)) return undefined;
  const shared = state.options.some((option, index) => index !== targetIndex && !option.disabled && option.label.charAt(0).toLowerCase() === initial);
  return shared ? undefined : initial;
}

function arrowSteps(state: SelectState, targetIndex: number): { key: "ArrowDown" | "ArrowUp"; presses: number } {
  const enabled = (from: number, to: number) => state.options.slice(from, to).filter((option) => !option.disabled).length;
  if (targetIndex > state.selectedIndex) return { key: "ArrowDown", presses: enabled(state.selectedIndex + 1, targetIndex + 1) };
  return { key: "ArrowUp", presses: enabled(targetIndex, state.selectedIndex) };
}
