// Where two parameter objects differ, as dotted paths: how a rebuild says
// which written step no recorded resolution answers, and how far it is from the
// nearest one. Values are compared by `canonical`, never printed.

/** The dotted paths at which two parameter objects differ, down to the first level that is not an object on both sides. */
export function differingPaths(left: unknown, right: unknown, canonical: (value: unknown) => string, at = ""): string[] {
  if (isObject(left) && isObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return keys.flatMap((key) => differingPaths(left[key], right[key], canonical, at ? `${at}.${key}` : key));
  }
  const same = left === undefined || right === undefined ? left === right : canonical(left) === canonical(right);
  return same ? [] : [at];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
