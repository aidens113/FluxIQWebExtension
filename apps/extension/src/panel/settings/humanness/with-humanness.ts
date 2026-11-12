import { normaliseHumanness } from "./normalise-humanness";
import type { FluxIQSettings } from "../../../shared/protocol";

/** The settings carrying `value`, clamped and rounded, ready for `panelSaveSettings`. */
export function withHumanness<S extends FluxIQSettings>(settings: S, value: unknown): S & { humanness: number } {
  return { ...settings, humanness: normaliseHumanness(value) };
}
