# t193-wU: debug of run 34 `run-mup2i28c-6c7fc209`

## Outcome

Done. Debug written to `docs/working/language-driven-flow-loop-plan/debugs/run-mup2i28c-6c7fc209.md`, every template field
filled or marked.

## What changed and why

One new file, the debug above (docs only). No source touched.

## Commands run and observed results

- Read the template, the lane report's Session 3 causes and the bigbox Stage 1, `summary.json`, `evaluation.json`,
  `run.json`, `events.ndjson`, `snapshots/{flow-lane,live-llm,decision-trace,person-hand-offs}.json`, `logs/core.log`,
  `logs/scenario-lab.log`, the Lab log `run34.log`, the ui-review `.json`.
- `node` scripts over the decision dump (28 lines): listed events; printed each tool request/result and decision; located
  `target.7`, `target.319`, `target.339`, `target.313/314/321`, "No thanks" in each packet; compared the store button's
  shadow-host selector in T2 `read.element` (`body > div > header > ...`) with T5 `ranWith` (`body > div:nth-of-type(1) > ...`).
- Read domain `node-run/run.ts` (240-300, 370-420, 580-600), `press.ts`, `stable-handles.ts`, `plan-resolution/target-packets.ts`
  header, `node-run/arrival.ts`; Core `flow-draft/amendment.ts`, `llm/decision-handlers/amendment.ts`,
  `llm/evidence-loop/rerun-request.ts`, `llm/loop-budget.ts`, `llm/evidence-loop.ts:540-565`.
- Opened all 8 ui-review PNGs (read 01-start x2, 02-mid-build x2, 03-mid-build x2, 04-failure x2) and run screenshots
  00002, 00003, 00004, 00006.
- Recomputed the budget: D4 shown 6 / $0.1564 and D5 shown 3 / $0.1025 match `loop-budget.ts`'s average-cost formula; after D5,
  $0.25 - $0.1820 - $0.0364 = $0.0316 -> 0 decisions -> `exhausted("budget")`.

## Not verified

- The pre-action look inside T3 is not dumped; that it renumbered the store button to `target.7` is inferred from T4 (3.9 s
  later, same popup) and the selector difference, not observed directly.
- Whether T5's press reached the store button's handler: no page event log.
- The final draft after D5 is not dumped; "5 add a2 accepted on the look" is inferred from `appliedCount 2` (one is the rerun),
  the refusals, and Core's `amendment.ts` logic.
- Run screenshots 00001 and 00005 were not opened (00004/00006 and the ui-review PNGs cover the same moments).

## Open questions or contradictions found

- The lane report's W1 cites 118,591 B / 199,305 B; I did not re-measure them (cited as given).
- The ui-review labels moment 2 (05:05:38-41) "mid-build", but the build loop started at 05:05:45.65; the "overlay absent" there
  is real but precedes the loop.
- New causes beyond W1/W2/B1: C1 selector-keyed stable handles renumber the page when an overlay div appears; C2 the unshown
  look replaces shown handles; C3 refusal omits the new blocker; C4 press on a covered control runs and reports success; C5
  add-with-rerun ordering; C6 act accepted on a look; C7 stale draft entry at D5; C8 average-cost budget projection and wrap-up
  with 0 acts done; C9 no rule for a newly appeared popup; U1 UI defects.
