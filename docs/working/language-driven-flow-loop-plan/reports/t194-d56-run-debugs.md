# t194-d56: full debugs of lane C runs 5 and 6

The brief named no report path. This file exists because the worker-report hook requires one. The substance is in the two debug files.

## Outcome

Done. Both debugs are written, with every template field filled or marked `NO EVIDENCE:`:

- `debugs/run-muntc23v-7fcc4110.md` (run 5)
- `debugs/run-munv53gt-a0e6f545.md` (run 6)

## What changed and why

Only the two debug files and this report were written. No source was edited, and no Lab, browser or build was run.

- **Run 5 reached Stage 2 only; no Flow was built. Cost USD 0.061516.**
  - The build re-ran its list-reading step eleven times without spacing its page loads. The store's rate limit refused loads at 08:03:49, 08:04:49 and 08:05:29.
  - The third refusal made the store show a robot check on every page. Ten check replays then failed at their first page load (`core.replay.reset_failed`), and the loop gave up with `evidence_unusable_decision`.
  - This is a product defect. The "facility failure" label is a Lab mislabel from `packages/test-runner/src/run-scenario.ts:505`.
- **Run 6 reached Stage 6. Cost USD 0.037808 for the build; USD 0.085608 with the rewrite and repair.**
  - First run: the "next page" selector `a:nth-of-type(6)` stopped the read on page 1, and the Flow had no accessory rule. It returned 2 of 13 records, 1 matching.
  - The rewrite was applied but spent its re-runs inside the rate limit, and its accessory rule drops expected rows 8, 9 and 11.
  - The re-run stopped on the optional "Continue shopping" click (recovery-budget cause, now fixed) and lost its first attempt records to repeated ids (fixed).

## Commands run and observed results

These were read-only inspections:

- Parsed the bundle JSON files with node.
- Read the kept `project.sqlite` read-only through `node:sqlite`, using scratch scripts `d56-tables.mjs` and `d56-graph.mjs`.
- Read `run05.log`, `run06.log` and both `core.log` files.
- Viewed the UI screenshots: 10 from run 5 and 9 from run 6.
- Used `git log` to date the fixes: `0faee6e6` at 08:54 UTC; the work-in-progress commits `518e38fe` and `4c8753ed`.

## Not verified

- That `i.css-0dxd415` is the Plus badge.
- What run 6 spent 09:00:26 to 09:09:23 on.
- The arguments of each decision, which are not in the evidence.
- Whether any of the cited fixes works in a live run.

## Open questions or contradictions found

- The brief says run 6's rewrite lost the route that lets the optional click fail and carry on (w7). The kept graph shows the route was kept (`s4:failed -> s5:in`). Only w7's repeated-record-id problem applied.
- Causes with no fix yet:
  - A multi-page read never waits for each page's lazily loaded results (`list-reader.ts`).
  - The check replay counts a one-page read as a success (`domain/.../node-run/replay.ts`).
  - The rewrite skips the check replay and accepted two steps writing the same dataset.
  - The judge is told how many rows each condition removed but not what it tests.
  - The Lab's facility-failure mislabel.
  - The 512-byte limit on showing step settings.
