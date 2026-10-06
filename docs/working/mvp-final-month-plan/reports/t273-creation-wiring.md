# t273-creation-wiring: creation blockers that needed t264's files

Lead: t273-creation-wiring (lead). Date: 2026-10-05. Trees: `fxwork/t273/!FluxIQ` (Core, branch `task/t273-creation-wiring`) and `fxwork/t273/!FluxIQWebExtension` (downstream; only this report changed). Nothing is committed. Stages: S1 B7 binding affordances (done, below); S2 D phase 2 and S3 P5 wiring are not started.

## Current State

S1 is done and validated, and is ready for the supervisor to commit in Core. S2 and S3 are waiting for the lead to be continued.

## S1 — B7 binding affordances

### What dev already had, and what was missing

- Dev (t262 `run-musp4h2f`, then t264 S4) already answers a bind of a press's shown `target` with `bind_new_key` + `control: true` ("a press has no value to vary ... leave that step as it is"). That covers the B7 cause for presses.
- Still missing (the t269 S1 brief and `b7-binding-feedback-causality.md`): a screened list of what a step does offer `bind`. The draft showed only `input`, and the refusal reason still ended with "or rerun the step with the new parameter first".
- Codex's WIP (`wip/t262-uncommitted`, Core `c5521e86`) did not apply mechanically. `amendment.ts` is now the `amendment/` directory, `entry.ts` and the feedback text changed, and the WIP's feedback hunk lacked its import. The WIP's projection was reused and reworked. Its feedback position lookup was not reused (see decision 3).

### Decisions

1. **The projection**, `automationStudioFlowDraftBindablePaths` (new `R/flow-draft/bindable/{paths,index}.ts`), lists the dotted parameter paths at which the shown `input` and `ranWith ?? input` hold the same value:
   - It is read from the shown input only, so no private resolved key or value is ever named.
   - It never maps a shown alias to what it resolved to.
   - A stored binding counts as one path. Nothing inside a binding, an array or a null is listed.
   - It is an affordance, not a rule: `bind` still checks `ranWith` and may accept more.
2. **The draft shows `bindable` only where the shown input misleads.** It appears on a step in the Flow only when its list is shorter than the paths its own input shows:
   - a Web press therefore shows `bindable: []`;
   - a step that ran as shown pays nothing;
   - one 165-byte instruction sentence is added only when any step shows the field.

   Measured reason: listing it on every kept step pushed the seven-step build in `tests/deepseek-bootstrap/tests/answerability.test.ts` from 4,928 to 5,302 bytes against its 5,000 budget. The generic fixture has no `ranWith`, so every list repeated the input.
3. **The refusal carries `bindable` from its source.** `amendment/bind.ts` computes it from the step it examined, and `amendment/apply.ts` copies it onto the `bind_new_key` refusal (new optional `bindable` on `AutomationStudioFlowDraftAmendmentRefusal`). The feedback passes it on.
   - Why: refusal `step` numbers use the numbering the model was shown, while `context.draftSteps` positions are current after moves. A lookup by position after a decision that reorders or drops steps could describe the wrong step.
   - The existing `nextStep` lookup in `llm/draft-amendment-feedback.ts` has the same latent mismatch. It is not changed here.
4. **New `bind_new_key` reason text:** "... Otherwise bind only a parameter bindable lists beside the refusal: the values of its input the step ran with as shown. An empty bindable means the step has no value to bind." The press (`control`) sentence is kept, and the "rerun the step with the new parameter" advice is removed.

### Changed (Core only)

- New: `R/flow-draft/bindable/paths.ts`, `R/flow-draft/bindable/index.ts`, `R/flow-draft/bindable/tests/paths.test.ts`.
- `R/flow-draft/index.ts` (barrel), `R/flow-draft/entry.ts` (`shownBindable`, `BINDABLE_INSTRUCTION`), `R/flow-draft/amendment/{bind,apply,types}.ts`, `R/llm/draft-amendment-feedback.ts`.
- Tests: `R/flow-draft/tests/entry.test.ts` (4 B7 cases), `R/flow-draft/amendment/tests/apply.test.ts` (whole-object bind regression, design assertion 3; `bindable` on 5 existing `bind_new_key` expectations), `R/llm/tests/draft-amendment-feedback.test.ts` (3 B7 cases).
- Docs: `docs/architecture/automation-studio/flow-authoring.md` (bind section); `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` regenerated. The only drift is the new export and shifted `entry.ts` line numbers.

### Validation (observed, `fxwork/t273`)

- Fail-first:
  - `npx vitest run .../bindable/tests/paths.test.ts`: "Failed to load url ../index.ts" (module absent).
  - The entry, feedback and apply tests before the source change: 4 failed / 111 passed. These were the 2 entry and 2 feedback projection cases. The whole-object bind regression passed before the fix, as the design predicted.
- `npx vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/llm .../tests/deepseek-bootstrap/tests/answerability.test.ts` (in `packages/fluxiq`): Test Files 177 passed (177), Tests 1749 passed (1749).
- `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
- `node scripts/structure-audit.mjs` (Core): "passed (252 warning(s), 349 baselined)". Line-count warnings on `apply.test.ts`, `draft-amendment-feedback.ts` and its test are advisory, and those files were already past 400 lines.
- `node scripts/docs-reference.mjs --check`: exit 0 after regeneration.
- `pnpm.cmd build` (Core): exit 0.
- Downstream:
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0 ("Core's build ... is current with its source").
  - `node scripts/structure-audit.mjs`: "passed (170 warning(s), 118 baselined)".
  - `run-subset.mjs domain t273-s1` + `node --test` on `runtime/tests/carried-row-service-repair`, `runtime/tests/carried-service-repair` and `runtime/llm-evidence/node-run/tests/draft-control`: tests 18, pass 18, fail 0.

### Not verified

- No live run.
- Whether the model now authors the missing cart action on B: the design report says better guidance does not guarantee a B pass.
- The real Web draft byte cost, estimated at about 165 bytes plus about 16 per press and 20 per typed step.

### Live run that proves S1

The B lane, `bigbox-retail-pickup-cart-store-remembered-after-creation` (B7 failed as `run-muteqswo-eb98d55a`), built from the extension chat.

It proves S1 when:

- the draft shows `bindable` beside the cart and size presses (`[]`) and beside typed steps;
- no repeated `bind_new_key` on a press `target` appears in the step log;
- the build either binds only listed paths or leaves the presses as they are.
