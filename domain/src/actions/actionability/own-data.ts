/** Classify an optional carrier property without running code supplied by it. */
export function webOwnDataProperty(source: unknown, key: string):
  | { kind: "data"; value: unknown }
  | { kind: "absent" | "accessor" | "unreadable" } {
  if (source === null || typeof source !== "object") return { kind: "absent" };
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(source, key);
  } catch {
    return { kind: "unreadable" };
  }
  if (descriptor === undefined) return { kind: "absent" };
  return "value" in descriptor ? { kind: "data", value: descriptor.value } : { kind: "accessor" };
}
