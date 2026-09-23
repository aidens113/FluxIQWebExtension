# fa-draft-routing — the draft can say when a step runs (task t090)

Worktrees `F:\fxwork\t090\!FluxIQ` and `F:\fxwork\t090\!FluxIQWebExtension`, both
on `task/t090-draft-routing`. No commit was made.

## Outcome

**Done for C1 and C3; C2 is built and unit-proved but has no live run.**

A draft step can now say when it runs, in four words the model writes on an
`amend_draft` decision, and Core derives the nodes, ports and edges that make it
true. The model states a relation between steps and never a graph.

| Word | What it says | Step |
| --- | --- | --- |
| `optional` | The Flow carries on when this step fails. | C1 |
| `only_if` | Run this only when the step before it succeeded. | C1 |
| `on_failed` | When this fails, run that step instead, then carry on. | C3 |
| `repeat` | Do this span once per row a step produced, or while a check holds. | C2 |

**Proved live**, run **`run-mudn1wfg-10007c72`** (everything-store,
`everything-store-first-page-plus-earbuds`, real DeepSeek from `.env.local`):

- `build.outcome: "proposed"`, `adaptation.bootstrap.4671b2a3-…`, 23 provider
  calls, $0.1226.
- **`build.providerCalls` 23 == `observed.calls` 23**, so the dry run that
  cleared the proposal still cost nothing.
- **The persisted Flow contains two branches.** Its graph
  (`…flows/flow.12a9cf7d-….bootstrap.b9adb2af89a1984a.main.graph/source/…`) has
  **seven nodes, two of them `builtin.control.merge`**, and these edges:

  ```
  s1 web.output.dom-click  ("Not now")           failed  -> s2 merge  in
  s1 web.output.dom-click                        success -> s2 merge  branches
  s2 merge                                       success -> s3 dom-type
  s3 -> s4 -> s5                                                (plain)
  s5 web.output.dom-click  ("Continue shopping") failed  -> s6 merge  in
  s5 web.output.dom-click                        success -> s6 merge  branches
  s6 merge                                       success -> s7 dom-extract_list
  ```

  The model marked **both interstitial dismissals `optional`** — the notification
  prompt and the soft-check — which are exactly the two controls that are not
  there on every visit. That Flow no longer fails on a page that shows neither.

**This closes t088's soft edge in the way t088 said it would.** Its replay
reported `unreproducible` for a dismissal the site remembers, asked the model
once, and accepted a reassertion unchecked. The dry run's refusal now names the
honest alternative, the model took it, and a step the Flow does not always run
no longer blocks a proposal at all.

## The plan's assessment was half right, and the half it got wrong is worth saying

The plan says workstream C is "smaller than it first looks, because the model
already authors routing and Subflows in a Flow script … only the accruing draft
needs to express them."

**The first clause is true and load-bearing.** `authoring/assemble.ts` already
derives edges from labels and `on <port>: go to <label>` branches, and I reused
it whole: the draft path writes a script in the shape that assembler already
reads, so keys, ports, edges, the router and every parameter still come from one
piece of code. Nothing here is a second assembler.

**The second clause understates it, in one specific way.** A Flow script's
routing is *router-level*: a block's `when:` line picks one Subflow before any
step runs. That is not a mid-Flow branch, and "dismiss this only if it is there"
is a mid-Flow branch. So the routing the model could already author was never
the routing C1 asks for, and reusing it needed three things the plan does not
mention:

1. **A join node.** A Flow node takes one way in
   (`bootstrap.target_port_cardinality`), so two paths cannot meet at a web
   node. `builtin.control.merge` declares `branches` as a port several edges may
   arrive at and is the only thing in the library that does. Every shape here is
   a diamond that rejoins at one.
2. **A relaxation of `bootstrap.cyclic_graph`.** A repeating span is a cycle and
   plan validation refused every cycle, so C2 was unrepresentable, not merely
   unexpressed. See below.
3. **Two fields on a derived script step** that a model never writes: which
   input port a branch arrives at, and "this step wrote all its own edges".

None of this is large — the whole change is ~700 lines across Core and nothing
downstream — but "only the draft needs to express them" would have led someone
to look for a grammar and find the graph underneath unfinished.

## What changed and why

### Core (`F:\fxwork\t090\!FluxIQ`) — all of it

**New — `runtime/flow-draft/routing.ts`.** What a step may say, and the two
things it has to survive. Statements name other steps **by id, never by
position**, because a position is renumbered the moment a step is reordered;
`automationStudioFlowDraftConditionalStepIds` answers which steps a Flow would
not always run, which is what the dry run reads.

**`runtime/flow-draft/step.ts`.** A step gains `id` — its own name, given when
it was appended and never changed — and `routing`.

**`runtime/flow-draft/amendment.ts`.** Four new changes, and the defaults that
make the commonest statement one word: a check is the step before, a span is
this step alone, a list is the step before. `to` is reused for `on_failed`
rather than a second key meaning "the other step". `keep` now also clears a
statement, so "put it back the way it was" means the whole step.

**`runtime/flow-draft/dry-run.ts`.** A verdict takes the conditional step ids and
a step in that set never blocks. An outcome carries `stepId` so the verdict can
be read against what the draft says. The refusal's instruction now names
`optional` and `only_if` as the answer to a step that is not always there —
**this sentence is what the live model acted on.**

**New — `runtime/flow-bootstrap/authoring/draft-routing.ts`.** The derivation.
Three diamonds and two loops, every node and port read off the definitions.

**`runtime/flow-bootstrap/authoring/assemble.ts`.** Honours a branch's target
port and a `routed` step, and skips `flow_script.branch_to_next_step` for both —
the guard exists to catch a step whose fall-through would strand the run, and
neither case can strand anything.

**`runtime/flow-bootstrap/plan/validation.ts`.** The acyclicity check asks twice:
once as the graph stands, and, if that finds a cycle, again with the join edges
removed. **A cycle that survives the second ask does not pass through a join**,
which means nothing in it was written to be arrived at twice, and it is still
refused. Depth is measured on the acyclic reading.

**`runtime/llm/evidence-loop.ts`** assigns each step its id;
**`evidence-loop-decision.ts`** reads the new fields;
**`node-tools/replay-draft.ts`** hands the conditional set to the verdict.

### Downstream (`F:\fxwork\t090\!FluxIQWebExtension`)

**Nothing.** `git status` is clean. The brief gave me
`domain/src/runtime/llm-evidence/node-run/**` and I did not need it: the domain
already reports every step's outcome in Core's closed vocabulary, and which
outcomes *block* is Core's judgement. A domain change here would have been the
domain learning what a conditional step is, which is the split t082 deleted.

## Three decisions worth arguing with

**1. The grammar is not in the draft entry, deliberately.** I first added a
sentence explaining the four words to the draft entry's instruction, and it
broke `entry.test.ts` by pushing a 900-byte entry past its budget — which is the
file's own warning, written about `replayed`: a sentence there is paid for on
every request by every build, including the ones whose Flow is a straight line.
The grammar lives in the amendment schema, which every decision that may amend
already carries, and the *prompt* to use it lives in the dry-run refusal, which
is where the model is actually looking at the step that needs it. The live run
says this works: the model reached for `optional` without the entry ever naming
it.

**2. `repeat` reads its own kind off the node, and does not ask.** A step whose
definition declares an array output produced rows, so the span runs once for
each; a step that declares none is a check, so the span runs while it keeps
succeeding. Asking the model which it meant would be asking a question its own
draft answers, and the two loops are wired quite differently — a list is read
once *outside* the loop, a check is lifted *inside* it so it is asked again on
every pass.

**3. A misjoined shape is refused, never guessed.** A guard that is not the step
before the one it guards, a recovery into a step already behind us, a
non-contiguous span, a loop inside a loop: each is refused with the amendment
that fixes it. A wrong edge is a Flow that does the wrong thing quietly, and the
model can afford a sentence.

## Commands run and observed results

### Live, against the real DeepSeek in `.env.local`

Lab instance `t090`, `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`,
`DEEPSEEK_API_KEY` from the process environment. No web panel was started or
managed. Command as `pnpm lab:campaign … --dry-run` prints it, plus
`--llm-max-calls 40`.

| # | run id | observed |
| --- | --- | --- |
| 1 | `run-mudmqhbl-ae594c2a` | Built a Flow; **the Lab refused to read it** — `metadata.phase9 created evidence audit exceeded its bounded contract`. See open question 1. |
| 2 | `run-mudmvp5s-c306ef63` | Same, again. |
| **3** | **`run-mudn1wfg-10007c72`** | **The proof.** `--target persistent-isolated --workspace t090`, so the created Flow survives on disk. `build.outcome: "proposed"`, 23 == 23 calls, $0.1226, **two `builtin.control.merge` nodes and two `optional` diamonds in the persisted graph**. Ended on the Lab's wait for Core's post-run recovery, as t082 and t088 both did. |
| 4 | `run-mudno3yu-4543e76f` | The regression check after the parser fix below. Built a Flow again (the Lab's audit read a record with more than 16 tool calls, so it refused it), which confirms the fixed build still runs live. Its graph was not persisted, so it shows nothing about routing. |

**A defect found between runs 3 and 4, by unit test rather than live.** The
amendment parser's exact-key check still listed only the old five keys, so
`check`, `through` and `over` were silently dropped and **`only_if` and `repeat`
were unreachable in run 3** — which is why run 3 could only use `optional` and
`on_failed`. Fixed in `evidence-loop-decision.ts` and pinned by a test that
parses all four words.

### Checks

| Command | Where | Observed |
| --- | --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | Core | clean |
| `npx vitest run …/flow-draft …/llm …/flow-bootstrap --exclude "**/.tmp/**"` | Core | **62 files, 684 tests, 684 passed** |
| `npx vitest run …/automation-studio/runtime --exclude "**/.tmp/**"` | Core | 2,123 passed, **1 failed**, 1 skipped — `service-adaptation/tests/subflow.test.ts`, a 15s timeout with `EBUSY … global.sqlite`, the environmental family t088 recorded. Re-run alone: **5/5 passed in 12.1s**. |
| `pnpm check` | Core | **exit 0**; `structure-audit: passed (177 warning(s), 360 baselined)` |
| `wc -l runtime/service.ts` | Core | **4,637 — unchanged, and not edited** |
| `npx tsc -p domain/tsconfig.json --noEmit`, `-p domain/tsconfig.test.json` | downstream | clean |
| `DOMAIN_TEST_BUILD_LABEL=t090 node domain/scripts/test-domain.mjs` | downstream | **# tests 752 / # pass 752 / # fail 0** |
| `pnpm --filter @fluxiq-web-extension/extension test` | downstream | **# tests 731 / # pass 731 / # fail 0** (t088's 2 failures are gone) |
| `pnpm check` | downstream | **exit 0**; `structure-audit: passed (94 warning(s), 122 baselined)` |

**New tests, 20 in all.** `flow-bootstrap/authoring/tests/draft-routing.test.ts`
(10) asserts the **graph** each word derives — which node, which port each edge
leaves and arrives at — never a field copied back out of the statement; one case
runs the assembled plan through `runAutomationStudioGraph` with the first
dispatch refused and reads what the run did (`["dismiss", "search"]`, routes
`failed, success, success`, run **succeeded**); one puts a loop plan through
`validateAutomationStudioFlowBootstrapPlan`, cycle and all.
`flow-draft/tests/routing.test.ts` (9) covers the defaults, id stability across a
reorder, `keep` clearing a statement, and the dry run's conditional set.
`llm/tests/evidence-loop.test.ts` gained 3.

**One new structure-audit warning**, advisory: `flow-bootstrap/authoring/` is now
16 source files against a 15-file threshold. Both `assemble.ts` (441) and
`validation.ts` (452) were already past the 400-line advisory before this task.

## Not verified

- **No live run used `only_if`, `on_failed` or `repeat`.** Run 3 used `optional`
  twice; the other three words were unreachable in it because of the parser
  defect above, and no run after the fix produced a readable record. They are
  proved by unit test, by the plan validator, and — for the `optional` diamond
  only — by an actual graph run. **The loop has never been executed by the
  runtime**, only assembled and validated.
- **That the merge nodes execute inside the *web* runtime.** The executor-backed
  test runs them under Core's own dispatcher. Run 3's Flow did run, needed two
  repair calls, and ended on the Lab's recovery wait; its runtime event chunks
  were not readable from the persisted store, so **which nodes the live Flow
  actually stepped through is inferred, not observed**. This is the gap I would
  close first.
- **That the Flow produces the right answer.** Run 3's extraction maps `url` to
  an `img@src`, which is almost certainly wrong. That is t082's open question,
  untouched here; the routing is what this task claims.
- **A `repeat` over a genuinely paginated list.** The obvious scenario is
  `everything-store-plus-earbuds-under-50`, which walks every page. I did not run
  it: each live build is about $0.12 and four to twelve minutes, and the Lab's
  audit refused three of my four runs outright.
- **A back edge that is not a loop.** The relaxed acyclicity check admits any
  cycle closing through a `multiple` input port. Only `builtin.control.merge`
  declares one today, and the derivation only ever emits that shape, but nothing
  stops a future node from declaring one and a plan from cycling through it.
- **No browser-level validation beyond the Lab's own Chromium runs.**

## Open questions or contradictions found

1. **The Lab's created-adaptation audit is now the main obstacle to measuring
   anything.** `packages/test-runner/src/existing-fluxiq-control.ts:498` refuses
   a record with `toolCallCount > 16`. **Three of my four live runs died there
   with a Flow already built**, and the one that survived did so by luck. This is
   t082's open question 3 and t088's open question 1, unmoved, and t089 owns the
   file. The same block already caps `providerCallCount` at Core's backstop with
   a comment saying creation iterates for as many calls as it needs; the tool-call
   cap is the same mistake one line down. **It should move or become a warning.**
   Until it does, the only way to read a build is to run with
   `--target persistent-isolated` and read the Flow graph off disk, which is what
   I did.
2. **A build's record is worth reading even when the Lab refuses it.** The Flow
   graph is written to
   `test-runs/instances/<lab>/persistent-isolated/<ws>/fluxiq-root/.fluxiq/artifacts/automation-studio/projects/<id>/flows/…`
   as readable TypeScript. Nothing in the Lab points at it. It is the cheapest
   evidence there is for "what did the model actually build", and a measured lane
   (D3) should probably capture it.
3. **`maxGraphDepth` is 16 and a diamond costs one.** A Flow of twelve steps with
   three conditionals is at depth 15. `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_LIMITS.maxNodesPerSubflow`
   is also 16, and each diamond adds one node, each loop three. Nothing hit it in
   these runs, but the first genuinely long Flow with routing will, and the
   refusal (`bootstrap.graph_too_deep`) will not mention routing at all.
4. **For t091, at merge.** I did not touch `runtime/service.ts`,
   `runtime/action-permissions/**`, `flow-bootstrap/action-permissions.ts`,
   `runtime/recovery/**` or `harness-options/plan-parameter-resolution.ts`, and I
   need nothing in them. One thing worth your attention: a derived `merge` or
   `for-each` node carries **no `consequences`** — it is Core's own control-flow
   node, it dispatches nothing, and it is not the model's declaration. If your
   build-time assertion is "every node carries a declaration" rather than "every
   *acting* node does", it will refuse every Flow that branches.
5. **The dry run replays a branching draft as a straight line.** It runs every
   proposed step once, in order, which is right for proving the steps still work
   and is *not* a proof that the branch routes correctly — a guard that fails
   during the replay is now simply not held against the draft. Proving the branch
   would mean replaying the assembled graph rather than the step list, which is a
   different and more expensive gate. Worth stating plainly because the dry run
   now passes drafts it would previously have refused.
