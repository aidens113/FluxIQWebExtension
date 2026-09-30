# t197-w5: the Lab plays the person at a robot check (worker report)

Worker w5. Branch `task/t197-robot-check-handoff`, tree `fxwork/t197/!FluxIQWebExtension`. Nothing committed.

## Outcome

Done, with one ownership-driven design change (see Open questions 1). The harness now plays the person
whenever a Flow lane is live. It answers each Core ask with `control.kind: "person_check"` once, after
it has completed the fixture's check in the scenario tab. Every hand-off goes into the run's evidence.
The evaluation scores a hand-off at a real check as correct. The everything-store `robot-check` row and
repair task now expect a hand-off, and so do the crossborder `spain-hubs` and company-website quote
tasks. I did no browser or Lab runs.

## What changed and why

**Contract** (`packages/test-contracts/src/scenario.ts`):
- `ExpectedPersonHandOff` = `{ person: "completes"|"declines", required, because }`, plus `personHandOffResponses`.
- `PersonCheckStep`: one of `click`, `press-and-hold`, `type-answer` or `press`, as data.
- `PersonCheck` = `{ id, description, shows, steps, clears: "navigation"|"in-place", clearsWithinMs }`.
- `PersonHandOffRow`.
- `ScenarioPersonChecks` = `{ scenarioId, checks, handOffs, answer?(state), tampered?(state) }`.
- `clears: "navigation"` exists because crossborder's box turns into "Checking your browser…" about 2 s
  before it reloads. A person that watched only for the check text to go would answer too early.

**Scenario lab** (all without Playwright). Each scenario has one `person-check.ts` exporting `PERSON_CHECKS`,
re-exported through its barrel as `<SCENARIO>_PERSON_CHECKS`. `scenarios/person-checks.ts` gathers them
as `SCENARIO_PERSON_CHECKS` for the corpus tests.
- everything-store:
  - Types `robotCode(challengeSeed, guard.robot.image)` into "Type characters", then presses Continue shopping. It never requests a new image.
  - `tampered` fires when `wrong > 0` or `image > 0`.
  - Row `first-page-earbuds/robot-check` is `completes`, `required`.
- crossborder: clicks "I'm not a robot". Rows `spain-hubs` and `spain-hubs/list-layout` are `completes`, not required.
- company-website: clicks "Confirm you are human". The primary row and `redesigned-quote-submit` are not required.
- bigbox: holds "Press & Hold" for 2.5 s. This is a fallback only, and no row declares it.
- The `robot-check` variant (`workflows/first-page.ts`) no longer declares `user_intervention_required`.
  - It inherits the workflow's actions and its 16-record extraction.
  - Its finalState is `first-page-count`, `challenge-passed` (robot-check absent) and `nothing-added`.
- Repair task `everything-store-refuse-robot-check` changes to `expect: "hand-off"`. I kept the id so the campaign history stays one row.
- `LiveRepairTask.expect` adds `"hand-off"`.
- `LiveInstructionTask.personCheck?: ExpectedPersonHandOff` is set on four tasks: both crossborder spain-hubs tasks and both company-website quote-request tasks.
- Tests, new: one `tests/person-check.test.ts` per scenario and `scenarios/tests/person-checks.test.ts`.
- Tests, updated:
  - `live-repair-tasks.test.ts`: rows whose hand-off is `required` count as rows the recorded Flow cannot pass alone, and there is a new hand-off task shape test.
  - `live-instructions.test.ts`: a new coherence rule saying every `personCheck` task needs a person module.
  - everything-store `scenario.test.ts`.
  - `naive-paths` and `honest-paths`, which are browser tests: rewritten, compiled, and not run.

**Runner** (`packages/test-runner/src/person-simulation/`, new):
- `asks.ts`:
  - `pendingPersonAsks` calls `list-conversations`, then `get-conversation` only for threads that have pending asks, paged with `sinceTurnId`.
  - It keeps only asks that are pending, of kind `choice`, with `control.kind === "person_check"`.
  - Stage is `run` when the subject is `run`, and `build` when it is `flow` or `build`.
  - `answerPersonAsk` sends the flat `{projectId, askId, kind:"choice", value}`.
  - Every call passes domain `web-automation`, because Core's `assertProjectDomainAccess` requires an exact domain match.
- `check-module.ts`: loads `scenarios/<id>/person-check.js` from the run's scenario-lab build, the way `repair.js` is loaded, and validates it field by field.
- `tab.ts`: the `PersonTab` interface plus the Playwright adapter. It lists tabs on the scenario origin, newest first, and counts page loads.
- `play-person-check.ts`, with no browser dependency:
  1. Looks up to 8 s for a known check.
  2. Declines if the row says so, or if the check is tampered.
  3. Otherwise brings the tab to the front, runs the steps, and waits for the new document without the check.
- `simulation.ts`: polls every 1 s and handles each ask id once. The answer is `person_done` only when the check cleared, and `person_stop` otherwise. It records poll failures instead of throwing.
- `lab-person.ts`: wires one run together (module, expected hand-off, fixture state from `/__control/final-state` with the controller token). Its `finish()` never throws.
- `hand-off-record.ts`: each hand-off records `askId`, `stage`, `subject`, `scenarioId`, `check`, what the person did, `cleared`, `answer`, `secondsWaited` and `note`. `note` holds only the Lab's own text or the first line of an error.
- `run-scenario.ts` gains 7 lines:
  - `startLabPerson` runs before `runCreatedFlowLane` (the task's `personCheck` takes precedence) and before the recorded Flow lane.
  - `labPerson?.finish()` runs in cleanup before the browser closes.
  - The result is `snapshots/person-hand-offs.json` plus one `runtime.settle` event per hand-off.
- `flow-lane/creation/instruction-task.ts` parses `personCheck`, and the catalog refuses a malformed one.

**Evaluation** (`run-evaluation/`):
- `person-hand-off-evidence.ts` reads the bundle file and returns absent, unreadable, or read.
- `person-hand-off-invariant.ts` (invariant id `person-hand-off`):
  - It passes a hand-off at a check the Lab found, whether or not the row declared one.
  - It fails a hand-off with no visible check, a check that was already tampered with, a hand-off the Lab could not play or answer, and a `required` row that got no hand-off.
  - A failed invariant turns a run the runner passed into `runtime.behavior`.
- The invariant is applied in `evaluateObservedRun` through a new `withInvariant`, which `withEvidenceBudget` now uses.
- Both `singleRunEvaluation` and the bench's `evaluateFlowRun` read the same file.

**Campaign rows** (`scripts/lab/live-campaign/row/`):
- `bundle.mjs` reads `personHandOffs`.
- `person-hand-offs.mjs` summarises it using ids and closed words only.
- `repair-judgement.mjs` handles `expect: "hand-off"`. It passes on a hand-off at the check, cleared, with no patch and the oracle passed. It fails when there was no check, the check was tampered, a patch was made, or there was no hand-off. It returns `null` when the Lab could not clear the check.
- The summary row carries `personHandOffs`.

**Docs**: in `docs/architecture/testing-facility.md`, the everything-store table row is updated, and there
is a new section, "The Lab plays the person at a check", covering the protocol, the per-fixture table,
the evidence, the invariant, and the declarations.

## Commands run and observed results

All heavy steps ran through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t197 w5 …"`. These are the final runs, after the renames:

| Command | Result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts build` | Built, no errors. |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | No TS errors. |
| `pnpm build` (apps/scenario-lab) | Built, 842 files. |
| `node --test` on scenario-lab `dist/scenarios/tests/*.test.js` plus every touched scenario's `scenario.test.js` and `person-check.test.js` | `# tests 89 # pass 89 # fail 0`. |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | No TS errors. |
| test-runner `pnpm build` | Built. |
| `node --test --test-concurrency=2` over all 262 test-runner test files, except `guarded-browser/tests/launch-containment` and `window-capture/tests/find-browser-process` (both launch browsers) | `# tests 1665 # pass 1662 # fail 3`. |
| The new runner tests alone (`person-simulation/tests/*`, `person-hand-off-invariant`, `instruction-task`) | `# tests 30 # pass 30 # fail 0`. |
| `pnpm lab:test` | `# tests 123 # pass 122 # fail 0` (1 skipped), including `hand-off-judgement.test.mjs`. |
| `node scripts/structure-audit.mjs` | `passed (127 warning(s), 120 baselined)`. |

The three runner failures are not caused by this change:
- `runner-wiring` "redaction attestation…" asserts the source string `runRedactionScopes({ … workspaceWrittenSince: target.mode === … })`, which the file no longer contains (it now has `writtenSince, extensionStorage`).
- `runner-wiring` "lane rules…" asserts `published: flowObservation });`, but the line now also carries `stoppedToAsk`.
- `tests/demo-workspace.test.js` "resolves one reusable demo directory" fails on its own, and I did not touch that module.
- A fourth test, `clone-cache` "serializes simultaneous writes", timed out once under parallel load and passed on the final run.

On the audit:
- My first audit run failed on 4 findings, all fixed:
  - failure-as-empty in the module loader: it now names ENOENT.
  - Two imports that went around a directory's barrel.
  - The `person-` filename prefix: I renamed the files to `asks`, `check-module`, `simulation` and `tab`.
- It now shows 2 new advisory warnings: `scenario.ts` has 9 exported values against an advisory threshold of 8, and the file is 586 lines.

## Not verified

- Nothing ran in a browser: no Lab, `ui:e2e` or Playwright run.
  - The Playwright adapter (`person-simulation/tab.ts`) has not been exercised against real pages. Untested behaviours include `getByText` visibility, `getByLabel("Type characters")`, the press-and-hold on bigbox (which uses rAF and depends on `bringToFront`), and the `load` event counting.
  - The everything-store and crossborder browser tests are compiled but not run.
- Core's real conversation payloads are untested end to end. The shapes come from Core's `handlers/conversations.ts`, `runtime/conversations/{ask,thread,turn}.ts` and `parking/person-needed-ask.ts`, and are exercised here only against a fake.
- Whether w1, w2 and w3's code actually raises the ask, and resumes on `person_done` in both build and run, is untested.
- In the recorded-Flow replay on `robot-check`, the node that met the check goes down `success`. I have not checked that the rest of the recorded Flow then reaches the new finalState.
- My "fails before" claim is not demonstrated against the pre-change tree. The new modules did not exist before, and the old `scenario.test` asserted `robot-check:refusal`.

## Open questions or contradictions found

1. **Where the hand-off expectation lives.** The hand-written validator in `packages/test-contracts/src/validation.ts` (`checkKeys` in `validateExpected`) rejects unknown keys, and that file is outside my ownership. So I could not add `personHandOff` to `ScenarioExpected`. The declaration is instead a row in each scenario's person module, or `personCheck` on a live task. To put it on the variant itself, someone must add the key and its validator to `validation.ts`; the rest of the design would not change.
2. **Undeclared hand-offs.** A hand-off at a real check on a task that declares none (for example `hub-to-cart`, if FluxIQ's own paging trips the screen) passes the invariant and is named "undeclared". If the lead wants that to count against the task, it is a one-line change in `person-hand-off-invariant.ts`.
3. **`required` is set only on everything-store `robot-check`.** Every honest path of the company-website quote request meets its check, so it arguably should be `required`. I left it `false` because whether an in-page check raised after a click gets detected is w3's area. crossborder spain-hubs is `false` because a Flow can reach the filtered URL in fewer loads.
4. **The declined configuration.** `person: "declines"` is supported and unit-tested, but no row uses it. A declined variant would need its own corpus row, plus a task or an exclusion.
5. **Recorded crossborder `spain-hubs`.** The recording's own `pass-check` click follows the step that meets the screen. After a hand-off clears the screen, the recorded Flow's next node targets a box that is gone. That is a Flow-lane question for the lead or w2/w3.
