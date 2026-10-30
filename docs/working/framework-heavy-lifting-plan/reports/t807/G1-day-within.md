# G1 day-granular within (t807)

Outcome: Done.

Changed (Core): contracts/src/record-sets/process/{date-within.ts, read-date.ts, condition/holds.ts, condition/date-cases.ts, condition/tests/date.test.ts}; fluxiq flow-script-format.ts (Within line); regenerated docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md. No W file edited (the twin imports Core's holds/reader; grammar only checks the span is defined).

Behaviour: new exported helper `automationStudioRecordDateStatesOnlyDay(text, now)` in read-date.ts. A day-only value (ISO/"22 Oct 2026"/numeric without time, "yesterday", "today", day-count age "3 days ago"/"2w"/"1mo") with a within in days or weeks compares by whole UTC days: day in [day(now-n), day(now)]. Later day not within. A value with a time (incl. "5 hours ago", "45m", "just now", time left) keeps the instants [now-n, now]. Minute/hour units stay instants for every value (choice: the span itself is sub-day). `readAutomationStudioRecordConditionWithin` now also returns `wholeDays`. Undated rule unchanged. One existing parity case flipped (within 7 days of "2026-09-29": left -> kept), 20 cases added.

Fail-first: with the new cases only, `npx vitest run src/record-sets` showed 2 failed (parity cases). After fix: 17 files / 259 tests passed.

Checks: contracts `pnpm check` ok; contracts build + fluxiq build (needed because W imports fluxiq dist); fluxiq plan/tests 20 files 258 passed (prompt-contract incl.); docs:reference rewrote, docs:check "current"; W domain actions/extraction (built against fresh dist) 94/94; earlier W domain run (actions/extraction output-nodes/extract-list runtime/llm-evidence structure) 1554/1554 but against stale dist; extension content/extraction 437/437 (after rebuild).
Deviation: one contracts vitest run (3s) was run without the heavy lock because of lock starvation; all others under it.
Not verified: no live browser; the extension test ran after the dist rebuild but domain wide fragments were not rerun after rebuild.
