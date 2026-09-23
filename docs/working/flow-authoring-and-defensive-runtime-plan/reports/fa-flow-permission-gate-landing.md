# fa-flow-permission-gate-landing — landing t081 on top of t082 (task t081, continuation)

Worktrees `F:\fxwork\t081\!FluxIQ` and `F:\fxwork\t081\!FluxIQWebExtension`, both
on `task/t081-flow-permission-gate`, merged with `dev` by the supervisor at my
request (the worker git guard denies `git merge`); downstream merge commit
`f274035`.

## Outcome

**Done — and the mechanism is not the finding.**

The blocker is gone. t082's four `runtime/flow-bootstrap/` edits are on `dev`,
the carrier works end to end, and **no live build now dies on
`bootstrap.unknown_parameter`**. Four real DeepSeek builds completed where my
predecessor's two on the same task did not.

> **In all four live builds the gate was asked nothing, because the model
> declared every press as causing nothing lasting.** Two of those Flows contain a
> `web.dom.click`; one is the press that schedules a public post. Every run had
> `permittedConsequences: []`, `instructedConsequences: []`,
> `permissionRequest: null`, and built anyway. **A gate the actor can walk past
> by declaring `none` is not a gate.** My answer to whether it should land, and
> what would have to change for it to bite, is the section *Does this gate bite?*
> below. Short version: **land it, it is a precondition and it is cheap; but do
> not count it as a defence until the declaration is changed, and the cheapest
> real change is not in this seam at all.**

- **Task 1, the merge: reconciled.** Core merged clean. Downstream had two
  conflicts, both in files I own, plus **four files that auto-merged into
  something that compiled and was wrong**.
- **Task 2, the carrier: decided, and it was already built.** The declaration
  comes from the executed `run_node` call, carried onto the draft step — the
  brief's preferred option, already implemented by t082 in
  `llm/node-tools/draft-step.ts`. My work was to prove it (no joint of it was
  tested) and to stop the resolver gating the same act twice.
- **Task 3, the grammar: added**, one sentence rather than two, with
  `consequences: none` on all three of the format's own click examples.
- **Task 4, the live proof: run, and it says something other than predicted.**
  Four runs, 33 provider calls, $0.154.
- **Task 5, the checks: green in both repositories.**

## Does this gate bite?

The supervisor asked for this plainly, so it goes first.

### What each run declared

I could not read the declarations directly — the Lab records
`perCallRecords: "not recorded"` for a create-flow run and tears its isolated
instance down — so this is deduced, but the deduction is forced, not a guess:

- the grant permitted nothing and the instruction authority claimed nothing, so
  **any** non-empty declaration on **any** acting node would have been refused,
  at the call by `node-run/run.ts` or at the step by `plan-parameter-resolution.ts`;
- a press that declared **nothing at all** is refused
  `web.step.consequences_undeclared` and does not build;
- the builds succeeded and contain presses.

| # | run id | task | presses in the Flow | declared |
| --- | --- | --- | --- | --- |
| 1 | `run-mudib8pt-186cb078` | `social-scheduler-schedule-post` | 2 `web.dom.click` | `[]` on both, one of them the press that schedules the post |
| 2 | `run-mudip5c4-d6e7f558` | `order-operations-refund-quote` | 1 `web.dom.click` | `[]` |
| 3 | `run-mudit3xh-140db7ce` | `order-operations-partial-refund` | none — 1 `web.dom.type` | nothing to declare; the refund press never entered the Flow |
| 4 | `run-mudiy0gw-00585128` | `social-scheduler-schedule-post` (granted) | 2 `web.dom.click` | `[]` on both, and the grant it was given went unused |

`instructedConsequences: []` is **not** a second bug corroborating this:
`webActionPermission` returns `no_consequence` for an empty declaration without
invoking the check, and `gate.instructedFor()` only runs inside the check, so an
all-empty build leaves `instructed` unset by construction. I checked that before
claiming it.

### Was the model ever shown a reason to answer otherwise?

**No. Every sentence it was shown about this key illustrates the empty answer,
and not one shows a press that must declare a class.** This is concrete and
checkable, in `llm/node-tools/run-node.ts`:

1. Line 55: *"Say in `consequences` what running this node would lastingly do,
   from the classes listed, and `[]` when it only reveals, opens, expands,
   filters, sorts, ticks, dismisses, reads or moves about."* — **nine verbs** for
   the `[]` case; the classes are "the classes listed", named nowhere in prose.
2. Line 56, the only worked example in the whole description: *"Say what this one
   node would cause, not what the Flow is for: **the press that applies a filter
   is `[]`** even in a Flow that ends by publishing."* — an example of answering
   `[]`.
3. The input schema's own field description: *"What running this node would
   lastingly do. `[]` when it only reveals, reads or moves about."* — `[]` again.

So the model sees the empty answer demonstrated three times, with a nine-verb
menu of ways to qualify for it, and never once sees a press that has to say
`send_or_publish`. On these pages the correct answer is a class the model has no
example of writing.

**My own new sentence repeated exactly this mistake**, which is how I noticed.
I had written *"the press that applies a filter is none even in a Flow that ends
by publishing"* — the same single, negative example. It now reads *"the press
that applies a filter is none, the press that publishes is send_or_publish"*:
one concrete example of each answer, for six bytes.

### My reading: which of the three is it?

The supervisor offered three candidates. My answer is that it is **mostly a
prompt defect, sitting on top of a real structural weakness, and `none` being
cheap is the mechanism by which the two combine**. In order of how much of the
effect I think each explains:

1. **Prompt defect — the largest share, and the most fixable.** The evidence
   above is one-sided enough that I would expect a measurable change from adding
   a positive example alone. A model copies the shape it is shown; it was shown
   `[]` three times. This is the same failure mode, in the same codebase, that
   the format's own history records twice already: builds copied the example
   handle shape (`control.7`) because the example showed it, and then copied a
   *description* as a literal value when the example was replaced with prose. The
   standing lesson here is that the example is the instruction.
2. **`none` is the cheap answer — real, and it is an asymmetry in the loop, not
   in the model.** Declaring a class has an immediate, visible cost to the model:
   the call is refused, the build stops, and on this corpus nothing it can do
   next will unblock it. Declaring `[]` costs nothing and the work continues.
   The loop therefore rewards under-declaring on every iteration, and the model
   does not need any intent for that gradient to show up in its output. This is
   why I think the conversation channel (open question 5) is the highest-value
   fix and not a nicety: a request that *parks and can be answered* removes the
   asymmetry, because declaring truthfully stops being the answer that kills the
   run.
3. **Structural — real, but smaller than it looks, and not a reason to abandon
   the design.** Asking an actor to declare its own consequences is
   self-report, and self-report is weak against an actor with any pressure not to
   report. But the alternative FluxIQ explicitly rejected — inferring consequence
   from what a control looks like — was deleted on 2026-09-18 after it made not
   one state-changing job possible, and re-adding it would reverse a user
   decision. **The model is genuinely the only party that knows what pressing
   "Schedule post" does on this site.** So the fix is not to stop asking the
   actor; it is to stop asking it at the moment when the honest answer is the
   expensive one, and to cross-check the answer against something independent.
   The instruction-authority derivation is exactly such an independent signal and
   is already computed — it is just never compared with what the model declared.

### Is the gate as built worth landing?

**Yes — land it — and I would not describe it as a defence in the plan's step
table until the declaration changes.** Both halves of that matter:

**Why it should land.** It is a precondition for every later fix, and none of
the work above is wasted by the finding. The declaration now has somewhere to
live, travels intact from the call that ran the node to the step the Flow keeps,
and is read fail-closed. A press that declares *nothing* cannot build — that hole
is genuinely closed, and it is the hole the original measurement found
(`run-mud4ywy4-45c2002f`). When the declaration starts being truthful the gate
will work with no further change to this seam. Reverting it would cost the
carrier and buy nothing.

**Why it must not be counted yet.** As of today, on this corpus and this
provider, **a Flow that publishes is authored and replayed with nobody asked**,
and every check in both repositories is green while that is true. Anyone reading
"the Flow-step permission gate is done" would reasonably conclude the product
asks before it publishes. It does not.

**What would have to change for it to bite**, cheapest first:

1. **Balance the examples in `run-node.ts`'s description** — one worked example
   of a press that must declare, beside the filter example. Perhaps 80 bytes.
   t082's file, so I did not touch it; I made the matching change in the format
   string, which is mine.
2. **Record each `run_node` call's declared classes in the run record**
   (`packages/test-runner`, t089). Until this exists, nobody can measure whether
   change 1 worked — I had to deduce this report's central claim from the
   absence of a refusal.
3. **Make the request parkable through the conversation channel** (open question
   5). This is what removes the incentive in reading 2, and the primitive already
   exists.
4. **Cross-check the declaration against the instruction's own derived classes.**
   When the instruction plainly asks to schedule a post and every press in the
   resulting Flow declares `[]`, something is wrong that neither side can see
   alone. Both numbers are already computed in the same gate; nothing compares
   them. This is the one change that does not rely on the model's good faith.
5. **A corpus task that reliably reaches the gate.**
   `order-operations-refund-quote` was purpose-built to be it — its own comment
   says "the build is expected to end in `flow_bootstrap.permission_required`
   before any playback, so a run of it that reaches a verdict is itself the
   finding". It reached a verdict.

I would not add a FluxIQ-side judgement of what a control looks like, at any
point on this list.

## What changed and why

### The carrier decision, and why there was nothing to build

The brief asked me to decide where the declaration comes from and to prefer
carrying it from the executed call onto the draft step. That is already the
design, and the whole chain is on `dev`:

1. `llm/node-tools/run-node.ts` requires `consequences` on **every** `run_node`
   call (`required: ["node", "parameters", "consequences"]`).
2. `llm/node-tools/draft-step.ts` writes it onto the draft step as the entry
   `consequences: <classes>`, or the word `none` for `[]`.
3. `flow-bootstrap/authoring/assemble-draft.ts` turns that into a script step.
4. `authoring/assemble.ts` reads it as a reserved word
   (`authoring/consequences.ts`) onto `node.consequences`.
5. `plan/parsing.ts` bounds the field; `parseAutomationStudioFlowBootstrapPlan`
   validates in place and returns the same object, so the field survives.
6. `harness-options/plan-step-consequences.ts` reads it into Core's classes, in
   Core's order, fail-closed.
7. `plan-parameter-resolution.ts` hands the domain `declaredConsequences` with
   the per-step check; `service.ts:1588` supplies `permissions.planStep`.
8. `plan-resolution/step-permission.ts` puts it to the gate.

**Not one joint of that was tested.** I added the coverage, because a chain built
by three tasks and checked by none is exactly what passes every unit test and
does nothing live.

**The flow-script carrier stays as the fallback**, for a nested plan or a
hand-written script, and I pinned both that it is read and that the node's own
field wins when both are present.

### The one thing that had to be built: not gating the same act twice

The merge did not compile: `node-run/run.ts` called
`resolveWebPlanNodeParameters` synchronously and my branch had made it async. **A
bare `await` would have compiled and been wrong**, which is worth stating because
it is what the merge was hiding.

`run.ts` resolves parameters for a call it is about to make, and gates that call
itself a few lines later against the page the model is looking at. The resolver's
step gate is for a step of a Flow. With a bare `await`, every exploration press
would have been refused `web.step.consequences_undeclared` — `run.ts` passes no
`declaredConsequences` — and exploration would have stopped working entirely.

So `WebPlanNodeResolutionInput` gains `gatedByCaller?: true`, set by `run.ts`.
**The polarity is the design:** a caller that forgets it is gated here as well as
wherever else it gates, costing a refusal; a caller that had to opt *in* and
forgot would pass ungated, which is the defect the seam exists to close.

The two gates are not redundant:

| | `run.ts`, when the node runs | the resolver, when the step is authored |
| --- | --- | --- |
| asks about | one call, now | a step that runs every time, unwatched |
| requires a declaration from | **every** acting node | click, keypress, dialog |
| refusal carries | the page, so the model can act next | `needs_permission`; only a person can answer |

### Core

- **`flow-bootstrap/plan/flow-script-format.ts`** — the grammar sentence, and
  `consequences: none` on all three click examples (the brief named two; a model
  copies what it sees, and a third click without the line teaches the opposite).
  **The classes are interpolated from `AUTOMATION_STUDIO_ACTION_CONSEQUENCES`**,
  not spelled out, so a class added to `action-permissions/` is offered without
  anyone editing the format.
- **One sentence, not my predecessor's two.** The second — "say what that one
  step would cause, not what the Flow is for" — is already said, almost word for
  word, by `run-node.ts` on the call that makes the declaration in any build that
  explores. The format is sent on every request, so I folded its load-bearing
  example into the first sentence: 536 bytes instead of 634, and now carrying one
  example of each answer rather than only the empty one.
- **`llm/harness-options/tests/plan-step-consequences.test.ts`** — the
  end-to-end carrier rows.
- **`flow-bootstrap/plan/tests/flow-script-format.test.ts`** — that the format
  states the rule, names every class, shows both answers, carries the line on its
  own presses, and that the reader honours what the sentence asks for. A sentence
  asking for a key the reader refuses is worse than no sentence, and that is
  exactly what the two measured live builds hit.

### Downstream

- **`plan-resolution/resolve-plan-node.ts`** — `gatedByCaller`, and the header
  says why there are two moments.
- **`node-run/run.ts`** — the exact change, for t088, who owns this file:
  at the `resolveWebPlanNodeParameters` call in `runWebOutputNode`, `const
  resolved = resolveWebPlanNodeParameters(` became `const resolved = await
  resolveWebPlanNodeParameters(`, `gatedByCaller: true` was added to the input
  object, and a four-line comment was added above it. **Nothing else in the file
  changed**; no behaviour moved, and the existing `webActionPermission` call
  below it is untouched.
- **`plan-resolution/tests/plan-step-permission.test.ts`** — migrated to
  `core.run_node`, moved onto the node-field carrier, plus rows for the parameter
  fallback and for the node field winning over it.

### Files I touched outside my "Owns", each as merge reconciliation

| File | Why | Size |
| --- | --- | --- |
| `domain/.../node-run/run.ts` (**t088's**) | the merge did not compile | 2 lines + comment, detailed above |
| `apps/extension/.../created-node-identity.test.ts` | drove a retired tool; 2 rows failed | 2 lines + comment |
| Core `flow-bootstrap/tests/plan.test.ts`, `llm/tests/evidence-loop-provider.test.ts` | byte ratchets my prose tripped | the number, and why |
| `docs/working/README.md` | `pnpm check` red on `working-docs` | one line count, 643→672, from the merge |

I did **not** touch `service.ts`, `flow-bootstrap/action-permissions.ts`,
`runtime-session-grant.ts`, `live-patch/**`, `flow-draft/**`,
`llm/node-tools/run-node.ts` or `packages/test-runner/**`.

### The merge's silent damage, for the record

Four files auto-merged into something that compiled and meant something else:

- `tests/stable-handles.test.ts` and `plan-resolution/tests/plan-node-identity.test.ts`
  kept **both** my import line and dev's, so they still imported
  `WEB_LLM_INSPECT_TOOL_ID` / `WEB_LLM_PRESS_TOOL_ID`. Those constants still exist
  as deliberately *retired* ids — kept so a recorded run still reads — so it
  compiled; the runtime offers neither.
- The same retirement silently broke my own `plan-step-permission.test.ts` (6
  rows) and the extension's `created-node-identity.test.ts` (2 rows). All eight
  are migrated to `core.run_node` and green.
- `tools.ts` auto-merged correctly: its only diff against dev is the
  `Promise<WebPlanNodeResolution>` signature.

## Commands run and observed results

### Live, against the real DeepSeek in `.env.local`

Isolated Lab instance `t081`, `FLUXIQ_TEST_ENV_FILES=none
FLUXIQ_TEST_TARGET=isolated`, via `pnpm lab:campaign <task>`. No web panel was
started or managed. 33 provider calls, **$0.154**.

| # | run id | permit | observed |
| --- | --- | --- | --- |
| 1 | `run-mudib8pt-186cb078` | none | **`flowCreated: true`, verdict passed**, 8 calls, $0.0378, 7 nodes, 2 presses, `permissionRequest: null` |
| 2 | `run-mudip5c4-d6e7f558` | none | `flowCreated: true`, oracle failed on behaviour, 8 calls, $0.0359, 2 nodes, 1 press, `permissionRequest: null` |
| 3 | `run-mudit3xh-140db7ce` | none | `flowCreated: true`, oracle failed, 1 node (`web.dom.type`), `permissionRequest: null` |
| 4 | `run-mudiy0gw-00585128` | `send_or_publish,create_new` | **`flowCreated: true`, verdict passed**, 9 calls, $0.0426, same 7-node shape |

**What run 1 proves, and it is the brief's real claim.** My predecessor ran the
same task twice and both builds died on `bootstrap.unknown_parameter` after the
model wrote exactly the right `consequences:` line. The same task now builds a
seven-node Flow containing two presses and replays it. The declaration path is no
longer fatal, which had to be true before anything else could be.

**What did not happen** is the subject of *Does this gate bite?* above.

### Deterministic, no provider

| Suite | Observed |
| --- | --- |
| Core `harness-options/tests/plan-step-consequences.test.ts` | **14 passed** (8 new), including the carrier from a `run_node` call to the classes Core reads |
| Core `flow-bootstrap/plan/tests/flow-script-format.test.ts` | **9 passed** (6 new) |
| `domain/.../tests/plan-step-permission.test.ts` | 8 rows, all passing, migrated to `core.run_node` |

Two of my new assertions failed first and **both were my test asserting at the
wrong layer, not the system being wrong** — worth recording, because it pins
where the vocabulary lives:

- the authoring readers keep the classes **in the order written**;
  `automationStudioPlanStepConsequences` is what puts them in Core's order;
- `consequences: publish it` is **not** refused at authoring.
  `authoring/consequences.ts` bounds the shape and knows no class names, so the
  words pass through and the fail-closed refusal happens at resolution as
  `bootstrap.step_consequences_invalid`. **The key is never called unknown**,
  which is the entire difference from the failure that killed the two live
  builds.

### Checks

| Command | Observed |
| --- | --- |
| Core `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` | clean |
| Core `pnpm check` | **exit 0**; `structure-audit: passed (175 warning(s), 360 baselined)` |
| Core `npx vitest run src/programs/automation-studio/runtime` | 2,085 tests; see below |
| `npx tsc -p domain/tsconfig.json --noEmit`, `-p domain/tsconfig.test.json` | clean |
| `DOMAIN_TEST_BUILD_LABEL=t081 node domain/scripts/test-domain.mjs` | **`# tests 744 / # pass 744 / # fail 0`** |
| `node scripts/test-extension.mjs` | **`# tests 731 / # pass 731 / # fail 0`** |
| Downstream `pnpm check` | **exit 0**; `structure-audit: passed` |
| `wc -l runtime/service.ts` | **4,637**, untouched by me (dev shrank it from 6,275) |

**Core's runtime suite, honestly — three runs, 16, 14 and 24 failures of
2,085.** The number moves because the whole family is load-sensitive, and I
caused the worst of it: the 24-failure run was in the background while I ran
other suites against the same tree, which is exactly the condition
`AGENTS.md` says a second worktree exists to avoid. Read it as an upper bound,
not a measurement.

What matters is which failures went away and which never belonged to me:

- **Two were mine, and are fixed**: a 6,072-byte completion schema against a
  5,600 ratchet, asserted in two places. **The final run has no ratchet
  failure**, and the four suites touching my work pass on their own.
- **22 of the final 24 are `Test timed out in 15000ms`**, the family `becdf07`
  recorded as the environmental baseline (clean `dev`, no task changes, fails
  17 of them). The earlier runs added `ENOTEMPTY` / `EPERM` on `rmdir` and one
  performance assert (`504.49 < 500`), same family.
- **The other 2 are `deepseek-bootstrap-exploration.test.ts`**, whose assertions
  are about a decision "that runs past its deadline" — deadline-sensitive by
  construction. It **passes alone, all 8 rows, in 64s** with that row at 6.9s.

Per `becdf07`'s rule a failure is suspect only if it is outside the family or
reproduces alone on an idle machine. None of these is. **Nothing in the three
runs is attributable to this task once the two ratchets are fixed**, and the
next person should run this suite in its own worktree rather than beside other
work, as I should have.

**The byte ratchet, 5,600 → 6,000 in two tests.** The schema's description
carries the whole Flow script format, and the declaration sentence costs 536
bytes of it (now 5,972 total). I cut the sentence from 634 bytes before raising
the number rather than raising it to fit what I first wrote, and both sites say
what bought the increase.

**Structure audit caught one violation of mine in each repository**, both fixed:
a test reaching past a barrel in Core, and a conditional spread into an object
literal in the domain. The `contract-spread` rule was right — the field the
spread was hiding is the very one this task is about.

## Not verified

- **That a real model's non-empty declaration reaches the *step* gate live.** No
  run produced one. It may not be reachable on the draft path at all — open
  question 1 — and no run exercised the nested-plan path.
- **What the model actually wrote in each `run_node` call.** Deduced, not read;
  the deduction and its premises are in *Does this gate bite?*. A run record that
  kept each call's declared classes would have settled it in one look.
- **That the grammar sentence changes what a model writes.** Every build that
  explored assembled its Flow from the draft, so the format's sentence was never
  what produced a declaration in any of my four runs.
- **That the balanced example fixes the under-declaration.** It is reasoned from
  the one-sidedness of what the model is shown, and from this format's own twice-
  recorded history of models copying its examples. Unmeasured.
- **My predecessor's `instructed.ts` wording change** remains unmeasured, for the
  same reason: the derivation never ran.
- **No browser-level validation of my own changes.** The Lab runs drove a real
  Chromium extension, but nothing I changed is extension code.
- **`web.dom.keypress` and `web.dom.dialog`** as committing actions remain
  reasoned, not measured.
- Core's **full** vitest suite was not run; `src/programs/automation-studio/runtime` was.

## Open questions or contradictions found

1. **On the draft path the step gate may be unreachable by construction.** There
   is one gate, one grant and one instruction authority
   (`flow-bootstrap/action-permissions.ts:63-85`); `executeTool` and `planStep`
   differ only in the action kind they name. So a class the gate allowed when the
   node *ran* it allows again when the step is *authored*, and a class it refuses
   at run time ends the build immediately via the throw at line 78. Since the Flow
   is now assembled from the steps that ran, every step was already gated when it
   ran. The step gate's remaining live jobs are real but narrower than the plan
   assumes: the nested-plan and hand-written-script paths, where nodes were never
   run, and the rule that a press must declare at all. **Someone should decide
   whether that is the intended end state**, because the step table reads as
   though the step gate is the primary defence.
2. **The model under-declares.** The whole of *Does this gate bite?*. This is the
   finding, and it needs its own task.
3. **The corpus cannot exercise the gate end to end.**
   `order-operations-refund-quote` was built to be the negative case and reached a
   verdict. `fa-domain-tools` and my predecessor both flagged that no task
   reliably produces a request; three of my four runs confirm it.
4. **A build that never explored can never author a committing step.**
   `service.ts:1651` resolves with no `permissionFor`, so every step falls back to
   `automationStudioActionPermissionDenied`, which refuses any declared class with
   `requestId: null`. A press declaring `none` builds; one declaring anything
   lasting cannot, and nobody is asked. Fail-closed, possibly intended,
   undocumented, and in `service.ts`, which I must not touch.
5. **The conversation channel makes the request answerable, and the gap is one
   call site.** `runtime/conversations/ask.ts` already has a `permission` ask kind
   **keyed by the gate's own `requestId`** — its header says so explicitly — with
   `parks` meaning the work waits rather than ends. Nothing outside
   `conversations/` creates one: the Flow-Bootstrap path still ends the build on
   `flow_bootstrap.permission_required`. Turning that ending into a parked ask is
   a small change in `flow-bootstrap/action-permissions.ts` and `service.ts` —
   **t087's files** — and it is what converts the terminal refusal my predecessor
   argued about into what the standing product rule actually asks for. **Do it
   before the under-declaration work, not after:** a gate that can park is a gate
   you can afford to make strict, and it removes the incentive that I think is
   half the reason the declarations are empty.
6. **`packages/test-runner` should record each `run_node` call's declared
   classes** (t089's). It is the difference between reading the answer to
   question 2 and deducing it.
