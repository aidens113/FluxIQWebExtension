# t197-w4: domain marks robot-check calls `personNeeded`

## Outcome

Done. When a build-loop node call meets a robot check (`USER_INTERVENTION_REQUIRED`), its
execution result now carries `personNeeded: true`, and its draft is the step as it would stand once
the check is cleared. `resultCode` and `resultReason` are unchanged. Replay answers carry the flag
too. The failure taxonomy documents the parking behaviour.

## What changed and why

- `domain/src/runtime/llm-evidence/action-failure/refusal.ts`: `WebActionRefusal.personNeeded?: true`.
  It is set only for failure code `USER_INTERVENTION_REQUIRED`, through the new exported
  `webActionNeedsPerson(result)`. `AUTH_REQUIRED` still maps to `needs_person` but is not flagged,
  because Continue cannot clear a sign-in. The key is absent, never `undefined`: an existing
  deep-equal test (`refusal.test.ts` "every failure code...") needs it that way.
- `tool-rejection.ts`: `RecoverableToolRejection` takes a 4th constructor argument,
  `personNeeded?: true`. The `needs_person` doc now says a robot check never reaches the model and
  that Core asks the person instead. No model-facing text told the model to retry a check, so no
  wording change was needed beyond that.
- `capture.ts`:
  - `personNeeded?: true` added to `WebLlmEvidenceToolExecution` and to
    `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`. Core's `evidence-loop-decision.ts:72` allow-list
    already has `personNeeded` (checked after w1 landed).
  - New `withPersonNeeded(execution, draft)` sets the flag and replaces the draft (or removes it).
  - `captureEvidence`: a capture that fails with `USER_INTERVENTION_REQUIRED` now throws
    `needs_person` with `personNeeded`. It used to throw `page_unreadable`.
  - `pageRefusal` passes the flag through.
- `node-run/run.ts`:
  - The call record gains `standing` (`input`, `ranWith`, `replay`), written just before the
    command goes out. After a successful command, `replay` is updated with that command's payload.
  - The catch block wraps any rejection that has `personNeeded` with `withPersonNeeded(refused,
    personDraft(record))`.
  - `personDraft` covers two cases:
    - The command went out (a navigation or press that met a check, or a successful press whose
      next look showed a check): `actionId`, the node's effect (`mutate` for navigate and click),
      `input`, `ranWith`, `proposes` (the node's, which is true), and `replay.from`. `from` is the
      page it was on, or the start location for a first navigation from nowhere.
    - Nothing went out (a look, or the look an action takes before acting): `effect: "observe"`,
      `proposes: false`, and no `ranWith` or `replay`.
  - The start-location path (`new RecoverableToolRejection(... webStartLocationRefusal ...)`) now
    passes the flag too.
- `node-run/replay.ts`: a replayed step that fails `USER_INTERVENTION_REQUIRED` keeps
  `core.replay.failed` and adds `personNeeded` with no draft. A reset that does the same keeps
  `core.replay.reset_failed` and adds `personNeeded`.
- `structure/detect.ts` and the detection catch in `tools.ts`: a detection capture that meets a
  check is flagged `personNeeded` and proposes nothing.
- `tools.ts` `captureStateDigest`: a check page now answers `undefined` (unobserved) instead of
  throwing, so Core's digest hook does not fail the step.
- New test file `node-run/tests/person-needed.test.ts` with 10 tests.
- `docs/architecture/failure-taxonomy.md`: new section "A Robot Check Parks, It Does Not End". It
  covers the Continue/Stop ask, checks that clear themselves being waited out by the extension, the
  build and run behaviour, replay, and why `AUTH_REQUIRED` is excluded.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/domain check`: exit 0 on the final tree. The first run
  failed with TS2345 because `present<>` needs every key; fixed by passing `personNeeded:
  undefined` in `toolExecution`.
- `DOMAIN_TEST_BUILD_LABEL=t197w4 bash .../heavy.sh "t197 w4 domain test" pnpm --filter
  @fluxiq-web-extension/domain test`:
  - First run: 949 tests, 948 pass, 1 fail (the `refusal.test.ts` deep-equal on
    `personNeeded: undefined`). Fixed.
  - Final run: `# tests 949 / # pass 949 / # fail 0`, exit 0.
- Fail-before check: the 7 changed `domain/src` files were temporarily restored from `HEAD`
  (`git show HEAD:<file> > <file>`), keeping the new test file, and the tests run: `# pass 941 /
  # fail 8`. All 8 new person-needed tests failed; the 2 "ordinary failures unchanged" tests
  passed. The files were copied back, and check and test were re-run with the results above.

## Not verified

- Live or browser behaviour. No Lab run was made.
- Whether Core's build loop honours `personNeeded` end to end (w1's side). Only its parser
  accepting the key was seen.
- Whether the extension fails `web.dom.capture_snapshot` with `USER_INTERVENTION_REQUIRED` on a
  check page. Today it appears to capture successfully (`apps/extension/src/runtime/action-runner.ts`).
  Until w3 makes it fail, only navigations and presses produce the flag; the look path is ready
  for when it does.

## Open questions or contradictions found

- Replay gap (item 3): Core's dry run reads only `resultCode`
  (`flow-draft/dry-run.ts:194`, `node-tools/replay.ts:104`). A replay answer that carries
  `personNeeded` is therefore still judged `failed` or `reset_failed` until Core's replay side
  reads the flag. The domain half is done.
- Harness options (`llm-evidence/harness-options/execute.ts`, the run-time repair tools) were left
  unchanged. Their refusals still reach the repair model as `needs_person` with no `personNeeded`.
  Per the design, w2's executor synthesizes the ask from the node attempt's category. If the
  harness should also flag it, that is a follow-up.
- `captureAfterAction` used to retry only `page_unreadable`. A check after an action is now raised
  at once rather than retried for 5 s. That is intended, because the extension waits out checks
  that clear themselves.
- A brief ambiguity: "effect mutate for an action" when the action never went out, because its
  look before acting met the check. I report `observe` / `proposes: false` there, since nothing was
  done.
