/** Exact recorded value comparison, including the historical capture-prefix form. */
export function webRecordedRecordValueMatches(found: string | undefined, recorded: string | undefined, kind: "key" | "text"): boolean {
  if (found === undefined || recorded === undefined) return false;
  if (found === recorded) return true;
  const legacyCut = kind === "key" ? 120 : 160;
  return recorded.length === legacyCut && found.length > legacyCut && found.slice(0, legacyCut) === recorded;
}
