# w2x-creation-permission-lost

Worker report, 2026-09-21. Task t047. Paired worktrees `F:\fxwork\t047\!FluxIQWebExtension`
(facility `9617103`) and `F:\fxwork\t047\!FluxIQ` (Core `510680f`), both on
`task/t047-creation-permission-lost` at t027's tip. t036 was **not** merged: no run needed
`--llm-permit`. All changes are uncommitted.

## Outcome

**Partial.** The brief's premise did not reproduce, and the bare 400 has a different cause, now fixed.

1. **On t027's tip, the no-permit build of `social-scheduler-schedule-post` does not ask for
   permission at all.** It made 5 calls, created the Flow, and the Flow passed the oracle
   (`run-mubm8pnc-e274469e`). There was no permission request to lose.
2. **The t036 `lab.generation_http_400` is most likely not a lost permission request.** The
   Core handler's *success* path bounds a build's accounting by one request's ceiling (64,000
   tokens). An evidence-guided build reports totals summed over all its calls. So any
   successful build past about 64k tokens is refused **after Core has built the proposal**.
   The registry then answers `{ ok: false, error }` with no diagnostic, which the Lab can only
   record as `lab.generation_http_<status>`. This is on `dev` too. It is fixed at the root.
3. **Needing permission is now a first-class creation outcome in the Lab.** A build Core stopped
   to ask a person records `outcome: "permission_required"` and the request. The lane then
   reports `permission.required: <missing classes>` rather than an HTTP or generic failure.
   Core already returned a closed request (`flow_bootstrap.permission_required` +
   `permissionRequest`), and the panel's dialog already reads exactly that field. Neither
   needed a change.
4. **The brief's live proof cannot happen on this code for this task, for two reasons.** First,
   t027's press-tool wording tells the model never to press a schedule/submit control while
   exploring. Second, the web domain never checks a Flow step's consequences. So nothing on
   this path ever raises a request. See open question 1.

## What changed and why

Core (`F:\fxwork\t047\!FluxIQ`):
- `packages/fluxiq/src/programs/automation-studio/api/handlers/llm-generation.ts`:
  `boundedAccountingInteger` now bounds by `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ACCOUNTED_TOKENS`
  (`maxIterations × 64k`) instead of `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`
  (64k). This is the bound the service's own `sanitizedBootstrapAccounting` (`service.ts:5967`)
  and the failure parser (`generation-failure.ts:671`) already put on the same object. Values
  past a whole build's maximum are still refused. `service.ts` is untouched.
- `.../api/handlers/tests/llm-generation.test.ts`: a new test covers a proposal whose totals are
  91,191 input tokens. It failed on the unfixed handler (`ok: false`) and passes now. The old
  "unbounded accounting" test pinned 64,001 as refused. It now pins
  `MAX_ACCOUNTED_TOKENS + 1`, so the refusal assertion is kept at the build's real limit.

Downstream (`F:\fxwork\t047\!FluxIQWebExtension`, `TR/flow-lane/creation/`):
- `build-proposal.ts`: `CreatedFlowBuild.outcome` gains `"permission_required"`, set when
  Core's parser returns a `permissionRequest`, which it admits only on that code.
  `failure.code` keeps Core's `flow_bootstrap.permission_required`, so the campaign's
  issue-code rollup still sees it.
- `lane.ts`: a `permission_required` build is settled, then the lane throws
  `FluxIQ asked for permission before building a Flow from the task's instruction (permission.required: <classes>)`.
  Its details are codes only: `outcome: "permission.required"`, `missing`, `consequences`, the
  action kind and verb, and calls. The control's name stays on the build record. Nothing is
  approved, applied or run.
- `tests/permission-required-diagnostic.ts` (new test support): builds the request with Core's
  real `AutomationStudioActionPermissionGate` and `flowBootstrapPermissionRequiredFailure`,
  then passes it through a JSON round trip as the wire does.
- `tests/build-proposal.test.ts` and `tests/lane.test.ts`: one new test each.

## Commands run and observed results

Live runs, all `FLUXIQ_TEST_ENV_FILES=none pnpm lab run <scenario> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task <task> --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25 --target persistent-isolated --workspace <ws>`.
`build.providerCalls == observed.calls` in every run.
- The first attempt was refused: Core's dist was older than a checked-out `service.ts`. Rebuilt with `pnpm --filter fluxiq build`.
- **Reproduction, unmodified t027 tip**, `social-scheduler-schedule-post`, no permit:
  `run-mubm8pnc-e274469e`, verdict **passed**, `flowCreated: true`, `oracleVerdict: passed`.
  Build `outcome: proposed`, 5 calls = observed 5, 50,394 input tokens, $0.0231. Tools included
  `web.press_control`. `permissionRequest: null`, `instructedConsequences: []`. Playback repair
  calls: 0.
- After the fix, runs meant to exercise the permission path or cross 64k (none did either):
  - `social-scheduler-retry-failed`: `run-mubn168l-45277d6f`, `flow_bootstrap.evidence_tool_failed`, 4 calls, 43,272 tokens, $0.0195.
  - `order-operations-refund-quote`: `run-mubna15u-82cbf8b6`, `flow_bootstrap.evidence_unusable_decision` (`bootstrap.invalid_parameter_value`), 11 calls, 111,851 tokens, $0.0510. The model never pressed Refund.
  - `order-operations-partial-refund`: `run-mubngonx-0a2531a3`, `flow_bootstrap.evidence_repeat_without_progress`, 10 calls, 99,822 tokens, $0.0449.
  - `property-listings-newest-homes`: `run-mubnnllw-7efd2a9a`, `outcome: proposed`, 7 calls, 50,741 tokens, $0.0239. The Flow matched **0 of 10** records (a separate extraction defect).
  - Total spend is about $0.16.
- History, read-only across 167 `live-llm.json` files in `F:\!FluxIQWebExtension\test-runs`,
  `F:\fxlab\*` and `F:\fxwork\*`. The largest *successful* build was 56,842 input tokens. Failed
  builds reached 233,637. The only bare `generation_http_400` in all of them is t036's run 1
  (78.9 s). t036's check of the `adaptations` table (0 rows) does not show that no proposal was
  built: the permit-b workspace, which applied a proposal, also has 0 rows there.
- Core, from `packages/fluxiq`: `npx vitest run` on `llm-generation.test.ts` before the fix:
  **1 failed | 16 passed** (the new test). After: `llm-generation`, `llm-permission`,
  `generation-failure`, and `service-bootstrap/tests/permission`: **4 files, 74 passed**.
- Core `pnpm check`: exit 0. Structure tests 182/182, task tests 20/20,
  `structure-audit: passed (170 warning(s), 361 baselined)`, all four `tsc --noEmit` Done.
  Warning on my file: `llm-generation.test.ts` 595 lines (it was 552 before, already past the
  400-line advisory).
- Downstream `pnpm build` in test-runner, then `node --test dist/flow-lane/creation/tests/*.test.js`:
  **36 tests, 35 pass, 1 fail**. The new tests pass. The failure is pre-existing (next section).
- Downstream `pnpm check`: exit 0. Structure 182/182, `lab:test` 74 pass / 1 skipped,
  `task:test` 113/113, `structure-audit: passed (83 warning(s), 122 baselined)`, every package
  `check: Done`.

## Not verified

- **No live run raised a permission request**, so the Lab's `permission.required` report and the
  panel dialog were not seen live. The Lab path is proven with Core's real gate output through
  JSON. The panel was not driven: the brief forbids the user's panel.
- **No live build crossed 64k and succeeded**, so the fix is not shown live. It rests on the
  handler test (red, then green) and the 167-run history.
- The cause of t036's run 1 is inferred, not observed. Its bundle holds no Core log line,
  build record or step list, and that workspace keeps no bootstrap proposal on disk.
- The `--llm-permit` proof was not run: no class was ever requested, so there was nothing to
  permit.
- Pre-existing failure, not mine: `lane.test.ts` "a dataset task is built, settled, applied...".
  It expects no `get-flow-adaptation` call on the proposed path. That call comes from
  `instructedConsequencesOf`, added in `4a39262` ("not landed: proofs failed"). I removed no line
  of `lane.test.ts` and did not touch the proposed path. It belongs to the t027 gate triage.

## Open questions or contradictions found

1. **Flow steps are never permission-checked in the web domain.** Core hands
   `resolvePlanNodeParameters` a `permission` check for every step. The web domain's
   `WebPlanNodeResolutionInput` (`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:103`)
   has no such field, and `resolveWebPlanNodeParameters` never calls it. Together with t027's
   "Never press a submit, save, schedule, send, publish, delete or confirm control..." wording,
   any lasting act is moved into the Flow, and there nobody checks it. A created Flow can
   publish, refund or delete on every run with no grant and no instruction check;
   `instructedConsequences` stays `[]`. For this task the instruction does ask to schedule, so
   the end result is allowed. But it went through unchecked, and the same holds for a task
   whose instruction asks nothing of the kind. Fixing it needs the domain's plan resolver
   (not in my files): declare each Flow step's consequences and call the check. Until then,
   P1's live proof ("ends in a permission request") can only come from an exploration press,
   which t027 now steers the model away from.
2. The brief expected a no-permit schedule-post build to ask. Under the user's rule the
   instruction is the authority, so the right answer for this task is "instructed, goes ahead".
   A proof of the ask needs a task whose instruction does not cover the act. The natural
   candidate is `order-operations-refund-quote`, but the model did not get that far here.
3. The handler still throws on a successful build whose accounting fails sanitizing. Core has
   already stored the proposal, yet the caller gets a bare error. With the bound fixed this
   should not happen on real builds. Whether it should instead return a classified code, or the
   proposal, is a Core contract decision I did not make.
4. Separate live defects seen, none in this brief: `evidence_tool_failed` on
   `social-scheduler-retry-failed` (the failing call is missing from the trace); order-operations
   exploration stalling; `property-listings-newest-homes` creating a Flow that matched 0 of 10
   records.
