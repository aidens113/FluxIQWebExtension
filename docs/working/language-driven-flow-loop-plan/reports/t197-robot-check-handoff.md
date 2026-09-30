# t197: robot-check hand-off (lane report)

Lane lead report. Branch `task/t197-robot-check-handoff` in both trees
(`fxwork/t197/!FluxIQ`, `fxwork/t197/!FluxIQWebExtension`). Evidence:
`reports/robot-check-behaviour.md` (dev tree).

## Fix log

- 2026-09-30, lead: fixed the shared contract before dispatch.
  - Core `runtime/parking/person-needed-ask.ts` (new, exported from `parking/index.ts`): the one
    person-needed ask. Kind `choice`, options `person_done` "Continue" (route null, so `granted`,
    `success`) and `person_stop` "Stop" (route `failed`), `parks: true`, `onTimeout: "deny"`,
    timeout capped at 300 s, and `control.kind: "person_check"` as the marker for surfaces and
    the Lab. Text: "FluxIQ needs you: complete the check on this page, then press Continue."
  - Core `runtime/llm/evidence-loop/tool-execution.ts`: `personNeeded?: true` on a build tool
    result. When set, Core asks instead of showing the model the failure. On Continue the call
    stands with its `draft`, and a fresh look replaces its evidence. Otherwise the build ends
    `flow_bootstrap.user_intervention_required`.
  - Validation: `npx tsc --noEmit -p .` in Core `packages/fluxiq` printed no errors.

- 2026-09-30, round 1, workers landed (all verified by the lead, see Validation):
  - w1 (Core build): `flow-bootstrap/person-needed.ts` wraps the build's executor (after the permission gate). A
    `personNeeded` result is never shown to the model. The ask goes to the Flow's thread and the build waits. On
    Continue, the step stands with the domain's draft, and the evidence becomes `{personCompletedCheck, note, now:
    <fresh look>}`. On Stop, a timeout, no thread, or more than 3 asks, the build ends
    `flow_bootstrap.user_intervention_required` (issue `person_needed.stopped|timed_out|no_thread|cancelled|asks_exhausted`).
    Dry-run replays and `amend_draft` reruns go through the same wrapper, and a cleared replay counts as
    `core.replay.replayed`. `run-node.ts` now says a check goes to the person. `activity/ask.ts` shows
    `waiting_permission` with the ask text. apps/web gets one message line each in two authoring panels.
  - w2 (Core run): `executor/person-needed.ts`. A failed attempt with category `user_intervention_required` and
    no ask of its own gets the person-needed ask, but only when a parking port is bound. The existing parking
    then carries it, in place or durably. Continue goes down `success`. Stop or a timeout follows an authored
    `failed` edge if there is one; otherwise the run ends failed with "a person was needed at step …", keeping
    the category and code. At most 3 asks per run. Nothing is written to `values.answer`.
  - w3 (extension): checks are classified by wording as person-only or self-clearing. Self-clearing checks are
    waited out in place, for at most 15 s and never by reloading. A same-address navigation onto a tab showing a
    check is held, not reloaded. A click that lands on a check, or a press that raises one in place
    (company-website), fails `USER_INTERVENTION_REQUIRED` with the press recorded as made. The chat header shows
    Core's ask text.
  - w4 (domain): a `USER_INTERVENTION_REQUIRED` call sets `personNeeded`, with a proposing mutate draft for a
    navigation or press, and nothing proposed for a look. The model-facing wording no longer invites acting on a
    check. `failure-taxonomy.md` is updated.
  - w5 (Lab): `packages/test-runner/src/person-simulation/**` plays the person on any `control.kind:
    "person_check"` ask during build and run. It completes the fixture's check: crossborder box, company-website
    box, everything-store code from `robotCode`, bigbox hold. It then answers `person_done`, and records
    `snapshots/person-hand-offs.json` plus events. The everything-store `robot-check` variant now expects the
    hand-off (required) and then the ordinary result. crossborder spain-hubs and company-website quote-request
    expect a hand-off without requiring one. The hand-off invariant is judged in run-evaluation and in the
    campaign rows. `testing-facility.md` is updated.

## Design (binding for workers)

- **Build.** A person-needed tool result never reaches the model. Core parks on the ask. After
  Continue, the step stands (a navigation or a press did happen, and the person cleared the
  obstacle behind it) and the model is shown a fresh look. After Stop, a timeout, or no thread,
  the build ends `flow_bootstrap.user_intervention_required`. `run-node.ts` no longer says "a
  failure ends nothing" for this case.
- **Run.** A node attempt that fails with category `user_intervention_required` and raised no ask
  of its own gets the person-needed ask synthesized as its ask effect. From there the executor's
  existing parking takes over: Continue goes down `success` and the next node reads the page
  fresh; Stop or a timeout goes down `failed`, with a clear person-needed ending.
- **Extension.** Checks are read as either person-only or self-clearing. A self-clearing check is
  waited out in place: no reload, and at most about 15 s. One that does not clear becomes
  person-only. A navigation or a click that lands on a person-only check reports
  `USER_INTERVENTION_REQUIRED`, never success. A same-address navigation onto a tab already
  showing a check does not reload it.
- **Domain.** A failed call whose code is `USER_INTERVENTION_REQUIRED` sets `personNeeded` and
  describes the step as it would stand once cleared.
- **Lab.** The harness plays the person. When a pending ask has `control.kind === "person_check"`,
  it completes the fixture's check in the scenario tab the way a person would, then answers
  `choice: person_done`. The evaluation counts a hand-off at a real check as correct behaviour.

## Workers

| Worker | Area | Report |
| --- | --- | --- |
| w1 (worker-high) | Core build loop | `reports/t197-w1-core-build.md` (Core-side notes in this tree) |
| w2 (worker-high) | Core run executor | `reports/t197-w2-core-run.md` |
| w3 (worker-high) | Extension | `reports/t197-w3-extension.md` |
| w4 (worker) | Domain mapping | `reports/t197-w4-domain.md` |
| w5 (worker-high) | Lab person and evaluation | `reports/t197-w5-lab.md` |

## Validation

Run by the lead on 2026-09-30, after all five workers had finished:

- Core, `npx vitest run --poolOptions.threads.maxThreads=2` over the person-needed tests (flow-bootstrap,
  service-bootstrap), permission-ask, executor, activity, parking, llm/node-tools, and
  conversation-parking: "Test Files 32 passed (32), Tests 374 passed (374)".
- Core, `heavy.sh ... pnpm --filter fluxiq check`: tsc exit 0. `node scripts/structure-audit.mjs`: "passed
  (197 warning(s), 354 baselined)".
- Downstream, `heavy.sh ... pnpm check`: EXIT=0.
- Extension, `EXTENSION_TEST_BUILD_LABEL=t197lead heavy.sh ... extension test`: "# tests 1384 # pass 1384
  # fail 0".
- Domain, `DOMAIN_TEST_BUILD_LABEL=t197lead heavy.sh ... domain test`: "# tests 949 # pass 949 # fail 0".
- Lab, after the scenario-lab and test-runner builds (exit 0), `node --test`:
  - the scenario-lab person-check, live-instructions and live-repair-tasks tests: 26/26;
  - test-runner person-simulation, the hand-off invariant and instruction-task: 30/30;
  - everything-store person-check: 4/4.
- Fail-before is the workers' claim (w1 4/4 fail against HEAD service.ts; w2 12/14; w3 per area; w4 8
  new fail at HEAD). The lead did not re-run tests against HEAD.

## Not verified

- **No browser check was run.** `lab-slots/ui-1` was free, but three live runs held slot-2, slot-3 and
  slot-4, and free RAM was 3.8 GB, then 2.7 GB, below the 4 GB floor for a provider-free run. The command
  for the next round:
  `FLUXIQ_LAB_INSTANCE=ui-1 FLUXIQ_TEST_ENV_FILES=none pnpm lab run everything-store --target isolated --flow --workflow first-page-earbuds --variant robot-check`.
  Whether the Flow lane records usefully with the variant armed from the start is itself unverified.
  - As a result, the Playwright person (`person-simulation/tab.ts`), Core's real conversation payloads, and
    the end-to-end ask, answer and resume path are exercised only against fakes.
- Recovery exploration and the run-time repair tools are not wrapped. A check met while exploring still
  reaches the repair model as `needs_person`, and exploration records it `refused`. Core's run now parks at
  the node first, so the ladder does not run on a check node.
- w3 narrowed page-scope challenge gating to person-only checks. A missing target under a self-clearing
  cover that never clears is retried as `TARGET_NOT_FOUND` instead of being handed over.
- w3's in-page watch probably misses local-classifieds' pushState feed cover. The cover lifts by itself in
  2.5 s.
- `packages/test-contracts/src/validation.ts` has no `personHandOff` key. The hand-off is declared in each
  scenario's `person-check.ts` and in `LiveInstructionTask.personCheck` instead.
- Stop on a person-needed ask follows an authored `failed` edge when the Flow has one, rather than always
  ending the run.
