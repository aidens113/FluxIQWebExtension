// A hand tier-1 correction, written as the builder would write it: the same
// script with one labelled step's Core-side record processing
// (`recordOutput.process`) replaced, and not one other byte changed. Core's
// compiler then reads the corrected script as it reads any submission
// (`./rebuild-candidate.ts`), so the corrected candidate and its digest are
// Core's, never assembled here.
//
// The step is found by its label (`step <label>: ...`); its parameter lines
// are the lines indented under it. An existing `recordOutput.process:` line is
// replaced; otherwise one is added after the step's last `recordOutput.` line,
// or at the end of its lines, at their indentation. `null` removes the line.

export function withRecordProcessing(script: string, stepLabel: string, process: Record<string, unknown> | null): string {
  const lines = script.split("\n");
  const heading = new RegExp(`^(\\s*)step ${escaped(stepLabel)}:`);
  const at = lines.findIndex((line) => heading.test(line));
  if (at < 0) throw new Error(`The script has no step labelled ${stepLabel}`);
  const own = indentation(lines[at]!);
  let end = at + 1;
  while (end < lines.length && lines[end]!.trim() !== "" && indentation(lines[end]!) > own) end += 1;
  const body = lines.slice(at + 1, end);
  const inner = body.length ? " ".repeat(indentation(body[0]!)) : `${" ".repeat(own)}  `;
  const written = process === null ? [] : [`${inner}recordOutput.process: ${JSON.stringify(process)}`];
  const existing = body.findIndex((line) => line.trimStart().startsWith("recordOutput.process:"));
  if (existing >= 0) lines.splice(at + 1 + existing, 1, ...written);
  else {
    const lastOutput = body.map((line, index) => line.trimStart().startsWith("recordOutput.") ? index : -1).reduce((last, index) => Math.max(last, index), -1);
    lines.splice(lastOutput >= 0 ? at + 2 + lastOutput : end, 0, ...written);
  }
  return lines.join("\n");
}

function indentation(line: string): number {
  return line.length - line.trimStart().length;
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
