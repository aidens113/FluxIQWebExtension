// The key a drawing (`./drawing.ts`) is handed to Core's element matcher under.
//
// Core's matcher has no picture signal, and its `attributes` signal compares
// each recorded key with the candidate's value for it (`fluxiq/automation-
// studio/fingerprinting`). The page hands Core no other attribute -- neither
// `candidates.ts` nor `score.ts` puts a page attribute there -- so under this
// key the `attributes` signal is the drawing and nothing else, at the weight
// `score.ts` gives it. The name cannot be a real attribute's: an HTML or SVG
// attribute name holds no colon outside a namespace prefix, and none is
// `fluxiq`.

/** The `attributes` key both sides of the comparison put a drawing under. */
export const DRAWING_ATTRIBUTE = "fluxiq:drawing";
