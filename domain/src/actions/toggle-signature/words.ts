// The words of an accessible name: lowercased, split on anything that is not a
// letter or a digit, each once.

export function webToggleWords(name: string): string[] {
  return [...new Set(name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word !== ""))];
}
