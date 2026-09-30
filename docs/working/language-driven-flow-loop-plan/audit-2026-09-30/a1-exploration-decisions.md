# Audit A1: exploration and the model's decisions (Full Debug Protocol, stage 2)

Worker audit, 2026-09-30. This is read-only: no code was changed and no Lab was run.

- **Code audited:** Core `dev` at `9d343d3b`. `R/` below means
  `C:/Users/osrs_/FluxStuff/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`.
- **In-flight branches checked:** `task/t196-state-digest-cost` and `task/t200-model-sees-whole-page`, in
  `C:/Users/osrs_/FluxStuff/fxwork/{t196,t200}`.

## Outcome

The page does not stop these builds. They fail in the loop. A model that is never told what "done" means
keeps finishing too early. It is refused, and every refusal is answered with more replays and more guessing.
Meanwhile a loop guard that counts any landed press as progress lets it circle until the 64-decision
backstop. Four causes account for nearly every no-Flow run:

- two are open on every branch (causes 1 and 2);
- one is fixed only on t196's unvalidated WIP branch (cause 3);
- one is t200's, and nothing has landed for it in Core yet (cause 4).

## Evidence base and how runs were counted

- **Debugs.** I took the union of `debugs/*.md` from the main checkout and the t174, t193, t194 and t195 trees
  (57 files; the lane copy won for five files t195 had edited). I read every debug's "Causes" table.
- **Lane reports.** I read t174, t193, t194 and t195 (run tables and fix logs), plus the t196 and t200 reports.
- **Bundles, all of them, not only the debugged ones.** A script read `snapshots/flow-lane.json` for every
  `run-mun*`/`run-muo*` bundle under the five trees' `test-runs/instances/` (1,191 bundles; 117 have a build
  loop). It also tallied the `missing=` reasons in `logs/core.log`. The scripts are in the worker scratchpad
  (`a1-scan.cjs`, `a1-codes.cjs`, `a1-per.cjs`). Only codes, counts and run ids are quoted here. No page
  data, tokens or keys.

**Population.**
- 117 builds ran a decision loop.
- 42 created a Flow (stage 3+).
- 18 stopped to ask permission at the declared point (bigbox pickup-order). That is the right ending, so they
  are not counted here.
- **57 ended with no Flow:**
  - `evidence_iteration_limit`: 24
  - `evidence_unusable_decision`: 16
  - `evidence_repeat_without_progress`: 13
  - `user_intervention_required`: 4
- A further 4 ended before a loop row existed: three Core throws and one Lab timeout.

By task, no-Flow builds out of all builds:

| Task | No Flow |
| --- | --- |
| everything-store-kettle-to-cart | 12 of 12 |
| crossborder-marketplace-hub-to-cart | 14 of 16 |
| bigbox-retail-pickup-cart | 10 of 16 |
| bigbox pickup-cart-redesigned | 10 of 32 |
| social-network-feed-confirm-requests | 4 of 6 |

**Where the 2,889 decisions of the 57 failed builds went:**

| Where it went | Decisions | Share | Runs |
| --- | --- | --- | --- |
| Refused completions | 401 | 14% | 37 runs had 5 or more; 27 had 8 or more |
| Amendments that changed nothing (`draft_unchanged` or undone) | 223 | 8% | 23 runs had 5 or more |
| Presses and navigations that left the page unchanged | 175 | 6% | |
| Tool calls refused because the handle was wrong | 147 | 5% | (reasons below) |
| Requests answered from memory | 111 | 4% | |
| Invented addresses refused (`address_not_shown`) | 96 | 3% | |

The 147 handle refusals break down as `handle_not_in_packet` 87, `target_not_a_handle` 51,
`handle_wrong_kind_of_control` 5, `handle_no_longer_on_page` and similar the rest.

**Refused completions by first issue code:**

| First issue code | Completions | Runs |
| --- | --- | --- |
| `bootstrap.instructed_act_missing` | 304 | 45 |
| `llm_evidence_loop.dry_run_refused` | 29 | 12 |
| `bootstrap.cannot_answer_instruction` | 21 | 12 |
| `llm_output.invalid_evidence_decision` | 17 | 13 |
| `llm_output.invalid_evidence_amendment` | 11 | 5 |
| `flow_draft.repeat_span_unknown` | 9 | 1 |
| `llm.provider_malformed_response` | 8 | 4 |

The build ended with the instructed act still missing (last refusal `instructed_act_missing`) in **35 of 57**.

**`missing=` reasons in the build traces:**

| Reason | Count |
| --- | --- |
| `step_changed_nothing` | 164 |
| `no_step_named` | 114 |
| `step_only_arrives` | 101 |
| `no_such_step` | 98 |
| `step_claimed_twice` | 43 |
| `step_is_optional` | 22 |
| `choice_is_the_act_step` | 19 |
| `act_needs_repeat` | 14 |

"Killed" below means the cause is the proximate reason the build ended with no Flow. "Contributed" means it
spent a large share of a build that another cause ended. Earliest stage is the Full Debug Protocol stage where
the cause first shows.

---

## Ranked causes

### 1. The model does not know what "done" means until it is refused, so it completes early and blindly (OPEN)

**Scale.**
- `instructed_act_missing` was refused in 45 of the 57 failed builds, 304 completions in all, and was the last
  refusal in 35.
- 29 builds were refused it 5 or more times.
- Earliest stage: 2.

**Debugged examples.**

| Run | Refused completions |
| --- | --- |
| `run-muntu7in-e3dd1972` | 14 |
| `run-muogweml-0190212c` | 16, 7 of them claiming the start navigation |
| `run-muoga8at-123533a4` | 13, d30 claimed for five acts |
| `run-muntcsge-36c2663a` | 9 |
| `run-munpjclw-52592f43` | 8 |
| `run-munp80f5-c31ea417` | 9 (lane report: 8 in a row, no action between them) |

**Root cause on dev: four facts combine.**
1. **The acts are hidden until the first refusal.**
   - Core derives the instruction's acts, including t174's size and quantity requirements, only inside the
     completion check (`R/llm/harness-options/bootstrap-completion.ts:300`,
     `R/flow-bootstrap/instructed-acts/check.ts:107`).
   - Their ids (`a1`, `a2` ...) first reach the model in a refusal (`check.ts:147-151`).
   - So the first completion of every build must fail `no_step_named`: 114 in the traces.
2. **Claims and the draft use different names for a step.**
   - The completion schema asks for "The id of the kept draft step ... such as d7"
     (`R/flow-bootstrap/plan/evidence-schema.ts:130`).
   - The refusal lists ids (`check.ts:150`, `stepsThatChangedSomething`).
   - The draft the model reads shows only `step: <position>` and never the id
     (`R/flow-draft/entry.ts:243-247` `stepLine`, `:273-281` `stepRow`).
   - `no_such_step` (98) and `step_claimed_twice` (43) are the result.
3. **The standing instruction pushes early completion.** It tells every build "Complete immediately once
   current evidence is sufficient ... prefer observation over mutation"
   (`R/llm/evidence-loop-decision.ts:51`). That is a one-reply rule applied to a Flow build.
4. **Too much of the page is hidden for the model to plan against the acts.** See cause 4: the 4 KB draft cap
   cuts the guidance to 177 bytes.

**Status.** Open on dev and on every branch.
- t195's F13 (trace) and F15 (`repeatWith`) are on dev.
- t174's F5, F6 and P1 B make the check stricter, and so add refusals, without showing the acts earlier.

**Fix, partitioned by file.**
- **1a. Instructed-acts checklist** (new `R/flow-bootstrap/instructed-acts/checklist.ts`, plus its `index.ts`).
  - A pure function `automationStudioInstructedActsChecklist({ instructionText, draftSteps, startLocation })`.
  - For every act it returns `{ id, kind, verb, quote, plural?, requirement? }`.
  - It adds the status the check would give now, with no claims: whether a kept mutating step exists, the
    candidate step ids, and whether the act is plural.
  - It reuses `automationStudioInstructedActs` and the check's own predicates. No provider call.
  - Test: `instructed-acts/tests/checklist.test.ts`. Cover a bigbox-shaped instruction (store, two adds with
    size and quantity) and a plural confirm. Assert the ids match what `check.ts` later reports.
- **1b. Wiring** (`R/llm/harness-options/bootstrap-completion.ts`).
  - Export a `draftActs(steps)` callback built from 1a, next to `checkCompletion`.
  - `R/service.ts` (the loop input at about `:1558`) passes it as `draft.acts`.
  - `R/llm/loop-configuration.ts` adds `draft.acts?: (steps) => JsonObject` to `AutomationStudioLlmEvidenceLoopInput`.
- **1c. Show the checklist and the ids in the draft** (`R/flow-draft/entry.ts`).
  - Add `id` to `stepLine` and to `stepRow` (a new trailing field in `DRAFT_STEP_ROW_FIELDS`).
  - Render `acts: <checklist>` at every length of the entry, never trimmed.
  - Change `DRAFT_INSTRUCTION*` to say: claim acts by the `id` column; complete only when every act shows a
    kept step.
  - Test: `flow-draft/tests/entry.test.ts` and `entry-budget.test.ts`.
- **1d. Accept either name for a step** (`R/flow-bootstrap/plan/evidence-schema.ts:130` and `check.ts:150`).
  - Describe `step` as "the id or step number shown in your draft".
  - List both in `stepsThatChangedSomething` (`d7 (step 7)`).
- **1e. The instruction for drafting builds** (`R/llm/evidence-loop-decision.ts:51`).
  - When `drafting` is true, replace "Complete immediately ... prefer observation over mutation" with:
    do each listed act live once per distinct target; complete only when the draft's `acts` checklist shows
    every act kept.
  - Keep the current text for non-drafting callers (repair exploration, one-reply).
  - Test: `R/llm/tests/evidence-loop-decision.test.ts`, one assertion per variant.
- **Measure.** Replay a recorded-shape run in `R/llm/decision-context/tests/recorded-runs.ts`, for example the
  shape of `run-muoga8at` or `run-muntu7in`. Assert that the first decision's context holds `acts` with ids.

**Conflicts.**
- t200-w3 owns `flow-draft/**`, `evidence-loop-decision.ts` and `loop-configuration.ts`, and plans to remove
  the draft cap. 1c and 1e should go into t200-w3's brief, or land right after it.
- t196 edits `entry.ts` (`replayed` word, `automationStudioFlowDraftReplayOutcomeWord`), and its dry-run
  instruction now says "You said the Flow is ready, so it was tested". Rebase 1c onto t196, keeping its word
  mapping.

### 2. Any press or navigation that lands counts as progress, so circling builds run to the 64-decision backstop (OPEN)

**Scale.** It killed **24 of 57** (every `evidence_iteration_limit` ending). Earliest stage: 2.

**Examples.**

| Run | What the loop did |
| --- | --- |
| `run-munwmfrs-b81bbc65` | 47 applied actions, `open.towels` / `add.towels` / `open.cart` ten times; every row `pageState: changed`, `draftState: changed`; the guard never stepped (read from the bundle) |
| `run-munvz5x0-84fa6177` | 42 actions |
| `run-munuxns5-833f4313` | 40 actions |
| `run-muntufao-7b7bc04a` | 24 actions, 10 page-unchanged |
| `run-munnq7vz-98c3481c` | 64 decisions, 11 answered from memory |
| `run-muo0um1v-855281c2` | 29 actions, 16 page-unchanged |

`run-munmmj5n-52d8a67d` belongs here too: 27 re-navigations to one item page, then the Lab failed it at
63 calls.

**Root cause on dev.**
- `R/llm/evidence-loop/no-progress.ts:41-43` states the rule: "A call that applied an effect is always
  progress". `answerRepeats` applies it at `:145-149`: `!mutated && ...`.
- `R/llm/evidence-loop.ts:719` passes `mutated: record.effect === "mutate" && effectApplied`, and `:725`
  clears the guard on it.
- The domain reports `effectApplied: true` for every node that ran, whatever the page did
  (`domain/src/runtime/llm-evidence/node-run/run.ts:426-435`).
- So navigate, press, navigate back and press again clears the count every time.
- The guard also compares an answer only with the last answer of the same **tool** (`no-progress.ts:146`).
  Every web node goes through the one tool `core.run_node`, so any other call in between resets it.
- Applied keep/drop amendments neither step nor clear the guard (`R/llm/decision-handlers/amendment.ts:263-267`).
- A refused completion's issue set is forgotten at the next applied action (`no-progress.ts:117-122`,
  `cleared()`). "Refuse, act, refuse again" never accumulates.

**Status.** Open on dev.
- t196's first round (look withdrawal, on dev) covers repeated looks only.
- Neither t196 nor t200 touches this rule.

**Fix, partitioned by file.**
- **2a. Progress means a new state** (`R/llm/evidence-loop/no-progress.ts`).
  - Add `visited: Set<string>` of post-call state digests, reset only by `cleared()`.
  - `answerRepeats` takes `stateAfter?: string`. An applied call is progress only when `stateAfter` is
    undefined (no digests, the old behaviour) or not in `visited`.
  - Add `refusedOver: Map<string, number>` keyed by `draftReplaySignature + issueSet`, not cleared by tool
    progress. A refused completion over the same proposed steps with the same issues counts as a step.
  - Test: `R/llm/evidence-loop/tests/no-progress.test.ts`, with new cases:
    - an A→B→A→B navigation loop steps from the third call;
    - an applied call reaching a new digest clears;
    - refuse, act (same draft), refuse steps.
- **2b. Loop wiring** (`R/llm/evidence-loop.ts:714-737`).
  - Pass `stateAfter` (already computed at `:663`) into `answerRepeats`.
  - At the `unusable()` call from a completion (`:356-358`), pass
    `automationStudioFlowDraftReplaySignature(draftSteps)` so 2a can key on it.
  - Test: `R/llm/tests/evidence-loop*.test.ts`. Build a scripted loop from `run-munwmfrs`'s shape
    (nav/press/nav/press with repeating digests). Assert `repeat_without_progress` well before 64, and a
    redirect at the third revisit.
- **2c. The redirect** (`R/llm/evidence-loop/stall-redirect.ts`). When the repeating tool is `core.run_node`
  with revisited states, say that the page has been in this state before and name the act still missing,
  taken from `lastIssueCodes` or the checklist from 1a.
- Replay test: `R/llm/decision-context/tests/recorded-windows.test.ts` (t196 already edits it; coordinate).

**Conflicts.**
- t200-w3 owns `evidence-loop.ts` and `evidence-loop/`.
- t196 edits `evidence-loop.ts:490-497` (a different hunk) and `evidence-loop/{completion-attempt,resume,progress-trace}.ts`.
- Land after t196 merges. Rebase on t200-w3's edits.
- t200 removes the per-request caps and keeps the $0.25 ceiling. Decisions will grow from about 18k input
  tokens and $0.002 each (run 15, decision 20) to whole-page size, so the ceiling rather than 64 iterations
  will end circling builds. That makes 2a more urgent, not less.

### 3. The draft is replayed from the start during exploration, and the replay's verdicts drive the model (FIXED ON BRANCH `task/t196-state-digest-cost`, unvalidated)

**Scale.**
- Killed 6 debugged builds: `run-munaiz76-7026748c`, `run-munri5gr-94d7f8a0`, `run-munw16g4-81e2d1a8`,
  `run-muntu7in-e3dd1972`, `run-muntc23v-7fcc4110` and `run-munpjclw-52592f43`.
- Contributed to 7 more: `run-munnq7vz`, `run-muntcsge`, `run-muntufao`, `run-munsxchc`, `run-muog33va`,
  `run-muogweml` and `run-munq51ik`.
- In the bundle population, `dry_run_refused` was the first refusal code in 12 of 57 and in the final issues
  of 9. The check's codes come first, so this undercounts.
- Earliest stage: 2.

**What it cost.**

| Run | Cost |
| --- | --- |
| `run-muntu7in-e3dd1972` | 401 of 537 s in replays; ended on the deadline |
| `run-muntufao-7b7bc04a` | 142 s; moved the person's cart lines |
| `run-muntcsge-36c2663a` | 95.5 s |

- In `run-munri5gr` and `run-munw16g4`, the store switch replayed on an already-switched site, so the model
  re-amended unchanged 6 and 7 times.
- In `run-muntc23v`, resets landed on the robot check.

It also shipped wrong Flows. The "asked once" waiver and step withdrawals accepted drafts with failing or
missing steps in `run-munpwa5r`, `run-muntmwvx`, `run-munvvc3z`, `run-munutuvf`, `run-munwdydi`,
`run-munv9eqy` and `run-munwmt25`.

**Root cause on dev.**
- `R/llm/evidence-loop/completion-attempt.ts:164-176` runs the dry run on every completion, whatever the
  check said.
- `R/llm/node-tools/replay-draft.ts:84-115` resets by navigation and re-executes every proposed step,
  lasting effects included.
- `R/flow-draft/dry-run.ts:176-183`: an `unreproducible` step stops blocking once "asked".
- `R/llm/evidence-loop.ts:490-497`: a continuation replays the draft before its first decision.
- Dev already has t195's F18 (`R/llm/node-tools/dry-run-gate.ts:237-283`, at most 2 replays of one unchanged
  draft) and F11 (repeat spans exempt). These are mitigations only.

**Status.** Fixed on branch `task/t196-state-digest-cost`: Core WIP `66c77aea` plus the working tree. It is
**unvalidated**, and the Core tree is mid-merge.

What the branch does:
- `completion-attempt.ts` tests only after the check accepts.
- `dry-run.ts` removes the "asked" waiver: `automationStudioFlowDraftReplayOutcomeBlocks` returns
  `status !== "replayed"`.
- The new `flow-draft/verify-only.ts` plus `replay-draft.ts` verify a lasting step rather than re-run it.
- `resume.ts` and `evidence-loop.ts` no longer replay on a continuation.
- Downstream, `domain/.../node-run/{verify.ts, replay-answer.ts}` are untracked and `replay.ts` is modified.

What stands between it and dev:
- `dry-run-gate.ts` is `UU` and `tests/dry-run-gate.test.ts` is `AA`.
- 78 paths are dirty in Core, 5 downstream.
- No test run is recorded for this state (the t196 report predates it).

**Action.** No new design. t196 must:
1. finish the merge;
2. run `R/flow-draft`, `R/llm/node-tools` and `R/llm/evidence-loop` vitest plus the domain `node-run` tests;
3. merge.

One gap remains after t196, and it is outside A1: the dry run still starts from the build's own site state,
not a fresh visitor's. That is t174's D1 and belongs to the replay and playback audit.

### 4. The model cannot see enough of the page, its draft or its own history (OWNED BY t200; nothing landed in Core yet)

**Scale.**

| Symptom | Count |
| --- | --- |
| Draft guidance cut to 154–177 bytes at the build's last row | 103 of 117 builds |
| Draft entry at 3,800 bytes or more (cap 4,000) | 99 |
| Handle refusals in the failed builds (`handle_not_in_packet` 87, `target_not_a_handle` 51) | 147 |
| Failed builds with 3 or more handle refusals | 23 of 57 |
| Requests answered from memory | 111 |

**Killed.**
- `run-muogweml-0190212c` (`handle_not_in_packet` ×8 on one result card).
- `run-muntc23v-7fcc4110`: 11 extract reruns because the 512-byte input cap hid its own `where`, which then
  hit the store's rate limit.
- `run-munneauy-de8663ed` (10 answers from memory).
- `run-muoga8at-123533a4`: 36 of 37 steps shown without input, so d30 was claimed for five acts.

**Contributed.** `run-munnq7vz`, `run-munpjclw`, `run-muog33va` and `run-muncqlr0`.

Earliest stage: 2.

**Root cause on dev.**

| Limit | Where |
| --- | --- |
| 4 KB draft cap | `R/llm/loop-configuration.ts:355` (`draftBytes: min(4_000, window/4)`) |
| 512-byte step input | `R/flow-draft/entry.ts:80, :329` |
| 24 KB evidence window | `R/loop-limits/flow-bootstrap-evidence-loop.ts:84` |
| History at most 4 KB | `R/llm/decision-context/shown.ts:44` |
| 40 elements and 6,000 bytes per packet | downstream `domain/src/runtime/llm-evidence/limits.ts:34-52` |

**Status.** Owned by t200.
- The Core tree `fxwork/t200/!FluxIQ` is clean at `f4feb028`: no Core change yet.
- Downstream, 23 paths are dirty (extension identity, `domain/.../location.ts`, `untrusted-json.ts`, new
  `withheld.ts`).

**Action.** No separate fix; t200's D1–D9 cover it. Two things to add to t200's brief:
1. Show the step `id` in the draft (cause 1, 1c).
2. Keep the refusal and feedback entries (`core.completion_feedback`, `core.amendment_feedback`) in view
   until superseded. They are already superseded rather than evicted, so D6's "window shows every evidence
   entry" is enough.

### 5. The draft is a transcript the model must prune, and its edits break it (OPEN; t196 intends the redesign, no code yet)

**Scale.**
- 223 amendments that changed nothing in 57 failed builds; 23 builds had 5 or more.
- Killed `run-muog33va-96469cb2`: a rerun orphaned `repeat` routing, and `repeat_span_unknown` named the wrong
  reference nine times.
- Killed `run-muntfume-7f7d97fb`: six identical routing amendments refused `not_a_kept_step`, with no reference
  named.
- Contributed to `run-munsxchc` (`no_such_position`, now F16), `run-munuj2os` and `run-muntu7in` (9 keep/drop
  churns).
- Shipped wrong Flows when an amendment withdrew a prerequisite or an instructed act:
  - `run-munore4o` (41);
  - `run-munpwa5r` (40);
  - `run-muntmwvx` (17);
  - `run-munutuvf` (31–32);
  - `run-munwdydi` (30).
- Earliest stage: 2.

**Root cause on dev.**
- **Every call is kept by default.** Each tool call is appended as `kept` (`R/llm/evidence-loop.ts:256-263`
  `draftRecord`, called at `:699`). The draft tells the model "every step here is something you actually
  ran ... A step you want and have not run yet is run, not written" (`R/flow-draft/entry.ts:43`). Failed tries,
  retries and back-and-forth navigations all enter the Flow unless the model drops them.
- **A rerun orphans routing.** It appends at the end and drops the replaced step without carrying routing that
  names it (`R/llm/evidence-loop/rerun-replacement.ts:22-24`).
- **One refusal message covers three faults.** "`over` missing", "`through` missing" and "`through` behind"
  all get one message (`R/flow-bootstrap/authoring/draft-routing.ts:182`).
- **`not_a_kept_step` never names the reference** (`R/flow-draft/amendment.ts:219,227`;
  `R/llm/draft-amendment-feedback.ts:56`).
- **`over_not_before` never suggests `reorder`** (`draft-amendment-feedback.ts:55`). In `run-muog33va` the
  model re-pressed Confirm for real instead.
- **Nothing warns when a withdrawal strands later steps.** The history records `withdrewChanged`
  (`R/llm/decision-handlers/amendment.ts:233`), but no check warns that a later kept step's page depended on
  the withdrawn one.

**Status.** Open on dev. t195 recorded most of these as open. The brief assigns "authors an intelligent draft,
not a transcript" to t196, but nothing in its branch touches `draftRecord` or `DRAFT_INSTRUCTION`.

**Fix, partitioned by file.** 5a to 5c are independent of the redesign and cheap.
- **5a. Rerun keeps its place** (`R/llm/evidence-loop/rerun-replacement.ts`).
  - Move the rerun step to the replaced step's position.
  - Rewrite every `routing.over`, `through`, `check` and `to` naming the replaced id to the rerun's id, using
    `automationStudioFlowDraftRoutingReferences` in `R/flow-draft/routing.ts:86`.
  - Test: `R/llm/evidence-loop/tests/rerun-replacement.test.ts`. A `repeat(over=d15)` on d16, then rerun d15:
    routing points to the new id, and it sits before d16.
- **5b. The span refusal names the fault** (`R/flow-bootstrap/authoring/draft-routing.ts:182`).
  - Split it into three codes and messages: over absent, through absent, through before.
  - Each names the step, why it is out (dropped, replaced by step N, did not work) and the exact amendment.
  - Test: `authoring/tests/draft-routing.test.ts`.
- **5c. Name the offending reference.**
  - `R/flow-draft/amendment.ts:215-227` returns `{ reason: "not_a_kept_step", reference: "over" | "through" | "check" | "to", step }`.
    This extends `AutomationStudioFlowDraftAmendmentRefusal`.
  - `R/llm/draft-amendment-feedback.ts:55-56` renders it, and for `over_not_before` gives the `reorder`
    amendment explicitly.
  - Mirror the new refusal field in `packages/fluxiq/.../flow-bootstrap/evidence-loop-steps.ts` (the refusal
    parser).
  - Test: `flow-draft/tests/amendment.test.ts`, `llm/tests/draft-amendment-feedback.test.ts`.
- **5d. Authored draft** (design decision for t196; not specified here beyond the evidence). Two options:
  - record actions as candidates and let the model keep them;
  - supersede an identical re-execution (same `actionId`) and, where t196 decides, the same `ranWith` target.

  Take care: t195's F17 wants two consecutive presses of a swallowed control kept. So "identical in a row
  after `pageChanged: false`" is not a duplicate.

**Conflicts.**
- t200-w3 owns `flow-draft/**` and `evidence-loop/**`, so coordinate 5a and 5c.
- 5b (`authoring/`) and `draft-amendment-feedback.ts` belong to no in-flight lane.

### 6. Tools tell the model an act worked when it did nothing, and the model navigates blind (PARTLY FIXED; rest on branches)

**Scale.**
- **Swallowed first press.** In the t195 bigbox pickup-order runs, the model looped nav/press/cart until 64:
  `run-munuxns5`, `run-munvmg0n`, `run-munvz5x0` and `run-munwmfrs`.
- **Invented addresses.** 96 `address_not_shown` refusals in 20 failed builds; 9 builds had 5 or more. On
  runs from before P1 A, the addresses went out and landed on the wrong product (`run-munvvc3z`,
  `run-munoa86g`, `run-munovwp3`).
- **Empty searches taken as success:** `run-muntufao`, `run-munutuvf` (N3), `run-munwmt25` (N3).
- **Navigate-only exploration:** `run-muntcsge`, `run-munp80f5` and `run-munoeac4`.
- 175 presses or navigations in failed builds left the page unchanged.
- Earliest stage: 2. These causes supply cause 2's loops.

**Root cause.** This is domain and extension output, not the Core loop. The domain reports `effectApplied: true`
and `web.action.succeeded` for any press that ran (`domain/src/runtime/llm-evidence/node-run/run.ts:426-435`),
with `pageChanged` and `unchangedPress` only as hints (`:415-418`).

**Status.**

| Fix | What it does | Where |
| --- | --- | --- |
| t174 F10 | a page's "no results" line reaches the model (`apps/extension/src/content/evidence/lead-statements.ts`) | on dev |
| t195 F17 | `unchangedPress` hint | on dev |
| t195 F19 | click description | on dev |
| t174 P1 A | `address_not_shown` | branch `task/t174-live-lane` only (`node-run/shown-addresses.ts` absent on dev) |
| t195 F20 | the extension presses an ignored control once more | branch `task/t195-live-control-flow`, uncommitted (`apps/extension/src/content/action-runtime/ignored-press/` absent on dev) |

The F19 row in the t195 report says: "live: no effect in run 15". F19 alone did not stop the loop.

**Action.** Merge F20 and P1 A. After that, cause 2's guard (2a) is the backstop for what remains. Nothing
more for A1.

### 7. Robot checks were not handed to a person (FIXED ON DEV, live unproven)

**Scale.** Killed or contributed in `run-muntcsge`, `run-munp80f5`, `run-munw3g8n` and `run-muntc23v` (reset
on the check), plus `run-munoeac4` and `run-munw16g4` (replay pace). Four later crossborder builds now end
`user_intervention_required` (`run-munz164x`, `run-munziqos`, `run-muo0039t`, `run-muo0jcvi`), with the final
issue `person_needed.asks_exhausted`. Earliest stage: 2.

**On dev.** t197 is merged: `R/flow-bootstrap/person-needed.ts`, with `R/service.ts:1558,1603`
`personNeeded.endedOnIntervention`. t174 F7 (navigation lands on a check) is on dev.

**Remaining.** `asks_exhausted` shows the Lab's stand-in person does not clear the check. That is Lab
behaviour, outside A1.

### 8. Throws, grant refusals and Lab timeouts (FIXED ON DEV, except one unexplained)

- **Killed:**
  - `run-munda7ub-d9214e3b` and `run-mune0xh1-2470406a` (draft-shown `did_not_work` throw);
  - `run-muncqlr0-3348202b` (the same family);
  - `run-mun5e1ie-5aeefbbd` (grant refusal as transport);
  - `run-munaiz76-7026748c` (the Lab's 300 s request timeout; the build's own cause is cause 3).
- **Fixed on dev:**
  - t174 F1 (`R/llm/evidence-loop/draft-shown.ts`);
  - t174 Fix 2, thrown issue codes (`R/flow-bootstrap/generation-failure/thrown-issue-codes.ts`);
  - t186, grants removed;
  - t174-w1, the Lab polls for failure.
- **Open:** `run-mun8tgdh-36ae87a2`, 675 s. The cause is not established, and the run predates the progress
  trace.

### 9. Unusable replies are refused with no reason recorded (OPEN, minor)

**Scale.** In the failed builds: `llm_output.invalid_evidence_decision` 17 (13 runs),
`invalid_evidence_amendment` 11 (5 runs), `llm.provider_malformed_response` 8 (4 runs). Examples:
`run-munri5gr` N2 and `run-munnop9n` #11. In `run-munw7ffn`, 13 of 35 re-author decisions were malformed.

**Root cause.** `R/llm/harness/provider-result.ts:146,171` and `R/llm/unusable-decision.ts` record the code
but not which shape check failed, nor the finish reason and output length.

**Fix.** Add a closed sub-code: `object_expected`, `unknown_kind`, `missing_field:<name>`,
`finish_reason:length`.
- Where: `R/llm/harness/provider-result.ts`, carried in `AutomationStudioLlmUnusableDecisionError.issueCodes`
  and printed by `R/llm/evidence-loop/progress-trace.ts`.
- Test: `R/llm/harness/tests/provider-result.test.ts`.
- Conflict: `progress-trace.ts` is edited by t196; append after it.

### 10. Exploration performs real acts on the wrong rows (OPEN; correctness, not a stall)

**Seen in:** `run-munsxchc` and `run-muntfume`, where the first card (1 mutual) was confirmed; also
`run-muntu7in`, `run-muog33va` (a second real Confirm from a rerun) and `run-munnyvbr`.

**Root cause.**
- A rerun of an applied consequential press is allowed (`R/llm/evidence-loop/rerun-request.ts:40-66`).
- Only guidance restrains which row the build acts on (`R/flow-draft/amendment.ts:107`, F14 wording).

**Fix.**
- `rerun-request.ts`: refuse `rerun` of a step with `effect: "mutate"`, `effectApplied: true` and a declared
  consequence other than `none`. New reason `applied_consequential_press`, with feedback that points at
  `reorder` or at a new press on a kept row.
- Test: `R/llm/evidence-loop/tests/rerun-request.test.ts`.

---

## Summary table

| # | Cause | No-Flow builds killed (of 57, plus 4 pre-loop) | Earliest stage | Status | Examples |
| --- | --- | --- | --- | --- | --- |
| 1 | Acts invisible until refused; draft shows positions, claims need ids; "complete immediately" | 35 ended on it; 45 affected | 2 | open | muogweml, muoga8at, muntu7in, munp80f5 |
| 2 | Applied action is always progress, so the build runs to 64 | 24 | 2 | open | munwmfrs, munvz5x0, muntufao, munnq7vz |
| 3 | Draft replayed from the start at every completion during exploration | 6 debugged primary, 7 contributing; 12 or more by bundle | 2 | fixed on branch `task/t196-state-digest-cost` (WIP, unvalidated, mid-merge) | muntu7in, munri5gr, munw16g4, munaiz76 |
| 4 | 40-element packets, 4 KB draft, 512 B inputs, 24 KB window | 4 debugged primary; 23 with 3 or more handle refusals | 2 | t200 (Core not started) | muogweml, muntc23v, munneauy, muoga8at |
| 5 | Transcript draft; rerun orphans routing; refusals do not name the reference | 2 primary; 23 with 5 or more no-op amendments | 2 | open (t196 design pending) | muog33va, muntfume |
| 6 | Press "succeeded" with no effect; invented addresses; empty search | feeds cause 2 (4 t195 builds at 64) | 2 | partly on dev; F20 and P1 A on branches | munwmfrs, munvvc3z, muntufao |
| 7 | Robot check not handed to a person | 4 | 2 | fixed on dev (t197) | muntcsge, munw3g8n |
| 8 | Throws, grants, Lab timeout | 5 | 2 | fixed on dev; mun8tgdh unexplained | munda7ub, mune0xh1 |
| 9 | Unusable replies without a reason | 0 alone | 2 | open | munri5gr |
| 10 | Real acts on the wrong rows | 0 (correctness) | 2 | open | munsxchc, muog33va |

## Recommended order

1. **t196 finishes its merge and validates** (cause 3). This is the largest time sink and the one that
   mutates real state.
2. **Cause 1 (1a, 1b, 1d) now.** These files belong to no in-flight lane. **1c and 1e go to t200-w3** with
   the draft-cap removal.
3. **Cause 2 (2a to 2c)** after t196 lands, rebased on t200-w3's `evidence-loop.ts`.
4. **Cause 5 (5a to 5c).** 5b and the feedback file are free now; 5a and 5c go with t200-w3.
5. **Merge t195 F20 and t174 P1 A** (cause 6).

## Conflicts with t196 and t200

- **t196** edits these Core files: `evidence-loop.ts` (resume hunk), `evidence-loop/{completion-attempt,resume,progress-trace}.ts`,
  `node-tools/{dry-run-gate,replay-draft,replay}.ts`, `flow-draft/{dry-run,entry,index,verify-only}.ts` and
  `decision-handlers/completion.ts`.
  - My fixes touch `entry.ts` (1c), `evidence-loop.ts` (2b), `progress-trace.ts` (9).
  - Different hunks throughout. Rebase after t196.
- **t200** (worker t200-w3) owns `llm/{context-window,loop-configuration,evidence-loop,evidence-loop-decision,session-key-provider}.ts`,
  `llm/{decision-context,evidence-loop,decision-handlers,node-tools,deepseek}/`, `loop-limits/**` and `flow-draft/**`.
  - That covers my 1b (`loop-configuration.ts`), 1c, 1e, 2a to 2c, 5a, 5c and 10.
  - None has started in Core.
  - Either put these in t200-w3's brief or land them strictly after it.
- **Not owned by t196 or t200:**
  - `flow-bootstrap/instructed-acts/**`, `flow-bootstrap/plan/evidence-schema.ts` and
    `llm/harness-options/bootstrap-completion.ts` (1a, 1b, 1d);
  - `flow-bootstrap/authoring/draft-routing.ts` (5b);
  - `llm/draft-amendment-feedback.ts` (5c).
  - `R/service.ts` (1b wiring) is edited by t196 (3 lines).
- **t200's D7** (whole page, 1M-token window, $0.25 ceiling kept) makes each decision costlier. Circling
  (cause 2) and blind completion (cause 1) then burn the ceiling in fewer decisions, so these fixes should
  land before t200 goes live.
- **t196's WIP drops the "asked once" waiver.** After it, a Flow cannot be accepted with a step that did not
  replay. That removes one source of shipped wrong Flows, but it raises refusals until cause 1 is fixed.

## Not verified

- No test or Lab was run. The line numbers are from dev at `9d343d3b` and were read directly.
- **Bundle counts** come from `flow-lane.json` step rows:
  - "Refused completions" counts rows whose `decision` is `unusable` or whose `toolId` starts with
    `core.decision_unusab`, so unusable replies are included (≈36 of 401).
  - The dry-run count uses only the first issue code of each refusal.
- The `missing=` tallies come from every `logs/core.log` under the four lane trees (1,194 files, passing and
  provider-free runs included). They show the distribution, not failed builds only.
- **Stated from reading, not traced live:**
  - that draft ids and positions diverge in practice (they match until a `reorder`);
  - that `no_such_step` claims come from the id-versus-position mismatch rather than invented names (the
    claim text is truncated in the trace).
- **Not checked:**
  - that the digests in `run-munwmfrs` actually repeat across its revisits. `flow-lane.json` holds `pageState`
    per call, not the digest values. 2a's test must use a recorded digest sequence, or t174's decision dump
    (F12, on the t174 branch).
  - t196's branch has no recorded validation since its WIP commit. I read its diff; I did not run its tests.

## Open questions

- **The brief's t196 description versus its branch.** The brief says t196 authors "an intelligent draft (not
  a transcript of steps)". Nothing on the branch does that yet: its code covers the dry-run lifecycle and
  verify-only. The supervisor should confirm whether 5d is t196's or needs its own task.
- **Mislabelled owners in debugs.** The debugs for `run-munri5gr` and `run-munw16g4` attribute the unchanged
  re-amend loop to "Core no-progress guard (wH)". wH is t193's row-control replay identity fix, not a guard
  change. No lane owns the guard; cause 2 is unowned.
- **Sub-act refusals.** t174's P1 B (size and quantity as their own acts) lives on the t174 branch. Without
  cause 1's checklist, it will add refusals the model cannot anticipate. Merge them together.
