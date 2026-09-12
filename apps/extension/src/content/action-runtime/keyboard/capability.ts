// The keyboard capability as the verbs receive it (decision D5): trusted-input
// emulation, assembled from the pieces in this directory.
//
// `execute-action.ts` grants this object to `actions/`, so `type`, `clear` and
// `keypress` reach the keyboard only through these two calls and never touch
// the DOM themselves.

import type { WebAutomationKeyModifiers } from "../../types";
import { pressKey, type KeyPressOutcome } from "./press-key";
import { typeText } from "./type-text";

export type KeyboardCapability = {
  typeText(element: Element, text: string): void;
  pressKey(target: Element, key: string, modifiers?: WebAutomationKeyModifiers | undefined): KeyPressOutcome;
};

export const keyboard: KeyboardCapability = { typeText, pressKey };
