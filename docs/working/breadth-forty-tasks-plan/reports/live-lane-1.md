# Report: live-lane-1 (lane tree `fxwork/t563`, slot-1, instance `bf-slot-1`)

Source at start: downstream `5e59a563`, Core `76d66fe8` (Core branch `task/t563-a8-lab-comparison`).
Launch shape: A8 (`--authoring-mode project`, `--llm-max-cost-usd 0.25`, `--llm-max-calls 250`, workspace
`bf-<task>`), environment `FLUXIQ_TEST_TARGET=persistent-isolated`, `FLUXIQ_DEMO_HEADLESS=false`,
`FLUXIQ_LAB_INSTANCE=bf-slot-1`, `FLUXIQ_LAB_CORE_BRANCH=task/t563-a8-lab-comparison`,
`FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`.

**Integration round 1 (2026-10-18):** fixes 1, 2, 2b committed by the supervisor (Core `f4968d92`, downstream
`32be00d3`) and merged to dev; fix 3 applied by the supervisor on dev (`2485e450`, user-approved wording). Lane tree
synced to downstream `48cdbfee` / Core `c1ed1bdd`.

**Scope change (user, via the supervisor):** one full end-to-end pass per site, then stop. everything-store is done
(three passes). Left: bigbox-retail `rated-delivery-towels` (reworded) and local-classifieds `test-ride-question`
(the send at a permission point). The other queued tasks are proven provider-free by a per-site audit, not live.

## Fix log

| # | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- |
| 1 | Core `packages/fluxiq/src/programs/automation-studio/runtime/project-agents/`: `contracts/{builder-return,subflow-brief,index,earlier-attempt(new)}.ts`, `dispatch/{ending,run-brief}.ts`, `dispatch/tests/stopped-repeating.test.ts` (new), `supervisor/{dispatch-tool,guidance,brief-input}.ts`, `supervisor/tests/{repair-repeats.test,supervisor-fixture}.ts`. A builder the no-progress guard stopped is marked `stoppedRepeating` (from the loop's code); the first such blocked return of a subflow lets the same brief be sent once more, carrying `earlierAttempt` (reason, calls it stopped on, lasting acts), shown to the new builder in generic words; a second stop is refused `project.brief_repeated` as before. | run-mvcx8na6-9554a3f1 (office checkout: re-brief refused, ended blocked with $0.23 unspent) | `pnpm --filter fluxiq check` -> exit 0; vitest supervisor/tests, dispatch/tests, contracts -> "Test Files 50 passed (50) / Tests 360 passed (360)" (lead re-ran); Core `node scripts/structure-audit.mjs` -> "passed (398 warning(s), 1155 baselined)"; Core libraries rebuilt, `scripts/check/core-build.mjs` -> current | built; live rerun run-mvczd85j-c98561c5 did not exercise it (no loop stop that run) |
| 2 | downstream: `domain/src/actions/extraction/{request,read-request,schema}.ts`, `domain/src/actions/types.ts`, `domain/src/output-nodes/extract-list/derived-record-output.ts`, `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts`, `domain/src/runtime/llm-evidence/structure/{packet,field-sample}.ts`, `structure/first-item/{locate,index}.ts`, `structure/tests/line-group.test.ts` (new); `apps/extension/src/content/extraction/{infer-fields,field-spec,field-reader,content-fields,detect-structure,infer-list}.ts`, `content/extraction/line-group/` (new), `content/extraction/tests/infer-fields.test.ts`, `shared/extraction-messages.ts`, `background/extraction/definition.ts`, `panel/extraction/{view-model,confirm-payload}.ts`; `docs/architecture/web-capabilities.md`. A container whose text lines are offered only by position is also offered whole: a `text` field with `lines: true` reads its children's text joined by " · ", so "any line contains X" is a condition. Positional fields unchanged; digest changes only when `lines` is set. | run-mvcxvr3k-af919462 (rated towels: no field for "has a delivery line"; judge passed a vacuous condition) | worker: tsc domain/extension src+test exit 0; lead re-ran `test-extension.mjs src/content/extraction` -> "# tests 304 # pass 304 # fail 0", `test-domain.mjs runtime/llm-evidence/structure actions/extraction output-nodes/extract-list` -> "# tests 217 # pass 217 # fail 0", `node scripts/structure-audit.mjs` -> "passed (205 warning(s), 638 baselined)" | **verified live**: run-mvd1ex8o-e1dc7ec8 read the new `div_css-0gz65eu_all_lines` field and stored the oracle's exact 16 rows (oracle passed) |
| 2b | downstream (lane 3's cause, routed by the supervisor): `apps/extension/src/content/extraction/{infer-fields.ts, template-kind/ (new: index, element-kind, same-kind, kind-conditions, kind-columns), stated-name/ (new: index, stated-attributes), tests/infer-fields.test.ts, tests/fake-shadow-dom.ts}`; `domain/src/runtime/llm-evidence/structure/first-item/{compound.ts, tests/chain.test.ts}`, `structure/tests/template-kind.test.ts` (new); `docs/architecture/web-capabilities.md` (one sentence). A positional column whose element differs in kind across items (tag, role, classes, aria-label/datetime, href folder) is read by one selector naming one kind (e.g. `:scope a.meta[aria-label]`), keeping its key; another kind widens an existing column or gets its own; an aria-label/title/datetime that differs from the element's words is offered as an attribute column. The domain compound reader reads `:not([attr])` and matches a root-relative `[href^=]` against the absolute href. | lane 3 run-mvczv4jn-1b61183c (feed: `span:1 > a` read the author in group posts; full date only in aria-label) | fail-first (worker): before, `infer-fields` 16 pass 2 fail (the column read ["1h","Elena Sokolova","5h","Priya Nair","2d"]); lead re-ran after: `test-extension.mjs src/content/extraction src/background/extraction src/panel/extraction` -> "# tests 477 # pass 477 # fail 0"; `test-domain.mjs runtime/llm-evidence/structure actions/extraction output-nodes/extract-list runtime/llm-evidence/plan-resolution/extraction` -> "# tests 272 # pass 272 # fail 0"; tsc domain + extension, src and test -> exit 0 x4; audit passed | built; not live-tested (no feed task in lane 1) |
| 3 | task data `apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts` line 6: "that can be delivered to me" -> "that ValueRidge offers for Delivery to me (shipping or pickup alone does not count)" | run-mvd1ex8o-e1dc7ec8 (oracle passed; judge read "delivered" as including Shipping) | - | the lead's edit was refused by the permission classifier as a shared resource; **applied by the supervisor on dev `2485e450`** (user-approved). Live: run-mvd8ypsv-32cde667 used the Delivery filter and the oracle passed 16/16; the run failed only on the judges (fix 4) |
| 4 | Core `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`: `refuted-no/{weigh,index}.ts`, `refuted-no/tests/weigh.test.ts`, `request-rows/summary-with-also-in-result.ts`, `request-rows/tests/{summary-with-also-in-result.test,stored-though-left-out.test}.ts`, `request-rows/tests/promoted-copies-fixture.ts` (new), `value-readings/tests/text-settled-judge.test.ts`. (a) `weigh.ts`: a no's clause that only says rows a condition left out came back by another copy is no complaint (the judges' own "4 of them ... are also in the result ... so not missing" had counted as one, so neither no was wholly refuted); "wrongly" now counts as a complaint word. (b) A row Core settled is no longer also listed in `leftOutAlsoInResult`, and that sentence no longer lets a judge infer unlisted rows are missing. | run-mvd8ypsv-32cde667 (oracle passed 16/16; both whole-run judges said no over the settled sponsored-only row; reported unverified) | worker replay of the run's real judge input: before, both nos "not wholly refuted"; after, both wholly refuted and marked for re-ask (`refutedNo.calls [1,2]`). Fail-first: 6 failed / 16 passed before. Lead re-ran after: `pnpm --filter fluxiq check` -> exit 0; `npx vitest run src/programs/automation-studio/runtime/result-verification` -> "Test Files 129 passed (129) / Tests 1077 passed (1077)"; Core `node scripts/structure-audit.mjs` -> "passed (401 warning(s), 1154 baselined)" | **uncommitted** in `fxwork/t563/!FluxIQ`; complete and tested at unit level; Core dist NOT rebuilt (the next Lab launch needs `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`); not live-verified (the run ends verified only if the re-asked judges say yes). Report: `reports/live-lane-1-fix-4.md` |

## Queue

| Task | Runs (id, verdict, billed $) | Status |
| --- | --- | --- |
| everything-store-coupon-earbuds-rated-four | run-mvcvzwd3-32f53329 passed, $0.102, 90 calls (5/5 records) | **pass** |
| everything-store-batteries-and-descaler | run-mvcws1l9-f43e197f passed, $0.023, 35 calls (3/3 records) | **pass** |
| everything-store-sage-small-kettle-if-in-stock | run-mvcx106k-2c9e375d passed, $0.033, 49 calls (2/2 records, cart unchanged) | **pass** |
| everything-store-office-checkout-review | run-mvcx8na6-9554a3f1 failed, $0.022, 36 calls (cause 1: builder looped; re-brief refused as repeated; fixed by fix 1); run-mvczd85j-c98561c5 failed, $0.042, 56 calls (cause 2: builder reads "ready to buy on its own" as add-to-cart and never tries Buy Now; judge right; model reading, no fix without teaching to the test) | parked, 2 causes |
| bigbox-retail-rated-delivery-towels | run-mvcxvr3k-af919462 failed, $0.127, 109 calls (21 records vs 16: delivery clause not expressible; fixed by fix 2); run-mvd1ex8o-e1dc7ec8 failed, $0.079, 68 calls, **oracle passed 16/16** (judge read "delivered" as including Shipping; fix 3 wording); run-mvd8ypsv-32cde667 failed (reported unverified), $0.028, 27 calls, **oracle passed 16/16** (both judges called the settled sponsored-only row missing; fix 4) | open: rerun on fix 4 (Core rebuild first) |
| bigbox-retail-napkins-for-delivery | not run | out of scope (user, 2026-10-18: provider-free audit) |
| bigbox-retail-checkout-quote-without-ordering | not run | out of scope |
| bigbox-retail-new-store-cheapest-towels | not run | out of scope |
| local-classifieds-nearby-furniture | not run | out of scope |
| local-classifieds-test-ride-question | run-mvd9nlx5-1373850d failed, $0.089, 131 calls (no Flow; trial step 14 "read the seller's name" `web.target.not_found` x4, then repeat stops in both briefs; nothing sent, no permission ask reached; cause not fully debugged) | open: debug step 14 before any rerun |
| local-classifieds-carbon-price-check | not run | out of scope |
| local-classifieds-bikes-within-alex-price | not run | out of scope |

Billed in total: 9 runs, $0.545 (everything-store $0.222 incl. the two office-checkout failures, bigbox $0.234, classifieds $0.089).
Added by the user after the round (not started): rerun `everything-store-office-checkout-review` on the audit's rewording
(names the Buy Now route) until it passes.

## Stopped state (2026-10-18, session wrap-up)

- No run in flight. Last run on bf-slot-1: run-mvd9nlx5-1373850d, debug written (the debug guard is satisfied).
- Uncommitted in `fxwork/t563/!FluxIQ`: fix 4 (8 files above, 1 new), complete and unit-tested; Core dist not rebuilt.
- Uncommitted in `fxwork/t563/!FluxIQWebExtension`: this report, `reports/live-lane-1-fix-4.md`, debug notes
  `run-mvd8ypsv-32cde667.md` and `run-mvd9nlx5-1373850d.md`. No source change downstream since `48cdbfee`.
- Next, in order: commit and merge fix 4; rebuild Core; rerun rated-delivery-towels; debug test-ride step 14 from
  `lab-runs/2026-10-17/run-mvd9nlx5-1373850d/steps` (compare the trial's page view at step 14 with the exploration
  page view where the seller-name target was saved); rerun office-checkout on its rewording.

## Run notes
