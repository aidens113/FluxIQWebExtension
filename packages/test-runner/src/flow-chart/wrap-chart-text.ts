import { shortenChartText } from "./shorten-chart-text.js";

/** Words wrapped to lines of at most `width` characters; text past `maxLines` ends in an ellipsis on the last line. */
export function wrapChartText(text: string, width: number, maxLines = 6): string[] {
  const lines: string[] = [];
  let line = "";
  for (const raw of text.replace(/\s+/gu, " ").trim().split(" ")) {
    const word = raw.length > width ? `${raw.slice(0, width - 1)}…` : raw;
    if (line === "") line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = shortenChartText(`${kept[maxLines - 1]} …`, width);
  return kept;
}
