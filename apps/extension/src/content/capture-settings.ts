// What the recorder is allowed to capture. The background worker replaces
// these with every `recording` message, and both the recorder and the element
// description path read them, so they sit in a leaf module that imports
// nothing.
//
// These are the user's capture preferences, not a security boundary. A
// sensitive control's value is withheld unconditionally, by `readElementValue`
// in `describe-element.ts` and `recordableKey` in `dom-events.ts`, whatever
// these say: turning `inputValues` on cannot re-enable it, and turning it off
// is not what protects it.

/**
 * The defaults, which hold until the first `recording` message arrives and
 * whenever a `recording` message omits a field (`message-handler.ts` keeps the
 * current value rather than resetting it).
 *
 * - `mutations` (default **on**) -- DOM mutation counts, batched.
 * - `inputValues` (default **on**) -- the *values* of non-sensitive controls, on
 *   `dom.input`, `dom.change` and every element descriptor. On by default
 *   because a recording without them cannot be replayed: a `web.dom.type` step
 *   is generated from the recorded value, and with the setting off it replays
 *   as an empty string. Turn it off to record only *that* a field changed;
 *   presence still travels as the descriptor's `hasValue`, which is not a value
 *   and is never withheld.
 * - `snapshots` (default **on**) -- a ranked state snapshot attached to
 *   recorded events and action results.
 */
export const captureSettings = {
  mutations: true,
  inputValues: true,
  snapshots: true
};
