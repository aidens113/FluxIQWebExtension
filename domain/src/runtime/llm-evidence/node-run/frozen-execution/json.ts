import type { JsonObject, JsonValue } from "fluxiq/core";

/** Copy private JSON without retaining a producer's mutable command object. */
export function webNodeFrozenJson<T extends JsonObject>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (part: JsonValue): void => {
    if (part === null || typeof part !== "object") return;
    for (const child of Object.values(part)) freeze(child);
    Object.freeze(part);
  };
  freeze(copy);
  return copy;
}
