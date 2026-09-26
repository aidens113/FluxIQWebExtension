# MVP Today

Status: Active
Status detail: The four MVP criteria, the four binding product rules that get them over the line, and the ordered path from the current tree to a live run that passes. Creation and self-judgement work live; deterministic replay has never been demonstrated because no run has yet produced a correct answer; the repair route is open and has applied a correction once.
Created: 2026-09-26
Last updated: 2026-09-26
Owner: Senior supervisor agent
Scope: Getting the MVP over the line — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself, and judges its own answer — by making the runtime defensive by default for every node, removing every grant that gates anything but a genuinely risky action, making the judge issue fix instructions rather than a verdict, and then running the live loop until a hard scenario passes twice. It deliberately does not re-plan the loop's operating procedure, which is in language-driven-flow-loop-plan.md, and does not cover recorded Flows or any surface that does not block these four criteria.
Paired document: `none yet — the Core-side changes land under FluxIQ Core's own working documents as this plan names them.`
Related: [language-driven-flow-loop-plan.md](./language-driven-flow-loop-plan.md) (the operating loop, the run history, and the twenty-three tasks already built), [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md) (the earlier defensive-runtime design this supersedes on defaults), [fluxiq-conversations-plan.md](./fluxiq-conversations-plan.md) (where a genuinely risky action's question reaches the person)

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

**Dispatched for these:** the cross-repository defensive audit (t163, **done** — its findings
are in `What The Audit Found` and they reframe rule 1), the judge's context and instructions
(t164), Core's default node policy and the gate that blocks it (t165), the grant removal across
both repositories (t166), the web nodes' own defences and the failure-code table (t167), and
the provider retry the audit found nobody was doing (t168).

**The one thing standing between the tree and a measurement.** Nothing has been exercised
live. Core, the domain and the extension all hold uncommitted work from many workers; the Lab
refuses a run whose build is older than its source, so the next live run needs all three
rebuilt first. That rebuild is the gate, and `The Order Of Work` treats it as such.

**Blockers:** none. Two environment notes carry over: `git worktree add` fails on this machine
with `cannot spawn git: Exec format error`, so a Core-paired task takes a plain branch in each
repository; and a Core build that exits `3221225477` is this machine's RAM fault and builds on
retry.

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
