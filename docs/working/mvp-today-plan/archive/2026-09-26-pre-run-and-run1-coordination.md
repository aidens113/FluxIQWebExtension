# MVP Today — archived pre-run and run-1 coordination snapshot

Status: Active
Status detail: The defensive runtime, risk-only permission boundary, structured judge-to-repair path, and extraction contract are integrated and locally validated. The first provider-backed hard-scenario measurement remains, so deterministic replay and the strengthened self-repair path are not yet live-proven.
Created: 2026-09-26
Last updated: 2026-09-26
Owner: Senior supervisor agent
Scope: Getting the MVP over the line — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself, and judges its own answer — by making the runtime defensive by default for every node, removing every grant that gates anything but a genuinely risky action, making the judge issue fix instructions rather than a verdict, and then running the live loop until a hard scenario passes twice. It deliberately does not re-plan the loop's operating procedure, which is in language-driven-flow-loop-plan.md, and does not cover recorded Flows or any surface that does not block these four criteria.
Paired document: `none yet — the Core-side changes land under FluxIQ Core's own working documents as this plan names them.`
Related: [language-driven-flow-loop-plan.md](../../language-driven-flow-loop-plan.md) (the operating loop, the run history, and the twenty-three tasks already built), [flow-authoring-and-defensive-runtime-plan.md](../../flow-authoring-and-defensive-runtime-plan.md) (the earlier defensive-runtime design this supersedes on defaults), [fluxiq-conversations-plan.md](../../fluxiq-conversations-plan.md) (where a genuinely risky action's question reaches the person)

---

## Current State

**Why this document exists.** The loop document records twenty-three tasks built today, all
verified by unit tests and isolation measurements and **none by a provider call**. The user's
assessment on 2026-09-26 was that the MVP is close and that the remaining distance is not more
debugging but three rules that have been stated repeatedly and not applied as defaults. This
document is those rules and the ordered path to a passing live run.

**Where the four criteria actually stand.**

| Criterion | State | What it still needs |
| --- | --- | --- |
| Created from language | **Works, repeatedly.** Ten-node Flows built from an instruction with no recording, including navigation, interruption dismissal, a typed search and an extraction | Fidelity: the built Flow must match what exploration proved, and must carry the instruction's qualifying clauses |
| Runs deterministically | **Unproven.** Gated behind a correct answer, which has never happened; best ever is 3 of 13 rows in position | A defensive runtime, so a replay survives the page it did not author |
| Repairs itself | **Route open, fired once.** Was never reachable at all until `85e0d38`; one run applied a correction, the next reached the re-author and failed inside it | A judge that says what to fix; the ability to amend a node's parameters; no gate in the way |
| Judges its own answer | **Works.** Five consecutive runs stored plausible tables and all five were refuted rather than reported | Its refutation must carry instructions, not just a verdict |

**The three rules this document exists to apply**, all from the user on 2026-09-26 and all
binding. They are stated in full under `The Binding Rules`.

1. **The runtime is defensive by default, for every node, core or custom.** A recoverable
   fault — a changed page, a late element, a 429 or a 500, a timeout, a dropped connection —
   is absorbed. A Flow never stops for something that could have been retried.
2. **The user's instruction is the grant.** Grants gate only genuinely high-risk real-world
   actions: deleting, checking out, paying, sending, publishing. Everything else — repair,
   re-authoring, rollback, re-running, extraction, judgement — has free rein. Every other gate
   is removed, not defaulted open.
3. **The judge says what to fix.** It is given the same context as the other modes and returns
   explicit instructions and suggestions about the data, not a label.

**Implemented and reconciled.** t163 identified the retry and recovery gaps. t164-t169 added
the structured judge directive, Core-wide defensive execution, provider retry, browser-side
recovery, and the risk-only permission boundary. t173 then found three integration defects:
grant-aware provider retry, a post-deadline browser dispatch, and lossy judge advice. t170 and
t171 closed all three. t175-t177 and t181 established that the remaining stable failures were
stale fixtures or assertions rather than production regressions, without weakening refusal or
parameter-withholding boundaries.

**Local validation is green.** Core's structure/check/build gates pass, and its serialized full
suite passed 3,964 tests with one intentional skip. Downstream structure and package checks pass,
the full build passes, the domain suite passes 847/847, and the runner suite passes 1,462/1,462.
The complete post-fix downstream run passes all ten workspace packages and 3,920 tests. The root
`pnpm check` task-fixture stage remains unavailable because this machine cannot spawn
`git worktree add`; product-equivalent structure and package checks pass separately. A final
high-risk review subsequently found one send/publish permission gap, now assigned as t189; its
focused and integration validation gates the live run.

**What remains before measurement.** The isolated readiness probe resolves
`everything-store-plus-earbuds-under-50` with zero provider calls, and the ignored runner CLI was
rebuilt after a machine crash. Once the post-fix integrated suite and final release inventory are
confirmed, run the hard scenario with one replay, inspect the complete artifacts and write its
debug record. Repeat serially until two consecutive runs pass.

**Known environment limitation, not a product-behavior blocker.** `git worktree add` fails on
this machine with `cannot spawn git: Exec format error`, so the paired task uses a plain branch in
each repository. No product or live-scenario blocker is currently known.

---

## What The Audit Found

The cross-repository audit (t163) is the evidence this plan rests on. Its conclusion reframes
rule 1: **the defensive runtime already exists and is on by default, and is gated behind one
boolean that almost nothing sets.** So the work is less building a policy than making the one
that exists reachable, and filling what was never written.

**One gate decides all deterministic recovery.** `runtime/executor/retry-policy.ts:88` returns
false for an attempt whose `failure.retryable !== true`, and for any attempt staged
`verification` or `confirmation`. That result gates ladder rungs 2, 3 **and** 4. Everything it
refuses drops to `llm_diagnosis`, which is never executed in-run, which ends the run at
`graph-run.ts:471`.

**The largest live failure cause is two files contradicting each other.**
`web.validation.output_not_observed` is declared `retryable: true` in the domain's code table
and discarded by Core on its stage. **11 of roughly 18 reportable live runs died there.** Both
files carry comments claiming a deliberate reading.

**Nothing retries a provider fault.** The DeepSeek adapter marks 429, 5xx, timeouts and network
errors retryable; the only consumer writes the flag into metadata, and a grep for
`backoff|sleep|delay` over the whole `runtime/llm/` tree returns **zero hits**. Two runs died
here. With the above, these two account for 13 of roughly 18 reportable failures.

**Every web node executes outside Core's only try/catch.** The guard covers the
`definition.execute` path alone; the native-executor, effect-dispatch and composite awaits are
unguarded, and all 18 web output nodes take those paths. `runGraphFromSeed` has no try/catch
either, so a throw ends the session and rethrows — no attempt row, no ladder, no repair.

**Three of the ladder's four rungs are dead, and that is now measured rather than inferred.**
`readyState` and `clearsInterference` have no writer in either repository; `expectedState` is
written only by the recording path. Across all 150 run directories: `retry_node` fired in 12
runs, `await_recorded_state` in **0**, `clear_interference` in **0**. The ladder is one rung
deep and that rung works.

**Two gates defeat themselves.** The `clear_interference` rung is gated off by `retryable`, and
the code it exists for — `web.action.blocked_by_dialog` — is `retryable: false`, so the rung for
dialogs is switched off by the dialog code. And the justification for not retrying record-less
attempts assumes every web action emits a record, which holds for the content-script path only,
not for two catch paths nor 37 of Core's 41 built-in nodes.

**The scale.** Of Core's 41 built-in nodes, 4 emit any failure record and **0** can reach the
retry rung on their own record. Of the domain's 16 failure codes, **4** can reach a retry.

**One case that must get *less* defensive.** A browser-API refusal —
`Cannot access contents of url "about:blank". Extension manifest must request permission…` —
was classified `web.action.failed` with `retryable: true`, retried at 250 ms and 1 000 ms, and
then ended the run. The machinery worked as designed; the closed code set had nothing better to
say. Absorbing the transient and refusing the deterministic is one rule, and the deterministic
half needs its own code.

**Two earlier symptoms are confirmed already fixed**, from source: the list wait is now a
10 000 ms render window, and the required-field default reports a stated gap instead of failing
forty good rows.

**Who owns each.** The gate, the unguarded seam and the dead rungs went to t165; the domain's
code table and the browser-API code to t167; the provider retry, which nobody held, to t168.
The audit's ranked fix list has eight entries, each sized as one task.

---

## What The Defences Now Do

**The web side is built (t167).** Its survey found the inversion exactly: **nine of the fifteen
verbs resolved their target once, synchronously, in the millisecond the command arrived**, and
failed outright. The only verbs that waited were the three whose whole purpose is waiting, plus
the list read — so the runtime was defensive only where *the model* had authored a wait node,
which is the inversion the user rejected.

Every verb now runs behind a bounded retry at one seam, `executeContentAction`: four rungs at
250/500/1000/2000 ms for a target the page has not drawn, two at 250/500 ms for a blip, a
5 000 ms whole budget measured from the command's start and never exceeding its own `timeoutMs`.
**Worst case about five seconds added, and zero where the verb already spent the command's
time.** A retry calls the verb afresh, so re-resolution, a moved target and a stale reference are
one fix. A verb that can move the page absorbs only a fault thrown *before* anything was
dispatched, so a click is never pressed twice — asserted for all four post-gesture codes.

**The contradiction is settled with an argument, not a coin toss.** `verification` correctly
describes where `output_not_observed` is decided and `retryable: true` correctly answers Core's
question; the defect is that Core's gate uses the **stage as a proxy for side-effect safety**,
which the stage does not carry — a read and a click both fail post-conditions at `verification`
and only one is unsafe to repeat. The fix is for Core to ask `sideEffectClassForNode` directly.
Rewriting the stage would have made the field mean "what Core will retry" and destroyed the
question. Meanwhile the extension does not wait for Core: an unpaginated list read whose
post-condition failed is re-read **in the page**, before the gate is consulted, which covers the
measured 11-run case. A paginated read still needs Core's change.

**Two new failure codes, in opposite directions.** `web.browser.permission_denied` is
non-retryable, so a manifest or permission refusal is refused once instead of retried three times
and then reported as a mystery; `web.transport.transient` is retryable. The browser's own message
is read into one of them, and a message it does not recognise keeps the caller's existing code —
so the reading can only sharpen, never mislead.

**One more total-versus-partial failure found and fixed, in neither brief.** The list reader's row
loop had no catch, so **one recycled or detached element threw out of the read and every row
already gathered was discarded.** Rows that throw are now skipped and counted, a failed page
advance ends the read with the pages it has, and both are named in the read's own account.

**What is still owed on this half.** The recovery account reaches Core only as prose on the
validation's `actual`. Making it countable is a four-line change across `domain/src/actions/types.ts`,
`domain/src/client/gateway-mapping.ts` and a Core projection — specified in t167's report section 7,
not yet assigned, and deliberately **not** done by widening the evidence result's top-level keys.

---

## What The Judge Now Does

**The judge was strictly poorer than the repair it triggers.** t164 measured it: the call was
shown each step as `{nodeId, definitionId}`, while the repair has had each step's screened
parameters since this morning. So the judge was being asked whether the Flow had "a step that
could have narrowed" the result — against a list of names in which a Flow filtering on the right
field and one filtering on the wrong field are **the same list**. It was also denied the
conversation, which the repair reads, in a file whose own comment says a repair that cannot read
it repairs blind.

**Parity, through the same screens.** `flowShape` now carries each step's label, parameters and
withheld paths through `automationStudioScreenedNodeParameters` — the same screen, the same
credential and locator rules, the same dotted-index paths settled earlier today. Page evidence
is genuinely unavailable to a judge, because a clean run captures no failure; that is an absence,
not a withholding.

**The instructions reach the repair through the channel that already exists.** The repair is
handed `failure.expected` and `failure.actual` and nothing else. So the directive rides there:
`expected` carries what the request asked for plus the fix lines, `actual` carries the
observation — both bounded to the record's 1,024 characters. No change was needed outside the
verification directory for that to work.

**Nothing new is demanded of the model.** No response field, no schema key, no parse. The
judgement is read off the `expected`/`observed`/`changed` the diagnosis reply already carries,
with the reply's summary as fallback advice. A wrong type, whitespace, 900 characters, a
credential-shaped or locator-shaped value: each is absent or redacted, **the verdict stands**,
and `withheld: true` says so. That is the "easy to produce" rule holding under adversarial input.

**The ask itself is now written** (supervisor, direct): the judge is told to say in `observed`
which rows or columns are wrong and in `changed` what to change — naming the clause of the
request the result fails and the step whose parameters would have to change — and told plainly
that a bare verdict is not the job because the repair gets what it writes and nothing else. The
closing sentence is load-bearing in the other direction: **a refusal with no advice is still a
valid refusal and nothing fails for it**, which the code already honours.

**Cost, measured rather than estimated:** the summary grows 710 → 1,262 bytes for a realistic
five-step web Flow, about **+138 input tokens per judged call** — 0.03–0.06% of a build's
441,531 tokens, zero output tokens, zero extra calls, and the packet's ceiling unchanged.

**Two widenings outstanding**, handed to the worker holding that file: carry the conversation to
the judge, and carry `recordCount` on recent actions so the judge can see that the step meant to
narrow the result stored the same count as the step before it — which is precisely the shape of
the 43-where-13-expected answer.

---

## The Binding Rules

These are product requirements. A design that weighs them as options has misread them.

### 1. Defensive execution is the default, for every node

Every node executes defensively without opting in — Core's built-ins, the web domain's output
nodes, a native or host-executed node, and one added tomorrow. The policy lives at the seam
every dispatch passes through, so a new node inherits it rather than implementing it.

- **Retries on by default**, with a sensible attempt count nobody configures, and backoff.
- **The fault class decides the response.** Transient HTTP (429, 500, 502, 503, 504), timeouts,
  aborted requests, dropped connections, malformed response bodies, detached elements,
  navigation races: retried. A deterministic refusal — bad input, an unmapped output — is not,
  because retrying it only spends time.
- **A recorded delay is a ceiling, not a sleep.** The gap recorded during authoring is the
  *maximum* wait for that node's expected state. If the state appears sooner the node runs
  immediately; if it never appears the node is still attempted at the deadline rather than
  failed outright.
- **Partial beats nothing.** A read that got some rows returns them and says what it missed. A
  request with one unusable part drops that part, names it, and runs. The worst failures in this
  product's history were total rather than partial.
- **Nothing is swallowed silently.** Every absorbed fault is recorded — which fault, which
  attempt, what it cost. A defence nobody can see is a defence nobody can trust.
- **Bounded.** Worst-case added wall clock per node and per run is stated and capped. A defence
  that turns a fast failure into a hang makes live runs worse.
- **A mutating action does not act twice.** A click whose confirmation was missed is not retried
  blindly; each mutating node says how its retry is made safe or why it is excluded.

The runtime carries this, **not the model**. Answering a brittle runtime by making the model
smarter, or by asking it to author retries, or by leaving robustness to the repair loop, does
not satisfy this rule. The repair loop improves a Flow's intent; it is not a substitute for a
node that survives an ordinary web page.

### 2. The user's instruction is the grant

A person asking for an automation has granted everything the automation needs in order to work.
There is no second permission for the product doing its job.

- **A grant is reserved for genuinely high-risk real-world consequences**: deleting, completing
  a purchase or checkout, paying, sending or publishing on the person's behalf. Those ask the
  person, and that machinery should get better rather than weaker.
- **Nothing else may be gated**: triggering a repair, repairing again, editing or re-authoring a
  Flow or subflow, rolling a version back, re-running, exploring, extracting, judging, retrying a
  node, persisting what was learned, being in an unusual mode, spending a call.
- **Only an explicit instruction or setting narrows a Flow.** A restriction must never arise from
  the architecture's own caution.
- **Remove, do not default open.** A gate left in place with a permissive default is the same trap
  one setting away.

This is a bug report, not a preference. The wrong-answer repair never executed once across five
live runs because its route was gated on the grant purpose being the literal
`explore_and_adapt`, while a Flow built from an instruction runs under `build_and_adapt`. The
gate made nobody safer; it silently disabled the feature the MVP is for and hid that for days.

### 3. The judge says what to fix

- **Same context as the other modes.** Whatever creation and repair are shown — the instruction,
  the Flow, the run's actions and results, the page evidence, the extracted data, the conversation
  — the judge sees.
- **A refutation carries instructions.** Which rows or columns are wrong, which qualifying clause
  was not applied, which step most plausibly caused it, and concrete suggested fixes.
- **Encouraged, never demanded.** The asking says a bare verdict is not the job; a terse
  judgement is still a valid refusal, and no run fails because the judge offered no advice.
- **Easy to produce.** Few required fields, forgiving parsing, anything derivable computed by
  Core. A malformed suggestion must not cost the verdict.

The judgement is the input to the repair. A repair handed only "wrong" pays for a second full
exploration; one handed "the rating floor never reached the extraction" acts immediately.

### 4. The rules already in force that these compose with

Stated here because a defensive default must not contradict them: a node is usable with
**minimal parameters** and an omitted parameter gets a permissive default; an unknown name the
model writes **resolves to its nearest match** using name and shape rather than being refused; a
**removal is always an explicit model decision** and attributable in the run's record; and every
model change to a Flow or subflow is a **new version** that the evaluator can roll back.

---

## The Order Of Work

Each step gates the next. The point of the ordering is that the first live run measures a tree
that is whole, because a run against a half-built tree is not a result.

**1. Land the five dispatched tasks.** The defensive audit, the judge, Core's node policy, the
grant removal, and the web nodes' defences. The audit is read-only and informs the rest; the
other four edit disjoint files.

**2. Apply what the workers could not reach.** The grant removal is deliberately partitioned
away from files other workers hold, and reports its remaining changes as exact before/after
edits. The supervisor applies those once the holders finish. Same for anything else a report
hands back.

**3. Rebuild all three trees and run the narrow checks.** Core, the domain, the extension. Then
`pnpm check` in this repository and the Core suites, and the two assertions a name-resolution
change is known to flip — `column-match.test.ts`'s honest-failure case and `slot.test.ts`'s
`unknownField` entry, both of which must be updated to assert the new behaviour with `banana`
and a selector still refused.

**4. One live run on `everything-store-plus-earbuds-under-50`, debugged in full.** This is the
first run since twenty-eight tasks landed, so attribution is harder than usual and the debug
must be explicit about which change each observation exercises. Expect to learn more from it
than from any run so far, because for the first time the model is told why its edits fail, the
read waits properly, the filter vocabulary is visible, and the judge says what to fix.

**5. Fix what that run names, and run it again.** Until it passes twice in a row. A scenario is
finished when it works, not when it has been attempted.

**6. Then open the other nine lanes**, concurrently, one hard task each, isolated by
`FLUXIQ_LAB_INSTANCE`. The lane table is in the loop document.

---

## What Would Make This Fail

Recorded so the plan is falsifiable rather than optimistic.

- **A defensive default that hides a real defect.** If a node now retries past a genuine product
  failure and reports success, the loop loses its ability to measure. This is why every absorbed
  fault must be recorded: the defence and the evidence of it are one requirement, not two.
- **A removed gate that lets a consequential act through.** The rule keeps the high-risk gates;
  if the removal over-reaches, a test asserting a genuinely risky action is refused will break,
  and that break is a stop signal rather than a test to update.
- **Twenty-eight changes measured at once.** Attribution across them is the known cost of having
  fanned out this wide. The mitigation is that most of them make the run *say* more, so the next
  debug reads causes off the artifacts instead of inferring them from durations.
- **A wrong answer that is now harder to see.** Six of ten runs read nothing because of a
  two-second wait; with that fixed, reads will return data, and a wide-but-wrong answer is more
  work to judge than an empty one. The judge's new instructions are what carries that weight.

---

## Worker Briefs

Dispatched 2026-09-26 for integration of t164 through t169. These briefs partition the
already-dirty trees by repository and package. No worker may start a live Lab run or a
repository-wide validation command; the supervisor owns combined validation after all edits stop.

### Brief: t170-core-integration
- Repository: FluxIQ Core (`F:\!FluxIQ`)
- Task: reconcile and finish the in-progress t164/t165/t168/t169 Core changes so the focused
  executor, provider-retry, result-verification, and action-permission scopes are internally green.
- Required reads: this document's `Current State`; reports t164, t165, t168 and t169; Core
  `AGENTS.md` Repository Boundary; only the source/tests named by those reports.
- Owns (may edit): `packages/fluxiq/src/programs/automation-studio/runtime/{executor,result-verification,action-permissions}/**`;
  `runtime/llm/provider-retry/**`; `runtime/llm/{grant-capabilities,runtime-session-grant,diagnosis-instructions}.ts`;
  their directly owned tests; `runtime/llm/harness-options/registry.ts`;
  `runtime/llm/deepseek/system-prompt.ts`; `runtime/flow-bootstrap/plan/risk.ts`; and unique report file.
  Also owns `packages/fluxiq/src/programs/automation-studio/api/contracts/tests/llm.test.ts`
  solely to reconcile the two contract assertions changed by those owned runtime contracts.
  Also owns `packages/fluxiq/src/programs/automation-studio/api/contracts/llm.ts` and direct shape
  assertions solely for the provider retry count changing from literal zero to the bounded grant allowance.
  Review follow-up ownership: `runtime/llm/execution/{grants,grant-metadata}.ts` and directly
  relevant tests for composed provider-retry accounting; `runtime/recovery/{context.ts,refuted-result/attempt.ts}`
  and directly relevant tests for a structured, bounded judge directive reaching repair.
- Must not touch: other Core paths; either working document; downstream repository files; commits.
- Definition of done: fix owned compile/test/structure failures; run focused type/test checks; record
  exact results and anything outside ownership that still blocks combined validation.
- Report to: `docs/working/mvp-today-plan/reports/t170-core-integration.md` in this repository.

### Brief: t171-web-integration
- Repository: this repository
- Task: reconcile the in-progress browser/domain defensive-execution and extraction changes from
  t167, including the two known name-resolution assertion flips, without touching Lab packages.
- Required reads: this document's `Current State`; report t167; changed files under
  `apps/extension/` and `domain/` only.
- Owns (may edit): `apps/extension/**`, `domain/**`, and unique report file.
- Must not touch: `packages/**`; shared working documents; Core; commits; live Lab runs.
- Definition of done: affected extension/domain type checks and focused tests pass; build the
  affected packages if the focused checks are green; report remaining cross-repository failures.
- Review follow-up: ensure recovery never dispatches a new content action after the command's hard
  timeout, including scheduler overshoot, with a focused advancing-clock test.
- Report to: `docs/working/mvp-today-plan/reports/t171-web-integration.md`.

### Brief: t172-lab-readiness
- Repository: this repository
- Task: reconcile the changed test-contract and test-runner extraction lane, and prove the named
  scenario is ready to run once product builds are refreshed.
- Required reads: this document's `Current State`; changed files under `packages/test-contracts/`
  and `packages/test-runner/`; scenario definition for `everything-store-plus-earbuds-under-50`.
- Owns (may edit): `packages/test-contracts/**`, `packages/test-runner/**`, and unique report file.
- Must not touch: `apps/**`; `domain/**`; Core; shared working documents; commits; live Lab runs.
- Definition of done: focused package checks/tests pass and the exact supervisor command/environment
  for one isolated live run is recorded without exposing secrets.
- Report to: `docs/working/mvp-today-plan/reports/t172-lab-readiness.md`.

### Brief: t173-cross-repository-review
- Repository: both repositories, read-only except unique report
- Task: review the complete uncommitted product diff for contract mismatches, unsafe retries,
  swallowed recovery evidence, or changed behavior without a proportional test.
- Required reads: this document's `Current State`; reports t164 through t169; only changed source
  and test hunks needed to substantiate findings.
- Owns (may edit): unique report file only.
- Must not touch: all source, shared working documents, commits, builds, and live Lab runs.
- Definition of done: rank only concrete actionable findings with file/line evidence; explicitly
  say when no release-blocking mismatch is found.
- Report to: `docs/working/mvp-today-plan/reports/t173-cross-repository-review.md`.

### Brief: t174-remaining-grant-gates
- Repository: FluxIQ Core, read-only except unique downstream report
- Task: decide whether t166 handoffs I and J still gate this live scenario: generation's accepted
  grant purpose and service-time grant revocation after a build.
- Required reads: this document's `Current State`; report t166 sections I/J; Core
  `api/handlers/llm-generation.ts`, `runtime/service.ts`, and directly relevant tests/callers.
- Owns (may edit): unique report file only.
- Must not touch: all source, shared working documents, commits, builds, and live Lab runs.
- Definition of done: trace the exact current call path and give a yes/no blocker verdict plus the
  smallest correct fix if either gate remains reachable.
- Report to: `docs/working/mvp-today-plan/reports/t174-remaining-grant-gates.md`.

### Brief: t175-rerun-seed-regression
- Repository: FluxIQ Core
- Task: diagnose and fix the two stable `representation.test.ts` failures where a live-patch rerun
  no longer seeds the failed attempt's executed inputs for routed and legacy graphs.
- Required reads: this document's `Current State`; failing test only; current diffs in executor
  run-state/graph-run/node-execution needed to trace the missing value.
- Owns (may edit): `runtime/tests/service-flows/tests/representation.test.ts`;
  `runtime/executor/{run-state,graph-run,node-execution}.ts`; directly owned executor tests; report.
- Must not touch: other paths, shared working documents, commits, builds, or Lab.
- Definition of done: establish whether regression or stale assertion; preserve withheld persistence;
  focused failing rows and affected executor suites pass.
- Report to: `docs/working/mvp-today-plan/reports/t175-rerun-seed-regression.md`.

### Brief: t176-auto-repair-assertions
- Repository: FluxIQ Core
- Task: reconcile three stable failures caused by removal of forced manual approval: two granted-run
  assertions expecting `manual`, and one runtime-patch assertion expecting a pending proposal.
- Required reads: this document's `Current State`; t166/t169 reports; only the three failing test
  files and the production diff directly responsible.
- Owns (may edit): `runtime/tests/service-adaptation/tests/{unattended-repair-authority,unattended-retry-verification,runtime-patches}.test.ts`;
  directly responsible production file only if behavior violates a retained delete/money gate; report.
- Must not touch: other paths, shared working documents, commits, builds, or Lab.
- Definition of done: assertions test the new automatic non-risk contract without weakening any
  delete/money refusal; all three files pass in one focused run.
- Report to: `docs/working/mvp-today-plan/reports/t176-auto-repair-assertions.md`.

### Brief: t177-domain-extraction-regressions
- Repository: this repository
- Task: diagnose and fix the two stable domain extraction test failures exposed by the integrated
  full sweep: `column-match.test.ts` (no plausible candidate) and `slot.test.ts` (unresolved list or
  column handle). Determine whether each is a production regression or a stale assertion.
- Required reads: this document's `Current State`; only the two failing source tests, their owned
  extraction-resolution production modules, and the current diff for those files.
- Owns (may edit): `domain/src/runtime/llm-evidence/plan-resolution/extraction/**` and unique report.
- Must not touch: other paths, shared working documents, Core, commits, builds outside domain, or Lab.
- Definition of done: both failures are corrected without weakening honest unresolved-handle
  rejection; the focused tests and the complete domain suite pass.
- Report to: `docs/working/mvp-today-plan/reports/t177-domain-extraction-regressions.md`.

### Brief: t178-live-run-preflight
- Repository: this repository, read-only except unique report
- Task: prepare the supervisor's exact two-run live execution and per-run debugging checklist for
  `everything-store-plus-earbuds-under-50`, including safe credential loading and collision checks.
- Required reads: this document's Current State and steps 4-5; report t172; the live debug template
  and directly invoked runner/CLI scripts only.
- Owns (may edit): unique report file only.
- Must not touch: product source, shared working documents, Core, builds, commits, or live Lab runs.
- Definition of done: exact commands, expected artifact/run-id locations, required debug fields, and
  safe go/no-go checks are recorded without exposing any credential or recorded page data.
- Report to: `docs/working/mvp-today-plan/reports/t178-live-run-preflight.md`.

### Brief: t179-release-inventory
- Repository: both repositories, read-only except unique downstream report
- Task: inventory the complete task-branch diffs for commit readiness: generated/runtime artifacts,
  accidental secrets, missing owned test files, suspicious deletions, and task-boundary omissions.
- Required reads: this document's Current State; git status/diff summaries; changed manifest/index
  files only where needed to verify an omission.
- Owns (may edit): unique report file only.
- Must not touch: all source, shared working documents, builds, commits, or Lab runs.
- Definition of done: concise release-blocker list with exact paths, or an explicit no-blocker verdict;
  never print secret values or recorded content.
- Report to: `docs/working/mvp-today-plan/reports/t179-release-inventory.md`.

### Brief: t180-documentation-reconciliation
- Repository: this repository, read-only except unique report
- Task: compare completed reports t163-t177 and observed validation results against this document's
  Current State and ledger, then draft the smallest exact reconciliation the supervisor should apply.
- Required reads: this document; report conclusions only; working-document protocol sections on
  Current State, ledger, and status vocabulary.
- Owns (may edit): unique report file only.
- Must not touch: shared working documents, product source, Core, builds, commits, or Lab runs.
- Definition of done: proposed status/current-state replacement facts and ledger bullets are accurate,
  compact, and distinguish verified behavior from the pending live measurement.
- Report to: `docs/working/mvp-today-plan/reports/t180-documentation-reconciliation.md`.

### Brief: t181-runner-authored-node-assertions
- Repository: this repository
- Task: diagnose and fix the two integrated test-runner failures in `authored-nodes.test.ts` and
  `lane.test.ts`, both showing the new `parametersWithheld` field in actual authored-node records.
- Required reads: this document's Current State; only the two failing tests and the authored-node
  projection they directly exercise.
- Owns (may edit): the two failing test files; directly responsible projection only if behavior is
  inconsistent with Core's screened-parameter contract; unique report.
- Must not touch: other paths, shared working documents, Core, commits, builds outside test-runner,
  or Lab.
- Definition of done: decide production regression versus stale assertion; preserve withholding;
  focused tests and the complete test-runner suite pass.
- Report to: `docs/working/mvp-today-plan/reports/t181-runner-authored-node-assertions.md`.

### Brief: t182-authored-documentation-impact
- Repository: both repositories, read-only except unique downstream report
- Task: determine which authored architecture/current-state documents require updates for this
  substantial change set (recovery, grants, judge directives, extraction behavior, and gateway data).
- Required reads: changed source/interface summaries; documentation-maintenance rules; only candidate
  authored docs found by targeted search.
- Owns (may edit): unique report file only.
- Must not touch: shared docs, source, builds, commits, or Lab runs.
- Definition of done: exact document/section recommendations ranked required versus optional, with
  proposed facts and no speculative redesign; explicit no-update verdict where current docs suffice.
- Report to: `docs/working/mvp-today-plan/reports/t182-authored-documentation-impact.md`.

### Brief: t183-commit-manifest
- Repository: both repositories, read-only except unique downstream report
- Task: turn the complete tracked/untracked task diff into an exact commit manifest grouped by
  repository and coherent responsibility, accounting for moved/replacement files atomically.
- Required reads: t179 report; current status/name-status; task report file list; no source bodies
  unless needed to resolve an ambiguous rename.
- Owns (may edit): unique report file only.
- Must not touch: source, shared working documents, index/staging area, builds, commits, or Lab runs.
- Definition of done: every task-owned path is accounted for; excluded generated/runtime paths are
  named; proposed commit groups do not split a contract from its tests or a deletion from replacement.
- Report to: `docs/working/mvp-today-plan/reports/t183-commit-manifest.md`.

### Brief: t184-runner-build-readiness
- Repository: this repository
- Task: restore the ignored test-runner build lost in the machine crash and repeat the provider-free
  dry-run readiness check for `everything-store-plus-earbuds-under-50`.
- Required reads: t178 report; t172 report; package scripts directly invoked.
- Owns (may edit): ignored/generated package build output and unique report only.
- Must not touch: tracked source/shared docs, Core, commits, live provider calls, browsers, or Lab runs.
- Definition of done: runner CLI exists, the exact isolated dry-run resolves the named scenario with
  zero provider calls, and no secret value is logged or copied into the report.
- Report to: `docs/working/mvp-today-plan/reports/t184-runner-build-readiness.md`.

### Brief: t185-downstream-suite-rerun
- Repository: this repository
- Task: run the complete downstream workspace test suite after t177 and t181 assertion fixes and
  isolate any remaining failures without changing source.
- Required reads: this brief; t177 and t181 reports; root package test script.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, Core, commits, builds beyond normal test-generated ignored output,
  browsers, provider calls, or Lab runs.
- Definition of done: exact package/test totals and command exit are recorded; any failure has its
  exact test name and safe diagnostic, without attempting an out-of-scope fix.
- Report to: `docs/working/mvp-today-plan/reports/t185-downstream-suite-rerun.md`.

### Brief: t186-high-risk-gate-final-review
- Repository: both repositories, read-only except unique downstream report
- Task: final adversarial review that the broad grant removal still gates the product's retained
  high-risk classes, especially deletion and money/checkout, across declaration, bootstrap, runtime,
  and tests.
- Required reads: binding rule 2 in this document; changed permission/grant hunks and their tests;
  downstream safety registry/manifest changes only where relevant.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, or Lab runs.
- Definition of done: trace each retained high-risk class end to end, cite passing coverage already
  present or identify an exact release blocker; distinguish unsupported send/publish from allowed acts.
- Report to: `docs/working/mvp-today-plan/reports/t186-high-risk-gate-final-review.md`.

### Brief: t187-downstream-architecture-docs
- Repository: this repository
- Task: apply t182's required current-state updates to the four downstream architecture documents.
- Required reads: t182 report; the four owned documents; changed contracts only to verify wording.
- Owns (may edit): `docs/architecture/web-capabilities.md`, `failure-taxonomy.md`,
  `testing-facility.md`, `sensitive-values.md`, and unique report.
- Must not touch: other files, Core, commits, builds, or Lab runs.
- Definition of done: docs accurately cover browser recovery/extraction, eighteen failure codes,
  created-Flow authored-node artifacts, and screened authored/judge data; no live success is claimed.
- Report to: `docs/working/mvp-today-plan/reports/t187-downstream-architecture-docs.md`.

### Brief: t188-core-architecture-docs
- Repository: FluxIQ Core, report in this repository
- Task: apply t182's required current-state updates to the three Core architecture documents.
- Required reads: t182 report; the three owned documents; changed contracts only to verify wording;
  Core AGENTS instructions.
- Owns (may edit): Core `docs/architecture/automation-studio.md`,
  `docs/architecture/automation-studio/llm-flow-bootstrap.md`,
  `docs/architecture/package-boundaries.md`, and unique downstream report.
- Must not touch: other files, downstream shared docs/source, commits, builds, or Lab runs.
- Definition of done: docs accurately cover defensive dispatch, provider retries/grant accounting,
  risk-only prompting, screened judge repair directives, and compatibility notes; no live success claim.
- Report to: `docs/working/mvp-today-plan/reports/t188-core-architecture-docs.md`.

### Brief: t189-send-publish-gate
- Repository: both repositories
- Task: close t186's release blocker by retaining `send_or_publish` as a high-risk consequence at
  Core's single classification seam and reconciling cross-repository focused assertions.
- Required reads: t186 report; binding rule 2; only the named Core classifier/tests and downstream
  press/tool-rejection tests; Core AGENTS instructions.
- Owns (may edit): Core `runtime/action-permissions/destructive.ts` and its direct tests; downstream
  `domain/src/runtime/llm-evidence/tests/{press,tool-rejection-detail}.test.ts`; unique report.
- Must not touch: other paths, shared working docs, commits, builds outside owned packages, or Lab.
- Definition of done: instruction/grant authority permits send/publish; unasked/no-run send/publish
  refuses before dispatch; mixed requests name only missing high-risk classes; delete/money unchanged;
  focused Core and domain tests pass.
- Report to: `docs/working/mvp-today-plan/reports/t189-send-publish-gate.md`.

### Brief: t190-hard-scenario-stage-one
- Repository: this repository, read-only except unique report
- Task: prepare exact no-hindsight Stage 1 facts for the pending hard-scenario debug record.
- Required reads: live debug template; scenario/task/workflow definitions for
  `everything-store-plus-earbuds-under-50`; t178 report; no prior run artifacts.
- Owns (may edit): unique report file only.
- Must not touch: shared debug/working documents, source, builds, commits, existing run artifacts,
  browsers, provider calls, or Lab runs.
- Definition of done: verbatim task instruction, expected node/action chain, oracle dataset contract,
  plausible-looking wrong answer description, and explicit pre-run hypotheses are ready to copy.
- Report to: `docs/working/mvp-today-plan/reports/t190-hard-scenario-stage-one.md`.

### Brief: t191-version-compatibility-audit
- Repository: both repositories, read-only except unique downstream report
- Task: determine whether the cross-repository public/host-visible contract changes require package
  version or changelog edits before release under current repository policy.
- Required reads: t182/t188 reports; changed package manifests/exports; existing release/versioning
  instructions and changelog conventions only.
- Owns (may edit): unique report file only.
- Must not touch: manifests, source/shared docs, builds, commits, or Lab runs.
- Definition of done: exact required edits or explicit no-change verdict, with package paths and
  policy evidence; do not invent a release workflow absent from the repositories.
- Report to: `docs/working/mvp-today-plan/reports/t191-version-compatibility-audit.md`.

### Brief: t192-build-freshness-audit
- Repository: both repositories, read-only except unique downstream report
- Task: audit the compiled artifacts needed by the isolated live command for presence and freshness
  relative to their owned tracked sources after the crash and subsequent edits.
- Required reads: t178/t184 reports; build scripts and current source/output mtimes only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, generated output, builds, commits, browsers, provider calls, or Lab.
- Definition of done: per-tree go/no-go table for Core, domain, extension E2E, scenario Lab, and runner,
  naming exact rebuild commands for stale or missing outputs without exposing secrets.
- Report to: `docs/working/mvp-today-plan/reports/t192-build-freshness-audit.md`.

### Brief: t193-core-doc-send-publish-reconcile
- Repository: FluxIQ Core, report in this repository
- Task: reconcile t188's three owned Core architecture docs with t189's final retained high-risk set.
- Required reads: t186/t188/t189 reports; only the t188-edited permission sections.
- Owns (may edit): Core `docs/architecture/automation-studio.md`,
  `docs/architecture/automation-studio/llm-flow-bootstrap.md`,
  `docs/architecture/package-boundaries.md`, and unique downstream report.
- Must not touch: other files, shared working docs, builds, commits, or Lab.
- Definition of done: every current two-class statement becomes the exact three-class contract
  (`move_money`, `delete`, `send_or_publish`), with create/modify still ungated and no live claim.
- Report to: `docs/working/mvp-today-plan/reports/t193-core-doc-send-publish-reconcile.md`.

### Brief: t194-final-doc-consistency-review
- Repository: both repositories, read-only except unique downstream report
- Task: final consistency review of the seven architecture documents edited by t187/t188/t193
  against the integrated source, binding rules, and one another.
- Required reads: t182/t187/t188/t189/t193 reports; only edited doc hunks and cited source seams.
- Owns (may edit): unique report file only.
- Must not touch: docs/source/shared working docs, builds, commits, or Lab.
- Definition of done: exact contradiction/omission list with path/heading, or explicit no-blocker
  verdict; verify three retained high-risk classes and no unsupported live-success claims.
- Report to: `docs/working/mvp-today-plan/reports/t194-final-doc-consistency-review.md`.

### Brief: t195-core-version-compatibility
- Repository: FluxIQ Core, report in this repository
- Task: apply t191's required public-package compatibility release metadata.
- Required reads: t191 report; Core versioning policy; current `package-boundaries.md` migration notes;
  Core AGENTS instructions.
- Owns (may edit): Core `packages/fluxiq/package.json`, Core
  `docs/architecture/package-boundaries.md`, and unique downstream report.
- Must not touch: lockfiles, other manifests/docs/source, shared working docs, commits, or Lab.
- Definition of done: `fluxiq` is 0.7.0 and the new compatibility facts live under a distinct 0.7.0
  migration entry with t189's three retained high-risk classes; historical 0.6.0 remains historical.
- Report to: `docs/working/mvp-today-plan/reports/t195-core-version-compatibility.md`.

### Brief: t196-live-host-prerequisites
- Repository: this repository, read-only except unique report
- Task: verify non-provider host prerequisites for one isolated live run after the machine restart.
- Required reads: t178 report; runner isolated-target prerequisite code; installed browser lookup and
  port-allocation code only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds/generated output, commits, browsers, provider calls, or Lab.
- Definition of done: report browser executable/install availability, required loopback port bindability,
  lock/process collision state, and exact no-go cause if any; do not launch a browser or print secrets.
- Report to: `docs/working/mvp-today-plan/reports/t196-live-host-prerequisites.md`.

### Brief: t197-core-rebuild-and-readiness
- Repository: both repositories; generated outputs plus unique downstream report
- Task: clear t192's freshness no-go by rebuilding Core, then repeat artifact freshness and the exact
  provider-free isolated readiness probe.
- Required reads: t178/t184/t192/t195 reports; exact root build/readiness commands only.
- Owns (may edit): generated/ignored build output and unique report only.
- Must not touch: tracked source/shared docs, commits, browsers, real provider calls, or live Lab runs.
- Definition of done: Core root build passes, every required output is newer than owned inputs, and
  dry-run returns the exact scenario/lane with zero provider calls; report no secret values.
- Report to: `docs/working/mvp-today-plan/reports/t197-core-rebuild-and-readiness.md`.

### Brief: t198-doc-precision-fixes
- Repository: this repository
- Task: correct t194's two documentation precision findings without changing product claims.
- Required reads: t194 report; only the cited sections and responsible recovery/result source seams.
- Owns (may edit): `docs/architecture/web-capabilities.md`,
  `docs/architecture/failure-taxonomy.md`, and unique report.
- Must not touch: other files, Core, builds, commits, or Lab.
- Definition of done: recovery-account carrier limits are exact, transport classification ownership and
  Core replay-safety ownership are exact, and live status remains unclaimed.
- Report to: `docs/working/mvp-today-plan/reports/t198-doc-precision-fixes.md`.

### Brief: t199-final-sensitive-artifact-scan
- Repository: both repositories, read-only except unique downstream report
- Task: scan the final uncommitted path set for forbidden generated/runtime artifacts, credential-like
  material, recorded page data, browser profiles, or accidental run bundles before live execution.
- Required reads: repository exclusion rules; current status/name-only diff; inspect content only for
  a path that triggers a safe pattern, never print the matching value.
- Owns (may edit): unique report file only.
- Must not touch: index, source/shared docs, builds, commits, test-runs, browser/provider/Lab state.
- Definition of done: exact offending paths or explicit clean verdict; report only pattern category and
  path, never secret/page-data contents.
- Report to: `docs/working/mvp-today-plan/reports/t199-final-sensitive-artifact-scan.md`.

### Brief: t200-worker-report-closure-audit
- Repository: this repository, read-only except unique report
- Task: audit briefs t163-t199 against report files and extract any unresolved release/live blockers
  that later work has not explicitly closed.
- Required reads: brief definitions and each report's outcome/open/follow-up sections only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, artifacts, browser/provider/Lab state.
- Definition of done: missing-report list, blocker closure matrix, and exact remaining gates; distinguish
  superseded findings from active ones and do not re-open settled design decisions.
- Report to: `docs/working/mvp-today-plan/reports/t200-worker-report-closure-audit.md`.

### Brief: t201-final-working-doc-reconciliation
- Repository: this repository, read-only except unique report
- Task: draft the exact final Current State and ledger deltas after t185-t200, without editing the
  shared working document.
- Required reads: current document Current State/ledger; outcomes t185-t200 only; working-doc
  protocol status/ledger rules.
- Owns (may edit): unique report file only.
- Must not touch: shared docs/source, builds, commits, artifacts, browser/provider/Lab state.
- Definition of done: compact copy-ready wording reflects verified gates, t189/t195, docs, active
  freshness/sensitive/live gates, and never upgrades live criteria without run evidence.
- Report to: `docs/working/mvp-today-plan/reports/t201-final-working-doc-reconciliation.md`.

### Brief: t202-immediate-live-go-no-go
- Repository: this repository, read-only except unique report
- Task: perform the last non-provider go/no-go snapshot immediately before live run 1.
- Required reads: t178/t196/t197 reports; immediate process/lock/output/key-presence checks only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, browsers, provider calls, Lab/run artifacts;
  never print a credential or command line.
- Definition of done: timestamped GO/NO-GO for collision, lock, compiled paths, Core root, and safe
  credential availability; process findings list only name/PID and key check is boolean.
- Report to: `docs/working/mvp-today-plan/reports/t202-immediate-live-go-no-go.md`.

### Brief: t203-final-commit-manifest-refresh
- Repository: both repositories, read-only except unique downstream report
- Task: refresh t183's commit manifest for every path added through t202, including architecture docs,
  version metadata, reports, and the authored pending debug record.
- Required reads: t183 report; current status/name-status; reports t187-t202 file lists only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, staging index, builds, commits, run artifacts, browser/provider/Lab.
- Definition of done: every current path is assigned once to an atomic commit group; deletions and
  replacements remain together; generated/runtime exclusions and late reports are explicit.
- Report to: `docs/working/mvp-today-plan/reports/t203-final-commit-manifest-refresh.md`.

### Brief: t204-live-cost-watchdog
- Repository: this repository, read-only except unique report
- Task: define the run-1 provider cost/time watchdog from existing ledger summaries and current runner
  budgets, without reading prior raw artifacts.
- Required reads: language-loop ledger cost/duration summaries; current live profile/budget constants;
  t178 command.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, raw artifacts, browser/provider/Lab state.
- Definition of done: expected range, hard configured ceilings, observable stop/escalation conditions, and
  safe status fields to report; do not invent a lower cap that would invalidate the scenario.
- Report to: `docs/working/mvp-today-plan/reports/t204-live-cost-watchdog.md`.

### Brief: t205-live-process-watchdog
- Repository: this repository, read-only except unique report
- Task: take one sanitized health snapshot of the currently active run-1 process tree without
  interfering with it or reading output/artifacts.
- Required reads: t204 safe status fields; process names/PIDs/start times/CPU only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, process input, command lines, environment, builds, commits,
  browser/provider/Lab state, or run artifacts.
- Definition of done: report active/ended, elapsed time, process names/counts, and whether a competing
  Lab/build tree exists; never read command line, credential, network payload, logs, or artifacts.
- Report to: `docs/working/mvp-today-plan/reports/t205-live-process-watchdog.md`.

### Brief: t206-pending-debug-quality-check
- Repository: this repository, read-only except unique report
- Task: verify the pending run-1 debug record satisfies the template's pre-run/no-hindsight Stage 1
  requirements before it is renamed and completed.
- Required reads: pending debug; blank template; t190 report only.
- Owns (may edit): unique report file only.
- Must not touch: pending/shared docs, source, builds, commits, live processes, output, or artifacts.
- Definition of done: exact missing/ambiguous Stage 1 fields or explicit ready verdict; do not inspect
  any run output or artifact.
- Report to: `docs/working/mvp-today-plan/reports/t206-pending-debug-quality-check.md`.

### Brief: t207-run-artifact-field-map
- Repository: this repository, read-only except unique report
- Task: map the current typed run artifacts to every post-run debug-template field so analysis can
  proceed without exploratory raw-data reads.
- Required reads: artifact/test-contract types and serializers only; blank debug template; t178 order.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, live processes/output, or any run artifact.
- Definition of done: artifact path + typed field mapping for stages 2-6, costs, recovery, repair, and
  mismatches; identify fields that require `NO EVIDENCE` by contract.
- Report to: `docs/working/mvp-today-plan/reports/t207-run-artifact-field-map.md`.

### Brief: t208-hard-scenario-ownership-map
- Repository: both repositories, read-only except unique downstream report
- Task: map each likely hard-scenario failure surface to the narrow owning source/test files for rapid
  post-run partitioning, without predicting or inspecting the actual outcome.
- Required reads: t190 hypotheses; scenario workflow; directly named navigation/dialog/search/filter/
  extraction/pagination/judge/repair ownership barrels and tests only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, live process/output, or run artifacts.
- Definition of done: file-partitionable ownership table with no overlapping edit sets and the narrow
  validation command for each surface; no claim about which cause occurred.
- Report to: `docs/working/mvp-today-plan/reports/t208-hard-scenario-ownership-map.md`.

### Brief: t209-live-evidence-doc-routing
- Repository: this repository, read-only except unique report
- Task: identify every authored working-document update required after one live run, including debug
  rename, loop ledger, MVP ledger/current state, and index/baseline refresh.
- Required reads: working-doc protocol; current loop/MVP ledgers; blank debug template only.
- Owns (may edit): unique report file only.
- Must not touch: shared docs/source/builds/commits/live process/output/run artifacts.
- Definition of done: exact target sections and required facts/status vocabulary for pass or fail,
  distinguishing measured evidence from diagnosis and follow-up.
- Report to: `docs/working/mvp-today-plan/reports/t209-live-evidence-doc-routing.md`.

### Brief: t210-run1-exploration-proposal-debug
- Repository: this repository, read-only bundle analysis except unique report
- Task: debug run `run-muj2kzx1-8f9f8271` stages 1-3: header, timeline, provider exploration turns,
  authored proposal/nodes, and divergences from the prewritten expected chain.
- Required reads: run debug Stage 1; bundle integrity/index, run/summary/evaluation, timeline,
  `snapshots/live-llm.json`, and proposal/authored-node parts of `snapshots/flow-lane.json` only.
- Owns (may edit): unique report file only.
- Must not touch: shared debug/docs, source, builds, commits, browser/provider/Lab; never quote raw
  prompts/responses, credentials, selectors, or recorded page data.
- Definition of done: turn-by-turn safe summary, exact authored nodes with screened parameters,
  stage reached, every Stage-1 divergence, cost/call totals, and precise candidate causes.
- Report to: `docs/working/mvp-today-plan/reports/t210-run1-exploration-proposal-debug.md`.

### Brief: t211-run1-runtime-recovery-debug
- Repository: this repository, read-only bundle analysis except unique report
- Task: debug run `run-muj2kzx1-8f9f8271` stage 4 and runtime failure/recovery behavior.
- Required reads: bundle integrity/index, timeline, runtime/action/failure/recovery portions of
  `snapshots/flow-lane.json`, and sanitized facility diagnostics only.
- Owns (may edit): unique report file only.
- Must not touch: shared debug/docs, source, builds, commits, browser/provider/Lab; never quote recorded
  page data, raw logs, selectors, credentials, prompts, or responses.
- Definition of done: node-by-node execution table, terminal/recovered failures, retries/rungs,
  provider calls during replay, exact runtime-behavior cause(s), and evidence gaps.
- Report to: `docs/working/mvp-today-plan/reports/t211-run1-runtime-recovery-debug.md`.

### Brief: t212-run1-answer-judge-repair-debug
- Repository: this repository, read-only bundle analysis except unique report
- Task: debug run `run-muj2kzx1-8f9f8271` stages 5-6: dataset comparison, judgement, repair, replay,
  persistence, and cost accounting.
- Required reads: bundle integrity/index, evaluation, extraction mismatches, repair-lane when present,
  judgement/repair portions of live-llm and flow-lane snapshots only.
- Owns (may edit): unique report file only.
- Must not touch: shared debug/docs, source, builds, commits, browser/provider/Lab; summarize rather
  than reproduce record values or provider text, and expose no secrets.
- Definition of done: exact expected/returned counts and field-level mismatch classes, judgement/fix
  directive path, repair/application/replay/persistence outcome, safe calls/tokens/cost, and causes.
- Report to: `docs/working/mvp-today-plan/reports/t212-run1-answer-judge-repair-debug.md`.

### Brief: t213-evidence-iteration-root-cause
- Repository: FluxIQ Core, read-only except unique downstream report
- Task: trace why run `run-muj2kzx1-8f9f8271` consumed the evidence-iteration ceiling after repeated
  draft reruns and ended at provider-output validation instead of settling a Flow.
- Required reads: t210/t211 when available; run evidence-loop step codes only; Core evidence-loop
  decision parsing, draft-rerun, validation, iteration-limit, and directly relevant tests.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, browser/provider/Lab; do not read raw provider
  text or page evidence.
- Definition of done: exact state transition/counter path, distinguish model behavior from loop defect,
  name smallest correct fix and owned files/tests, and identify any missing diagnostic evidence.
- Report to: `docs/working/mvp-today-plan/reports/t213-evidence-iteration-root-cause.md`.

### Brief: t214-run1-debug-synthesis
- Repository: this repository, read-only except unique report
- Task: synthesize t210-t212 into copy-ready Stage 2-6, Causes, and Instrumentation Gaps text for the
  run-1 debug record, preserving `NO EVIDENCE` where stages were not reached.
- Required reads: run-1 shared debug Stage 1; reports t210-t212 only; blank template.
- Owns (may edit): unique report file only.
- Must not touch: shared debug/docs, source, builds, commits, run artifacts, browser/provider/Lab.
- Definition of done: every template field is answered, no raw sensitive/page/provider data appears,
  measured failure is separated from unmeasured later stages, and causes remain evidence-bounded.
- Report to: `docs/working/mvp-today-plan/reports/t214-run1-debug-synthesis.md`.

### Brief: t215-iteration-limit-test-gap-audit
- Repository: FluxIQ Core, read-only except unique downstream report
- Task: audit existing evidence-loop tests for repeated draft reruns, unusable decisions, progress,
  remaining-call awareness, and iteration-limit termination exposed by run 1.
- Required reads: t210-t213 conclusions when available; only evidence-loop/decision/budget test files.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, raw artifacts, browser/provider/Lab.
- Definition of done: coverage matrix, exact missing regression tests, owned target files, and whether
  current tests encode the observed behavior intentionally or leave it unspecified.
- Report to: `docs/working/mvp-today-plan/reports/t215-iteration-limit-test-gap-audit.md`.

### Brief: t216-live-build-budget-derivation
- Repository: both repositories, read-only except unique downstream report
- Task: trace the live profile through runner request, Core preflight/grant, evidence-loop limits and
  budget to explain exactly why run 1's final decision occurred at 26 calls.
- Required reads: t204/t210; live profile resolver and request fields; Core execution-grant/loop
  configuration/budget derivation and direct tests only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, raw artifacts, browser/provider/Lab.
- Definition of done: closed arithmetic from configured values to 26, identify which bound selected
  the last decision, assess smallest safe budget change versus convergence fix, and name tests/files.
- Report to: `docs/working/mvp-today-plan/reports/t216-live-build-budget-derivation.md`.

### Brief: t217-final-unusable-classification
- Repository: FluxIQ Core, report in this repository
- Task: implement t213's terminal-classification parity fix so a refused completion on the literal
  final iteration retains its actionable unusable-decision issue instead of becoming iteration-limit.
- Required reads: t213 report; `runtime/llm/evidence-loop.ts`; focused loop-budget/unusable-decision
  tests and optional bootstrap integration only; Core AGENTS instructions.
- Owns (may edit): Core `runtime/llm/evidence-loop.ts`,
  `runtime/llm/tests/{loop-budget,unusable-decision}.test.ts`, optional directly relevant bootstrap
  integration test, and unique downstream report.
- Must not touch: other paths, shared docs, commits, browser/provider/Lab; do not increase budgets or
  weaken completion answerability.
- Definition of done: bottom-of-loop exhaustion preserves last unusable issue through the stalled
  callback; generic exhaustion stays iteration-limit; focused tests, Core check/build pass.
- Report to: `docs/working/mvp-today-plan/reports/t217-final-unusable-classification.md`.

### Brief: t218-run1-ledger-draft
- Repository: this repository, read-only except unique report
- Task: draft exact loop-plan and MVP-plan ledger entries for run 1 and t213/t217 follow-up without
  editing shared documents.
- Required reads: completed run-1 debug; reports t210-t217 outcomes only; working-doc ledger protocol.
- Owns (may edit): unique report file only.
- Must not touch: shared docs/source, builds, commits, run artifacts, browser/provider/Lab.
- Definition of done: copy-ready measured facts, costs, stage reached, root cause, validation/follow-up,
  and correct Partial/Blocked/Accepted status without upgrading unmeasured MVP criteria.
- Report to: `docs/working/mvp-today-plan/reports/t218-run1-ledger-draft.md`.

### Brief: t219-run2-preflight-delta
- Repository: both repositories, read-only except unique downstream report
- Task: define the exact post-t217 rebuild/check/readiness delta and run-2 invocation while keeping
  the default 26-call MVP profile and serial one-Lab rule.
- Required reads: t178/t197/t213/t216/t217 brief; build dependency order and CLI flags only.
- Owns (may edit): unique report file only.
- Must not touch: source/shared docs, builds, commits, artifacts, browser/provider/Lab.
- Definition of done: minimal but sufficient commands, freshness checks, new pending-debug chronology,
  safe credential handling, and explicit rejection of using 27 calls as a passing MVP measurement.
- Report to: `docs/working/mvp-today-plan/reports/t219-run2-preflight-delta.md`.

---

## Work Ledger

### 2026-09-26 — Document opened with three binding rules and five tasks dispatched
- Agent: supervisor
- Changed: `docs/working/mvp-today-plan.md`, `docs/working/README.md`
- Why: the user's assessment was that the MVP is close and the remaining distance is three
  rules stated repeatedly and not applied as defaults — a defensive runtime for every node, a
  grant system that gates only genuinely risky actions, and a judge that issues fix instructions.
  All three were saved to durable memory in the same turn so they stop being restated.
- Validation: not validated — no code changed by this entry. The four criteria's states quoted in
  `Current State` come from observed live runs recorded in
  `language-driven-flow-loop-plan.md`'s ledger, not from this document's own work.
- Outcome: Accepted
- Follow-up: t163 through t167 are in flight; steps 2 and 3 of `The Order Of Work` are the
  supervisor's and begin as those land.
