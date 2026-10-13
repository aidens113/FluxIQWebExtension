# t483 replay-through-launch-session: worker report

## Outcome

Partial. All the owned work is done and its tests pass. One test I do not own now fails, as the brief's change predicts:
`guarded-browser/tests/fresh-extension-worker.test.ts:48` still lists `saved-flow-replay/replay-browser.ts` as a known
persistent-Chromium launcher. The replay no longer launches Chromium itself, so the fix is one line: remove
`"saved-flow-replay/replay-browser.ts"` from that array. The forget step still runs for the replay through
`launchBrowser`, which the same test already covers. The brief told me to stop rather than edit another file, so I did not edit it.

The coordinator's mid-task addition (a rejected candidate trial recorded `verdict: null`) is done, with fail-first tests.

## What changed and why

- **(B)** `packages/test-runner/src/saved-flow-replay/replay-browser.ts`: `openReplayBrowser` now starts the browser through `launchExtensionSession`,
  imported from `../run-scenario/index.js`. That gives the replay:
  - the containment switches and the forgotten cached workers (`launchBrowser`);
  - the guard installed before any page;
  - worker-stage details from `extensionControlPage`;
  - the t455 one-time close and relaunch;
  - `serviceWorkersProven()` and `assertNoViolations()` awaited before pairing.

  It tracks the last context through `onLaunched` and closes it on any start or pairing failure. Pairing (`pairScenarioExtension`,
  `activateScenarioTab`) and the scenario tab order are unchanged; they moved into a private `openPairedScenario`. The provider-free
  guarantees are unchanged: `launchBrowser` strips provider secrets from the browser environment, and nothing in `replay-saved-flow.ts` changed them.
  New optional `input.trace` and test-only `seams` (`session` fakes passed into the real `launchExtensionSession`, `probeProfile`,
  `openScenario`). The signature still works for `recovery-matrix/run/run-matrix-case.ts`.
- **(A)** New file `saved-flow-replay/receipt-error.ts` (`replayErrorOf`) returns `{category, message, details?}`, where `details` is
  `extensionStartFailureDetails(error)`. `replay-saved-flow.ts` uses it in the catch, and `SavedFlowReplayResult.error` is
  `ReturnType<typeof replayErrorOf> | null`. **Renamed from the brief's `replay-error.ts`**: the structure audit's `naming` rule fails
  on three `replay-` files in one directory. The test file is `tests/receipt-error.test.ts` for the same reason.
- **Trace and sidecar**: `replaySavedFlow` creates an `ExtensionStartTrace`. Its screened secrets are the controller token, the
  authorization password, the credential password, PIN and TOTP, and the secret-input values. After the browser closes, it writes the trace
  with `writeExtensionStartSidecar` to `<runs>/replays/<replay-id>/extension-start.local.json`, on success or failure, best-effort. That function
  fixes the filename inside a directory, so the trace sits in a directory named by the replay id, beside the receipt.
- **(C)** New file `saved-flow-replay/profile-handover-probe.ts` (`profileHandoverProbe`) records `{lockfile: boolean, sinceLastWriteMs: int|null}`. It reads the
  newest mtime among the direct entries of the profile root and `Default/`. ENOENT and ENOTDIR count as absent; any other read error propagates.
  `openReplayBrowser` marks it as `browser.profile-handover` before the launch, because `forgetCachedServiceWorkers` writes to the
  profile. A probe that throws is recorded as `{unavailable: <errno code>}` and never stops the replay.
- `guarded-browser/tests/launch-containment.test.ts`: removed the replay from `SANCTIONED`. It now asserts that the replay matches no `LAUNCH`,
  contains `await launchExtensionSession(` before `newPage(`, and has no `installDeterministicNetworkGuard(` or `awaitExtensionWorker(` of its own.
- `saved-flow-replay/index.ts`: exports the two new modules.
- `docs/architecture/testing-facility.md`: one new paragraph in "Replaying a saved Flow" (session path, receipt `details`,
  sidecar path, probe).
- **Coordinator addition**, in `flow-lane/creation/candidate-outcome.ts`:
  - `CreatedFlowCandidateTrialRun.verdict` now also allows `"rejected"`, and the type gains `reason: string | null`.
  - In a promotion, every trial other than the promoting one gets a definite verdict:
    - `execution_failed` when its run did not succeed. Core's `candidate-trial/run.ts` gives exactly that verdict to any non-succeeded run. The reason is the trial's code, or `candidate.trial_<execution>`.
    - Otherwise `rejected`, with the reason `not_promoted`.
  - Sessions read elsewhere keep `verdict: null, reason: null`. The failed-build path's named-only trials take their Core code as the reason.
  - Tests: `tests/lane-candidate.test.ts` replaces the round-6 and direct-build expectations that pinned `null`, and adds a test for a
    succeeded, a cancelled and an unwritten trial. `tests/candidate-draft.test.ts` adds `reason: null` to a literal.

## Commands run and observed results

All were run in `packages/test-runner` of the t483 tree.

- Fail-first (replay): `npx tsc -p tsconfig.json` reported errors that the new modules and the `trace` and `seams` parameters did not exist.
  `node --test` on the three new test files gave `ERR_MODULE_NOT_FOUND` for the probe module. The old `openReplayBrowser` ignored the
  seams and launched a real headed Chromium on `./unit-profile`, so the run hung and I stopped it. I then checked that no process still
  referenced `unit-profile` and removed the stray directory.
- Fail-first (candidate): after editing the tests, `node --test dist/flow-lane/creation/tests/lane-candidate.test.js` gave `not ok 5, 6, 7`
  and `# fail 3`. tsc reported that `reason` does not exist on the trial type.
- `npx tsc -p tsconfig.json` (typecheck and build): exit 0.
- `node --test dist/saved-flow-replay/tests/*.test.js dist/guarded-browser/tests/*.test.js`: `# tests 43, # pass 42, # fail 1`. The one
  failure is `fresh-extension-worker.test.ts`: "saved-flow-replay/replay-browser.ts is found as a persistent Chromium launch" (see Outcome).
- Earlier, the same run plus `run-scenario/browser-session/tests/launch-extension-session.test.js` gave 49 tests, 48 passing, with the same single failure.
- `node --test dist/flow-lane/creation/tests/*.test.js dist/flow-lane/creation/chat/tests/*.test.js`: `# tests 167, # pass 167, # fail 0`.
- `node scripts/structure-audit.mjs` (repository root): `structure-audit: passed (187 warning(s), 646 baselined)`. The first audit run
  failed on `as-never`, `failure-as-empty`, `naming` and `statement-packing`; all four were fixed.

## Not verified

- No live replay, Lab or provider run, as the brief instructs. Not verified live:
  - that the real `launchExtensionSession` path pairs a replay;
  - that the sidecar file is written;
  - that the probe reads a real Chrome-held `lockfile` on Windows.
- `recovery-matrix` now also goes through the session path, since it calls `openReplayBrowser`. Its tests were not run.
- No full suites were run.
- The documentation does not yet describe the candidate trial `verdict`/`reason` change. The docs are owned only for the replay section.

## Open questions or contradictions found

- The brief named `replay-error.ts`, which the structure audit's naming rule forbids next to `replay-browser.ts` and
  `replay-saved-flow.ts`. I used `receipt-error.ts`. The alternative is a `saved-flow-replay/replay/` subdirectory, which would move
  files that unowned tests reference by path.
- `fresh-extension-worker.test.ts` needs the one-line removal described in Outcome. The supervisor should apply it before merging.
- `"rejected"` is a verdict the Lab adds; Core's `AutomationStudioCandidateTrialOutcomeVerdict` has no such member. It covers a
  succeeded trial whose judge answer the Lab cannot read: Core's session metadata carries no verdict. If Core should publish each
  trial's verdict on its session, the Lab could record that verdict instead. That is a Core change.
- `createdFlowCandidateDraftFailure` details still omit per-trial verdicts. The draft paths still leave their non-deciding trials `null`.
  I left them alone because the addition named the promotion path (line 97).
