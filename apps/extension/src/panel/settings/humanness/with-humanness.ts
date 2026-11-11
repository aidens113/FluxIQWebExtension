import { normaliseHumanness } from "./normalise-humanness";
import type { HumannessSettings } from "./settings";

/** The settings carrying `value`, clamped and rounded, ready for `panelSaveSettings`. */
export function withHumanness<S extends HumannessSettings>(settings: S, value: unknown): S & { humanness: number } {
  return { ...settings, humanness: normaliseHumanness(value) };
}
