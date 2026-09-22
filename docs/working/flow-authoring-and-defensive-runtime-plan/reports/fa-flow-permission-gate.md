# fa-flow-permission-gate — a created Flow's steps meet the gate (task t081)

Worktrees `F:\fxwork\t081\!FluxIQ` and `F:\fxwork\t081\!FluxIQWebExtension`, both
on `task/t081-flow-permission-gate`.

## Outcome

**Partial — and one thing on this page matters more than the rest.**

> **t081 must not merge on its own.** Four small edits under
> `runtime/flow-bootstrap/`, specified below, are what carry the model's
> declaration to the gate. Without them the enforcement this branch adds is
> unsatisfiable, and **every build whose Flow presses something fails**. Two
> live runs measured it: `run-mud7fssy-902f877b` and `run-mud7p1wg-3049531f`.
> In both, the model was refused `web.step.consequences_undeclared`, answered by
> writing the declaration — which is the good news — and the authoring layer then
> refused it as `bootstrap.unknown_parameter`.

- **Task 1, the gate is reachable: built and proved at the seam.** The web
  domain now declares and calls Core's per-step permission check, and
  `WebPlanNodeResolution` has the needs-permission outcome it lacked. Driven
  through Core's own `resolveAutomationStudioFlowBootstrapPlanParameters` with a
  real gate and no provider: **before**, a `web.dom.click` on "Schedule post"
  resolved under an empty grant with `gate.request === undefined`; **after**, the
  same step declaring `send_or_publish` answers `needs_permission`, and the gate
  raises a request naming the class, the control and Core's own sentence.
- **Task 1's live half is blocked in a file I do not own** — the box above.
- **Task 2, a non-terminal refusal: not done, and I believe the brief's premise
  is half wrong.** The gate's abort is a deliberate, documented, test-pinned
  design, and the request already reaches the person as
  `flow_bootstrap.permission_required` — observed live this session. What is
  terminal in the wrong way is the plain `throw` at
  `flow-bootstrap/action-permissions.ts:78` and the inability of a build to
  propose a Flow while carrying a request (`service.ts:1928` plus the API
  contract). Neither can be fixed from the gate, and both are outside my "Owns".
  Reasoning and exact edits below.
- **Task 3, the grammar specification: written**, with the undeclared-step
  question answered and defended, and corrected by what the live runs found.
- **One extra defect, found live and fixed inside my ownership.** The
  instruction-authority derivation read "Schedule a post ... saying: Trail
  clean-up on Saturday" as asking for `send_or_publish` only, so the build
  stopped to ask the person for `create_new` — a class the same instruction
  plainly asks for. That is the opposite of capable-by-default. The question the
  model is asked (`action-permissions/instructed.ts`) now says that one act often
  asks for several classes.
- **`service.ts` is untouched and still 6,275 lines.** No change there was needed.

## What changed and why

### Core (`F:\fxwork\t081\!FluxIQ`)

**New — `runtime/llm/harness-options/plan-step-consequences.ts`.** Reads what a
step said its own action would lastingly do, off the node's own `consequences`
field, with the node's parameters as a fallback. Accepts the shapes a Flow
script and a nested plan can produce (`send_or_publish, create_new` as one
comma-separated line; an array), reads `none` and an empty value as "nothing
lasting", puts the classes in Core's order, and is fail-closed: anything it
cannot read as Core's own classes is `malformed`, not silence. It tells apart
**a step that said nothing** from **a step that said it does nothing** — the
whole question the domain then has to answer.

**`runtime/llm/harness-options/plan-parameter-resolution.ts`.** Reads the
declaration off each node before anything else touches it, hands the domain
`declaredConsequences` beside the `permission` check Core already built per step
at `:72`, and hands on parameters with the declaration removed, so neither the
domain nor the registry sees a parameter no node declares. Two new issue codes:
`bootstrap.step_consequences_invalid` (unreadable declaration) and
`bootstrap.step_permission_required` (a step nobody permitted, with the classes
and the request id in the message). Resolution **stops at the first step that
needs permission**: the gate keeps only the first request by design, so asking
about later steps would answer each with an id that asks about another step's
classes.

**`runtime/llm/harness-options/binding.ts`.** `AutomationStudioPlanNodeResolution`
gains `needs_permission`; the resolver input gains `declaredConsequences`. Core
already declared `permission` here and already allowed an awaited answer — that
half of the seam was built and simply had nobody on the other end.

**`runtime/action-permissions/instructed.ts`.** The question put to the model now
says, in the field the answer is given in, that one act often asks for more than
one class, with three examples (scheduling or posting, a refund, replacing a
document). Motivated by the live measurement above and by the module's own
stated intent, which the class descriptions alone did not achieve.

**Not changed: `runtime/action-permissions/gate.ts`.** Reasons under Task 2.

### Downstream (`F:\fxwork\t081\!FluxIQWebExtension`)

**New — `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts`.**
Puts a step to Core's check. It adds only what Core cannot know: which control,
in the words the model was shown (`visibleText` then `accessibleName`, read off
the identity the handle resolved to), one plain word for what the control is,
and the verb for the node's own action. It reads no control and holds no word
list — the classes are the model's own statement, as the standing rule requires.

It also decides which steps must declare, which is the judgement the brief asked
me to defend: **the actions whose effect the page decides —
`web.dom.click`, `web.dom.keypress`, `web.dom.dialog` — must say what they would
cause, `none` included.** Everything else is something Core itself states is not
a consequence (typing into a field that has not submitted, choosing, clearing,
navigating, scrolling, waiting, reading), so it is never asked about and never
needs the line.

**`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`.**
`WebPlanNodeResolutionInput` gains `permission` and `declaredConsequences`;
`WebPlanNodeResolution` gains `needs_permission`; the function is now async and,
once a node's parameters are real, puts the step to the gate with them — so the
request names the control rather than a handle. Core's Run Output node is asked
about under the web output its payload names, reading the element out of that
payload.

**`domain/src/runtime/llm-evidence/tools.ts`** — one line: the binding returns a
promise now.

**Outside my "Owns", and why.**
`apps/extension/src/content/identity/tests/created-node-identity.test.ts` calls
the resolver, so it stopped compiling. I made the same mechanical change as in
the domain's own tests (await it, and say `declaredConsequences: []`), because
the alternative was leaving `pnpm check` red in a repository I was asked to
check. Three lines in one test file; no extension source was touched.

## Commands run and observed results

### The measured hole, reproduced and closed, with no provider

`domain/src/runtime/llm-evidence/plan-resolution/tests/plan-step-permission.test.ts`
drives Core's real resolution seam against the real web runtime with a real
`AutomationStudioActionPermissionGate`.

| | Observed |
| --- | --- |
| **Before the change** | `[repro] resolved.ok = true \| gate.request = undefined` — a plan whose second step presses "Schedule post", resolved under an empty grant, **built, with nobody asked**. That is `run-mud4ywy4-45c2002f`'s hole at the exact seam. |
| **After — undeclared press** | refused `["web.step.consequences_undeclared", "web.step.expected.consequences_classes_or_none"]` at `plan.subflows.0.nodes.1.parameters` |
| **After — declares `send_or_publish`, empty grant** | issue `bootstrap.step_permission_required`; `gate.request.missing = ["send_or_publish"]`, `action = {kind: "flow_step", ref: "main.post"}`, `control = {name: "Schedule post", kind: "button"}`, sentence: *"The Flow its instruction describes would press \"Schedule post\" (button) each time it runs, which would send or publish something that others will receive or see. Neither its instruction nor a grant allows that, so the build stopped to ask."* |
| **After — a grant holds the class** | builds; nothing raised |
| **After — the instruction asked for it** | builds; nothing raised |
| **After — `consequences: none`** | builds; nothing raised; the declaration is not on the node the Flow runs |
| **After — unreadable declaration** | `bootstrap.step_consequences_invalid`; nothing raised |
| **After — no build behind the resolution** | `bootstrap.step_permission_required`, *"nobody was there to ask"* |

### Live, against the real DeepSeek in `.env.local`

Isolated Lab instance `t081`, `FLUXIQ_TEST_ENV_FILES=none` so the machine's
`FLUXIQ_TEST_TARGET=existing` did not apply; the Lab brought up its own FluxIQ
and **no web panel was started or managed**. No `--llm-permit`, so every grant
permitted nothing. Task `social-scheduler-schedule-post` — the same task that
produced the plan's measured hole.

| Run | Calls (build vs observed) | Ending | What it showed |
| --- | --- | --- | --- |
| `run-mud7fssy-902f877b` | 10 == 10, $0.0533 | `flow_bootstrap.permission_required` | **My Flow-step gate fired live**, and the carrier is blocked |
| `run-mud7p1wg-3049531f` | 12 == 12, $0.0570 | `flow_bootstrap.evidence_unusable_decision`, `issueCodes: ["bootstrap.unknown_parameter"]` | the same, twice more |

`run-mud7fssy-902f877b`'s decision trail (`build.evidenceLoop.steps`):

```
inspect ok | press ok | enter_field ok | enter_field ok | detect ok
core.decision_unusable  web.step.consequences_undeclared      <- my refusal
enter_field ok
core.decision_unusable  bootstrap.unknown_parameter           <- it wrote the declaration; authoring refused it
enter_field ok
core.decision_unusable  web.step.consequences_undeclared      <- it gave up on the line
```

`run-mud7p1wg-3049531f` is the same shape with `bootstrap.unknown_parameter`
twice, and the build ends on it.

**Two findings, and they point opposite ways.**

1. **The refusal teaches, with no grammar sentence at all.** Shown only the bare
   codes `web.step.consequences_undeclared` and
   `web.step.expected.consequences_classes_or_none` at a plan path, the model
   wrote a `consequences:` line on its next completion, in both runs. That is
   the strongest available evidence that the refusal vocabulary this repository
   already uses is enough to teach a new step key, and it means the grammar
   sentence makes the mechanism cheap rather than possible.
2. **The authoring layer eats it.** `authoring/assemble.ts:259-262` and
   `authoring/normalise.ts:38-44` refuse any step key the node's definition does
   not declare, and they run *before* resolution. So the declaration never
   reaches Core's reader. This killed my first design — the declaration riding on
   the step's parameters — and is why the four edits below are required.

`run-mud7fssy-902f877b` also carried the instruction-authority defect:
`build.permissionRequest` was an `exploration_step` press of "Schedule post"
declaring `create_new`, refused because the derivation had claimed only
`send_or_publish` from an instruction that says "Schedule a post ...". That is
what `instructed.ts` now addresses.

### Checks

| Command | Observed |
| --- | --- |
| `npx tsc -p domain/tsconfig.json --noEmit` and `npx tsc -p domain/tsconfig.test.json` | clean |
| `DOMAIN_TEST_BUILD_LABEL=t081 node domain/scripts/test-domain.mjs` | `# tests 736 / # pass 736 / # fail 0` (was 731 before; 6 added, 1 replaced) |
| `node scripts/test-extension.mjs` (`apps/extension`) | `# tests 731 / # pass 731 / # fail 0` |
| `pnpm check` (downstream) | **exit 0**; `structure-audit: passed (92 warning(s), 122 baselined)` |
| `npx vitest run src/programs/automation-studio/runtime` (Core) | `192 files passed, 1966 tests passed, 1 skipped` |
| `pnpm check` (Core) | **exit 0**; `structure-audit: passed (173 warning(s), 361 baselined)` |
| `wc -l runtime/service.ts` | 6,275 — unchanged |

Intermediate states worth recording, because they are the blast radius: the
first full domain run after the change was `# fail 19` — eighteen existing
plan-resolution rows that resolve a `web.dom.click` without a declaration, plus
the reproduction row, which is the change working. The eighteen now say
`declaredConsequences: []`, which is what a build writes for a press that only
reveals.

## Specification: the grammar half, and the four edits it needs

Everything below is under `runtime/flow-bootstrap/`, which another running task
owns. None of it is guesswork: the shape is copied from a reserved step word
that already exists in the same two functions, and the need for it was measured.

### Why the grammar is not optional

The declaration is the one fact in the permission seam that neither Core nor the
domain can supply. Core holds the person's grant but has never seen the page;
the domain knows which control the step acts on but not what pressing it means
on this site. Only the model knows. So the model must say it, and it needs
somewhere to write it — and today it has nowhere, as the two live runs show.

### The carrier: a reserved step word and a node field

There is exactly one precedent in the same functions: `OUTPUT_ACTION_WORDS`
(`authoring/assemble.ts:50`). A single-segment step key in that set is taken as
the node's `outputActionId` instead of being refused as an unknown parameter.
The declaration takes the same shape.

1. **`plan/contracts.ts`** — `AutomationStudioFlowBootstrapNode` gains
   `consequences?: string[]`, beside `outputActionId`. Keep it `string[]`: the
   consequence vocabulary belongs to `action-permissions`, and
   `automationStudioPlanStepConsequences` already validates it fail-closed, so
   flow-bootstrap need not learn a word of it.
2. **`plan/parsing.ts`** — add `"consequences"` to `parseNode`'s `rejectFields`
   list, with a bound (an array of at most ten strings of at most 40
   characters). No meaning is read there.
3. **`authoring/assemble.ts`** — a `CONSEQUENCE_WORDS` set
   (`["consequences", "consequence"]`, compared through `authoringKey` so
   spelling and case do not matter) treated exactly as `OUTPUT_ACTION_WORDS` at
   `:251` and `:259-262`: a single-segment step key in it sets the node's
   `consequences` from the line's text instead of being refused.
4. **`authoring/normalise.ts`** — the same at `:38-44`, for a model that still
   returns the nested JSON plan, and `authoring/json-plan.ts:128` carries the
   field onto the node it builds.

Core's reader already prefers `node.consequences` and needs no change once these
land. If the grammar task would rather not put the field on the contract, the
only other thing that works is to let the reserved word through into
`node.parameters` in both authoring readers; Core's reader takes that too and
removes it before the registry sees it.

### The sentences for `plan/flow-script-format.ts`

Add after the format's existing *"A step may act, not only read"* line:

> `"A step that presses something says what pressing it would lastingly do: consequences: <classes>, from move_money, delete, send_or_publish, modify_existing, create_new, comma separated. Write consequences: none when the press only reveals, opens, expands, filters, sorts, ticks, dismisses or navigates. Every press step needs the line; a step that types, chooses, waits or reads never does."`
>
> `"Say what that one step would cause, not what the Flow is for: the press that applies a filter is none even in a Flow that ends by publishing, and the press that publishes is send_or_publish even when the instruction plainly asked for it."`

And carry the line on the click steps of the format's own examples, which is how
the model learns every other key here: `consequences: none` on the "click the
member's row" step and on the "apply it" step of the narrowing example.
`bootstrap-completion.ts`'s `FEEDBACK_INSTRUCTION` needs no change — the refusal
codes name the key, and the format is the one place the shape is stated.

### How a declared consequence reaches the gate, end to end

1. The model writes `consequences: send_or_publish` on the step.
2. `authoring/assemble.ts` (or `normalise.ts`) reads the reserved word onto the
   node, as it already does for `outputActionId`.
3. `plan/parsing.ts` allows the field; nothing reads its meaning.
4. `harness-options/plan-step-consequences.ts` reads it into Core's classes, in
   Core's order, fail-closed, and takes it off the parameters if it rode there.
5. `harness-options/plan-parameter-resolution.ts` hands the domain
   `declaredConsequences` beside the per-step `permission` check.
6. `plan-resolution/resolve-plan-node.ts` resolves the step's handles, then
   `plan-resolution/step-permission.ts` builds the declaration — the model's
   classes, the control's name as the model was shown it, the verb — and calls
   the check.
7. `action-permissions/gate.ts` answers from the grant and the instruction. If
   neither covers a class it raises the request, and the domain answers
   `needs_permission`.
8. `plan-parameter-resolution.ts` turns that into
   `bootstrap.step_permission_required` and stops; the build ends on the request
   as `flow_bootstrap.permission_required`, which the Lab already reads.

### The undeclared step: consequential until proven otherwise. Yes.

**A press step that declares nothing is refused, and does not build.** Four
reasons, in the order I weighted them.

1. **The same act already works this way one layer up.** The exploration press
   tool has `consequences` as a *required* input with `[]` allowed
   (`harness-options/options.ts:85`). A press written into a Flow is the same act
   made on every run instead of once, so it is strictly more consequential. A
   system that asks about the one-off press and not about the permanent one has
   the question backwards — and the model already knows how to answer it, which
   both live runs confirm.
2. **The two errors are not symmetrical.** Refusing an undeclared press costs one
   refusal round and one line of script. Permitting it costs what was measured: a
   nine-node Flow that publishes on every run with nobody asked
   (`run-mud4ywy4-45c2002f`). There is no reading of the standing product rule
   in which the second is the safer default.
3. **It refuses nothing the person wanted.** `consequences: none` is always
   available, always cheap, and always believed. FluxIQ stays capable by default:
   nothing is refused for what a control looks like, only for the model declining
   to say what its own step does. And when a class *is* declared, the person's
   instruction still permits it with nobody asked — the rule that the instruction
   is the authority.
4. **The domain cannot fill the gap honestly.** Inferring a consequence from a
   control's words or its selector is precisely the word list `press.ts` deleted
   on 2026-09-18, after it made not one state-changing job possible. Re-adding it
   under another name at authoring time would reverse a decision the user made
   explicitly.

**Scope, so the cost is proportionate.** Only `web.dom.click`,
`web.dom.keypress` and `web.dom.dialog`. `action-permissions/consequences.ts`
states that moving about, opening, expanding, filtering, choosing and typing into
a field that has not submitted are not consequences, so those steps are never
asked about. A typical Flow gains one line per press.

**The cost, measured.** Eighteen existing plan-resolution rows had to say so
explicitly. And **until the four edits land the refusal is unsatisfiable**, so
every build whose Flow presses something fails. That is not a reason to soften
the rule; it is the reason the two halves must land in the same merge.

## Task 2: what is terminal, what is not, and what I did not change

The brief asked me to make `gate.ts:159` yield a request that reaches the person
rather than throwing. Having read the path and watched it run live, I think the
premise is half wrong, and I deliberately changed nothing there.

**The request already reaches the person, and the abort is why.**
`flow-bootstrap/action-permissions.ts` documents the abort as the only thing that
stops the loop when a plan step is refused inside the completion check, "which
the loop cannot see into". Remove it for a flow step and the loop asks the model
again for a refusal no rewrite can answer, burning iterations and ending on the
same `flow_bootstrap.permission_required`. Observed live this session:
`run-mud7fssy-902f877b` ended on the request, and the Lab read it into
`build.permissionRequest` with the class, the control and the instruction's own
authority intact. The gate's one-request rule is also a recorded user decision
("It ends the run; it does not park it") and is pinned by `gate.test.ts`'s
*"keeps the first request and still refuses what comes after it"*. Rewriting it
from this brief would reverse a decision silently.

**What is actually terminal in the wrong way**, and what each needs:

1. **`flow-bootstrap/action-permissions.ts:78`** throws a bare
   `new Error("Flow Bootstrap stopped: an action needs permission.")` the moment
   a request is raised for an exploration call, so the routable refusal t079
   built (`permission_required` carrying `missing` and `requestId`) never reaches
   the model. Returning `execution` instead would let an exploration refusal be
   routed around. **Not in my Owns.** The request is not lost today — the loop
   reads `execution = "threw"`, `signal.aborted` ends the next iteration as
   `llm_evidence_loop.cancelled`, and `endedOnRequest` recovers it — so this costs
   capability, not evidence.
2. **`service.ts:1928`**, `if (askedPermission) throw askedPermission;`, runs
   before `loop.ok`, so a raised request ends the build even when a good Flow was
   completed another way. One line replaces it
   (`if (askedPermission && !accepted.verdict) …`) and it stays inside the
   ratchet, **but it must not be changed alone**: a build that proposes a Flow
   while carrying an unanswered request contradicts
   `api/contracts/adaptation.ts:133`, and it would mean a Flow containing an
   ungranted step could be applied and replayed — and replay has no gate at all,
   by design, because a saved Flow runs with no model. Whoever takes this must
   decide what blocks *apply* until the request is answered. That is a contract
   decision, not a refactor.
3. **Misattributed request ids.** With the gate reachable, a second refused step
   would be answered with the first request's id, which asks about another step's
   classes. I closed that from my own side instead of changing the gate:
   resolution stops at the first step that needs permission.

## Not verified

- **That the whole chain works in a live build.** It cannot, until the four
  flow-bootstrap edits land. Everything up to the carrier is proved live; the
  carrier is proved *absent* live, twice.
- **That the `instructed.ts` wording change works.** `run-mud7p1wg-3049531f`
  raised no permission request where `run-mud7fssy-902f877b` did, which is
  consistent with the derivation now claiming both classes — but the build failed
  before `instructedConsequences` was recorded (it is written only after the loop
  succeeds), and the model's own press declaration varies between runs. One
  sample, not a measurement. A run that completes a build is needed.
- **That a real model writes `consequences: none` for a harmless press.** Both
  live runs were stopped before they could: the model wrote the line and was
  refused by the authoring layer, so what it would have written is unknown.
- **No browser-level validation.** The changes are Core and domain; the Lab runs
  exercised a real Chromium extension only incidentally.
- **`web.dom.keypress` and `web.dom.dialog` as committing actions** are reasoned,
  not measured: no run in this session authored either.
- Core's full `vitest` suite was not run; `src/programs/automation-studio/runtime`
  was (1,966 tests). An earlier attempt to run the whole `automation-studio` tree
  from the repository root produced 442 failures that were entirely an artefact of
  my invocation — it globbed the Lab's `.tmp/core-web-build/` copy of the
  repository and ran duplicate suites against the same sqlite files
  (`EBUSY: resource busy or locked`). Re-run from `packages/fluxiq`, everything
  passed. Worth knowing before someone else reports it as a regression.

## Open questions or contradictions found

1. **This task and the grammar task are one change.** The plan's wave-one note
   already says step A11 "needs the grammar, the gate wiring, and a non-terminal
   throw". The measurement sharpens it: the grammar is not a usability
   improvement on top of the wiring, it is the wiring's only input. The step
   table should say that t081 and the `flow-script-format.ts` work merge
   together or not at all.
2. **`fa-domain-tools`' open question 2 is answered, and the answer is better
   than expected.** It said a live permission request was unreachable on this
   corpus because every task's instruction asks for the act it needs. Measured:
   not so. In `run-mud7fssy-902f877b` the model declared the press as
   `create_new` while the instruction-reader had claimed only `send_or_publish`,
   so the gate asked. A live request is reachable today — the corpus needs no new
   task — but it was reachable for the wrong reason, which is finding 3.
3. **The instruction-authority derivation under-claims, and that makes FluxIQ
   refuse what the person asked for.** "Schedule a post" is both `create_new` and
   `send_or_publish`; `instructed.ts`'s own header says so, and its class
   descriptions both list "schedule". The model still answered with one class,
   and a person was asked to permit something their own words plainly requested.
   I have changed the question; whether that is enough is unmeasured. If it is
   not, the next step is to derive per class rather than as one list.
4. **The corpus cannot exercise a Flow-step permission request end to end yet.**
   Once the carrier lands, the interesting case is a task whose instruction does
   *not* ask for the act the Flow reaches for. `everything-store-buy-kettle`'s
   own comment claims to be that task and is not — `fa-domain-tools` found the
   same. One should be added.
5. **A refusal code taught a model a step key it had never seen.** Twice, with no
   prose. That is evidence for the existing design decision that a domain's
   refusal names codes rather than sentences, and it is worth recording in the
   plan: it means new step-level grammar can be introduced by refusal, and the
   format string is for making it cheap rather than for making it possible.
