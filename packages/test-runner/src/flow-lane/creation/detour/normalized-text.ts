/** Words compared the way a person reads them: case and runs of whitespace do not matter. Empty after trimming is `undefined`. */
export function normalizedText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const words = value.trim().replace(/\s+/g, " ").toLowerCase();
  return words === "" ? undefined : words;
}
