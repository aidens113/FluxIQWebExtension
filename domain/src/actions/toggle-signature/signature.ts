// What a toggle press changed about its own control, in terms that hold on any
// row of the same kind of control (t775). Core stores it whole and never reads
// inside it; only this domain and the extension's click verb do.

/** The states a control can state for itself, as the attribute (or native property) that carries them. */
export type WebToggleAttribute = "aria-pressed" | "aria-checked" | "aria-selected" | "checked";

/**
 * Either the stated state the press flipped (`to` is the state it left the
 * control in), or the words its accessible name gained and lost -- lowercased,
 * so a row's own words (a job title) cancel out.
 */
export type WebToggleSignature =
  | { via: "attribute"; attribute: WebToggleAttribute; to: boolean }
  | { via: "name"; gains: string[]; loses: string[] };
