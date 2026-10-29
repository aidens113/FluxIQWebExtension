# t791 fix5b-ending-left-acts

## Outcome
Done. Unit-tested only; no live run.

## What changed and why (Core, packages/fluxiq/src/programs/automation-studio/runtime)
- New `service/project-build-ending/reason-nothing-changed.ts` (exported from the barrel): drops reason sentences that say the site was left unchanged ("nothing was changed", "no change", "did not change", "left nothing", "unchanged/untouched"). Sentences about the Flow/draft/script stay ("nothing was put into the Flow").
- `service/project-build-ending/ending-told.ts`: when `left.note` is defined (ledger holds an act in place, kept, unsettleable or possibly there) the dropper runs before the readings check. The row then names the act through the existing `left.told` (what was pressed, that it is still on the site).
- `project-agents/supervisor/left-on-target.ts` `reason(said)`: applies the same dropper when `note` exists, so the build record's reason (blocked and partial endings, both via completion.ts / supervisor-loop.ts) no longer carries the false claim. The failed path goes through `ending-told` in run.ts (unchanged wiring).
- Ledger source: the existing `snapshot()`/`unsatisfiable()`/`possiblyInPlace()` already used by left-on-target; no flow-bootstrap edit, no run.ts edit needed.

## Commands run and results
- `npx vitest run` (packages/fluxiq) on project-build-ending + left-on-target.test.ts: 6 files, 44 tests passed.
- Under the lock: same over runtime/service/project-build-ending and runtime/project-agents/supervisor: 31 of 32 files, 241 tests passed; the one failure is `provider-stopped.test.ts` ("No test found in suite", empty describe), pre-existing and untouched (same as fix 5 report).
- `node scripts/structure-audit.mjs`: passed (1152 baselined).

## Tests added (non-social examples)
- `service/project-build-ending/tests/nothing-changed.test.ts`: forum follow left (blocked wording), library hold left (partial wording, "unchanged"/"left no change"), kept as-is when nothing left, Flow-claims kept.
- `project-agents/supervisor/tests/left-on-target.test.ts` (appended): reason drops "Nothing was changed on the account" and names the act when one is in place; unchanged when nothing is left.

## Not verified
- Whole-package tsc not run (brief said skip); tests transform fine.
- The pattern list is heuristic English; a differently phrased "nothing changed" claim would stay. The row's `where` of an act is only as the act's `did` text names it (control name); no separate page location added.
- Not checked on a live build.

## Open questions
- A claim like "the account is as it was" is covered only by "as it was"/"as found"; others may need adding after a live ending is seen.
