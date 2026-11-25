/** One line cut to `max` characters with an ellipsis; whitespace is collapsed. */
export function shortenChartText(text: string, max: number): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
