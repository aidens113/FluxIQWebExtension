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
