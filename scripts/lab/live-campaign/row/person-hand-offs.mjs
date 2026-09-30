/** What the Lab's person may have done at a hand-off (`packages/test-runner/src/person-simulation/hand-off-record.ts`); anything else is dropped. */
const ACTS = new Set(["cleared", "could-not-clear", "declined", "declined-tampered", "no-check-visible", "failed"]);
const STAGES = new Set(["build", "run", "unknown"]);

/**
 * The run's hand-offs, as a row carries them: what the row or task declared,
 * and each time FluxIQ handed a check to the person -- the stage, the check
 * the person found (a fixture's own id), what they did, the answer and how
 * long FluxIQ waited. Ids, closed words and numbers only. `null` for a run
 * the Lab never played the person on.
 */
export function personHandOffSummary(record) {
  if (!record || typeof record !== "object" || !Array.isArray(record.handOffs)) return null;
  const expected = record.expected && typeof record.expected === "object" && (record.expected.person === "completes" || record.expected.person === "declines")
    ? { person: record.expected.person, required: record.expected.required === true }
    : null;
  const handOffs = record.handOffs.filter((entry) => entry && ACTS.has(entry.did)).map((entry) => ({
    stage: STAGES.has(entry.stage) ? entry.stage : "unknown",
    check: typeof entry.check === "string" && /^[a-z0-9-]{1,64}$/u.test(entry.check) ? entry.check : null,
    did: entry.did,
    answer: entry.answer === "person_done" || entry.answer === "person_stop" ? entry.answer : null,
    secondsWaited: typeof entry.secondsWaited === "number" && Number.isFinite(entry.secondsWaited) ? entry.secondsWaited : null,
  }));
  return { expected, count: handOffs.length, cleared: handOffs.filter(({ did }) => did === "cleared").length, handOffs, pollFailures: Number.isSafeInteger(record.pollFailures) ? record.pollFailures : 0 };
}
