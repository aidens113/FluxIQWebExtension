// The class tokens of a `class` attribute, each once.

export function webToggleClassTokens(value: string | null | undefined): string[] {
  return [...new Set((value ?? "").split(/\s+/u).filter((token) => token !== ""))];
}
