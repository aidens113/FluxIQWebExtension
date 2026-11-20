# t975: two Flow-saving defects (F4 stray step after a paging loop, F3 read-condition column)

## Outcome

Partial. Both fixes are in, with tests, and the targeted tests, targeted tsc and structure audits ran (results below). Nothing is committed. Nothing was run live. The rule I built for F3 is narrower than the brief's wording in one respect, and on its own it would not have fixed run 22's attempt-2 judge. See "Open questions".

## Follow-up after the lead's review

**Outcome: Done.** F4 and F3 as below, plus F23, and the structure audit passes in both repos. F24 (an act done by eye instead of a filtered repeat) is left for the user, as asked.

1. **Core audit (26 files in `llm/node-tools/tests/`).** I moved the two F4 round-trip tests into the existing `draft-from-flow.test.ts` as a self-contained `describe` block and deleted `draft-from-flow-loop-covered.test.ts`. The file is now 639 lines.
2. **F23: a read field bound to a column another field of the same read already reads.**
   - **Where:** `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts`, function `sharedColumn`. This is where a written field is bound to a detected column.
   - **Rule:** once every field is resolved, a field whose resolved spec equals an earlier field's is refused at that field's path. The two fields read the same detected column the same way.
   - **What the refusal says:**
     - reason `web.handle.malformed`;
     - issue `{code: "web.handle.shared_column.with.<earlier field>", field: <this field>, valid: <detected columns no field reads>}`;
     - shape hint `web.handle.expected.extract_list.same_as`.
   - **The model's way out:** write the field as a column object with `sameAs: "<the other field>"`, and both are kept. A `sameAs` naming any other field is refused at `sameAs`.
   - **Not refused:** one element read two ways, such as `key`, `key@href` and `key_url`.
   - **Plumbing:**
     - `slot.ts` passes the hint through;
     - `resolve-plan-node.ts` declares the hint code;
     - `tests/resolve-plan-node.test.ts` pins the code list and now includes it.
   - **Changed expectation:** an existing case in `tests/slot.test.ts` asserted that "a column may be read twice". It now reads the column twice through `sameAs`.
   - **New test, `extraction/tests/shared-column.test.ts`:** uses run 22's recorded detected columns and decide 0127's binding `{name: NAME, url, mutuals: NAME}`. It checks:
     - the refusal at `fields.mutuals`, with the issue naming `name` and the six unread columns;
     - the same refusal through `resolveWebExtractionSlot` and `webPlanSlotRefusal`;
     - the meant binding (the `div_x1a4yqcp` count column) resolves;
     - `sameAs` keeps both, and a wrong `sameAs` is refused;
     - text and link reads of one element pass.
   - **Model guidance:** the guidance text (`catalog-text.ts`) does not mention `sameAs`. The model learns it only from the refusal's hint code. I left the vocabulary text alone because its size is pinned.

Follow-up commands, all through the heavy-slot gate:
- `t975-final-checks`: Core `vitest run src/runtime/llm/node-tools/tests/draft-from-flow.test.ts src/runtime/flow-authoring/draft/loop-covered` -> 2 files, 49 passed. The Core audit -> `structure-audit: passed (562 warning(s), 909 baselined)`, exit 0. The extension audit -> 1 failure, `[contract-spread]` at `columns.ts:234`. The domain tsc -> TS2345, because `present()` needs `expected` written by name. Both are fixed.
- `t975-final-checks2`:
  - targeted Core tsc (the tsconfig `files` updated for the folded test) -> no diagnostics;
  - targeted domain tsc (17 files) -> no diagnostics;
  - `DOMAIN_TEST_BUILD_LABEL=t975-f3 node scripts/test-domain.mjs plan-resolution/extraction/tests plan-resolution/tests llm-evidence/tests/tool-rejection-detail output-nodes/extract-list/tests output-nodes/tests node-run/list-read/tests node-run/tests/run script-examples/tests src/tests/domain.test` -> 670 passed, 0 failed;
  - the extension audit -> `structure-audit: passed (258 warning(s), 551 baselined)`, exit 0.

## What changed and why

### F4: a stray Next page after the paging loop (Core)

**Evidence.** `run-mwoserxk` does not exist under `lab-runs/2026-11-20` or in any bundle. The newest company-website apprentices run there is `run-mwouhs7i-b22d9399`. It shows the defect exactly: on every replay the saved Flow ran `s3 merge -> s4 repeat -> s5 extract -> s6 next_page` four times, exited to the `s7` merge, then ran `s8 web.output.dom-next_page`. The note then reads "The saved Flow's run stopped at step 10: executor.graph.unmatched_route". `run-mwcncux8-d888f3a0` (2026-11-11, same task) carries the same note. `run-mwodpw10` (2026-11-19) instead ended with `flow_not_proven` after the loop exit, so I did not count it as this shape.

**Cause.** The recorded draft at decide 0051 is the draft as the model saw it just before it wrote the loop (fixture: `draft/loop-covered/tests/recorded-run-mwouhs7i.json`). In it, steps 9, 10 and 11 are all kept presses of Next page with identical parameters `{"nextPage":{"list":"extraction.2"}}`. The decision `{"step":6,"change":"repeat","while":9}` covered only steps 6 to 9. Nothing in Core treats steps 10 and 11 as passes the loop already makes, so the draft kept them and `draft-routing.ts` emitted them after the exit Merge.
- At runtime the loop ends only when Next page answers `ended`. The copy after it answers `ended` again, and no edge routes it. That is the `unmatched_route`.
- A repair reads the saved Flow back through `draft-from-flow.ts`. It rebuilds the loop as a `repeat while` and carries `s8` and `s9` as ordinary kept steps after the span, so every repair assembled them again.
- `second-copy.ts` never refused the presses, because each one started on a different page state.

**Fix: a draft rule.** It sits in the draft rather than in assembly, so the replay (`core.run_flow` runs the proposed draft steps directly), assembly and the draft entry all agree. The rule lives in the new directory `runtime/flow-authoring/draft/loop-covered/`; `draft/` already held its 25-file limit.
- `covering-step.ts` answers one question: does a step directly follow, among the proposed steps, the last step of a span that repeats while it succeeds with no `most`, and do it again? "Again" means the same actionId, the same toolId, and the same canonical `input.parameters`. A span with `most` covers nothing, because it may stop before the list ends. A step that has its own routing is never covered.
- `settle.ts` takes a covered kept step out: `dropped`, plus a new `coveredBy` field holding the id of the loop's last step. Any acts claimed on it move to that step. In the other direction, a `coveredBy` step comes back to `kept` once no loop covers it any more (for example after `unrepeat` or a move).
- Where it runs:
  - at the end of `applyAutomationStudioFlowDraftAmendments` (`amendment/apply.ts`), so the decision that writes the loop removes the strays;
  - at the end of `automationStudioFlowDraftSeedFromFlow` (`llm/node-tools/draft-from-flow.ts`), so a repair of a Flow saved before this fix drops them.
- `second-copy.ts` gains rule (d): a step joining the Flow that a loop right before it covers is refused as `second_copy`, with `copyOf` set to the loop's last step. This covers both an `add` call and `add`/`keep` amendments, so a re-add is never counted as progress. The `second_copy` reason text in `llm/draft-amendment-feedback/refusal-reasons.ts` now names this case.
- `entry.ts` shows the model an `out` line on a covered step: "taken out by Core: the loop ending at step N already does this step's act ...".
- `step.ts` declares `coveredBy?: string`, and `draft/index.ts` exports the new module.

### F3: the column a read condition tests becomes a stored, hidden column (extension domain)

**Cause.** `domain/src/output-nodes/extract-list/declared-columns.ts` narrowed a read to its declared schema columns. A helper column that only the read's own `where` used was removed from the field map, and its condition was rewritten to read through its own spec. So the saved Flow never stored the value the rows were kept for, and the judge's rows (the page evidence) never carried it.

**Fix.** A helper column is now stored and hidden, kept under its key with its condition untouched, whenever any of these uses it:
- a read condition (`where`), which is new;
- a sort or a dedupe, as before;
- the authored `process`, as before.

The answer still shows only the declared columns. When the author wrote no `process.columns`, the declared columns are written there. Some details:
- Hidden columns are read as optional (`required: false`). Without that, a row the conditions keep could fail for lacking the column; `where X absent` keeps exactly those rows, and Core's record validation would refuse them under a required schema field.
- Which columns are hidden is read from `process.columns` when it is written. So a saved record output, dispatched again with the read it came from, builds the same value (tested).
- A helper that nothing uses is still dropped, and the t877 note is unchanged. I first tried storing every unused column as hidden. The existing stored-columns tests show why that is wrong: a read of a detected list carries every detected column (seven css-keyed columns in one test), and all of them would have been stored and put in front of the judge.

Files changed:
- `declared-columns.ts`: the logic above and the `hidden` field.
- `reconciled-record-output.ts`, `plan-resolution/extraction/conditions.ts` and `plan-resolution/extraction/run-record-output.ts`: header comments only.
- Tests updated to the new contract: `declared-columns.test.ts`, `dedupe-link-identity.test.ts`, `plan-resolution/extraction/tests/{conditions,run-record-output,run-record-output-note}.test.ts`.
- New test: a "zero mutual friends" stand-in read stores `mutuals` hidden and optional, keeps `where mutuals absent` by key, and dispatches idempotently.

## Commands run and observed results

All of these ran through `cd C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots && node heavy-slot.mjs run t975-<step> -- ...`.

| Step | Command | Result |
| --- | --- | --- |
| t975-f4-tests | Core, from `packages/fluxiq`: `node ../../node_modules/vitest/vitest.mjs run src/runtime/flow-authoring/draft/loop-covered src/runtime/llm/node-tools/tests/draft-from-flow-loop-covered.test.ts` | First run: 10 passed, 2 failed. My test registry's next-page node did not declare `nextPage`, so the plan was refused with `bootstrap.unknown_parameter`. I fixed the test definition; rerun: 2 passed. |
| t975-f4-importers | Core vitest: `draft/tests`, `draft/amendment/tests`, `loop-covered`, `node-tools/tests/draft-from-flow*`, `decision-handlers/tests/{second-copy,refusal-way-out}`, `llm/tests/draft-amendment-feedback`, `harness-options/tests/draft-acts*`, `bootstrap/authoring/tests/{draft-routing,repeat-loop}` | 40 files, 506 tests passed |
| t975-f4-importers2 | Core vitest: `refuted-result/tests/carried-steps*`, `instructed-acts/tests/{claim-verdict,object-binding}`, `anthropic/tests/cache-content`, `stall-keeps-schedules`, `evidence-loop/tests/draft-shown`, `harness/tests/draft-screen`, `inherited-plan-nodes`, `replay-draft`, `replay-parity`, `rerun-check`, `step-place*`, `draft-guide`, `evidence-loop-seeded-draft`, `tests/earlier-output` | 20 files, 206 tests passed |
| t975-f3-domain | domain: `DOMAIN_TEST_BUILD_LABEL=t975-f3 node scripts/test-domain.mjs output-nodes/extract-list/tests plan-resolution/extraction/tests output-nodes/tests/{definitions,native-runtime,parameter-contracts} node-run/list-read/tests node-run/tests/run plan-resolution/tests/resolve-plan-node script-examples/tests offline-reads/state-domain/tests/row-computer target-reacquire/tests/row-match node-run/reach-page/tests src/tests/domain.test src/tests/web-panel-host.test` | The final run: 425 tests passed, 0 failed. Earlier runs failed 6, then 2, as I narrowed the rule and updated expectations. |
| t975-tsc-core | `tsc -p <scratch>/tsconfig.t975-core.json`: the Core tsconfig with `files` set to the 13 changed or new Core files (the tsc follows their imports) | No diagnostics |
| t975-tsc-domain | The same, over the 10 changed domain files | No diagnostics |
| t975-structure | `node scripts/structure-audit.mjs` in the Core and extension worktrees | Not run. It waited about 15 minutes in the gate's queue (2.2 to 2.4 GB free against the 2.5 GB minimum, behind `campaign-b-run`) and I stopped it at hand-off. **The lead should run it.** One thing I checked by hand: the new files sit in a new directory, because `draft/` already holds 25 files. |

## Not verified

- No live Lab run, so the F4 replay fix and the F3 judge evidence are proven only by unit and round-trip tests built from the recorded draft and stand-in reads.
- I did not check that the Lab oracle and the chat answer ignore hidden stored columns, beyond the t510/t970 precedent: sort helpers are already stored and hidden.
- These paths do not run the settle step:
  - a rerun that takes a kept step's place (`evidence-loop.ts` around line 476, `rerun-check.ts`);
  - a step kept via `write true`.

  For that rerun case, the next amendment decision or completion will not catch it either, unless an amendment runs. Rule (d) covers adds.
- No package-wide typecheck and no full suites, per the user rule.
- No docs under `docs/architecture/` were updated. The "Documentation Maintenance" rule probably applies to the change in what a saved read stores.

## Open questions or contradictions found

1. **F3 and run 22.** In `run-mwounh32-24f9bc6b` the saved read (`extraction.12`) had fields `{name, url, mutuals}` and no `where`. `mutuals` was mapped to the same css key as `name` (`div_x0531l50_..._a_x0ybvghy_x130pqy_x1yfagd`), so it held the person's name, not the count. The Delete was a single click on Diego, picked by eye, not a loop driven by a condition. The note "drops a column ... nothing uses ... mutuals" means it was not a read condition. So the new rule (condition fields stored hidden) would not have given attempt 2's judge the count. Two separate defects did that:
   - the model bound `mutuals` to the wrong column, and nothing refuses a field bound to a key another field already uses;
   - the delete was done by eye instead of a `where mutuals` read with a repeat.

   Either one needs its own task if wanted.
2. The brief's run id `run-mwoserxk` was not found; I used `run-mwouhs7i-b22d9399`, which matches the described shape.
3. When a covered step's loop goes, Core puts the step back on its own, even if the model would rather leave it out. The model can then drop it. This differs from `reversal.ts`, where the model has the last word; here a covered step can never run.
