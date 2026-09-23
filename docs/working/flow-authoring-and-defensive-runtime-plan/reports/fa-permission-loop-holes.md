# fa-permission-loop-holes — A13 and the three holes (task t091, Core-paired)

Worktrees `F:\fxwork\t091\!FluxIQWebExtension` and `F:\fxwork\t091\!FluxIQ`,
both on `task/t091-permission-loop-holes`. No commit was made.

## Outcome

**Done — and the measurement is the finding, in the other direction.**

> **On `social-scheduler-schedule-post`, with no grant, the press on "Schedule
> post" now declares `send_or_publish`. Read off the stored proposal, not
> deduced. Twice, on two independent live runs.** It cannot be read out of a run
> bundle — the Lab surfaces none of it, for the reason in *Open questions* 1 —
> so *How to read this yourself* below is the exact command, store and field,
> and it still prints this from the run's workspace, which is on disk. 20 actions were put to the
> gate; 17 declared nothing lasting and all 17 are correct (opening a composer,
> choosing an account, entering text, reading the queue); 3 declared
> `send_or_publish` — the press while exploring, the same press as a Flow step,
> and the same press again in the draft dry run. t081's four-build finding that
> *every* press declares nothing lasting no longer holds. t088's prompt
> rebalance (Core `c76ad70`) worked, and this is its first measurement.
>
> **The gate still asked nobody, and this time that is correct.** The
> instruction itself was read as asking for `send_or_publish`, quoting the
> person's own words, so the instruction's own authority permitted the press.
> The grant permitted nothing; the instruction permitted this.
>
> **A13 caught what nothing else could see.** The instruction asks for
> `send_or_publish` **and** `create_new` — scheduling a post creates something
> that stays. Nothing declared `create_new`. Core named it, quoted the words
> that ask for it, stored it on the proposal, and said it in the Flow's thread.
> That contradiction was invisible to every check in both repositories an hour
> ago, and is reproducible.

| Hole | State | How it was proved |
| --- | --- | --- |
| 1. A permitted declaration is discarded | Done | Live, twice: read off the stored proposal's `declaredConsequences`, plus model-free rows through the real gate and the real plan resolver |
| 2. A13, cross-check against the instruction | Done | Live, twice, `verdict: "undeclared"`, with the ask written into the real conversation store; plus model-free rows |
| 3. The repair path dies where the build parks | Done | Model-free, through the real evidence loop, registry and gate: granted, refused and nobody-answered |
| Extra: a true provider-call count | **Partly — and it cost a live run** | Published as new fields beside the old ones; folding it into `providerCallCount` broke a downstream contract, measured |

## What each press declared, read rather than deduced

Live, `run-mudngxpd-b9a4648e` (the second run; the first,
`run-mudmlf2q-0f938cfe`, is identical in every respect below). Grant:
`permittedConsequences: []`. Instruction: *"Schedule a post to the Northwind
Trails account for the morning of 24 September at nine o'clock, saying: Trail
clean-up on Saturday…"*.

| # | stage | action | control | declared |
| --- | --- | --- | --- | --- |
| 1 | exploration | click | New post (button) | `[]` |
| 2 | exploration | select option | Account (select) | `[]` |
| 3–5 | exploration | type text | Post text, Date, Time | `[]` |
| 6 | exploration | **click** | **Schedule post (button)** | **`send_or_publish`** |
| 7 | exploration | select option | Account (select) | `[]` |
| 8–12 | flow step | press / choose / enter ×3 | New post, Account, Post text, Date, Time | `[]` |
| 13 | **flow step** | **press** | **Schedule post (button)** | **`send_or_publish`** |
| 14–19 | dry run | reset, click, select, type ×3 | (replayed steps) | `[]` |
| 20 | **dry run** | **click** | (the schedule step, replayed) | **`send_or_publish`** |

`permissionRequest: undefined`. `instructedConsequences`:
`send_or_publish` *and* `create_new`, each with the person's own quoted words.
`consequenceCrossCheck`:

```
verdict: "undeclared", declared: ["send_or_publish"],
instructed: ["send_or_publish", "create_new"], undeclared: ["create_new"],
actions: 20, declaredNothing: 17
```

And in the project's real conversation store, one turn and one pending ask:

> The instruction asks for create_new, and none of this run's 20 actions said it
> would cause that; 17 of them said they would cause nothing lasting. Apply it
> as it stands?

## How to read this yourself, until the Lab surfaces it

**None of the table above is in a run bundle.** `events.ndjson`, the campaign
summary, `snapshots/flow-lane.json` and Core's log carry no `consequences` field
and no `send_or_publish`, because the Lab reads the declaration from a field the
bootstrap projection never carried — *Open questions* 1. A run on the default
`isolated` target cannot be read at all afterwards: its FluxIQ install is
deleted when the run ends. So the reading has two requirements, and the first is
part of the run, not of the reading.

**1. Run it on a target that keeps Core's workspace.** `persistent-isolated`
retains `fluxiq-root/.fluxiq` after the run; nothing else about the run changes.

```bash
cd <this repository>
export DEEPSEEK_API_KEY="$(sed -n 's/^DEEPSEEK_API_KEY=//p' .env.local | tr -d '
')"
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t091c FLUXIQ_LAB_INSTANCE=t091 pnpm lab:campaign social-scheduler-schedule-post
```

**2. Read the proposal out of Core's own store.** The workspace is at
`test-runs/instances/<FLUXIQ_LAB_INSTANCE>/persistent-isolated/<workspace>/`
when a Lab instance is named, and `test-runs/persistent-isolated/<workspace>/`
when one is not. A Flow-Bootstrap proposal is **not** in `project.sqlite` — its
`adaptations` table is empty for this path — it is one row of the
`automation.state` table in `fluxiq-root/.fluxiq/global.sqlite`, under the id
`projects/<projectId>/flows/<flowId>/adaptations/<adaptationId>/bootstrap`, with
the whole adaptation as JSON in its `data` column.

`sqlite3` is a dependency of Core's `packages/fluxiq`, not of this repository, so
run node from there and pass the database path:

```bash
cd ../!FluxIQ/packages/fluxiq
node -e '
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database(process.argv[1], sqlite3.OPEN_READONLY);
db.all("select data from \"automation.state\" where id like \"%/bootstrap\" and data like \"%declaredConsequences%\"", (e, rows) => {
  if (e) throw e;
  for (const row of rows) {
    const a = JSON.parse(row.data);
    console.log("adaptationId", a.adaptationId);
    console.log("crossCheck  ", a.consequenceCrossCheck.verdict, a.consequenceCrossCheck.undeclared);
    console.log("calls       ", JSON.stringify(a.auditEvents[0].detail));
    for (const d of a.declaredConsequences) {
      console.log(`${d.action.kind.padEnd(16)} ${d.action.ref.padEnd(18)} ${String(d.control.name).padEnd(14)} ${JSON.stringify(d.consequences)}`);
    }
  }
});
' "<abs path>/test-runs/instances/t091/persistent-isolated/t091c/fluxiq-root/.fluxiq/global.sqlite"
```

**Which fields say what.** On the parsed adaptation:

| Field | Holds |
| --- | --- |
| `declaredConsequences[]` | one record per action put to the gate, in the order asked: `action.{kind,id,ref,verb}`, `control.{name,kind}`, `consequences[]`, `permitted`, and `missing`/`requestId` only on a refusal |
| `declaredConsequences[].action.kind` | `exploration_step` for a `run_node` call (including a dry-run replay, whose `ref` starts `dryrun.`), `flow_step` for a step of the Flow being authored |
| `consequenceCrossCheck` | `verdict`, `declared`, `instructed`, `undeclared`, `beyondInstruction`, `actions`, `declaredNothing`, `quotes`, `sentence` |
| `instructedConsequences[]` | what the instruction was read as asking for, each with the person's quoted words and the instruction digest |
| `permissionRequest` | the request a refusal raised, absent when none was |
| `auditEvents[0].detail` | `providerCallCount`, `decisionCount` (the loop's own, equal), `additionalProviderCallCount`, `totalProviderCallCount` |

**The one line that answers the headline** is the record whose
`control.name` is `Schedule post` and whose `action.kind` is `flow_step` — the
step the saved Flow runs. On `run-mudngxpd-b9a4648e` it reads
`{"action":{"kind":"flow_step","id":"web.output.dom-click","ref":"main.s6","verb":"press"},"control":{"name":"Schedule post","kind":"button"},"consequences":["send_or_publish"],"permitted":true}`.

Run verbatim against the workspace of `run-mudngxpd-b9a4648e`, which is still on
disk, the script prints the 21 lines of the table above — 20 declarations plus
the cross-check and call counts. **The conversation turn is a separate store**:
the `confirm` ask is a row in that project's `project.sqlite`, tables
`conversation_turns` and `conversation_asks`, under
`artifacts/automation-studio/projects/<projectId>/`.

## What changed and why

### Hole 1 — the declaration is kept, and the empty answer is a declaration

Two halves, and the second is the one nobody had noticed.

**Core discarded a permitted declaration.** `checkFor` returned
`{ permitted: true }` and nothing else, so the only trace a permitted action
left was that it had not been refused. The gate now keeps one
`AutomationStudioActionDeclarationRecord` per action asked about — the action,
the control (under the same evidence rule the request uses, so a name the model
was never shown is withheld here too), the classes in Core's order, and Core's
own answer. Capped at 500 records.

**The domain never asked about an empty declaration at all.**
`webActionPermission` short-circuited `declared.length === 0` to
`no_consequence` without calling the check, and `webPlanStepPermission` did the
same for a step. So the answer every measured press actually gave was the one
answer Core never saw. `readAutomationStudioActionDeclaration` now reads `[]`
(a missing `consequences` key still throws — saying nothing and saying none are
different facts), the domain passes it through, and the gate permits it without
reading the instruction: nothing is being permitted, and a build whose every
action answers that way must not be charged for a derivation it has no use for.
`automationStudioActionPermissionDenied` likewise permits an empty declaration,
because refusing it would make honesty the one answer that cannot be given.

**One thing I had to add that the brief did not name.** Once `[]` reaches Core's
reader, so do the control name and verb the domain supplies for *every* acting
node — and `run.ts` derives the verb from the node label, so "Wait For Selector"
would have thrown `verb_invalid` and failed the action. `webActionPermission`
now bounds both (two plain lowercase words, name to 2,000 characters). The verb
is presentation; an unreadable *class* still throws and the action still fails.

The build stores the records on the proposal as `declaredConsequences`, and the
review projection carries them into `metadata.bootstrap` with
`instructedConsequences`, `consequenceCrossCheck` and `permissionRequest`, none
of which the projection carried before.

### Hole 2 — A13, and what a disagreement does

`automationStudioActionDeclarationCrossCheck` compares the classes the build
declared with the classes the instruction was read as asking for. Both sides are
the model's own statements. **Nothing reads a control, a label, a URL or a node
id** — the word list deleted on 2026-09-18 does not come back under another
name.

Four verdicts: `not_comparable` (no action was put to the gate — a read-only
build declared nothing because it did nothing, and calling that a contradiction
would make every extraction Flow suspect), `undeclared`, `beyond_instruction`,
`agreed`. `undeclared` wins when both directions disagree, because it is the
direction nothing else catches.

**What a disagreement does, and why it does no more.** This is the decision the
brief asked me to defend.

1. **It never refuses the build and never grants anything.** The instruction is
   the authority for *permitting*, so a class the instruction asks for was
   already allowed: an under-declaration here bypasses no permission. Refusing
   the build would be Core overruling the person's own instruction on Core's
   reading of their words — a judgement about the instruction rather than about
   a control, but still Core deciding for the person. And it would refuse Flows
   for what is, on today's evidence, a prompt defect.
2. **It is recorded on what the person approves**, with both class lists and the
   person's own quoted words, so approving the Flow means approving it in sight
   of the contradiction.
3. **It is said out loud in the Flow's thread** as a `confirm` ask, because a
   finding filed where nobody is shown it is the anti-pattern this product has
   already been corrected on. It does **not** park: the build has finished and
   has a Flow, and the question is whether to apply it. A thread that cannot be
   written to loses the turn and keeps the record.

**What it costs.** The derivation that reads the instruction is lazy — it runs
on the first action declaring something lasting — so a build whose every action
declares `[]` never derives it and has nothing to compare. `crossCheck()`
therefore forces it (`gate.resolveInstructed()`), which is one provider call,
and only when at least one action was put to the gate. A build that declared
something has already paid for it; a build that acted on nothing pays nothing.

### Hole 3 — the repair path parks instead of dying

`recovery/runtime-exploration.ts:269` threw
`exploration stopped: operator_approval_required` on the first request — the
exact terminal refusal A11 had just removed from the build path.

It now takes an optional `ask`, and `annotate.ts` gives it the run's own parking
port, which `service.ts:2735` already binds for every run with a conversation.
The wiring is A11's: the gate raises the request, the ask goes to the thread
keyed by the request's own `requestId`, a grant settles the gate and **the same
check is asked again** so nothing decides permission twice, and the action goes
ahead. One question per exploration.

Two things had to change with it, and both are the kind of detail that compiles
either way:

- the recovery gate is built with `endsOnRequest: false` **only when a port is
  bound** (`annotation/permissions.ts`, `answerable`), because a gate that
  aborts its own signal on raising the request cannot wait for an answer;
- with the gate no longer aborting, the refusal ending had to be fired from the
  exploration itself. `permissionRefused` is joined into `stopSignal` and fires
  only after a person — or nobody — has declined. Without it the deliberate
  throw would have been *observed* (`toolFailures: "observe"`) and the
  exploration would have carried on past a refusal.

The mechanism the build and the repair now share lives in
`parking/permission-ask.ts`; `flow-bootstrap/action-permissions.ts` keeps its
own constant name and type alias and calls it.

### The extra: a true provider-call count, and the live run it cost

`providerCalls` in the Lab comes from the created-audit's `providerCallCount`,
which `evidenceTraceAuditDetail` derives from the evidence loop's trace alone.
The instruction-authority call is not in that trace, so every per-build call
count was short by it while its tokens and its money *were* counted.

I added `usage.calls` to the authority and folded it into `providerCallCount`.
**That broke the next live run outright**: `run-mudna2ng-ceadeb69`,
`environment.missing`, no Flow, nothing measured, `Malformed FluxIQ API
response: adaptation.metadata.phase9 created evidence audit exceeded its bounded
contract`. The downstream testing facility requires
`decisionCount === providerCallCount` and `iterationCount` within one of it
(`packages/test-runner/src/existing-fluxiq-control.ts:490-501`), which is t089's
file and outside my Owns.

So the count is published **beside** the two loop counts rather than inside
them: `additionalProviderCallCount` and `totalProviderCallCount` on the
created-audit detail. The live run after that fix reads
`providerCallCount: 17, decisionCount: 17, additionalProviderCallCount: 1,
totalProviderCallCount: 18`. **Making the Lab report the true number is one line
there and it is not mine.** A unit test now pins the invariant I broke, so the
next person learns it from a test rather than a live run.

### Files changed

Core, `F:\fxwork\t091\!FluxIQ` (no commit):

- new `runtime/action-permissions/declared.ts`, `cross-check.ts`,
  `runtime/parking/permission-ask.ts`,
  `runtime/service/flow-bootstrap-commands/permission-outcome.ts`
- new tests `runtime/action-permissions/tests/declared.test.ts`,
  `runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts`
- `runtime/action-permissions/{gate,declaration,index}.ts`
- `runtime/flow-bootstrap/{action-permissions,adaptation,review-projection}.ts`
- `runtime/recovery/runtime-exploration.ts`,
  `runtime/recovery/annotation/{annotate,exploration,permissions}.ts`
- `runtime/service.ts`, `runtime/service/instruction-authority.ts`,
  `runtime/service/flow-bootstrap-commands/{evidence-trace,index}.ts`,
  `runtime/parking/index.ts`
- updated tests `runtime/action-permissions/tests/gate.test.ts`,
  `runtime/recovery/tests/runtime-exploration-permission.test.ts`
- `docs/architecture/automation-studio.md`,
  `docs/architecture/automation-studio/llm-flow-bootstrap.md`
- `.structure-baseline.json` (`service.ts` lowered 4,614 → 4,611)

Downstream, `F:\fxwork\t091\!FluxIQWebExtension` (no commit):

- `domain/src/runtime/llm-evidence/permission.ts`,
  `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts`
- updated tests `domain/.../llm-evidence/tests/press.test.ts`,
  `domain/.../plan-resolution/tests/plan-step-permission.test.ts`
- `docs/architecture/testing-facility.md`
- this report

**`runtime/service.ts` went down**, 4,614 → 4,610, and its baseline was
re-recorded at 4,611. The four facts a finished build's gate holds were being
lifted out by hand at two call sites — which is how one of them came to be read
at one site and not the other — and are now one call into
`flow-bootstrap-commands/permission-outcome.ts`. The order there is load-bearing
and is stated in the file: `crossCheck()` may derive the instruction's
authority, so `instructed()` is read *after* it.

**Files touched outside the brief's Owns, each with its reason.**

| File | Why |
| --- | --- |
| Core `flow-bootstrap/adaptation.ts`, `review-projection.ts` | the proposal is where a declaration has to land and where a person reads it |
| Core `service/instruction-authority.ts`, `service/flow-bootstrap-commands/**` | the call count, and the service extraction that kept `service.ts` under its ratchet |
| Core `parking/{permission-ask,index}.ts` | the shared ask; the alternative was copying 40 lines into `recovery/` |
| Core `action-permissions/declaration.ts` | `[]` cannot be read as a declaration while the reader refuses it |
| domain `llm-evidence/permission.ts` | the `[]` short-circuit that kept every press invisible to Core lives here, not in `plan-resolution/` |
| domain `llm-evidence/tests/press.test.ts` | that file asserted the short-circuit by name |

I did **not** touch `flow-draft/**`, `flow-bootstrap/authoring/**`,
`flow-bootstrap/plan/**`, `llm/evidence-loop*.ts`, `llm/node-tools/**` or
`packages/test-runner/**`.

## Commands run and observed results

### Live, against the real DeepSeek in `.env.local`

Isolated Lab instance `t091`, `FLUXIQ_TEST_ENV_FILES=none
FLUXIQ_TEST_TARGET=persistent-isolated`, a fresh workspace per run, via
`pnpm lab:campaign social-scheduler-schedule-post`. No `--llm-permit`, so every
grant permitted nothing. No web panel was started or managed. 30 provider calls,
**$0.121**.

| # | run id | observed |
| --- | --- | --- |
| 1 | `run-mudmlf2q-0f938cfe` | **verdict passed**, `flowCreated: true`, 6-node Flow with 2 presses, 13 calls, $0.0535. 20 declarations recorded, 17 empty, the schedule press `send_or_publish`. `crossCheck.undeclared: ["create_new"]`, one `confirm` turn in the thread. |
| 2 | `run-mudna2ng-ceadeb69` | **failed, and it was mine**: `environment.missing`, 0 calls, no Flow. `providerCallCount` folded the authority call in and broke the Lab's bounded contract. Diagnosed and fixed. |
| 3 | `run-mudngxpd-b9a4648e` | **verdict passed**, 17 calls, $0.0677. Identical declarations and cross-check to run 1. `totalProviderCallCount: 18` beside `providerCallCount: 17`. |

### Deterministic, no provider

| Suite | Observed |
| --- | --- |
| Core `action-permissions` (4 files) | **38 passed**, 11 of them new in `declared.test.ts` |
| Core `recovery/tests/runtime-exploration-permission.test.ts` | **11 passed**, 3 new: granted, refused, nobody answered |
| Core `service/flow-bootstrap-commands` | **3 passed**, new, pinning the contract I broke |
| Core `llm/harness-options` (6 files) | 75 passed |
| Core `tests/service-bootstrap` (12 files) | 73 passed, 1 timeout (below) |
| `DOMAIN_TEST_BUILD_LABEL=t091 node domain/scripts/test-domain.mjs` | **`# tests 752 / # pass 752 / # fail 0`** |
| `EXTENSION_TEST_BUILD_LABEL=t091 node apps/extension/scripts/test-extension.mjs` | **`# tests 731 / # pass 731 / # fail 0`** |

Two existing tests asserted behaviour this task deliberately changed, and both
were updated rather than worked around: `gate.test.ts` listed
`consequences: []` among the malformed declarations (replaced with a missing
key and a non-array, which are still malformed), and `press.test.ts` asserted
that an empty declaration asks Core nothing.

### Checks

| Command | Observed |
| --- | --- |
| Core `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` | clean |
| Core `pnpm check` | **exit 0**; `structure-audit: passed (176 warning(s), 360 baselined)` |
| Core `npx vitest run --exclude "**/.tmp/**" src/programs/automation-studio/runtime` | 2,124 tests, **23 failed, all `Test timed out in 5000ms`** plus 3 `EBUSY` unlinks — the environmental family; **no assertion failure anywhere in the run** |
| `npx tsc -p domain/tsconfig.json --noEmit`, `-p domain/tsconfig.test.json` | clean |
| Downstream `pnpm check` | **exit 0**; `structure-audit: passed (94 warning(s), 122 baselined)` |
| `pnpm build` in both repositories | exit 0 |

The one timed-out file in my own area,
`tests/service-bootstrap/tests/adaptation.test.ts`, **passes alone in 17.6s, 9
of 9**. Per `becdf07`'s rule a failure is suspect only if it is outside the
family or reproduces alone on an idle machine; none of these is.

The structure audit caught four violations of mine and all four are fixed: two
`contract-spread` (the gate's record builder and a test helper — the rule was
right, the field it would have hidden is the one this task is about), a
`swallowed-failure` in the thread write, and `service.ts` over its baseline,
which is what prompted the extraction above.

## Not verified

- **Whether a press that declares a class the instruction does *not* ask for now
  reaches a person.** No live run produced one: on this task the instruction
  covers `send_or_publish`, so the gate had nothing to refuse. The path is
  proved model-free, and t087 proved the ask end to end against a real
  conversation store, but the two have not met live.
- **Hole 3 live.** Proved model-free through the real loop, registry and gate,
  with a stand-in thread. No `--llm-task repair` run was made; the corpus has no
  repair variant that reliably raises a permission request.
- **That the cross-check's `confirm` ask is shown anywhere.** It is a real row in
  the real conversation store, written by the real port. Whether the chat window
  renders a `confirm` raised at stage `authoring` with `parks: false` is
  untested, and it is Core web UI, not mine.
- **Whether A13 is right that `create_new` was genuinely under-declared.** Core
  read the instruction as asking for both classes and the model declared one.
  Which of the two readings a person would endorse is exactly the question the
  thread now asks them, and nobody has answered it.
- **Two samples.** Both live builds behaved identically, but two runs of one task
  on one site is not a measurement of the model's declaration behaviour in
  general.
- **`beyond_instruction` live**, and the 500-record cap, are reasoned and
  unit-tested only.
- **No browser-level validation of my own changes.** The Lab runs drove a real
  Chromium extension; nothing I changed is extension code.
- Core's **full** vitest suite was not run; `src/programs/automation-studio/runtime`
  was, plus the touched files individually.

## Open questions or contradictions found

1. **The Lab's `instructedConsequences` has always read nothing, and now
   `declaredConsequences` cannot be read either.** `build-proposal.ts:286` reads
   `adaptation.instructedConsequences` off `get-flow-adaptation`, but a bootstrap
   proposal reaches that endpoint through
   `bootstrapAdaptationAsFlowAdaptation`, which never carried the field at top
   level. Both live runs report `[]` while the proposal holds two quoted
   entries. I have put all four fields into `metadata.bootstrap`, which is the
   right home; **the Lab reading them is a few lines in t089's file** and until
   it lands the adversarial lane cannot see any of this. That is why this
   report's central table was read out of SQLite.

   **Confirmed independently by the supervisor** on `run-mudny8g6-7eb38ec5`:
   the build passes and the Flow is created, and `events.ndjson`, the campaign
   summary and Core's log contain no `consequences` field and no
   `send_or_publish` anywhere. So until t089 lands, this task's central claim is
   reproducible only by hand, and only from a `persistent-isolated` run — the
   default `isolated` target deletes the install that holds the answer. The
   procedure is *How to read this yourself* above.
2. **`providerCalls` in every Lab record is short by one per build**, and the fix
   is one line in `existing-fluxiq-control.ts` — read `totalProviderCallCount`
   when present, and stop requiring `decisionCount === providerCallCount` to
   mean "all the calls". Core now publishes both. t089's.
3. **A13 needs a second opinion on `create_new`.** Both live builds say the
   instruction asks for it and no action declared it. Either the model
   under-declares a second class on a press that publishes, or Core's
   instruction reader is over-claiming `create_new` for "schedule a post" — the
   schema's own description says scheduling "creates a new thing that stays", so
   the reader is doing what it was told. Whoever owns `node-tools/run-node.ts`
   should know that the press example now needs to show *two* classes on one
   action, because today the model gives exactly one.
4. **The cross-check's ask has no answer path that does anything.** A person can
   grant or deny it and nothing reads the answer. Blocking apply on it would be
   the obvious next move and I deliberately did not: the instruction already
   permits the classes in question, so nothing is bypassed, and a build blocked
   on a prompt defect is worse than a build proposed with the contradiction
   written on it. Somebody should decide whether that stays true once the
   declarations are trustworthy.
5. **17 of 20 declarations are the dry run and the exploration replaying the same
   steps.** The record is honest but repetitive: the same press appears three
   times under three refs. A reader wanting "what does this Flow do" wants the
   `flow_step` rows alone. The `kind` is on every record, so it is a reader's
   filter rather than a defect, but the `declaredNothing: 17` in the sentence a
   person reads counts replays.
6. **A recovery with no conversation still dies on a request.** That is
   deliberate — there is nowhere to ask — but it means the "one loop, three
   entry points" rule holds only for a project whose runs have threads. Nothing
   warns a caller that binding no parking port makes every permission question
   terminal.
