# Report: live-lane-2 (crossborder-marketplace, auction-marketplace)

Lane tree `C:/Users/osrs_/FluxStuff/fxwork/t565` (downstream and Core on `task/t565-a8-lane-2`; downstream synced by
the supervisor to dev `fb3919e2`, Core `76d66fe8`), Lab slot `lab-slots/slot-2`, instance `bf-slot-2`. Nothing
committed.

## Fix log

| # | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- |
| 1 | downstream `domain/src/runtime/llm-evidence/repeated-refusal.ts` (a repeat keeps `closeWith`), `rejection-next/next-sentence.ts` (the covered-press `next` names cover, closers and target in order of action, and never ends "make this same call again, unchanged"), `tool-rejection.ts` (passes `target`); tests `node-run/tests/covered-press.test.ts`, `rejection-next/tests/next-sentence.test.ts` | run-mvcwem7d-34689f55 | lead: `DOMAIN_TEST_BUILD_LABEL=lane2-verify node scripts/test-domain.mjs rejection-next/tests node-run/tests/covered-press llm-evidence/tests/repeat-across-explorations llm-evidence/tests/tool-rejection-detail action-failure/tests/refusal system-instructions/tests` -> `# tests 58 # pass 58 # fail 0`; worker: structure audit passed (204 warnings, 638 baselined) | in tree; live rerun r3 |
| 2 | Core `runtime/llm/repeat-guard/covered-refused.ts` (new), `feedback.ts`, `candidate-feedback.ts`, `index.ts`: a repeat of a covered press says to close the layer first (the earlier answer names its closers), then press again; tests `tests/covered-repeat.test.ts`, `tests/feedback.test.ts` | run-mvcwem7d-34689f55 | lead: `npx vitest run src/programs/automation-studio/runtime/llm/repeat-guard` -> 11 files, 68 tests passed; `pnpm --filter fluxiq build` rebuilt (132 s); worker: `tsc --noEmit` exit 0, Core structure audit passed (397 warnings, 1155 baselined) | in tree; live rerun r3 |
| 3 | Core `runtime/llm/tool-call-keys/folded.ts` (new) + barrel, `harness/provider-result.ts`, `harness/run.ts` (passes offered tools), `unusable-decision.ts`: a key beside a tool call's `input` that the offered tool's own input schema declares, and `input` lacks, is moved into `input` before any check (never `write`, never an overwrite; info code `llm_output.key_moved_into_input`). Any other key there is refused with `expectedPath response.decision.input`. Bracket-unreadable replies are told the tool-call nesting. Tests `tool-call-keys/tests/folded.test.ts`, `harness/tests/tool-call-keys-folded.test.ts`, `tests/decision-kind/tests/misplaced-input-key.test.ts` | run-mvcwp3wh-bcea2115 (also 4 refusals in run-mvcxf4uz) | lead: `npx vitest run` on tool-call-keys, harness/tests, tests/decision-kind, tests/unusable-decision -> 28 files, 235 tests passed; worker: the real step-0011 reply now parses with `key_moved_into_input`; `tsc --noEmit` exit 0; Core rebuilt | in tree; live rerun pending |
| 4 | downstream `domain/src/runtime/llm-evidence/node-run/layer/runtime-clears.ts` (new) + barrel, `node-run/run.ts` (covered pre-check), `covered-target.ts` (header), `system-instructions/instructions.ts` ("Popups", version web-10): a press under a layer the runtime's own defence dismisses is sent, and the extension's gate and recovery close the layer and press, as in playback. Person-only layers, run-opened layers, and covers with no dismissal closer are still refused (C4). Tests `node-run/layer/tests/runtime-clears.test.ts`, `node-run/tests/covered-press.test.ts`, `system-instructions/tests/instructions.test.ts`, extension `content/actions/tests/covered-press-clears.test.ts` (test only) | run-mvcxf4uz-64cd322c (fixes 1-2 were not enough) | lead: `DOMAIN_TEST_BUILD_LABEL=lane2-verify node scripts/test-domain.mjs runtime/llm-evidence/node-run/tests runtime/llm-evidence/node-run/layer/tests system-instructions/tests rejection-next/tests` -> 273 pass, 0 fail; `EXTENSION_TEST_BUILD_LABEL=lane2-verify node scripts/test-extension.mjs actions/tests/covered-press-clears` -> 1 pass; downstream structure audit passed (204 warnings, 638 baselined) | in tree; live rerun r4 |
| 5 | Core `runtime/project-agents/stop-reason/stop-reason.ts` (new) + barrel, `supervisor/supervisor-loop.ts` (ending line): the supervisor's ending names why it stopped in plain words, never a code; a new loop code fails the typecheck until it has words. Test `stop-reason/tests/stop-reason.test.ts`. Adjacent to lane 4's in-progress failed-build chat cards (`service/project-build/ended-reason.ts` and others); no shared file | run-mvcwp3wh-bcea2115 UI review | lead: `npx vitest run` on project-agents/stop-reason and supervisor -> 27 files, 187 tests passed; Core rebuilt (181 s); Core structure audit passed (397 warnings, 1155 baselined) | in tree; seen live at the next failed ending |
| 6 | downstream `domain/src/runtime/llm-evidence/node-run/page-record.ts`: a cleared layer's `wayOut` (page address plus the control's descriptor, xpath included) is removed from what the model reads. Its rule (`actions/cleared-layers.ts`) is that it stops at the domain's server half, and fix 4 makes the path common. Test: `node-run/tests/covered-press.test.ts` asserts no `wayOut` and no `/html/body` in the read | fix-4 worker's trace (not a run) | lead: `node scripts/test-domain.mjs runtime/llm-evidence/node-run/tests` -> 246 pass, 0 fail; `tsc -p tsconfig.test.json --noEmit` exit 0; structure audit passed (204, 638) | in tree; not yet live (landed after r4's build) |
| 7 | extension `apps/extension/src/content/extraction/pager-reading/current-page.ts` (new: one current-page rule for `readPager`, `currentPageNumber`, `followingPageControl`: aria-current, the one number that is no control, a numbered link to this document, the one numbered control styled apart), `pager-reading/page-address.ts` (new: `linkAddress`/`leadsToThisPage`/`sameDocument` moved; an empty-valued query parameter counts as absent), `pager-reading.ts`, `index.ts`; tests `pager-reading/tests/{current-page,page-address}.test.ts`, `page-advance/tests/script-next{,-pager}.test.ts`/`.ts`, and the stub in `tests/list-reader-refused-page.test.ts` (gained `closest`/`querySelector`). Lead reordered the rule (plain-text number before link-to-this-page) after the worker flagged that risk | run-mvd0pbn9-bad36023 cause 1 | lead: `EXTENSION_TEST_BUILD_LABEL=lane2-round1 node scripts/test-extension.mjs src/content/extraction actions/tests/covered-press-clears` -> 317 pass, 0 fail; `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` (extension) exit 0 | in tree; not yet live |
| 8 | downstream `domain/src/runtime/llm-evidence/structure/container-words.ts` (new), `field-sample.ts`, `packet.ts` (one call-site line), `index.ts` (comment): a column whose element has no words of its own gets a sample composed from its described descendants ("9" ",87" " €" -> `price: '9,87 €'`). Test `structure/tests/composed-sample.test.ts`. **Merge note:** lane 1 fix 2 (t563) also adds a 4th parameter to `webLlmShownColumn` and edits the same `packet.ts` line; keep both as `(label, element, spec, lines?, page?)` | run-mvd0pbn9-bad36023 cause 2 | lead: `DOMAIN_TEST_BUILD_LABEL=lane2-round1 node scripts/test-domain.mjs` on node-run/tests, node-run/layer/tests, system-instructions/tests, rejection-next/tests, structure, repeat-across-explorations, tool-rejection-detail, action-failure/tests/refusal -> 349 pass, 0 fail; domain `tsc -p tsconfig.test.json --noEmit` exit 0; worker: removing the call-site argument gives 44/45 | in tree; not yet live |
| 9 | (lane 3 fix 3) a Repeat that reads the same rows with no page change stops as `repeat.no_progress` | run-mvd0pbn9-bad36023 cause 3 (a Click-plus-Read paging loop ran 48 passes on page 1 and ate 20 of the build's 30 minutes) | not fixed here | arrives at integration |

Watch item (not fixed): with fix 8, the struck-through original price is still offered as a second money column,
now labelled `price: '21,48 €'` beside the sale price `price: '9,87 €'`. Nothing in the capture says a text is drawn
crossed out. If a rerun reads the struck column again, the fix is a "struck through" note on that column from the
element's computed `text-decoration` (extension capture plus domain label).

Round 1 (2026-10-17): Core lane tests `npx vitest run` on llm/repeat-guard, llm/tool-call-keys, llm/harness/tests,
llm/tests/decision-kind, llm/tests/unusable-decision.test.ts, project-agents/stop-reason, project-agents/supervisor ->
66 files, 490 tests passed; Core `tsc --noEmit` exit 0; structure audits: downstream passed (204 warnings, 638
baselined), Core passed (397 warnings, 1155 baselined). Core `dist` last rebuilt after fix 5.

## Queue

| Task | Runs (run id, verdict, billed cost, calls) | Status |
| --- | --- | --- |
| crossborder-marketplace-free-hubs-under-ten | run-mvcwem7d-34689f55 failed $0.0114 17 (covered press); run-mvcxf4uz-64cd322c failed $0.0170 28 (same cause, advice not enough); run-mvd0pbn9-bad36023 failed $0.0779 47 (30-min limit: pager, price sample, paging loop) | rerun after round 1 |
| crossborder-marketplace-follow-official-store | | queued |
| crossborder-marketplace-mint-hub-fallback | | queued |
| crossborder-marketplace-uk-express-quote | | queued |
| auction-marketplace-cheap-accessory-auctions | run-mvcwp3wh-bcea2115 failed $0.0068 15 (plan grammar, fix 3) | rerun after round 1 |
| auction-marketplace-save-mark-ii-sellers | | queued |
| auction-marketplace-buy-it-now-quote | | queued |
| auction-marketplace-lens-hood-seller-shop | | queued |

## Launch shape

`launch.ps1` (lead scratchpad) sets `FLUXIQ_TEST_TARGET=persistent-isolated`, `FLUXIQ_DEMO_HEADLESS=false`,
`FLUXIQ_LAB_INSTANCE=bf-slot-2`, `FLUXIQ_LAB_CORE_BRANCH=task/t565-a8-lane-2`, `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`
and runs, from the lane tree's downstream checkout:

```text
pnpm.cmd lab run <scenario> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash
  --authoring-mode project --llm-task create-flow --instruction-task <task> --target persistent-isolated
  --workspace bf-<task> --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

Dry run first (2026-10-17): free-hubs-under-ten `{"status":"ready","providerCallCount":0,...,"coreAuthoringMode":"project",
...,"maxEstimatedCostUsd":0.25}`; the prelude rebuilt `scenario-lab:build` and `extension:build` (228 s).

## Runs

### 2026-10-17 14:10: first launch refused by `behind-dev` ($0, no provider call)

The guard was right: dev had gained t706's extension background change after the lane sync. The supervisor
fast-forwarded the downstream checkout to `fb3919e2`.

### r1 run-mvcwem7d-34689f55 (free-hubs-under-ten): failed, $0.0114, 17 calls

The builder pressed the cookie bar's "Reject non-essential" under the welcome modal, five times in each of two briefs.
The repeat answer had lost `closeWith`, and the advice ended "make this same call again, unchanged". Debug:
`docs/working/language-driven-flow-loop-plan/debugs/run-mvcwem7d-34689f55.md`. Fixes 1 and 2.

### r2 run-mvcwp3wh-bcea2115 (cheap-accessory-auctions): failed, $0.0068, 15 calls

The supervisor's plan put `reason` beside `input` 12 times: 10 replies were unreadable JSON, and 2 were refused
`unexpected_field` with no path. Debug: `debugs/run-mvcwp3wh-bcea2115.md`. Fix 3.

### r3 run-mvcxf4uz-64cd322c (free-hubs-under-ten): failed, $0.0170, 28 calls

Fixes 1-2 were live and their advice reached the model verbatim ("Press t478 or t488 first ..."). The builder still
pressed the covered control about 15 times over three briefs. Words do not move this model, so the runtime now clears
a dismissible cover itself (fix 4). Debug: `debugs/run-mvcxf4uz-64cd322c.md`.

### r4 launch 1 (free-hubs-under-ten): refused by the Lab's staleness check, $0

I edited `page-record.ts` while the prelude was still building. The Lab saw the domain build was behind its source
and refused before any provider call; no ledger start was written. Lead rule from here: no source edit until a
prelude logs `"step":"total"`.

### r4 run-mvd0pbn9-bad36023 (free-hubs-under-ten): failed, $0.0779, 47 calls

Fixes 3 and 4 worked live: the plan was taken first time, and the covered cookie press was sent, with the runtime
closing the welcome modal. The build then ran out its 30 minutes on three general causes: `next_page` could not read
this pager's current page (fix 7); the real price column had no sample (fix 8); a Click-plus-Read paging loop with no
progress (lane 3 fix 3). Debug: `debugs/run-mvd0pbn9-bad36023.md`.

UI notes so far (chat): the ending is said twice (card and plain message) plus a toast. The supervisor-ended card
shows "(llm evidence loop.unreadable replies)", an internal code turned into words.
