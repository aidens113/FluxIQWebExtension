/** A payload field as a trimmed string, or "" when the page sent something else. */
export function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

/** A payload field as a whole number from 1 to 12, the most a line may hold, or undefined. */
export function quantity(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12 ? value : undefined;
}
