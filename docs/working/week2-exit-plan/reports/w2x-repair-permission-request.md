# w2x-repair-permission-request

Worker report, 2026-09-21. Paired task t059, plan step L5: "Item 4" of
`reports/w2x-existing-flow-and-repair-design.md` (slices C4 and D4), plus
items (a), (b) and (c) from L4's live runs.

Worktrees:

- `F:\fxwork\t059\!FluxIQ`, branch `task/t059-repair-permission-request`
- `F:\fxwork\t059\!FluxIQWebExtension`, branch `task/t059-repair-permission-request`

Nothing is committed. Prefixes: `AS/` = Core
`packages/fluxiq/src/programs/automation-studio/`; `TR/` = downstream
`packages/test-runner/src/`.

## Outcome

**Partial.** The code is written, tested and checked. What is not done is the
live proof: no live run reached a permission request at the patch stage. Two
things outside my files stopped it.

1. **The social-scheduler task cannot reach recovery at all.** The Lab's grant
   expires before this Flow fails.
   - Core gives an unclaimed grant 60 seconds by default
     (`AS/runtime/llm/execution-grants.ts`, `ttlMs ?? 60_000`; the maximum is
     300 s). The Lab never sends `ttlMs` (`TR/live-llm/execution-grant.ts`).
   - This Flow fails 87 seconds after its run starts: the stored run began at
     21:39:12.7 and ended at 21:40:39.3.
   - So when the recovery asks for its provider, the grant has already lapsed.
     The run ends `llm.provider_resolution_failed` with 0 calls, before any
     code in this brief runs.
   - The real panel has the same defect. It issues a grant and then runs, so
     any Flow that fails more than 60 s after the grant was issued gets no
     recovery, and says only "provider resolution failed".
2. **The order-operations task cannot produce a repair that runs.** The domain's
   equivalence check refuses the correct control on this variant.
   - `domain/src/runtime/llm-evidence/target/equivalence.ts` counts
     conjunctions (`joinsMoreActions`). The new label "Pick and pack" has one
     and the recorded "Dispatch run" has none, so it reads as two actions and
     is refused as `target_not_equivalent`.
   - Nothing else that identified the recorded button survives the redesign
     either: no test id, no name, and no form to anchor it.
   - This is the `target_not_equivalent` refusal L4's permitted run L5 hit.
   - On this task the model also never proposed an override in my two runs, so
     the check was not even reached.

So no live run shows the Recover or Validate links of the Week 2 exit chain.
Each link is reported below with what was observed. The social-scheduler task
is the one that can prove Item 4: "Add to queue" is the only submit button in
the recorded form, so the domain's check can accept it. Its only blocker is the
grant claim window.

## What changed and why

### Core: the patch stage asks the recovery's gate (C4)

- **New `AS/runtime/llm/harness/runtime-patch-schema.ts`**, exported from the
  harness barrel as `automationStudioRuntimePatchOutputSchema({ proposalOnly })`.
  - The runtime patch schemas moved here out of `deepseek-provider.ts`. They are
    Core's contract with a model, not DeepSeek transport code.
  - `temporary_target_override` and `temporary_action_sequence` gain a required
    `consequences` array. It is limited to Core's five classes, at most 5 items,
    each named once.
  - Under a `diagnose_and_adapt` grant the target override is a proposal that
    never runs, so its schema has no `consequences` field. That branch is
    unchanged.
- **`AS/runtime/llm/deepseek-provider.ts`**: 797 → 707 lines.
  - It uses the moved schema.
  - It adds one system-prompt line, only where a patch may run: "say in
    consequences what performing the new target would lastingly do ... write []
    when it only opens, shows or chooses. A class the run is not permitted is
    asked of the person, never refused, so name every class that applies."
    It contains no web noun (the opaque-target test checks this).
- **`llm/harness/structured-response.ts`**: the two acting patch kinds gain
  `consequences?`. The field is optional in the type because it is read
  forgivingly.
- **`llm/harness/provider-result.ts`**: `consequences` is allowed on those two
  kinds and validated. A value that is not a list, is longer than 10, or names
  a class Core does not know is refused as
  `llm_output.invalid_patch_consequences`. An absent field is accepted, and a
  repeated class is harmless because it is deduplicated when read.
- **`live-patch/refusal-reasons.ts`** and **`live-patch/target-override-check.ts`**:
  - `matched` and `resolved` gain an optional
    `control: { name, kind? }` (new type
    `AutomationStudioRuntimeTargetOverrideControl`, re-exported from
    `live-patch.ts`).
  - The check carries it through only when it is plain: a non-empty name of at
    most 2,000 characters, and a kind in the permission declaration's own
    vocabulary. It is never carried on a refused target.
- **`AS/runtime/live-patch.ts`**: the input gains `sideEffectPermission?: "permitted"`.
  - When it is set, the two policy side-effect lines do not apply, and
    `requiresExternalSideEffectApproval` is false.
  - Every other check still applies: runtime recovery, the policy toggles, the
    host capability and the target check.
  - A caller that does not set it behaves exactly as before.
- **`AS/runtime/action-permissions/request.ts`**: new wording for a `flow_step`
  request at the `recovery` stage: "To repair the step that failed, the Flow
  would press "Add to queue" (button) each time it runs, which would ... so the
  repair stopped to ask". A test confirms the strict parser accepts it.
- **`recovery/annotation/patches.ts`**: the input gains `permissionGate?`.
  - A target override that would run (anything other than proposal-only) is
    handled like this:
    1. **Preflight as if permitted.** If any other check would refuse it, for
       example the domain refusing the target, the outcome is `not_asked`. The
       patch runs into that refusal as before, and nobody is asked a question
       whose answer changes nothing.
    2. **`consequences` absent.** The outcome is `undeclared`: a receipt is
       written and the patch does not run.
    3. **`consequences` is `[]`.** The outcome is `permitted`, and the patch runs
       without asking.
    4. **Otherwise the gate is asked.** The action is
       `gate.checkFor({ kind: "flow_step", id: definitionId, ref: nodeId })`,
       with the domain's control, or "the step's new target" when the domain
       named none, and the verb `press`.
       - Permitted: the patch runs with `sideEffectPermission: "permitted"`.
       - Refused: the receipt carries `permissionRequired: true`, `requestId`,
         `consequences`, `missing`, verification
         `not_executed/permission_required` and the issue
         "Permission required: <sentence>". The loop stops there.
  - Every gated receipt carries `permissionOutcome`.
  - `temporary_action_sequence` is not gated: Core cannot apply it at all
    (`unapplied_patch_kind`), so asking a person about it would be pointless.
- **`recovery/annotation/annotate.ts`**:
  - It hands the gate to the patch stage.
  - It reads `gate.request` again after the patches. A request raised there
    becomes `metadata.permissionRequest`, `llmGate.patchHeldCode: "llm.runtime_patch_permission_required"`,
    and the resolution stage's `failureCode` of the same name.
  - A patch that may run is now told `actionPermissions` in place of the side-effect
    flag, because the preflight no longer reads the flag for it. I found this
    while reviewing.
    - L4 had deliberately kept the flag on the patch call because the preflight
      still enforced it.
    - A `diagnose_and_adapt` proposal keeps the flag, and the service test that
      asserts that is unchanged.

### The three findings from L4's live runs

- **(a) Host capability.** The Lab and the real panel use the same host module.
  - The Lab loads `domain/.lab-instances/<id>/host/web-panel-host.mjs`, which is
    built from `domain/src/web-panel-host.ts`.
  - That module, like `domain/src/host.ts`, calls `registerWebAutomationRuntime`,
    which binds `createWebAutomationHostRuntime`.
  - Its `HOST_RUNTIME_CAPABILITIES` lacked `action-dispatch`, so neither host
    had it. It is now declared in `domain/src/runtime/host-runtime.ts`, and the
    test is updated.
  - The web host does dispatch every web action a Flow runs, through the gateway
    the boundary is bound with, so the declaration is true.
- **(b) `policyGates` on exploration decisions.** `deepseek-provider.ts` now
  projects `policyGates` into the context of an `evidence_tool_decision` call,
  when the packet carries it. The recovery packs `actionPermissions` into it, as
  L4 set up.
- **(c) Observed tool failures in recovery.** `recovery/runtime-exploration.ts`
  runs the loop with `toolFailures: "observe"`.
  - A thrown tool is now recorded under its call id with a closed code, and the
    model sees that code on its next decision. Only a run of failures that
    reaches the progress guard ends the exploration.
  - The loop's signal is now `AbortSignal.any([ledger.signal, gate.signal])`.
    This keeps the two stops this module throws on purpose (a ledger limit, and
    a request the gate raised) as stops rather than failures to observe.

### Domain: D4

- `domain/src/runtime/llm-evidence/target/override.ts`: a resolved repair now
  returns `control: { name, kind }`.
  - The name is the element's name exactly as the packet printed it, or its
    visible text when it has no name.
  - The kind uses the same words as the exploration's press: the role, `link`,
    `checkbox`, or the tag.
  - The result is written through `present<T>()` to satisfy the contract-spread
    rule.
  - `press.ts` has the same private kind helper. I could not share it, because
    `press.ts` is not my file.

### Tests

- **Core, new**:
  - `llm/harness/tests/runtime-patch-consequences.test.ts` (4): the schema, the
    absent proposal field, parsing, and refusals.
  - `live-patch/tests/target-override-check.test.ts` (3): the control is
    carried, a bad kind is dropped, and nothing is carried on a refusal.
- **Core, edited**:
  - `recovery/annotation/tests/patches.test.ts`: +8, covering required,
    permitted, `[]`, undeclared, not asked, a withheld name, stopping at the
    first request, and the proposal and no-gate paths being unchanged.
  - `recovery/annotation/tests/recovery-permissions.test.ts`: +2, a request
    raised at the patch stage through `annotate`, and the permitted run.
  - `recovery/tests/runtime-exploration.test.ts`: the "action that threw" row
    becomes "tool that kept throwing" (3 throws). +2 tests: a thrown tool is
    shown with no error text and the loop carries on, and the gate's request
    still ends the exploration.
  - `llm/tests/deepseek-provider.test.ts`: +1, the consequences instruction and
    schema appear only for a patch that may run.
  - `tests/deepseek-recovery-requests.test.ts`: +1, every exploration decision
    carries `policyGates.actionPermissions` through the real adapter.
  - `tests/live-patch.test.ts`: +1, `sideEffectPermission` skips only the two
    side-effect lines.
- **Domain, edited**:
  - `target/tests/override.test.ts`: five full-result assertions now include
    `control`.
  - `runtime/tests/host-runtime.test.ts`: the capability list.

## Commands run and observed results

### Live runs

Every run used `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated
FLUXIQ_LAB_INSTANCE=t059 npm_config_workspace_concurrency=1`, and
`FLUXIQ_TEST_PERSISTENT_WORKSPACE` was `t059-social` or `t059-orders`.
`FLUXIQ_LAB_ALLOW_BEHIND_CORE` was never set, and Core was not behind `dev`.
The command was:

`node scripts/lab/run-lab.mjs run <scenario> [--workflow dispatch-batch] --variant <v> --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task repair [--llm-permit modify_existing] --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-calls 26 --llm-max-cost-usd 0.25 [--replays 1]`

The Lab's snapshots do not keep permission fields. I read each run's recovery
record after the run, read-only, from the persistent workspace's
`project.sqlite` and its event chunks (`node --experimental-sqlite`, opened
`readOnly: true`). I printed only codes, classes, counts, statuses and timing.
No watcher ran during any run.

| Run | Task, permit | Code | Calls, cost | What happened |
|---|---|---|---|---|
| B0 `run-mubrl81i-e1ed1bac` | social-scheduler `renamed-composer`, none | before the change | 0, $0 | The Flow failed on `web.target.not_found`. The recovery could not resolve its provider: `llm.provider_resolution_failed`. The run lasted 21:39:12.7 → 21:40:39.3, which is 87 s against the 60 s claim window. |
| O1 `run-mubrzspx-9358293e` | order-operations `relabelled-dispatch`, none | final Core, except the patch-call `actionPermissions` edit | 0 | Facility failure: Core's web panel production build died with `uncaughtException [Error: kill EPERM]` during type checking. No Flow ran. |
| O1b `run-mubs3ebu-a8b20941` | same, none, `--replays 1` | same | 1 (diagnosis, 4,460 tokens), $0.00228 | The diagnosis answered `stillAchievable: "no"`, `patchNeeded: false`, `explorationNeeded: false` at confidence 0.55. The plan was `stop`, with `patchSkippedCode: llm.runtime_patch_not_requested`. `permissions: {granted:[], instructed:[], lapsed:[]}`. |
| O2 `run-mubsapvt-7a8a9324` | same, `modify_existing`, `--replays 1` | same | 4 (diagnosis 4,554, decision 4,216, decision 4,716, patch 7,228), $0.01000 | The exploration ended `evidence_gathered` after 2 actions (2 observed, 0 refused). The patch call answered `no_repair` / `control_refused`. `permissions.granted: ["modify_existing"]`. No adaptation, so nothing to replay. |

- In O1b and O2, `observed.calls` equals Core's `llmGate.costAccounting.calls`:
  1 = 1 and 4 = 4.
- Total provider spend was about USD 0.0123.

**The Week 2 exit chain, link by link:**

- **Fail**: seen in every run that ran a Flow (`web.target.not_found` on the
  recorded control).
- **Diagnose**:
  - Seen in O1b and O2.
  - In O1b the diagnosis stopped the recovery with no request by answering
    "not achievable". This is the diagnosis-stage stop L4 saw in its run L1.
- **Explore**: seen in O2 (2 actions, `evidence_gathered`).
- **Generate Repair**: the patch call was made in O2, and the model declined.
- **Recover** (a trial that restores the expected state): not reached in any run.
- **Validate** (an adaptation that is `validated`): not reached in any run.
- **The permission request**:
  - Not seen live at the patch stage or the exploration stage.
  - No run reached a target override that would run and that declared a class.

### Focused tests and checks

Core, from `packages/fluxiq`:

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (tests included).
- `npx vitest run` over the patch stage, exploration, provider, harness,
  permission, live-patch and service-adaptation paths (21 paths) gave "Test
  Files 39 passed (39), Tests 452 passed (452)". The paths were:
  - `recovery/annotation/tests`
  - `recovery/tests/runtime-exploration{,-permission}.test.ts`
  - `llm/harness-options/tests`
  - `llm/tests/execution-grant{-permissions,s}.test.ts`
  - `llm/tests/harness.test.ts`
  - `llm/harness/tests`
  - `tests/deepseek-recovery-requests.test.ts`
  - `tests/service-adaptation/tests/{iterating-recovery,llm-grants,runtime-patches}.test.ts`
  - `action-permissions/tests`
  - `live-patch/tests`
  - `tests/live-patch{,-target-override}.test.ts`
  - `llm/tests/{deepseek-provider,opaque-target-override,deepseek-evidence-preflight,evidence-loop-tool-failure}.test.ts`
  - `automation-studio/tests/opaque-target-execution.test.ts`

  The first pass had 2 failures in my new `patches.test.ts` cases. Both were
  wrong expectations:
  - an executed receipt never carries `targetResolution`;
  - a policy-refused receipt has no `executed` field.

  I fixed the expectations, not the code, and the file then passed 23 of 23.

Core root:

- `pnpm check`: exit 0, "# fail 0" on both script suites, and
  "structure-audit: passed (172 warning(s), 361 baselined)". Every warning on
  my files is advisory (file length, exported values, the `llm/harness/`
  directory at 20 files). `patches.ts` is newly past 400 lines (438).
- `pnpm build`: exit 0, including the Next web build.
- Line counts:
  - `service.ts`: 6,275, unchanged and untouched.
  - `deepseek-provider.ts`: 707.
  - `evidence-loop.ts`: 776, untouched.

Downstream:

- `domain`: `npx tsc -p tsconfig.json --noEmit` exit 0 against the rebuilt Core.
- The domain tests `target/tests/override.test.ts` and
  `runtime/tests/host-runtime.test.ts` were bundled exactly as
  `scripts/test-domain.mjs` does, into `.test-build-scratch/t059`, which I have
  since deleted. Result: "# tests 28, # pass 28, # fail 0".
- Root `pnpm check`: exit 0, "structure-audit: passed (84 warning(s), 122
  baselined)", and every workspace check reported `Done`.

## Not verified

- **Item 4 live.** None of these was observed live:
  - `runtimePatchAttempts[0].permissionRequired`;
  - a request naming "Add to queue";
  - "nothing executes";
  - run 2's trial, adaptation id, approve, apply and keyless replay;
  - the "never Save as draft" negative.

  The reasons are the two blockers in the Outcome. Unit tests cover the request
  path through `annotate` and the patch stage.
- **The capability fix live.** No run reached a patch preflight, since O2's
  patch was a decline. It is covered by the host-runtime test and by reading
  the host binding code.
- **(b) live.** The exploration in O2 ran on the new projection, but the
  explorer's context is not stored, so I cannot show that it saw
  `policyGates`. The real-adapter test shows every decision carries it.
- **(c) live.** No tool threw in O2.
- **The patch call's `actionPermissions` live.** It landed after O1b and O2
  were built, so no live run used it. O2's patch call was still told "external
  side effects disabled". It declined as `control_refused` where L4's L5 had
  proposed an override. That is n=1 either way, so I cannot say whether the
  flag caused it.
- **Full suites.** Not run, as the brief asked.

## Open questions or contradictions found

1. **The grant claim window blocks every Flow that fails more than 60 s after
   the grant was issued, in the Lab and in the panel.**
   - The narrow fix is in the Lab: send `ttlMs: 300_000` from
     `TR/live-llm/execution-grant.ts` (Core's maximum). That unblocks the
     social-scheduler proof, whose Flow fails at about 87 s.
   - The product fix is in Core: start the run lease when the granted run
     starts, not at the first provider resolution. That touches `service.ts` or
     `execution-grants.ts`, neither of which is mine.
   - Until one of these lands, Item 4's live proof cannot run.
2. **order-operations `relabelled-dispatch` cannot pass the domain's
   equivalence check with the correct answer.** "Pick and pack" trips the
   conjunction rule, and no anchor survives the redesign. Either the variant's
   label or anchor changes, or the rule gains a way to accept it (for example,
   the same slot in the same action group). Until then this task cannot show
   Recover, whatever the permission.
3. **The diagnosis can still end a recovery with no request.** O1b's diagnosis
   answered "not achievable" at confidence 0.55 and the recovery stopped
   silently. L4's rewording helped once (its run L3); this run shows it is not
   reliable. That is the diagnosis prompt (`diagnosis-instructions.ts`) or the
   plan's reading of it, not this brief.
4. **The Lab's reader drops the new fields.**
   - `TR/existing-fluxiq-control.ts` `runtimePatchAttempt` keeps only kind, the
     flags and issue codes.
   - It maps "Permission required: …" to `runtime_patch.preflight_rejected`.
   - It carries neither `permissionRequired` nor `permissionOutcome`, nor
     `llmGate.patchHeldCode` or `metadata.permissionRequest`.
   - A live proof currently needs a store read like mine.
5. **Stale Core documentation.** `docs/architecture/automation-studio.md`,
   subsection "What a recovery may do that outlasts it" (L4), says the patch
   call and its preflight still use the flag "until C4". Now the gate governs
   a target override that would run. The patch call is told `actionPermissions`
   (a proposal keeps the flag), and `patchHeldCode` and `permissionOutcome`
   exist. Docs were not among my files.
6. **Deviations from the design, and why:**
   - A repeated class is deduplicated rather than refused, so one duplicate does
     not cost a whole patch answer.
   - `consequences` is optional in the TypeScript type because it is read
     forgivingly.
   - The proposal-only schema has no `consequences` field, which keeps that
     branch unchanged.
   - Only target overrides are gated, because action sequences cannot be
     applied.
   - `llmGate.patchHeldCode` was added, rather than reusing `patchSkippedCode`,
     because the patch call was made.
   - I edited the `llm/harness/index.ts` barrel (one export line). The new file
     is otherwise unreachable without a ratcheted barrel bypass.

---

## Scope extension (2026-09-21): the four blockers, and the live proofs again

The supervisor asked me to fix the four blockers above, then run the brief's
live proofs again. Same worktrees; nothing is committed.

### Outcome of the extension

**Partial.** All four blockers are fixed and tested, and the first is proven
live: a Flow that fails 90 seconds after it starts now keeps its recovery.

No run reached Generate Repair with a patch, so Recover, Validate, Persist and
the keyless replay were still not observed. Three things stopped the chain, all
outside the files these briefs gave me:

- **The diagnosis ends the recovery with no request, most of the time.** Two of
  the four new runs that reached a diagnosis ended there (S1, O4).
  - The model answers `stillAchievable: "no"`, at confidence 0.55 both times.
  - `plan.ts:174` then requests no patch.
  - `annotate.ts:290` runs an exploration only when a patch is requested. So
    even S1's own `explorationNeeded: true` was never acted on.
- **With a permit, the social-scheduler diagnosis times out.** It ran into the
  25-second per-call limit in both attempts (S2, S2b). Without a permit, S1's
  diagnosis returned 599 output tokens within the limit.
- **A per-call timeout can take the grant down with it.** In O3, after call 3
  timed out, calls 4 and 5 were refused as `llm.provider_request_failed`. That
  code is what a refusal from the grant becomes, and the store does not keep
  the reason.

### What changed and why

**(1) Grant claim window**, fixed at the cause in Core.

- **`AS/runtime/llm/execution-grants.ts`: new `holdForRun(scope)`.**
  - A runtime grant is held for the run it authorizes from the moment that run
    starts.
  - It validates exactly as `inspectAvailable` does: the grant is available,
    in scope, the actor's session is live, and the key and Flow binding are
    unchanged.
  - It then extends the grant's claim window to the run's own lease: now plus
    `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`, 600 seconds.
  - A grant can be held once, by one run.
  - When the recovery claims the grant, the claim starts the same 600-second
    lease as before. The host's revoke when the run ends is unchanged.
- **A latent bug that holding would have exposed.** `ensureLiveAuthorization`
  compared `grant.expiresAtMs` to decide whether the reveal authorizations
  minted at issue were still live.
  - A held grant's `expiresAtMs` is no longer those authorizations' expiry.
  - A new stored field, `authorizationsExpireAtMs`, now carries that expiry.
    The one-for-one exchange reads it, so a call after the issue TTL still
    exchanges its lapsed authorization.
  - The new test would have failed without this: the reveal refuses a lapsed
    authorization.
- **Headroom.** `execution-grants.ts` was 792 lines. The public metadata type
  and its projection moved to a new `llm/execution-grant-metadata.ts`, and the
  type is re-exported, so the public surface is unchanged. The file is now 772
  lines.
- **`AS/api/handlers/runtime-execution.ts`**: the run endpoint calls
  `holdForRun` before `service.runRuntimeSession`. A grant that cannot be held
  (lapsed, spent, another run's, or out of scope) refuses the run with Core's
  message, and nothing runs.
  - `service.ts` is not touched: 6,275 lines.
  - `api/contracts/llm.ts`: only the `ttlMs` doc comment changed.
- **The panel.** The panel issues its run grant at
  `apps/web/src/features/automation-studio/runtime/FlowRunView.tsx:164`
  (N3-owned, not edited). It sends no `ttlMs` and calls the same run endpoint
  immediately. The Core hold therefore covers the panel with no edit there, and
  there is nothing to route.
- **The Lab** (`TR/live-llm/execution-grant.ts`): the grant request now sends
  `ttlMs` explicitly as `LIVE_LLM_GRANT_CLAIM_WINDOW_MS = 60_000`.
  - That covers only the wait between issuing the grant and the run starting.
    The Lab issues every grant immediately before its run, and from the start
    the hold governs.
  - It is stated rather than left to Core's default, so the two cannot drift
    apart unnoticed.
  - The preflight carries no TTL.

**(2) The conjunction rule**
(`domain/src/runtime/llm-evidence/target/equivalence.ts`), fixed at its cause.

- **The cause.** The rule counted conjunctions without asking what they join.
- **The fix.** A new `joinsAnotherActionToRecorded` treats a name as joining
  another action to the recorded one only when:
  - split at its conjunctions, it has more parts than the recorded name; and
  - one of those parts agrees with a recorded part from the front (one is the
    other shortened or extended, as in "Save" and "Save changes").
- **What that means for the names in question.**
  - "Pick and pack" standing where "Dispatch run" stood is one control's name.
  - "Dispatch run and export", "Export and dispatch run", "Dispatch and export"
    and "Dispatch run then print labels" are still two actions.
- **The form anchor keeps the old count.** It vouches for a control's place,
  never for what its name adds, so the existing refusal of "Apply and close" as
  the only control in the recorded form still holds.
- **Nothing previously refused is now accepted.** Only the reason changes, for
  a name that shares no part with the recording.
- **"Pick and pack" is still refused, now honestly.** The reason is
  `target_unanchored`: no test id, no name and no form ties it to the
  recording.
  - The recorder keeps no anchor for "the same place in the header's action
    group". Its context holds form, landmark, heading, list or table position
    and record, and this module deliberately rejects landmark, heading and
    position as identity.
  - So this fix alone cannot let order-operations pass. That needs a decision
    on a new anchor (for example, a recorder-captured group plus position),
    which is beyond this brief.

**(3) The Lab reader.**

- **`TR/existing-fluxiq-control.ts`**:
  - A patch attempt carries `permissionOutcome` (closed words) and
    `permissionRequired`.
  - A held patch's issue code is taken from those structured fields:
    `runtime_patch.permission_required` or
    `runtime_patch.consequences_undeclared`. It used to be derived from the
    sentence as `preflight_rejected`.
  - `ExistingRunLlmGate` carries `patchHeldCode` (the same shape check as
    `patchSkippedCode`) and `permissions` (the class lists).
  - `ExistingRunDetail` carries `permissionRequest`, read through Core's own
    strict client parser
    (`fluxiq/automation-studio/action-permissions`,
    `parseAutomationStudioActionPermissionRequest`). A request that parser
    refuses fails the read by its path.
- **The evaluation contract** (`packages/test-contracts/src/harness-recovery{,-validation}.ts`):
  - `RunHarnessPatchAttempt` gains an optional `permissionOutcome` (the closed
    list `harnessPatchPermissionOutcomes`) and `permissionRequired`.
  - Validation refuses `permissionRequired: true` unless the outcome is
    `required`, and on an executed patch.
  - Records written before the fields existed still read.
  - The evaluation carries closed words only. The control name and Core's
    sentence stay out of it, and a test asserts this.
- **The live snapshot.** `snapshots/live-llm.json` now carries:
  - `observed.gate.patchHeldCode` and `observed.gate.permissions`;
  - `observed.permissionRequest`: the request as Core built it, with the
    control name only where Core's gate found it in evidence the model was
    shown;
  - `granted.permittedConsequences`.

  `TR/flow-lane/harness-recovery.ts`, `TR/live-llm/observed-usage.ts` and
  `TR/live-llm/live-llm-run.ts` carry these through.

**(4) Core `docs/architecture/automation-studio.md`.**

- The recovery section no longer says the patch preflight reads the flag. It
  now describes:
  - the `consequences` declaration;
  - the four `permissionOutcome`s;
  - `sideEffectPermission`;
  - the `flow_step` request at stage `recovery`;
  - `patchHeldCode`;
  - that a patch call which may run is told `actionPermissions`, while a
    proposal-only call keeps the flag;
  - that only a direct `executeAutomationStudioRuntimePatch` caller passing no
    `sideEffectPermission` is still judged by the flag;
  - that exploration observes a failed tool rather than ending on it.
- The grant-lifetime section now describes the hold, and the new rule that a
  hold does not extend the authorizations minted at issue.

**Tests added or changed for the extension.**

- Core:
  - new `llm/tests/execution-grant-hold.test.ts` (5);
  - `api/handlers/tests/runtime-execution.test.ts` +2: the grant is held
    before the run starts, and an unholdable grant refuses the run with nothing
    run;
  - `api/handlers/tests/llm-generation.test.ts`: two partial grant mocks gained
    `holdForRun`. They failed with a TypeError turned into a refusal until then.
- Domain: `target/tests/equivalence.test.ts` +1, covering both halves of the
  conjunction rule.
- Downstream:
  - `flow-lane/tests/harness-recovery.test.ts` +1: a held repair carries its
    outcome, codes, gate fields and request; the evaluation holds no name; and
    a request Core's parser refuses fails the read.
  - `live-llm/tests/execution-grant.test.ts`: the issue request sends
    `ttlMs: 60_000`, and the preflight sends none.
  - New `packages/test-contracts/tests/harness-recovery-permission.test.mjs` (2).

### Live runs

The same command as above, with `--replays 1` added so any validated repair
would be approved, applied and replayed with no grant.
`FLUXIQ_TEST_ENV_FILES=none` was set on every run, and
`FLUXIQ_LAB_ALLOW_BEHIND_CORE` never was. Core was rebuilt from these sources
before the first run.

| Run | Task, permit | Calls | Recorded cost (USD) | What happened |
|---|---|---|---|---|
| S1 `run-mubtirs0-5d5cf2d4` | social-scheduler, none | 1 (diagnosis: 4,915 in, 599 out) | 0.00295 | The run went from 22:34:13.6 to 22:35:47.6, and the Flow failed about 90 s in. **The recovery resolved its provider** (it did not end in `llm.provider_resolution_failed`), so the grant hold is proven live. The diagnosis was `stillAchievable: "no"`, `patchNeeded: false`, `explorationNeeded: true`, confidence 0.55. The plan was `explore` with no patch, so no exploration ran either. `patchSkippedCode: llm.runtime_patch_not_requested`; `permissions: {granted:[], instructed:[], lapsed:[]}`. |
| S2 `run-mubtvk7u-436132df` | social-scheduler, `send_or_publish,create_new` | 1 | 0.0769, a reservation only | `permissions.granted` was both classes. The diagnosis ended `llm.provider_timeout` at the 25 s per-call limit. |
| S2b `run-mubu79bt-de8d3304` | same, retried | 1 | 0.0769, a reservation only | Identical: the diagnosis timed out. |
| O3 `run-mubupb9m-5160a27e` | order-operations, none | 5 | 0.00445 reported, plus reservations for 3 failed calls | The diagnosis was `stillAchievable: "unknown"`, `explorationNeeded: true`, confidence 0.35. Exploration: 2 actions observed, then decision call 3 timed out (`llm.provider_timeout`). Decision call 4 and the patch call (5) failed as `llm.provider_request_failed`. Exploration ended `invalid_decision` and resolution `patch_failed`. |
| O4 `run-mubuylev-1eb8863d` | order-operations, `modify_existing` | 1 (diagnosis 4,491 tokens) | 0.00232 | `permissions.granted: ["modify_existing"]`. The diagnosis was `stillAchievable: "no"`, `explorationNeeded: false`, `patchNeeded: false`, confidence 0.55. The recovery ended with no patch. |

**Accounting.** In every run, the snapshot's `observed.calls` equals Core's
`accounting.calls` (1, 1, 1, 5 and 1). Tokens actually reported add up to about
USD 0.010. The rest of the recorded 0.39 is the grant's worst-case reservation
for 4 calls that did not return (a charge Core records, not tokens reported).

**The exit chain, link by link, across the four tasks:**

| Link | Observed? |
|---|---|
| Fail | Yes, in every run (`web.target.not_found`). |
| Diagnose | Yes in S1, O3 and O4. S2 and S2b timed out. |
| Explore | Yes in O3 only (2 actions). |
| Generate Repair | No. No patch call returned in any run: in S1 and O4 none was made, and in O3 the grant refused it. |
| Recover | No. |
| Validate | No. |
| Persist | No. `adaptationIds: []` everywhere, so `--replays 1` had nothing to apply. |
| Keyless replay | No. |
| Permission request, at the patch or exploration stage | No. |

The new reader was exercised live: every run's `live-llm.json` carried
`observed.gate.permissions` and `granted.permittedConsequences`. No request or
held code occurred to carry.

### Checks for the extension

- **Core, from `packages/fluxiq`:**
  - `npx tsc --noEmit -p tsconfig.json`: exit 0.
  - `npx vitest run` over the 21 earlier paths plus the new grant-hold test and
    `api/handlers/tests` and `api/contracts/tests`: 55 of 56 files passed on the
    first run. The 2 failures were the partial mocks above. After fixing them,
    `npx vitest run src/programs/automation-studio/api` gave "16 passed (16),
    65 passed (65)".
  - The grant tests (`execution-grant-hold`, `execution-grants`,
    `execution-grant-permissions`): "37 passed (37)".
  - `service-bootstrap/tests/adaptation.test.ts`: 9 of 9.
- **Core root:**
  - `pnpm check`: exit 0, "# fail 0" twice, "structure-audit: passed (172
    warning(s), 361 baselined)".
  - `pnpm build`: exit 0.
- **Domain:**
  - `tsc --noEmit`: exit 0.
  - `target/tests/{equivalence,override}.test.ts`, bundled as
    `scripts/test-domain.mjs` does into a scratch directory I have since
    deleted: "# tests 31, # pass 31".
  - `host-runtime.test.ts` passed earlier.
- **Test contracts:** built; the three harness-recovery test files gave
  "# tests 11, # pass 11".
- **Test runner:** `tsc` exit 0. Fifteen affected test files (harness-recovery,
  execution-grant, existing-fluxiq-control, granted-run-settlement,
  persisted-flow-run, live-repair-lane, lane-observation, run-flow-lane,
  bench/evaluate-run, single-run-evaluation, judge-repair, run-repair-lane,
  budget, lane-settlement, demo-llm-exploration-adaptation-wait):
  "# tests 171, # pass 171".
- **Downstream root `pnpm check`: exit 1**, from two tests in
  `scripts/worktree/tests/remove.test.mjs` (95 and 100). Both fail at
  `process-list.mjs:17` `JSON.parse`: "Bad control character in string literal
  in JSON at position 71721".
  - That is the PowerShell listing of every process on this machine, and one
    process running at the time has a raw control character in its command
    line.
  - I have not changed anything under `scripts/` (`git diff --stat HEAD --
    scripts/` is empty), so this is environmental and pre-existing.
  - The steps of the chain after it, run separately, passed:
    `node scripts/structure-audit.mjs` gave "passed (84 warning(s), 122
    baselined)", and `pnpm -r check` exited 0 with every workspace `Done`.
  - The steps before it, `structure:test` and `lab:test`, passed inside the
    chain.

### Not verified (extension)

- **Recover, Generate Repair, Validate, Persist, the keyless replay and the
  permission request, live.** No run produced a patch.
- **The panel's run with a hold, live.** The panel uses the same endpoint;
  only the endpoint test and the Lab exercise it.
- **Why O3's grant refused calls 4 and 5.** Core's grant keeps a timed-out call
  as a spent call unless the credential had not yet been released or the grant
  no longer validates. The run store keeps codes only, so I cannot tell which.
  - Candidates:
    - the adapter's own 25-second timer fired during secret resolution
      (`validateClaimedGrant` plus the reveal), which counts as "not
      released" and revokes;
    - or the post-failure `validateClaimedGrant` failed.
  - The real-adapter test that makes decisions hang past their deadline passes
    with these changes and still sends the patch, so the joined signal is not
    implicated as far as I can see.
- **Why the permitted social-scheduler diagnosis times out.** Two for two, and
  a different outcome from the unpermitted run. The response is never stored.
  A reply that runs to its 8,000-token limit (DeepSeek's JSON-mode whitespace
  padding, which the system prompt already warns against) would explain it; so
  would provider latency near the limit.

### Open questions or contradictions (extension)

1. **The diagnosis-stage stop is now the first blocker in the chain.** It
   needs a decision in `recovery/plan.ts` and `annotate.ts`, the first of which
   is not mine. My recommendation:
   - When the diagnosis asks for exploration, explore first, whatever its
     `stillAchievable`, since "no" was said before looking.
   - Then make the patch call, which can answer `no_repair` as a first-class,
     recorded decline.
   - Today `annotate.ts:290` needs `patchRequest.request` to explore, and
     `plan.ts:174` drops the patch on "no".
   - The diagnosis instruction (`llm/diagnosis-instructions.ts`) also still
     tells the model to answer "no" when "what it acted on is gone with nothing
     that does the same thing". A relabelled control looks like exactly that
     before anything has been explored.
2. **The 25-second per-call ceiling is below what Core's grant allows (45 s).**
   It is set by the Flow settings check (`AS/api/handlers/llm-execution-settings.ts:25`,
   `boundedWholeNumber(value.timeoutMs, 1, 25_000)`) and mirrored by the Lab
   (`TR/live-llm/live-llm-plan.ts:37`). Raising both to 45 s would tell latency
   apart from runaway output.
3. **order-operations `relabelled-dispatch` needs an anchor, not only the
   conjunction fix.** See (2) above.
4. **O3's grant refusal after a timeout** needs its reason recorded. Adding the
   grant's refusal code to the provider call record, in place of the generic
   `llm.provider_request_failed`, would make this diagnosable. That is in
   `execution-grants.ts` or `run.ts`.
5. **The worktree process lister** (`scripts/worktree/process-list.mjs`) fails
   on a process whose command line holds a raw control character, so the
   downstream `pnpm check` can fail on another lane's process.
