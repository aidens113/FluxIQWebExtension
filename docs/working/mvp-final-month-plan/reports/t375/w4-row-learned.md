# t375-w4-row-learned: kept re-author counts as learned (item 24)

## Outcome

Done.

## What changed and why

- `apps/extension/src/panel/automations/facts.ts`: `runFacts` now counts applied ids as before (into `applied`), then sets `learned = 1` when `durableBehaviorChanged === true` and `applied` is 0 or undefined; otherwise `learned = applied`. A kept re-author is a Flow Bootstrap adaptation that no run adaptation id names, so Core's durable flag is the only thing that reports it. An applied id is never counted twice (durable true with 1 applied id stays 1; 2 applied stays 2). `durableBehaviorChanged === false` with no statuses stays 0; unapplied ids with no durable flag stay 0. `futureRunsUpdated`, `changesTried` and `validated` are unchanged. Header comment extended to say this.
- `summary-copy.ts`: not changed. Checked by test: a kept re-author's facts (`learned: 1`, `changesTried: 0`, `futureRunsUpdated: true`) read "Learned 1 new page variation" then "Future runs updated"; a tried-but-rejected change (`learned: 0`, `changesTried: 1`, `validated: false`, `futureRunsUpdated: false`) reads "The change didn't hold up, so future runs stay the same". No line was wrong.
- `tests/facts.test.ts`: new tests "a kept re-author is learned once, from durableBehaviorChanged" (no ids, `[]` ids, `[]` ids with empty statuses map, `adaptationIds: []`, and a rejected patch beside the kept re-author all give 1), "an applied patch is counted once when durableBehaviorChanged is also true", "a rejected change with nothing durable is not learned" (also: `[]` ids + durable false gives 0; proposed id, no durable flag, gives 0). One existing assertion changed by design: `createdAdaptationIds: ["a1"], durableBehaviorChanged: true` with no statuses was `undefined`, is now `1` (Core said the stored Flow changed).
- `tests/summary-copy.test.ts`: new test "a kept re-author reads as learned, and a rejected change as not held".

## Commands run and observed results

- Bundled `src/panel/automations/tests/*.test.ts` (14 entries) with `scripts/test-extension.mjs`'s esbuild options into `apps/extension/.test-build-scratch/w4/` via a scratchpad script, then `node --enable-source-maps --test .test-build-scratch/w4/panel/automations/tests/*.mjs`:
  - before the fix: `# tests 105 # pass 103 # fail 2` (failing: "learned is 0 when nothing durable changed..." on the changed assertion, and "a kept re-author is learned once...").
  - after the fix: `# tests 105 # pass 105 # fail 0`. Scratch output `w4/` removed afterwards.
- `node <typescript/bin/tsc> -p tsconfig.json --noEmit` (apps/extension) -> exit 0, no output. `node <tsc> -p tsconfig.test.json --noEmit` -> exit 0, no output. (The check script's tsc steps, without the core-build gate and with `--noEmit` instead of its incremental build-info.)
- `node scripts/structure-audit.mjs` (repo root) -> `structure-audit: 1 violation(s) across 1 rule(s).`: `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`. No line names any owned file. The violation comes from the untracked `docs/working/mvp-final-month-plan/reports/t375-adaptation-unblock.md` working doc (not mine); the supervisor's `pnpm structure:baseline` regenerates the README.

## Not verified

- No full extension suite (`scripts/test-extension.mjs`), no `pnpm check`, no browser, Lab or provider run.
- Did not verify the Core side: that `durableBehaviorChanged` is actually true for a kept re-author depends on the parallel Core change. Until it lands, the row is unchanged for a re-author (Core still sends false).
- `controller.ts` / `replies.ts` were not read beyond a grep; `replies.test.ts` passes in the same run.

## Open questions or contradictions found

- If Core ever sets `durableBehaviorChanged: true` for a runtime patch whose status the panel has not yet read (ids known, statuses unknown), the row now says "Learned 1" rather than nothing. That matches the brief (durable true means the stored Flow changed) but would undercount if several patches were applied; the real count appears once statuses are read.
