// What a toggle press changed about its own control, in terms that hold on any
// row of the same kind of control (t775). Core stores it whole and reads only
// its `gains` and `loses` words, to tie a step that names the control in its
// other state (t792, `toggle-state-words.ts`); everything else in it is read by
// this domain and the extension's click verb alone.

/** The states a control can state for itself, as the attribute (or native property) that carries them. */
export type WebToggleAttribute = "aria-pressed" | "aria-checked" | "aria-selected" | "checked";

/**
 * Either the stated state the press flipped (`to` is the state it left the
 * control in), or the words its accessible name gained and lost -- lowercased,
 * so a row's own words (a job title) cancel out. A control that shows its
 * state by neither is told by the class tokens its element, or a wrapper
 * within the control, gained and lost.
 */
export type WebToggleSignature =
  | { via: "attribute"; attribute: WebToggleAttribute; to: boolean }
  | { via: "name"; gains: string[]; loses: string[] }
  | { via: "class"; gains: string[]; loses: string[] };
