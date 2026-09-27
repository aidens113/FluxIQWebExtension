# t166 — Grants gate only genuinely risky actions

## Outcome

Partial. Every gate I own in both repositories is removed or narrowed, and the
flagship one — the wrong-answer repair refused because the grant's purpose was
not the literal `explore_and_adapt` — is gone. Two whole gate *classes* I did
not expect to find were also removed at their source in the web repository,
which neutralises two Core checks in off-limits files without touching them.
Nine changes remain that live in files another worker holds; each is written out
below with file, line, before and after.

## Validation, with the figures before my change

Concurrent workers were active in both repositories throughout, so the baseline
is not clean and the whole-suite numbers move for reasons that are not mine.
Every figure below is what I observed.

| Check | Before | After |
| --- | --- | --- |
| Core `npx tsc --noEmit` | exit 0, no output | exit 0, no output |
| Core `npx vitest run src/programs/automation-studio` | 38 files failed / 315 passed; **3 tests failed** / 3078 passed, 1 skipped | 42 files failed / 317 passed; **9 tests failed** / 3163 passed, 1 skipped |
| Core targeted grant suites (see below) | not measured separately | 6 files failed / 77 passed; **606 tests passed, 0 failed** |
| Web `pnpm --filter …/domain test` | 837 tests, 837 pass, 0 fail | 847 tests, 847 pass, 0 fail |
| Web `pnpm -r check` | exit 0 (10/10 packages Done) | exit 0 (10/10 packages Done) |
| Web `pnpm check` | not run before (chain) | **fails at `task:test`**: 120 tests, 89 pass, **31 fail**, all `git worktree add` failures in temp fixtures. `structure:test` 182/182 pass, `lab:test` 96 pass 0 fail. Environmental, and no file of mine is involved. |
| `node scripts/structure-audit.mjs` (Core) | not measured before | 1 violation: `runtime/llm/tests/` has 26 source files, limit 25 — another worker's new test in an off-limits directory |
| `node scripts/structure-audit.mjs` (web) | not measured before | passed (107 warnings, 121 baselined) |

**Targeted suites, run alone with `--testTimeout=90000`**:
`runtime/tests/service-adaptation`, `runtime/tests/service-bootstrap`,
`api/handlers/tests`, `runtime/recovery`, `_shared/tests`. **606 tests passed,
none failed.** The 6 failures are all suite *collection* failures with one
cause, `TypeError: automationStudioExploredEvidenceLabel is not a function` at
`runtime/llm/deepseek/system-prompt.ts:29` — a worker's in-flight edit in an
off-limits path, present in my baseline too.

### The Core whole-suite delta is not mine

Of the 9 whole-suite test failures, I checked the ones that could plausibly be:

- `service-flows/tests/representation.test.ts` — 2 failures, `runtimePatchAttempts`
  is `undefined` where a `temporary_wait_retry` was expected. **Not mine**: every
  run in that file is `runRuntimeSession({ … adaptiveMode: "no_llm_intervention" })`
  with no `llmExecution` at all, and my changes only touch the granted path.
  `runtime/executor/{graph-run,ladder-run,node-execution,recovery-ladder,retry-policy}.ts`
  were all modified at 14:20–14:25 by the defensive-policy worker, which owns the
  patch ladder these assertions read.
- `service-flows/tests/scale-pages.test.ts` — `expected 922ms to be less than 500`,
  a performance budget under concurrent load.
- `service-flows/tests/execution-digest.test.ts` and two others — 15 000 ms
  timeouts, which the brief names and which passed in the targeted run.
- The extra collection failures (42 vs 38 files) are the same
  `automationStudioExploredEvidenceLabel` cause.

A second whole-suite run I attempted crashed the vitest worker pool outright
(`RangeError: Maximum call stack size exceeded`, then a tinypool
`Cannot read properties of undefined (reading 'toString')`) under the concurrent
load. That is a harness failure, not a result, and I did not count it.

## What I removed, and what each one was doing

### Core

1. `runtime/recovery/refuted-result/reauthor.ts` — **`grant_does_not_buy_exploration`**.
   Refused the wrong-answer repair unless the run's grant purpose was in
   `{explore_and_adapt, build_and_adapt}`. This is the gate that had never let
   the repair execute; `EXPLORING_GRANT_PURPOSES` is deleted and the decision no
   longer has a field to read a purpose from.
2. `runtime/recovery/refuted-result/reauthor.ts` — **`adaptations_not_permitted`**.
   Refused the same repair when the run's training context had
   `createAdaptations: false`. That is false for exactly one purpose by
   construction — `verify_result`, which is the purpose a run judging its own
   answer holds — so this was the second lock on the same door. The route builds
   through the Flow Bootstrap entry point, which does not consult
   `createAdaptations` at all.
3. `runtime/service.ts` — **the whole `automationStudioRuntimeSessionGrantRefusal`
   call**, which refused a run (and revoked its grant, so the caller could not
   retry) for an unlisted purpose, for being a dry run, for carrying
   side-effect authorization or a domain id under a purpose that "changes
   nothing", and for naming its own run id.
4. `runtime/service.ts` — **the forced `adaptiveMode: "manual_approval"`** on
   every granted run. It overrode whatever the person had configured and, via
   `runtimeAdaptationContextWithRunOverride`, turned off `runRecovery` and
   `createAdaptations` for the very run that was started to get them.
5. `runtime/service.ts` — **`authorizedExternalSideEffects: false`** forced on any
   purpose that `automationStudioRuntimeSessionGrantMayAct` called non-acting.
6. `runtime/service.ts` — **`authorizedDomainIds` emptied** for the same purposes,
   so a run whose grant judged or diagnosed could reach no domain.
7. `runtime/service.ts` — **the `loop_verification` task-kind check** on the result
   check's `resolveGrantedProvider`. A grant whose purpose table omitted that kind
   could not be spent judging its own run's answer, so the run was executed,
   refuted by nobody, and reported as passed.
8. `api/handlers/runtime-execution.ts` — **"An explicit LLM run must create a fresh
   runtime session."** Refused a granted run that named `runId`, and revoked the
   grant with it. A repair has to resume the run that failed.
9. `api/handlers/llm-generation.ts` — **`hasIncompatibleBuildGrantFlags`** and
   `BUILD_GRANT_INCOMPATIBLE_FLAGS`. Refused issuing or preflighting a
   `build_and_adapt` grant if the payload so much as mentioned `runId`,
   `runtimeSessionId`, `idempotencyKey`, `runIntent`, `llmExecutionGrantId`,
   `adaptiveMode`, `dryRunLlm` or `authorizedExternalSideEffects` — one of which
   is what a build that presses anything actually needs.
10. `_shared/runtime.ts` — **the per-entry-point `allowedTaskKinds` narrowing**. A
    build grant was narrowed to `["flow_bootstrap", "evidence_tool_decision"]` and
    a runtime session to its purpose's recovery kinds, so arriving through one door
    made a capability unreachable however the work went. Flow creation, runtime
    failure and an existing Flow's edge case are three entry points into one loop.

### Web repository

11. `domain/src/runtime/llm-evidence/permission.ts` — **the no-check path refused
    the whole declaration**. With nobody to ask, a press declaring `create_new` or
    `send_or_publish` was refused, while the identical press under a run went
    ahead, because Core gates neither class (`action-permissions/destructive.ts`)
    and Core's own no-run check permits exactly them
    (`automationStudioActionPermissionDenied`). Now only the destructive part of a
    declaration is missing, which is what Core would have asked about.
12. `domain/src/output-nodes/definitions.ts` — **`safety.privileged` and
    `safety.requiresOperatorApproval` were `!safeOutput`**, i.e. true for every
    output that touches the page: click, keypress, type, clear, select, scroll,
    navigate, tab, upload, download, dialog, check. Core reads both as permission,
    not description, in two places:
    - `runtime/llm/harness-options/registry.ts:236` drops an option whose
      `requiresOperatorApproval` is true and whose tool id nobody pre-approved,
      **silently** — the model is simply not offered the tool.
    - `runtime/flow-bootstrap/plan/risk.ts:12` returns `"high"` for any plan
      containing such a node, and a high-risk adaptation does not auto-apply — so
      every Flow containing a click was a Flow a repair could not apply itself.

    Both flags are now `false`. That neutralises both Core checks for web nodes
    without touching either off-limits file. `requiredPermissions` stays: that is
    who may operate this domain at all, not whether a press is allowed.
13. `domain/src/io/manifest-definitions.ts` — **`safety.requiresApproval:
    WEB_AUTOMATION_ACTION_SAFETY[...] !== "safe"`**, removed rather than set false.
    Nothing in Core reads it today, which is exactly why leaving it permissive was
    not enough: it is a declaration that scrolling needs a person, one wiring
    change from being enforced. `safety.level` stays — Core reads it only for
    `elementTargetMinimumConfidence`, a target-match threshold, not a permission.

Nothing was replaced with a silent failure. Every removal either lets the action
proceed and be recorded as it always was (the gate raised no record of its own),
or, in case 1 and 2, leaves the run's `resultReauthor` record in place with
`routed: true` and whatever the route then did.

## Gates I kept, and why

- **`runtime/action-permissions/{gate,request,declaration,declared}.ts`,
  `parking/permission-ask.ts`, `conversations/ask.ts`** — the risky-action
  question itself. Untouched.
- **`runtime/action-permissions/destructive.ts`** — gates `move_money`, `delete`
  and `modify_existing`; `send_or_publish` and `create_new` are not gated.
  Two things to decide, flagged rather than guessed:
  - `modify_existing` is **not** on the instruction's list. I kept it: an
    irreversible overwrite of something that already exists is the same family as
    a deletion. It is also the broadest of the five classes, so if Aiden's "delete
    buttons, checkout buttons" is meant strictly, this is the one class to
    reconsider. One line: `modify_existing: true → false` in `DESTROYS`.
  - `send_or_publish` **is** on the brief's list ("sending or publishing on the
    person's behalf") and is currently **not** gated — a deliberate 2026-09-24
    decision, whose reasoning is that the instruction asked for the thing to be
    sent. I did not add a gate, because adding one is not this task. Flagged for a
    decision.
- **`runtime/action-permissions/instructed.ts`** and **`cross-check.ts`** — the
  person's instruction as the source of permission; the cross-check never
  refuses anything. Untouched.
- **`nodes/routine/approval.ts`** — an Approval node a person put in their own
  Flow, and `nodes/policy/action.ts`'s `requiresApproval` parameter, which
  defaults to `false`. Both are the person's explicit setting.
- **`domain/.../plan-resolution/step-permission.ts`'s `webPlanStepMustDeclare`** —
  a click, keypress or dialog step must state `consequences`, `none` included.
  Kept and flagged: this is the *input* to the delete/checkout gate rather than a
  gate on a non-risky act, and its refusal is a correctable plan issue fed back to
  the model, not a permission question. Remove it and the delete/checkout gate
  becomes unenforceable for any press the model stays silent about.
- **`runtime/service.ts`'s "Explicit LLM execution does not accept idempotency
  keys."** — argument coherence, not permission: returning an earlier run under
  the same key would spend the grant on a run it never authorized. Kept.

## Changes I could not make

All in files the brief reserves for other workers. Each is ready to apply.

**A. `runtime/llm/grant-capabilities.ts` — the purpose→task-kind table.** This is
the largest remaining gate: it decides, per purpose, what the model may be asked
for and how many times. `verify_result` is capped at 2 calls and may only request
`loop_verification`; `diagnosis_only` at 1 call and only `runtime_diagnosis`.

Before:
```ts
const GRANT_CAPABILITIES: Readonly<Record<AutomationStudioLlmExecutionGrantPurpose, GrantCapability>> = Object.freeze({
  diagnosis_only: { iterates: false, taskKinds: DIAGNOSIS_TASK_KINDS },
  diagnose_and_adapt: { iterates: true, taskKinds: RECOVERY_TASK_KINDS },
  explore_and_adapt: { iterates: true, taskKinds: EXPLORE_TASK_KINDS },
  build_and_adapt: { iterates: true, taskKinds: Object.freeze([...EXPLORE_TASK_KINDS, { taskKind: "flow_bootstrap", expectedOutput: "flow_bootstrap" } as GrantTaskAllowance]) },
  verify_result: { iterates: false, calls: 2, taskKinds: VERIFICATION_TASK_KINDS }
});
```
After:
```ts
/** Every kind any grant may ask for. A purpose no longer narrows this: none of
 * these is a risky act, and what a grant gates is a lasting real-world
 * consequence, which `permittedConsequences` and the action permission gate
 * still gate action by action. */
const ALL_TASK_KINDS: readonly GrantTaskAllowance[] = Object.freeze([
  ...EXPLORE_TASK_KINDS,
  { taskKind: "flow_bootstrap", expectedOutput: "flow_bootstrap" } as GrantTaskAllowance
]);
const GRANT_CAPABILITIES: Readonly<Record<AutomationStudioLlmExecutionGrantPurpose, GrantCapability>> = Object.freeze({
  diagnosis_only: { iterates: true, taskKinds: ALL_TASK_KINDS },
  diagnose_and_adapt: { iterates: true, taskKinds: ALL_TASK_KINDS },
  explore_and_adapt: { iterates: true, taskKinds: ALL_TASK_KINDS },
  build_and_adapt: { iterates: true, taskKinds: ALL_TASK_KINDS },
  verify_result: { iterates: true, taskKinds: ALL_TASK_KINDS }
});
```
`DIAGNOSIS_TASK_KINDS`, `LOOP_PROTOCOL_TASK_KINDS`, `VERIFICATION_TASK_KINDS` and
`RECOVERY_TASK_KINDS` then have no reader but `EXPLORE_TASK_KINDS`'s spread;
collapse them as the audit requires. Tests to flip:
`runtime/llm/tests/execution-grant/tests/execution-grants.test.ts:333–339` and
`runtime/llm/tests/verify-result-grant.test.ts:32`, which assert the narrow sets.

**B. `runtime/llm/runtime-session-grant.ts:44` — the purposes a session accepts.**
Before:
```ts
export const AUTOMATION_STUDIO_RUNTIME_SESSION_GRANT_PURPOSES = ["diagnosis_only", "diagnose_and_adapt", "explore_and_adapt", "verify_result"] as const;
```
After: add `"build_and_adapt"`. Until this lands,
`api/handlers/runtime-execution.ts:32` cannot accept `runIntent:
"build_and_adapt"`, which is the purpose a Flow built from an instruction runs
under — the same literal-matching mistake as the repair gate, one layer up. The
comment above the const ("`build_and_adapt` is absent on purpose") should go with
it.

**C. `runtime/llm/runtime-session-grant.ts` — delete
`automationStudioRuntimeSessionGrantRefusal` (lines ~97–112) and
`AutomationStudioRuntimeSessionGrantFlags` (lines ~52–58).** After my change to
`service.ts` these have **no caller anywhere**, tests included (verified by
grep). Leaving an uncalled refusal in place is the trap the brief names.

**D. `runtime/llm/runtime-session-grant.ts` — delete
`automationStudioRuntimeSessionGrantMayAct` (lines ~65–67).** Also no caller
left.

**E. `runtime/llm/runtime-session-grant.ts` — delete
`automationStudioRuntimeSessionGrantTaskKinds` and
`AUTOMATION_STUDIO_RUNTIME_SESSION_TASK_KINDS`.** A second allowlist layered on
top of the grant's own. No production caller left after (7) and (10). Test
callers remain and should go with it:
`runtime/llm/tests/execution-grant/tests/{execution-grant-hold,execution-grants}.test.ts`,
`runtime/llm/tests/verify-result-grant.test.ts`,
`runtime/tests/deepseek-recovery-requests.test.ts:193`,
`runtime/tests/service-adaptation/tests/iterating-recovery.test.ts:204`. The last
two are in files I may touch, but they are fixtures that *emulate the host
wiring I changed in (10)*; they still pass, and they now assert a narrowing
production no longer applies, so they should be updated in the same change rather
than separately.

**F. `runtime/llm/runtime-session-grant.ts` —
`automationStudioRuntimeAdaptationContextForGrant` (lines ~145–180).** Three
gates in one function: `verify_result` forces `invokeLlm: false,
createAdaptations: false, promoteAdaptations: false`, so the purpose that judges
an answer may not then repair it; `diagnose_and_adapt` forces `runRecovery:
false`; and **every** branch forces `policy.proposalMode: "manual"`, so no
granted run may ever apply what it learned without a person pressing approve —
which is the "a repair must be automatic" requirement being gated.
After (one branch for every purpose):
```ts
export function automationStudioRuntimeAdaptationContextForGrant(
  context: AutomationStudioRuntimeAdaptationContext,
  purpose: AutomationStudioRuntimeSessionGrantPurpose
): AutomationStudioRuntimeAdaptationContext {
  return {
    ...context,
    behavior: { ...context.behavior, invokeLlm: true, createAdaptations: true, promoteAdaptations: true },
    diagnostics: [...context.diagnostics, `Explicit ${purpose} run iterates under the configured cost, token and deadline budgets.`]
  };
}
```
The `policy` override goes entirely, so the person's own `proposalMode` stands —
that is the one legitimate source of a restriction. Note `runRecovery` is left as
configured, which is what the old `explore_and_adapt` branch claimed and did not
get, because the forced `manual_approval` in `service.ts` had already set it
false before this function ran.

**G. `runtime/llm/harness-options/registry.ts:236` — a silent exclusion.**
```ts
if (option.safety?.requiresOperatorApproval === true && !new Set(resolution.approvedOptionIds ?? []).has(option.toolId)) return false;
```
Delete the line. My web-repo change (12) means no web option declares the flag
any more, so this no longer fires for web automation — but the check itself is a
gate on a non-risky thing, it is decided by the tool's *kind* rather than by what
an action would cause, and it fails by not offering the tool at all, which is the
worst available failure mode: the model cannot ask for what it is not shown, and
nothing records that it was withheld.

**H. `runtime/flow-bootstrap/plan/risk.ts:12` — risk from a declaration, not a
consequence.**
```ts
if (definition.safety?.privileged || definition.safety?.requiresOperatorApproval || runtime?.process || runtime?.childProcess || runtime?.filesystemRoots?.length) return "high";
```
The two `safety` clauses should go; the `runtime.*` clauses (a child process, a
filesystem root) are a different kind of claim and I would keep them. With (12)
this no longer marks a web Flow high, so it is no longer blocking the loop, but
any domain that declares the flags gets its repair blocked from applying itself.

**I. `api/handlers/llm-generation.ts:107–115` — only a build-purpose grant may
build.**
```ts
const grant = await llmExecutionGrants.inspectAvailable({ …, purpose: "build_and_adapt" });
if (grant.purpose !== "build_and_adapt" || grant.settingsRevision === undefined) throw new Error("A valid build_and_adapt grant is required.");
```
Authoring a Flow is not a risky act, so an `explore_and_adapt` grant should be
able to do it. The handler is mine, but `inspectAvailable` takes one purpose and
validates against it, and it lives in `runtime/llm/execution/grants.ts`, so the
fix is to let it accept a set of acceptable purposes. Left alone.

**J. `runtime/service.ts:1717` — a grant spent by one build.**
```ts
if (grantId && unsafeGrant?.purpose !== "explore_and_adapt") this.revokeLlmExecutionGrant?.(grantId);
```
This file is mine, but the change is not: a build's grant is revoked the moment
generation ends, so "repair again on the same grant" is impossible by lifecycle
rather than by policy — which is on the instruction's list of things that must
not be gated. Correcting it means deciding when a grant's lease ends, and that
lives in `execution/grants.ts`. Flagged, not changed.

## Tests I changed, and why the old assertion was wrong

Each of these asserted that a non-risky action was refused.

- `runtime/recovery/refuted-result/tests/reauthor.test.ts` — asserted
  `grant_does_not_buy_exploration` for `diagnose_and_adapt` and for no purpose,
  and `adaptations_not_permitted` for `createAdaptations: false`. Both were
  permission questions about repairing a Flow. Now one test asserts a wrong
  answer routes whatever grant the run holds, and the only refusal left is
  `flow_unavailable`, which is an inability.
- `api/handlers/tests/llm-generation.test.ts`, "issues an opaque grant…" —
  asserted a granted run naming `runId` was refused **and its grant revoked**, so
  the caller could not retry. Now asserts the run proceeds, forwards the `runId`,
  and keeps its grant.
- `api/handlers/tests/llm-generation.test.ts`, "rejects build grants carrying
  existing-runtime flags" — asserted a build grant was refused for the mere
  presence of runtime flags in the payload, `authorizedExternalSideEffects`
  included. Renamed and flipped: the grant issues, and the grant service is
  reached.
- `runtime/tests/service-adaptation/tests/iterating-recovery.test.ts`, "refuses a
  runtime session purpose that is not a recovery…" — asserted three refusals: an
  unlisted purpose, a dry run, and side-effect authorization under a purpose that
  changes nothing. All three revoked the grant. Flipped to assert all three run.
- `runtime/tests/service-adaptation/tests/llm-grants.test.ts`, "binds and revokes
  a diagnosis-only execution grant…" — asserted refusals for `dryRunLlm`,
  `authorizedExternalSideEffects` and `authorizedDomainIds`. Flipped. The
  idempotency-key refusal in the same test is kept and is now commented as
  argument coherence.
- `runtime/tests/service-adaptation/tests/llm-grants.test.ts`, "rejects a
  diagnosis grant attached to a pre-staged cross-domain runtime session" —
  asserted the attach was refused twice, with `dispatchCount` 0. Flipped to
  assert the run attaches and dispatches once. **This is the one place where
  removing a refusal lets something through that did not go through before**, and
  it is worth reading carefully: the old assertion's zero came from the refusal,
  not from the domain list. `authorizedDomainIds` is read by composition
  validation and never by the effect dispatcher, so the same run **with no grant
  at all** dispatches identically. Holding a grant had made a run *more*
  restricted than holding none. What stops an action nobody allowed is the action
  permission gate, which is untouched.
- `domain/src/runtime/llm-evidence/tests/press.test.ts`, "with no permission check
  to ask…" — asserted a `send_or_publish` press was refused. Renamed; now asserts
  `delete` is still refused and `send_or_publish` proceeds.
- `domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts`, "a
  refusal with no run behind it…" — asserted `missing: ["send_or_publish",
  "create_new"]`. Now `["delete"]` from a `["delete", "create_new"]`
  declaration, plus a new assertion that a purely non-destructive declaration is
  not refused.
- `domain/src/tests/safety.test.ts` — asserted `requiresApproval`, `privileged`
  and `requiresOperatorApproval` were all `!safe`, i.e. that every mutating web
  action needs a person because of what kind of action it is. Now asserts the
  manifest has no `requiresApproval` field at all (a compile error if it comes
  back) and that both node flags are `false`. `level` still varies, because Core
  reads it as a target-match threshold rather than as permission.

No test asserting a genuinely risky refusal changed. The destructive path is
asserted in both repositories after the change: `delete` is still refused with
nobody to ask, and Core's gate tests (`action-permissions/tests/{gate,destructive,
instructed}.test.ts`) were untouched and pass.

## Not verified

- **No live run.** Nothing here was exercised against the real provider or a real
  page. The claim that the wrong-answer repair can now execute is a claim about
  the route being open, not a measurement of it repairing anything.
- **No Core build**, as instructed, so the web repository's tests ran against
  Core's existing `dist`. `automationStudioDestructiveConsequences`, the one new
  Core import I added on the web side, is present in that `dist` (checked in
  `dist/programs/automation-studio/runtime/action-permissions/destructive.d.ts`),
  so the domain typechecks and runs — but the web repository is not exercising my
  Core source changes, and it will need a Core rebuild before it does.
- **The Core whole-suite figure after my change is noisy**, as detailed above. I
  attributed each failure by path and mtime rather than by bisecting, because
  bisecting would mean reverting other workers' in-flight files.
- **`pnpm check` in the web repository never reached `structure-audit` or
  `pnpm -r check`**, because `task:test` fails first. I ran both stages
  separately; the audit passes and `pnpm -r check` exits 0.
- **`runtime/llm/execution/grants.ts` (764 lines) I did not read in full.** It
  holds the grant store, `inspectAvailable`, `maxCalls`, `remainingUses` and an
  absolute call backstop. There may be further purpose-keyed behaviour in it that
  I have not inventoried; item I is the one I know about.
- **`packages/test-runner` and `packages/test-contracts`** mention grants,
  purposes and consequences. I inventoried them as test scaffolding that requests
  and records grants rather than refusing product actions, and did not change
  them. `pnpm -r check` covers their compilation.

## Open questions or contradictions found

1. **`send_or_publish` is on the brief's high-risk list and is not gated.** The
   brief names "sending or publishing on the person's behalf" as genuinely
   high-risk; `destructive.ts` deliberately does not gate it, on the reasoning
   that the instruction asked for the thing to be sent. One of the two needs to
   move. I changed neither.
2. **`modify_existing` is gated and is not on the list.** Kept and flagged above.
3. **The same bug shape appears three times.** A capability was gated on a purpose
   *literal* — `explore_and_adapt` in the repair route, `loop_verification` in the
   result check, `build_and_adapt` in the session purposes and the generate
   handler. Each was invisible until a live run hit it. A check that compares a
   grant's purpose to a string is the pattern to forbid mechanically, not just to
   fix here.
4. **Two gates refuse by omission, which is worse than refusing.**
   `harness-options/registry.ts`'s `isOffered` returns `false` and the tool simply
   is not in the model's vocabulary; nothing records that something was withheld.
   The same shape is in `plan/risk.ts`, where a `high` band silently prevents a
   repair applying itself. Both deserve a record even after the gates narrow.
5. **A grant now makes a run strictly no more restricted than no grant.** That was
   not true before — a `diagnosis_only` grant emptied `authorizedDomainIds` and
   forbade side effects. If that invariant is wanted as a rule, it is testable:
   for any input, the behaviour with `llmExecution` set must permit at least what
   the same input without it permits.
