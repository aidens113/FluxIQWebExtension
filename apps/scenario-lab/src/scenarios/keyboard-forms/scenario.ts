import { defineScenario } from "../../types.js";
import { keyboardFormsManifest } from "./manifest.js";
import { renderKeyboardForms } from "./markup.js";
import { createKeyboardFormsState, mutateKeyboardFormsState, type KeyboardFormsState } from "./state.js";

/** Corpus rows W02 and W03; the evidence fixture for decision D5 (trusted-input emulation). */
export const keyboardFormsScenario = defineScenario<KeyboardFormsState>({
  id: "keyboard-forms",
  title: "Keyboard forms",
  startPath: "/scenarios/keyboard-forms/",
  seed: 123,
  manifest: keyboardFormsManifest,
  createState: () => createKeyboardFormsState(),
  mutate: mutateKeyboardFormsState,
  render: renderKeyboardForms,
});
