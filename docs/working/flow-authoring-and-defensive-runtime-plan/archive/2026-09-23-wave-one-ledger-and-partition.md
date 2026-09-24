# Wave one: the six-worker partition and the ledger that ran under it

Compacted out of
[flow-authoring-and-defensive-runtime-plan.md](../../flow-authoring-and-defensive-runtime-plan.md)
on 2026-09-23, when the document passed the 800-line threshold. Nothing here
is deleted, only moved: these are the entries that explain how the plan got
from its six parallel workstreams to the single instruction-path question it
now asks, and why each design decision along the way was taken.

The work after this point runs as supervisor-direct tasks, t095 onward, and
stays in the live document's ledger.

## The implementation partition, as it was written

### Implementation partition

Six workers, partitioned so no two share a file. Core's `service.ts` is the
serial bottleneck as always and belongs to exactly one of them, and it has **zero
ratchet headroom**, so edits there may change lines and never add them.

| Worker | Steps | Owns |
| --- | --- | --- |
| `fa-build-draft` | A1, A3, A4, A5, A6 | Core `runtime/llm/evidence-loop.ts`, `runtime/flow-bootstrap/**`, new `runtime/flow-draft/` |
| `fa-service-seams` | A2, A10, B8 | Core `runtime/service.ts` (line-neutral), `runtime/llm/runtime-session-grant.ts`, `live-patch/**` |
| `fa-domain-tools` | A8, A9, A11 | `domain/src/runtime/llm-evidence/**` and Core's harness-option registration only |
| `fa-executor-ladder` | B0, B1, B1a, B2, B3, B4, B9 | Core `runtime/executor/**`, `runtime/recovery/**` |
| `fa-extension-defenses` | B5, B6, B7 | `apps/extension/src/content/**`, `src/runtime/**` |
| `fa-lab-measurement` | D0, D0a, A12 | `packages/test-runner/**` |

`fa-executor-ladder` and `fa-extension-defenses` are the pair to start first:
they are disjoint, they carry the user's stated requirements, and B5 to B7 are
standalone defects that need nothing else to land.

Workstream C waits on A5. Workstream D1 to D3 wait on D0 and B4.

## The ledger entries that ran under it

### 2026-09-22 — Document created; designs drafted; discovery dispatched
- Agent: supervisor
- Changed: this document; `docs/working/README.md`; five briefs dispatched.
- Why: the user asked for a side plan to make Flow authoring and Flow execution
  defensive before live testing continues, naming two defects from round 1: the
  saved Flow diverging from what the model did, and a failing node having no
  cheap recovery before the model.
- Validation: not validated — design and dispatch only, no code touched.
- Outcome: Partial
- Follow-up: fold the five reports into a phase and step table, then dispatch
  implementation.

---

### 2026-09-22 — Wave one: the Lab's zero-call declaration and the domain's refusal detail landed
- Agent: supervisor; workers `fa-lab-measurement`, `fa-domain-tools`
- Changed: t080 merged (`387b314`) and t079 merged (`cdb038e`), both pushed. D0 done; A8 done but inert until the repeat rule changes; A12 blocked on a two-line Core change; A11 done on the domain side only.
- Why: D0 unblocks every adversarial variant — without it the live-LLM guard fails each correct deterministic absorption. A8's detail is a prerequisite whose value waits on `fa-build-draft`.
- Validation: the supervisor re-ran both worktrees rather than trusting the reports. t080: every package `# fail 0`, `test-runner # pass 1286`. t079: every package `# fail 0`, `domain # pass 730`. Both `task finish` runs reported `"command":"pnpm check","passed":true`. t080's live proof stands: `run-mud4xk2c-18c83d3d` undeclared failed `runtime.behavior` with its oracle passing, `run-mud4zvw9-2d497834` declared passed; `budget.ts` is byte-for-byte unchanged and `settleBuild` passes no declaration, both confirmed by the supervisor.
- Outcome: Partial
- Follow-up: the permission-gate hole (finding 1) needs its own task; A12's Core half and the strategy field join wave two; `fa-domain-tools`' three named Core edits fold into the A11 successor.

---

### 2026-09-22 — Wave one closed; the correction landed; wave two dispatched
- Agent: supervisor; workers `fa-executor-ladder`, `fa-build-draft`, `fa-extension-defenses`, `fa-explore-with-output-nodes`
- Changed: t076 and t077 merged in Core alone (`cda4bb1`, `bf8792b`); t078 merged in both (`a772560`); t082, the correction that makes exploration run the real registry nodes, merged in both (`9393cbd`, Core `1987317`). A1, A3, A4, A5, A6, B1, B1a, B2, B3, B4, B5, B6, B7 and B9 are built; B0 is short one line in `service.ts`.
- Why: wave one was dispatched before the user's correction on 2026-09-22 that the model must explore by running the real output nodes, so t082 both replaced the second tool vocabulary and, incidentally, supplied the consequence carrier that t081 was blocked on.
- Validation: t082's live run `run-mudavyub-d34e3c9b` (real DeepSeek, everything-store): `build.providerCalls` 23 == `observed.calls` 23, and the proposed Flow's four steps were exactly the four nodes that succeeded while exploring, replayed with no model attached. Two things that run did **not** show: a correct answer — the replayed extraction returned 0 records against 16 expected — and a Flow that replays untouched, since `run-muddtosq-b92a4d5c` needed a paid repair mid-replay. Core's `service.ts` re-measured at 4,637 lines, so the zero-headroom constraint this plan was partitioned around no longer holds.
- Outcome: Partial
- Follow-up: wave two went out the same day as four Core-paired tasks — t081 continued (the Flow-step gate and its grammar, now satisfiable), t087 (A2, A9, A10, A11's Core half, B8, B0's line), t088 (A7, whose dry run is the direct answer to the 0-of-16 extraction that shipped inside a proposal), t089 (D0a, A12, D1 to D3, which is what will finally give the ladder something to absorb). Workstream C stays held behind A7.

---

### 2026-09-22 — The Flow-step permission gate landed, and does not yet bite
- Agent: supervisor; worker `fa-flow-permission-gate`
- Changed: t081 merged in both repositories (downstream `d3be870`, Core `a968ccd`), both pushed. A Flow's own steps now meet the permission check its exploration does, an undeclared press cannot be authored, and the model is finally told the declaration key exists.
- Why: a plan whose second step pressed "Schedule post" built under an empty grant with nobody asked (`run-mud4ywy4-45c2002f`). The carrier the refusal needed had landed inside t082, so the task that was unsatisfiable this morning became landable.
- Validation: the supervisor re-ran the proof rather than trusting the report. Downstream `pnpm check` exit 0; `domain` `# pass 744 / # fail 0`; `apps/extension` `# pass 731 / # fail 0`; Core `harness-options` plus `flow-bootstrap/plan` 608 tests passed. Both `task finish` runs reported `"command":"pnpm check","passed":true`. Four live DeepSeek builds, 33 provider calls, $0.154.
- Outcome: Done, with a finding that outranks it
- Follow-up: **the gate was never asked anything in four live builds** — every press declared that it causes nothing lasting, including the press that schedules a public post, so two Flows containing presses built and replayed with no request raised. Three causes, three owners, all relayed: the prompt in `node-tools/run-node.ts` demonstrates the empty answer three times and never shows a press that must declare (t088); a declared class today dead-ends in a refusal while `none` costs nothing, and the conversation ask that would let the request park already exists with nothing outside `conversations/` calling it (t087, as A11); and the Lab records `perCallRecords: "not recorded"`, so the declarations had to be deduced rather than read (t089). A13 below adds the independent cross-check. Until those land, the step table must not describe this gate as a defence.


---

### 2026-09-22 — A7 landed: a build must replay its draft before it may propose
- Agent: supervisor; worker `fa-draft-dry-run`
- Changed: t088 merged in both repositories (downstream `674aeb5`, Core `65dee11`), both pushed. A build now replays its accrued draft from a reset page with no model attached, and a proposal is refused until that replay comes back clean; the refusal reaches the model as an ordinary issue it can answer.
- Why: after t082 a Flow is assembled from steps that each worked once, in sequence, on a page the steps before it had already carried there. That is not the same claim as the Flow working, and the gap was measured twice — a proposal whose extraction returned 0 of 16 records on replay, and one that needed a paid repair mid-replay.
- Validation: live `run-muditxzh-a7ae883d` (everything-store, real DeepSeek) — the dry run ran twice, **attempt one refused the proposal, the model amended and asked again, attempt two passed**; `build.providerCalls` 16 == `observed.calls` 16, so the replay itself spent **zero** calls; 7,262 ms and 7,108 ms for a reset plus five steps, about 1.2 s per act and 14% of a 105 s build. The supervisor re-ran everything after merging `dev`: domain `# pass 752 / # fail 0`, extension `# pass 731 / # fail 0`, Core `flow-draft` plus `llm` 2,736 passed, and both `task finish` runs reported `"command":"pnpm check","passed":true`. Seven domain failures seen before the rebuild were a stale Core `dist` in that worktree, not an integration defect.
- Outcome: Done
- Follow-up: the hard refusal is proved by unit test only — no live run has yet produced a `failed` or `changed` step, so the soft `unreproducible` path is what was exercised live. The plan's open question is answered: **the reset is the page**, because workspace and browser-context resets are unreachable through a gateway that only runs page actions, and a step the site itself remembers cannot be put back; that soft edge closes properly only with C1. Two Lab caps now fail correct work and are relayed to t089 — the created-adaptation audit caps tool calls at 16, and the instruction-authority derivation spends about four provider calls the grant never sees, which also corrupts any per-condition call count.


---

### 2026-09-22 — A blocked action now asks the person, and the ladder is finally shown to absorb
- Agent: supervisor; workers `fa-service-seams`, `fa-adversarial-measurement`
- Changed: t087 and t089 merged in both repositories (downstream `58286ad`, Core `494fef9`), both pushed. A2, A10, A11's Core half, A12, B0's missing line, B8, D0a and D1 to D3 are done; A9 was dropped as already satisfied — `core.run_node` reaches 18 runnable nodes, two of them waits, so a Core wait option would have been a second path to one capability. Core's `service.ts` went **down** to 4,614 lines while gaining this.
- Why: FluxIQ's standing rule is that a blocked action escalates to the person rather than failing, and it was unimplementable while the gate's request and the conversation ask that answers it sat one call apart with nothing between them. Separately, the recovery ladder had never been shown to recover anything, because every variant in the corpus was built to prove model repair.
- Validation: **the supervisor re-ran the adversarial lane itself: 6/6 conditions absorbed as declared, 0 provider calls** — `renamed-submit` absorbed by `host_target_resolution`, `late-recoverable` by `retry_node` on its second attempt, `rows-per-visit` and `too-slow` over three attempts each. Domain `# pass 752 / # fail 0` on both branches; extension `# pass 731 / # fail 0`; Core service plus flow-bootstrap 363 passed with one timeout that passes alone in 4.5 s; all four `task finish` runs reported `"command":"pnpm check","passed":true`. A first lane run returned 0/6 because the machine's `FLUXIQ_TEST_TARGET=existing` leaked in; `FLUXIQ_TEST_ENV_FILES=none` is required and the lane does exit non-zero on disagreement.
- Outcome: Done
- Follow-up: t089 found the Lab had been reading **every absorbed run as a failure**, since Core keeps the first failure record beside a succeeded status — the measurement would have reported the exact opposite of the truth — and that the host target resolution was read one nesting level too shallow, so it was `null` in every real run while its unit tests passed. Three of the four rungs still have no input written and have never fired. A11's ask has never fired live, because the model still declares that nothing it authors is consequential. t090 (workstream C) and t091 (the permission loop's remaining holes) went out on the back of this.


---

### 2026-09-23 — The instruction path becomes the only work, and three things were stopping it being measured
- Agent: supervisor; workers `fa-draft-routing`, `fa-permission-loop-holes`, `fa-extraction-answer`
- Changed: t090 (branches, loops and a Flow's own recovery edge), t091 (a declaration carried through the gate, cross-checked against the instruction, and a repair that asks instead of throwing) and t092 (the two extraction defects) all merged in both repositories and pushed. Plus three Lab fixes that are the reason any number can be trusted: the scenario lab builds its contracts before the fixtures typed by them; a campaign stops after two consecutive runs that never start, quoting the Lab's own refusal; and a creation run declares its own 48-call ceiling.
- Why: the user set the scope — only instruction-driven Flow creation, measured only on the ten campaign sites, nothing else until it works. Re-measuring those ten sites was therefore the first job, and it could not be done: the first attempt refused all 55 runs against a Core build 1,995 minutes behind its source and still printed a totals line; the second failed six of six as `performance.budget` because a creation run inherited a 26-call default shaped for a loop that no longer exists, after the model had already done the work. $0.90 bought nothing.
- Validation: t092's defect measured model-free — the same request read 20 records on a settled page, **0** on a fresh one, 15 a second and a half later; after the fix, 15 at once on a fresh page, and detection offers the instruction's four columns at full coverage where it offered five junk ones. Before landing, the supervisor re-ran domain `# pass 752 / # fail 0` and extension `# pass 731 / # fail 0` for each task, and every `task finish` reported `"command":"pnpm check","passed":true`. `run-mudpkd77-e780792e` is the run whose own error names the call ceiling.
- Outcome: Partial — the fixes are in, the number is not yet taken
- Follow-up: the ten-site campaign is running against a tree carrying all of it. The remaining named product defect is that the model can choose a list's **columns** but not its **items**, so four sponsored cards join sixteen results and positional matching fails; that is t093, holding its live runs until the campaign ends, because two live runs on this machine corrupt each other — which is what produced t092's own `performance.budget` stall.


---

### 2026-09-23 — Why a built Flow gives the wrong answer, diagnosed from two runs
- Agent: supervisor; workers `fa-extraction-answer`, `fa-extraction-items`, `fa-campaign-can-measure`
- Changed: t092 (a read waits for the page it was sent to; field inference can name a nested value; detection waits before saying a page has no list), t093 (a Flow can say which **items** belong in its list, not only which columns), t094 (a campaign can measure today's loop: it answers a permission ask where the instruction is the authority, and no longer fails a build whose recovery record Core never wrote) — all merged in both repositories and pushed.
- Why: the user narrowed everything to instruction-driven Flow creation on the ten sites, then stopped a wide campaign and said to debug the single failing case instead. That was right, and the answer was already on disk.
- Validation: **the Flows are not the problem.** `run-mudwci8d-de88aa32` replayed a nine-node Flow with no model attached, branched correctly around a banner that is not always there, and extracted twelve records carrying all four requested columns — and matched **zero**, because every row read `rating` as `"3.7 out of 5 stars"` where `"3.7"` was expected. Seven of the twelve differ on nothing else. It also returned 12 rows against 16 expected: the store lazy-loads the tail and the read did not wait for it. `run-mudw1ktb-0557816b` returned **24 rows against 13 expected**, eleven of them `observed-not-expected` — the instruction's filter (Plus eligible, 4.0+, under $50, no sponsored) was not applied at all, although t093 landed the mechanism for it; its own report had flagged that nothing verified the model *uses* it.
- Outcome: Partial — diagnosed, not fixed
- Follow-up: two tasks were briefed and then stopped unstarted, so they are free to pick up. One: prefer the page's own tightest statement of a value (an attribute, a microdata property, a child holding the value alone) over the sentence containing it — **no word list and no suffix stripping**, which `domain/src/actions/extraction/request.ts` explains. Two: wait for a lazily loaded list to be *complete*, not merely present, and find out why the model does not write a `where`. Both must be proved model-free in the content harness, and the fixtures must not be edited to match the code.
- Standing rule, from the user: **never launch a mass or campaign-scale run without asking first**, state its cost and duration beforehand, and debug the single failing case from artifacts already on disk before measuring the many.


---


## Wave one's worker findings, as first recorded

### From wave one's workers (2026-09-22)

1. **A created Flow's steps are never put to the permission gate. Verified, and
   now measured.** `WebPlanNodeResolutionInput`
   (`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:103`)
   carries exactly `projectId`, `flowId`, `nodeDefinitionId` and `parameters`,
   and the whole file contains **zero** occurrences of "permission" or
   "consequence"; its outcomes are `unchanged`, `resolved` and `refused`, with no
   needs-permission state to reach. Core hands the domain a per-node check
   (`plan-parameter-resolution.ts:72,119-125`) the domain never declares or
   calls, and the Flow script grammar gives the model nowhere to state a step's
   consequences. `fa-domain-tools` measured the consequence live: a nine-node
   Flow that fills and submits a composer was authored and replayed **under an
   empty grant** with `permissionRequest: null` and `instructedConsequences: []`.
   This is the week2 plan's P3, promoted from a code reading to a measurement.
   **It must close before anything is pointed at a real site**, and it is larger
   than step A11 as briefed: it needs the grammar, the gate wiring, and a
   non-terminal throw.
2. **Better refusal detail cannot pay off until the repeat rule changes.
   Verified.** The repeat key is
   `canonicalJson([mutationEpoch, decision.toolId, decision.input])`
   (`runtime/llm/evidence-loop.ts:546`) and `mutationEpoch` advances only when a
   mutation is **applied** (`:585`). A refused press applies none, so a model
   that reacts to a refusal by looking again — exactly what a good refusal
   advises — repeats a signature, is answered `already_answered`, increments
   `stepsWithoutProgress`, and ends in `evidence_repeat_without_progress`, a top
   cause in round 1. `fa-domain-tools` built the detail and measured two of three
   live builds still dying this way. Relayed to `fa-build-draft`, which owns that
   file, with the caveat that a genuine no-op repeat must still count as no
   progress. **A8 and the A stream are one change, not two.**
3. **Two corrections to the plan's own findings.** d6's claim that
   `snapshots/repair-lane.json` is read by nobody is stale — the bundle reads it
   and `replayProviderCalls` is live. And D0a's node id needs **no Core work**:
   Core already sends `attempt.nodeId` (`persisted-flow-run.ts:571,601,697`) and
   the Lab drops it in `flowActionsSnapshot` (`run-flow-lane.ts:428-436`), which
   the supervisor confirmed. Only the browser's
   `WebAutomationTargetResolution.strategy`, stuck in Core's `attempt.outputs`,
   still needs a Core change.
