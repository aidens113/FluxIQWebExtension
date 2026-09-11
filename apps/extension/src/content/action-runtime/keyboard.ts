// Trusted-input emulation (decision D5): the key and input events a real user's
// typing produces, so widgets that listen for keystrokes react.
//
// `typeText` sends a per-character `keydown`, `beforeinput`, `input`, `keyup`
// sequence, and drives a `contenteditable` host through `InputEvent` rather
// than a value setter. `pressKey` dispatches one key with its modifiers and
// performs the default action the browser would have performed for a trusted
// event, which a synthetic event never triggers: Enter on a form control calls
// `form.requestSubmit()` with the form's default button, and Tab moves focus
// along the tabbable order. Where no honest emulation exists -- arrow keys
// inside a radio group -- the outcome says `unsupported` rather than pretending.
//
// Owned by `w2-keyboard-input`, which replaces this stub.

import type { WebAutomationKeyModifiers } from "../types";

export type KeyPressOutcome = {
  /** Whether the key events were dispatched at all. */
  dispatched: boolean;
  /** The default action performed after the key, which a synthetic event does not trigger by itself. */
  defaultAction: "none" | "submitted" | "focus-moved" | "unsupported";
  /** A short description for the result's validation. */
  detail: string;
};

export type KeyboardCapability = {
  typeText(element: Element, text: string): void;
  pressKey(target: Element, key: string, modifiers?: WebAutomationKeyModifiers | undefined): KeyPressOutcome;
};

export const keyboard: KeyboardCapability = {
  typeText(_element: Element, _text: string): void {
    throw new Error("The keyboard capability is not implemented yet.");
  },
  pressKey(_target: Element, _key: string, _modifiers?: WebAutomationKeyModifiers | undefined): KeyPressOutcome {
    throw new Error("The keyboard capability is not implemented yet.");
  }
};
