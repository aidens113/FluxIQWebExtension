# t787 fix 2: the in-run repair's handler that never ran

## Outcome

Done, but the cause is different from the one the brief suspected. The handler did not fail because `t275` was a
page-view layer line that resolved to nothing. `t275` resolved to the dock element (`body > fl-dock`). The handler
failed because the model wrote its condition's `fact` as a description, `"dock layer covering the post action bar"`.
The web domain reads a kind in `fact` (`visible`, `absent`, `text`, ...), so it answered the condition `unknown`
(`unsupported`) without sending it to the page. An `unknown` `when` never holds, so the handler was skipped without a
record, and attempt 12 ran as if the handler had been tried.

I fixed that cause in Core, at apply. I did **not** add the refusal the brief asked for (an add_handler whose `when`
names a layer line). A layer line resolves to the layer's own element, and "the layer is visible" is the right `when`
for such a handler. That refusal would have thrown away the correct fix in this run.

## Confirmed cause, and how it was proved

1. **What the model wrote** (`steps/0143-repair/decision.json`): an `add_handler` with `event: before`, scope node
   `...like_recent_posts.s10`, and `when: [{ fact: "dock layer covering the post action bar", op: "visible", target:
   { handles: { element: "t275" } } }]`. The completion check had the same prose `fact` with `op: absent`. The step
   was a click on `t279`.
2. **What Core saved after resolution.** The adaptation `adaptation.9a0123fa…` (status `testing`) points at patch
   object `9a5675b1…` in the run's Core workspace
   (`persistent-isolated/claude-photo-likes-t567-20261028-r8/fluxiq-root/.fluxiq/…/objects/sha256/9a/56/`). Its
   `when` target is `{ selector: "body > fl-dock", element: { tagName: "fl-dock", selector: "body > fl-dock" } }`.
   The domain resolved `t275` to the dock's custom element. The dock is `position:fixed; display:block` and its panel
   is drawn inside it, so it is visible. **The layer-line theory is refuted.** The prose `fact` was saved unchanged.
3. **The executor path works.** I ran a probe executor test (since deleted) with an added On Before handler whose
   `when` the host answers `true`. The handler ran before the re-attempt and the run succeeded. Neither the overlay,
   the registry nor the arrival logic is at fault.
4. **The domain answers the saved `when` `unknown`.** I bundled `domain/src/runtime/facts/query.ts` with esbuild into
   the scratchpad and fed it the saved conditions:
   - `{ fact: "dock layer covering the post action bar", op: "visible", target }` returned `{"unknown":"unsupported"}`.
   - The same with `op: "absent"` returned `{"unknown":"unsupported"}`.
   - `{ fact: "visible", op: "visible", target }` returned `{"query":{"kind":"visible",…,"expected":true}}`.

   `claimFor` reads `fact` as the claim's word. A description matches none of the known words, so the condition is
   never sent, and the handler never runs.
5. **Timeline.** Attempt 11 at 20:57:28.6, then diagnose and repair (0142 and 0143, finished 20:57:37.35), then
   attempt 12 at 20:57:37.51. Attempt 12 carries no `lifecycle` record. A handler that runs or is refused is recorded
   on the attempt it cleared the way for. One whose `when` is `unknown` is not chosen, so nothing is recorded. That
   matches "no handler node between them".

The root of it: the runtime-patch schema describes `fact` as free text ("What the host observes, in the host's own
terms, as the evidence shows it"). The model reads that as a label. A build's script grammar
(`flow-bootstrap/script-statements/fact-condition.ts`) always writes the kind itself (`{ fact: "visible", op:
"visible" }`), so built handlers work and repaired ones did not.

## What changed and why

All of it is in Core, under `R = packages/fluxiq/src/programs/automation-studio/runtime`:

- **New `R/recovery/annotation/patch-fact-kind.ts`** (`automationStudioRecoveryPatchFactKind`). It holds a repair's
  condition about a control (one with a handle target) to the build's grammar before the target is resolved:
  - For a presence op (`exists`, `absent`, `visible`, `enabled`), `fact` becomes the op, as the script writes it.
  - For `count`, `fact` becomes `count`.
  - A comparison (`equals`, `contains`, `matches`) keeps `text` or `value`, `count` with `equals`, and a presence
    word with `equals` true or false. Any other comparison is refused, because the op does not say what is compared.
  - A condition with no target (a dialog, the page) is left as written.
- **`R/recovery/annotation/step-evidence-resolution.ts`, `resolveFacts`.** It applies the module above to every
  handle-target fact in `when` and `completionCheck`, before the domain is asked about the target. A refusal returns
  `step_unresolved`, with issue code `recovery.fact_kind_unread` and these words: "The fix's situation compares
  something it describes only in its own words, which the run cannot read, so the fix was not used. A condition that
  compares names what it reads: text for a control's shown words, value for a field's value." No adaptation is then
  recorded, and the run ends as a run with no fix does. I also added a sentence to the header.
- **`R/recovery/annotation/index.ts`.** The barrel now exports the new module.
- **Tests:**
  - `R/service/runtime-session/tests/in-run-repair.test.ts` has a new describe, "an in-run handler held to what the
    run can read". It runs the real executor with the session's `repairIncident`, a domain resolver, and a host that
    reads facts by kind as the web domain does. The patch is written the way this run's model wrote it.
    - "an add_handler before the failed step whose layer is visible runs before the re-attempt" asserts this attempt
      order: start, act failed, handler `step-1` succeeded, handler `end` succeeded, act succeeded, end. It also
      asserts the handler execution `["before","act","resume"]`, the presses `act, close, act`, and that the saved
      patch holds `{fact:"visible",op:"visible",target:{selector:"#layer"}}`.
    - "refuses at apply a handler whose condition compares something it names only in its own words, and records
      why" asserts the answer is `none` with the words above, that the receipt has `issueCodes:
      ["recovery.fact_kind_unread"]`, and that no adaptation was recorded.
  - `R/recovery/annotation/tests/step-evidence-resolution.test.ts`: one existing expectation changed. A completion
    check `{fact:"visible", op:"absent"}` is now saved as `{fact:"absent", op:"absent"}`. The web domain answers the
    old shape `unsupported`. I added one test for kinding and refusal at resolution; the refusal happens before the
    domain is asked.
  - New `R/recovery/annotation/tests/patch-fact-kind.test.ts`: unit tests for the module.

## Commands run and observed results

- **Both acceptance tests fail without the fix.** I temporarily replaced the new call with a pass-through, ran the
  tests, then restored the file from a scratchpad copy.
  - Command: `pnpm exec vitest run …/service/runtime-session/tests/in-run-repair.test.ts -t "held to what the run can
    read"`.
  - Output: "an add_handler before …" failed with "expected 'failed' to be 'succeeded'". "refuses at apply …" failed
    with "expected { kind: 'overlay', …(4) } to deeply equal { kind: 'none', …(1) }". 2 failed.
- **With the fix,** the same file: 17 passed.
- `pnpm test src/programs/automation-studio/runtime/recovery/annotation src/programs/automation-studio/runtime/service/runtime-session/tests`
  (from `C/packages/fluxiq`): Test Files 31 passed (31), Tests 274 passed (274). The real-sql group matched nothing
  there.
- `pnpm exec vitest run runtime/tests/in-run-repair runtime/executor/lifecycle-run/tests/in-run-repair.test.ts
  runtime/service/runtime-session/tests/interruption-learning.test.ts`: 3 files, 26 passed. This includes the
  real-sql `service-proofs.test.ts`.
- `pnpm exec vitest run runtime/recovery/annotation runtime/live-patch` (before the expectation update): only the
  expected `{fact:"visible",op:"absent"}` expectation failed; 167 passed.
- `pnpm check` (`C/packages/fluxiq`):
  - First run: exit 2, from `flow-bootstrap/candidate/submission.ts(229,155): error TS2872`. That file is not mine;
    another worker had work in flight there.
  - Final run: exit 0.
- `pnpm structure:check` (from `C`): 6 violations, all under `runtime/flow-bootstrap/` and none in my files:
  - `directory-files`: `candidate/`, `candidate/tests/` and `subflow-candidate/tests/`.
  - `file-lines`: `trial-gate.ts` and `subflow-trial-gate.ts`.
  - `imports`: `tests/explored-interruptions.test.ts`.

  My files raise no warning. `in-run-repair.test.ts` is exactly 400 lines; the advisory threshold is above 400.

## Not verified

- No live or Lab run, and no model call, per the brief. The claim that playback would pass with the dock handled
  rests on the provider-free reproduction alone.
- The extension's page-side `visible` of `body > fl-dock` is inferred from the fixture's style (a fixed, block,
  shadow-hosted panel with area). No browser judged it.
- The model may still write prose `fact` in conditions with no target, such as a dialog. Those are left as written
  and would still read `unknown`.

## Open questions or contradictions found

- **The brief's refusal premise contradicts the evidence.** The layer-line handle `t275` resolves, and naming the
  layer is correct. I did not implement "refuse a `when` naming a layer line". If the supervisor still wants
  handlers kept to controls only, that is a separate design decision. In this run it would have refused the right
  fix.
- **Suggested edit outside my paths.** `R/llm/harness/runtime-patch-schema.ts:175` describes `fact` as "What the host
  observes, in the host's own terms, as the evidence shows it." That invites a label. Suggested replacement, generic:
  `"The kind of check, as one word and never a description: for a control named in target, the op itself (exists,
  absent, visible, enabled, count), or text or value when the op compares its shown words or a field's value."`
  Core now corrects or refuses the control case at apply either way.
- **Possible defence in depth in the domain.** `domain/src/runtime/facts/query.ts` `claimFor` could read a presence
  op with an unknown `fact` as the op's claim. Not needed after this fix, and not done.
- **Stale sentences** (docs not edited):
  - The debug note `docs/working/language-driven-flow-loop-plan/debugs/run-mvskptb1-c9cef4fe.md` lines 93-97, 212-219
    and 315-318 name `t275` as the likely cause and say the cause is not verified.
  - In `docs/reference/framework-reference.md` (generated), the `AutomationStudioFlowBootstrapFactCondition` row says
    "Core never interprets `fact`". That is still true of the plan type. An in-run repair's condition about a control
    now has `fact` written from its `op` by Core.
