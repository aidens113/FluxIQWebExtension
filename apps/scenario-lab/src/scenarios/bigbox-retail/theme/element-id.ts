import { buildClassNames } from "../../../build-classes.js";

/**
 * A generated element id, the kind a component library mints for a label to
 * point at: stable for one seed, different under the next, and meaningless.
 */
export function elementId(seed: number, name: string): string {
  const [generated] = Object.values(buildClassNames(`ids~${seed}`, [name]));
  return `vr${(generated ?? "").slice("css-".length)}`;
}
