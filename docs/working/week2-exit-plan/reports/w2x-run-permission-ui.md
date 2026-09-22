# w2x-run-permission-ui

Worker report, 2026-09-21. Task t060, plan step N3, slice CU1 of
`reports/w2x-existing-flow-and-repair-design.md` (items 3 and 4, "What the
person sees").

Worktrees: `F:\fxwork\t060\!FluxIQ` (branch `task/t060-run-permission-ui`,
HEAD `99e0618`) and `F:\fxwork\t060\!FluxIQWebExtension` (no changes). Nothing
is committed. `W/` is Core `apps/web/src/features/automation-studio/`.

## Outcome

**Partial.** All the code is done and tested. Core `check` and `build` pass.
The panel's new Explore and adapt mode works end to end through the real
panel with the unpacked extension.

**No live run raised a permission request.** Every panel run starts on an
empty grant, and on both tasks I ran, the empty-grant diagnosis never
explored:

- `order-operations` relabelled-dispatch: the plan was to stop.
- `social-scheduler` renamed-composer: `stillAchievable: yes`,
  `deterministicRecoveryPossible: yes`, `candidateKind:
  action_target_override`, but `explorationNeeded: false` and
  `patchNeeded: false`.

The Allow and Don't allow paths are therefore proven against run details that
Core's own recovery code wrote. They are not proven against a request raised
by a live run.

Live testing also found two defects that stopped any request from reaching
the person. I fixed both in `W/runtime/FlowRunView.tsx` and proved both live:

1. **The panel lost every run longer than 30 s.** `run-runtime-session` is a
   POST with the transport's default 30 s limit, and an exploring run takes
   longer. Seen live: the request aborted at exactly 30 s, 22:01:32.020 to
   22:02:02.031.
2. **The recovery could not use its grant on a Flow that fails after about a
   minute.** A runtime grant is claimed only when the recovery first resolves
   the provider, and the panel issued it with Core's default 60 s claim
   window. Seen live: `llm.provider_resolution_failed` on run `f72c7250`.

## What changed and why

**`W/runtime/run-input-model.ts`**
- `AutomationRuntimeExplicitLlmRunMode` gains `explore_and_adapt`.
- New `isAutomationRuntimeExplicitLlmRunMode()`, so `FlowRunView` no longer
  lists the explicit modes by hand in two places.
- `runtimeLlmExecutionRequestFromFlow` already omits `maxCalls` for iterating
  purposes, and needed no change.

**`W/runtime/RunPermissionRequest.tsx` (new, 62 lines)**
- Reads `runDetail.metadata.permissionRequest` through t027's
  `parseAutomationStudioActionPermissionRequest`, from
  `fluxiq/automation-studio/action-permissions`. No barrel change was needed.
- Shows only a `recovery`-stage request. Anything the strict parser refuses
  renders nothing.
- Shows:
  - Core's sentence;
  - a list of the missing consequence phrases
    (`AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES`);
  - "Already allowed for this run" when the grant held classes;
  - a line saying the run did not do this.
- **Allow and run again** hands the parsed request back to the caller.
- **Don't allow** only dismisses the request.
- When the run carried no grant (the fully adaptive, manual approval and no
  LLM intervention modes), there is no Allow button. The text tells the
  person to run the Flow with Explore and adapt instead. There is no run
  intent to extend, and the brief asks for the same intent.

**`W/runtime/FlowRunView.tsx`**

Mode and display:
- New mode button **Explore and adapt**, with a description line and an
  "Inspecting live target..." progress label.
- `FlowRunView` binds `useRuntimeDetailCommands().loadDetail` and passes it to
  `FlowRunViewContent` as the optional `loadRunDetail`.
- After every run, the view reads the compact run detail. If
  `metadata.permissionRequest` is present, the view keeps
  `{projectId, flowId, runId, mode, inputText, maxSteps, runDetail}`, and
  `RuntimePostRunSummary` gains an optional `permission` prop that mounts the
  component.
- A later run, or a change of Flow, supersedes the read through a generation
  counter.

Allow, which mirrors t027's creation continuation:
- Allow is honoured only while the project, Flow, inputs and step limit still
  match what the run used. Otherwise the request is dropped with a fixed
  message.
- It calls `authorizeLlm(mode, false, request.missing)`. Preflight and issue
  both carry `permittedConsequences: [...request.missing]`, and the set
  survives the high-token confirmation.
- The re-run then uses the same `runIntent`.
- A run started any other way carries no `permittedConsequences`.

Read-back fix (defect 1):
- An explicit run now sends `newRunId: crypto.randomUUID()`. This is Core's
  existing contract for reading a run back if its request is cut short.
- If execute fails as a timeout (408, 504 or `request_timeout`), the view reads
  the run detail by that id every 2 s, for up to 15 minutes, until it ends. It
  then rebuilds the summary with `runResultFromDetail` and reads the request
  from that detail.
- The queued (non-explicit) path gets the same read-back by its known run id.

Claim-window fix (defect 2):
- Runtime grants are issued with `ttlMs: 300_000`, Core's maximum claim
  window. The authoring panel already passes `ttlMs` for exploration grants.

Audit fix:
- Two `catch` blocks state their `best-effort:` reason, which the
  swallowed-failure rule requires. `FlowRunView.tsx` was at the rule's
  baseline of 1, and without the reasons the audit fails.

**Tests**
- `W/runtime/tests/run-permission-request.test.tsx` (new, 11 tests). Requests
  come from Core's real `AutomationStudioActionPermissionGate`, imported from
  `fluxiq/automation-studio`, and are sent through JSON. The tests cover:
  - the rendered sentence, phrases and granted line;
  - strict refusal of tampered requests and of authoring-stage requests;
  - the no-grant case, with no Allow button;
  - an explore run with an exact-purpose grant (`ttlMs` 300000, no
    `permittedConsequences`), followed by a detail read;
  - Allow sending exactly `["send_or_publish","create_new"]` and not the held
    `modify_existing`, with the same intent;
  - Don't allow sending nothing;
  - changed inputs refusing Allow;
  - the high-token path keeping the classes;
  - read-back after a 408, reaching Allow;
  - any other failure reading nothing back.
- `W/runtime/tests/runtime-views.test.tsx`: one source-string assertion now
  expects `isAutomationRuntimeExplicitLlmRunMode` instead of the
  `diagnose_and_adapt` literal. Also added: an `explore_and_adapt` request
  names no `maxCalls` and no `permittedConsequences`.

## Commands run and observed results

Every live run used `FLUXIQ_TEST_ENV_FILES=none`, OS-assigned ports
(for example 60708, 63896 and 59873), and never `FLUXIQ_LAB_ALLOW_BEHIND_CORE`.
The Core HEAD contains Core `dev` (`71e2798`). Runs were sequential.

**Setup, all provider-free**
- `pnpm --filter fluxiq build` (Core): passed, 21 s. The source was newer than
  `dist`.
- `node scripts/lab/run-lab.mjs run order-operations --workflow dispatch-batch --variant relabelled-dispatch --flow --target persistent-isolated --workspace t060-perm`:
  - run `run-mubrsi8o-2d7c8ef0`, `flowCreated: true`;
  - failed with `target_not_found` / `web.target.not_found`, as a provider-free
    run should on this variant;
  - `llm.calls 0`.
- The same for `social-scheduler --variant renamed-composer`, into workspaces
  `t060-sched` and then `t060-sched2`: `flowCreated: true`, `target_not_found`.

**Panel driver**
- Scratch script `...\scratchpad\t060\panel-permission.mjs`. It reopens the
  workspace topology with `startTopology`, adds one active instruction,
  installs the Secret Key, sets Flow settings through Core's API, and pairs the
  unpacked extension (`pairExtensionWithColdEpochRecovery`). It then arms the
  variant and drives only the panel UI: project, Flow, Runtime Debug, Explore
  and adapt, Run.
- Results:

| Panel run | Task | What the panel sent | Server result (Core's run detail) | Panel showed |
|---|---|---|---|---|
| `c120b611` | relabelled-dispatch | preflight and grant `explore_and_adapt`; high-token confirmation accepted; run `runIntent: explore_and_adapt`, `adaptiveMode: manual_approval`; answered 200 in 23.5 s; then `get-flow-run-detail` `compact: true` | failed; 1 call (`runtime_diagnosis`); `patchSkippedCode: llm.runtime_patch_not_requested`; `permissions {granted:[],instructed:[],lapsed:[]}`; `permissionRequest: null` | no request (correct) |
| `5becbda1` | renamed-composer, before the fixes | same | request **aborted at 30 s**; the run went on in Core | nothing; the run was lost to the panel. My driver then stopped the topology mid-run, leaving this run `running` in `t060-sched` |
| `f72c7250` | renamed-composer, read-back fix only | run with `newRunId`; the panel read it back about 20 times over 107 s | failed; 90.6 s; `llmGate.code: llm.provider_resolution_failed`; 0 calls | Last Run `f72c7250`, no error |
| `109d896e` | renamed-composer, both fixes | aborted at 30 s (23:01:24.58 to 23:01:54.58); read back by `newRunId` | failed; 96.4 s; 1 call (grant claimed at about 90 s); `llm.runtime_patch_not_requested`; diagnosis `stillAchievable yes`, `explorationNeeded false`, `patchNeeded false`; `permissionRequest: null` | Last Run `109d896e`: failed, 9 actions, 1 recovery, 1 intervention (screenshot `shots\t060-sched2-...23-00-08...\run-1.png`) |

- Three further scheduler attempts on `t060-sched` were refused before running
  (`Only one adaptive runtime run can be active per project.`, blocked by the
  orphaned `5becbda1`). Two attempts on `t060-sched2` failed on machine load:
  the panel's own requests timed out at 30 s, including one preflight. All of
  these made 0 provider calls.

**Lab repair with a permit, one attempt plus a retry**
- Command: L4's exact repair command on social-scheduler renamed-composer,
  `--target persistent-isolated --workspace t060-sched2 --llm-permit modify_existing`.
- `run-mubuvjtl-771f2ea6`: facility failure. `review-recording-flow-proposal`
  hit its 30 s `http.timeout` under load; 0 calls.
- `run-mubv0kcd-3a4b8f52`: `flowCreated: true`, but both diagnosis
  interventions show `llm.provider_resolution_failed`, with
  `observed.calls: 0`. **The Lab's grant has the same 60 s claim window**, so
  it expires before the recovery claims it.

**Fallback proof against a request Core produced**
- L4's live run details contain no request, so there was none to reuse. Instead,
  `...\scratchpad\t060\core-request-producer.mts` copies L4's harness from
  `recovery/annotation/tests/recovery-permissions.test.ts` verbatim and runs
  Core's built `annotateAutomationStudioRunDetailWithRuntimeLlm` under
  `node --experimental-transform-types`. Core wrote:
  - a `metadata.permissionRequest` with stage `recovery`,
    `exploration_step` `test.press`, control "Pick and pack" (button),
    `missing: [modify_existing]`, `granted: []`;
  - `patchSkippedCode: llm.runtime_patch_permission_required`;
  - nothing pressed.
  With a `create_new` grant it asked for `modify_existing`, with
  `granted: [create_new]`.
- `...\core-request-panel.tsx` was bundled with the web app's esbuild
  (`next/navigation` and `RunHistory` stubbed). It renders the real
  `FlowRunViewContent` and serves that exact run detail as the run's detail.
  Observed:
  - no permit, then Allow: the request is shown with Core's sentence and the
    item "change something that already exists". A new preflight and grant go
    out with `purpose: explore_and_adapt`, `permittedConsequences:
    ["modify_existing"]` and `ttlMs: 300000`. One new run follows, with
    `runIntent: explore_and_adapt`, the new grant, `manual_approval`, no
    `runId` and a fresh `newRunId`. The request is then gone.
  - no permit, then Don't allow: 0 preflights, 0 grants, 0 runs; the request
    is gone.
  - partial permit, then Allow: the grant carries `["modify_existing"]` only.

**Checks**
- `npx vitest run src/features/automation-studio/runtime/tests src/features/automation-studio/adaptations/tests`
  (`apps/web`): 12 files, 67 tests passed. This was the final run, after the
  last edit.
- `npx tsc --noEmit -p .` (`apps/web`): clean.
- `pnpm check` (Core root):
  - first run exit 1: `[swallowed-failure] FlowRunView.tsx ... 193, 473`
    (baseline 1);
  - after the fix, exit 0: structure tests 182/182, task tests 20/20,
    `structure-audit: passed (171 warning(s), 361 baselined)`, and the
    contracts, client-gateway-websocket, fluxiq and web `check` all Done.
- `pnpm build` (Core root): exit 0 in 87 s; Next "Compiled successfully",
  static pages 16/16.

Provider spend: about three diagnosis calls in total, roughly USD 0.01. This
includes an unknown number from the orphaned `5becbda1`, at most a few calls.

## Not verified

- **A permission request raised by a live run**, and therefore:
  - its display in the live panel;
  - Allow re-running live with exactly the missing classes;
  - Don't allow leaving a live Flow and page unchanged.
  The driver's dismiss and allow branches exist but were never reached.
- The read-back's 15-minute limit, and a run that outlasts it.
- The queued-path read-back, live: only the explicit path was exercised.
- Firefox, and the extension side panel's own view: only the Core web panel
  was driven.
- Two advisory structure warnings:
  - `FlowRunView.tsx` is now 529 lines (was 368; advisory threshold 400);
  - `run-input-model.ts` has 11 exported values (was 10; advisory 8).
  Neither fails the audit. Moving the permission continuation into its own
  hook file would fix the first, but that file is not in my ownership.

## Open questions or contradictions found

1. **Empty-grant diagnoses do not explore, so the panel's first run rarely
   reaches a request.** On renamed-composer the diagnosis judged a target
   override possible, yet set `explorationNeeded: false` and
   `patchNeeded: false`. The recovery then ended with no repair and no
   question. This is Core recovery planning and prompt territory (L4/C3, or
   C4 for the patch-level request), not this slice. Until it changes, the
   panel can show a request only when a diagnosis chooses to explore.
2. **The claim window is also wrong on the Lab and Core side.** Core claims a
   runtime grant at the recovery's first provider call, but its default TTL is
   60 s. My panel fix passes Core's maximum of 300 s, so a Flow that fails
   after 5 minutes still cannot recover. The Lab's `--llm-task repair` grant
   has the same 60 s window: `run-mubv0kcd-3a4b8f52` got
   `provider_resolution_failed` with 0 calls. Options: Core could claim at
   run admission, or size the window from the run lease; the Lab should
   pass `ttlMs`.
3. **Core has no `cancel-runtime-session` handler.** The endpoint constant
   exists, and `service.cancelRuntimeSession` exists, but no API handler is
   registered: the call returns 404 "Global program API handler not found".
   So the panel's Stop button cannot work. A run orphaned by a stopped Core
   also stays `running` for good and blocks every later adaptive run in its
   project ("Only one adaptive runtime run can be active per project."). That
   happened to workspace `t060-sched`.
4. **Allow grants exactly `missing` and drops the classes held before.** The
   brief, the design and t027 all say `permittedConsequences: request.missing`.
   Suppose a recovery needs class A at one step and class B at another. Run 1
   asks for A. Run 2, on grant {A}, asks for B. Allow on run 2 grants {B} only,
   so run 3 asks for A again. The request's `authority.granted` holds what the
   person already allowed. Granting `granted` plus `missing` would still grant
   nothing that was not asked for. This is the supervisor's decision.
5. A request raised by a run started elsewhere (the Lab, a schedule, the API)
   appears only in that run's detail. The component is mounted only in the
   post-run summary, not in `RunDetailPanels`, because the brief limits that
   file to mounting and a history Allow would need the run's intent.
6. Documentation: this is a UI flow change. Core
   `docs/architecture/automation-studio.md` probably wants a line on the
   run-side request, the read-back by `newRunId`, and the 300 s claim window.
   Docs were not in my ownership.

Leftover disposable state (all gitignored) is under
`F:\fxwork\t060\!FluxIQWebExtension\test-runs\`:
- persistent workspaces `t060-perm`, `t060-sched` (holds the orphaned
  `running` run) and `t060-sched2`;
- the Lab run directories.

The scratch scripts and logs are in my scratchpad `...\scratchpad\t060\`.
