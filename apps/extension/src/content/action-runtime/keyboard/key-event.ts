// The key event a real key press delivers, with the legacy identifiers many
// widgets still read.
//
// A synthetic `KeyboardEvent` has `isTrusted: false`, so the browser performs
// no default action for it: everything a trusted key would have done is
// emulated by `press-key.ts`. This module's only job is to deliver an event
// that looks like the real one and to report whether the page cancelled it,
// because a page that calls `preventDefault()` on `keydown` suppresses the
// key's default action, and the emulation has to suppress it too.
//
// `code` and `keyCode` are filled in because widgets written before `key`
// existed still branch on them, and a handler that sees `keyCode: 0` behaves
// differently from one that sees a real key.

import type { WebAutomationKeyModifiers } from "../../types";

/** The physical-key identifiers for the keys an action names by word rather than by character. */
const NAMED_KEYS: Record<string, { code: string; keyCode: number }> = {
  Enter: { code: "Enter", keyCode: 13 },
  Tab: { code: "Tab", keyCode: 9 },
  Escape: { code: "Escape", keyCode: 27 },
  Backspace: { code: "Backspace", keyCode: 8 },
  Delete: { code: "Delete", keyCode: 46 },
  ArrowUp: { code: "ArrowUp", keyCode: 38 },
  ArrowDown: { code: "ArrowDown", keyCode: 40 },
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
  Home: { code: "Home", keyCode: 36 },
  End: { code: "End", keyCode: 35 },
  PageUp: { code: "PageUp", keyCode: 33 },
  PageDown: { code: "PageDown", keyCode: 34 },
  " ": { code: "Space", keyCode: 32 }
};

/**
 * Dispatches one key event and reports whether the page let it through.
 * `false` means a handler called `preventDefault()`.
 */
export function dispatchKeyEvent(
  target: Element,
  type: "keydown" | "keyup",
  key: string,
  modifiers?: WebAutomationKeyModifiers | undefined
): boolean {
  const { code, keyCode } = keyIdentifiers(key);
  return target.dispatchEvent(new KeyboardEvent(type, {
    key,
    code,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    composed: true,
    altKey: modifiers?.alt ?? false,
    ctrlKey: modifiers?.ctrl ?? false,
    metaKey: modifiers?.meta ?? false,
    shiftKey: modifiers?.shift ?? false
  }));
}

/** The `code` and legacy `keyCode` for a key name or a single typed character. */
function keyIdentifiers(key: string): { code: string; keyCode: number } {
  const named = NAMED_KEYS[key];
  if (named) return named;
  if (key.length !== 1) return { code: "", keyCode: 0 };
  const upper = key.toUpperCase();
  if (upper >= "A" && upper <= "Z") return { code: `Key${upper}`, keyCode: upper.charCodeAt(0) };
  if (key >= "0" && key <= "9") return { code: `Digit${key}`, keyCode: key.charCodeAt(0) };
  return { code: "", keyCode: upper.charCodeAt(0) };
}
