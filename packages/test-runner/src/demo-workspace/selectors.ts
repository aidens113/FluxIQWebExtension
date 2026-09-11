// Turning arbitrary text into a safe selector or pattern fragment.
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function escapeCssAttribute(value: string): string {
  return value.replace(/["\\]/gu, character => `\\${character}`);
}

export function stableHierarchyNodeId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}
