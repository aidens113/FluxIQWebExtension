# fa-explore-with-output-nodes — the model runs the library's own nodes (task t082)

Worktrees `F:\fxwork\t082\!FluxIQ` and `F:\fxwork\t082\!FluxIQWebExtension`, both
on `task/t082-explore-with-output-nodes`. No commit was made.

## Outcome

**Done.** The two vocabularies are gone. A build is now offered the node
registry itself, runs whichever node it names against the live page through the
same gateway command the finished Flow dispatches, and the Flow it proposes is
assembled from the steps that ran and worked — there is nothing left for the
model to write down at the end.

**Proved live**, run **`run-mudavyub-d34e3c9b`** (everything-store,
`everything-store-first-page-plus-earbuds`, real DeepSeek from `.env.local`):

- `build.providerCalls` **23** == `observed.calls` **23**, $0.0999. Nothing was
  spent during playback.
- `build.outcome: "proposed"`, `adaptation.bootstrap.f7edf24a-…`,
  `flowCreated: true`.
- The proposed Flow's four steps are **exactly the four nodes that succeeded
  while exploring**, in the order they ran: `web.dom.click` (the consent
  banner), `web.dom.type` (the search term), `web.dom.click` (search),
  `web.dom.extract_list`. The Lab replayed all four with no model attached.
- The loop used `amend_draft` for real editing: `draft_rerun` and
  `draft_amended` both appear in the decision trail.

What that run did **not** show is a correct answer: the replayed extraction
returned `observedRecords: 0` against `expectedRecords: 16`. The authoring
mechanism is proved; the extraction the model wrote is not. See *Not verified*.

## The two corrections to the brief, and how each was answered

**The catalog is the dynamic library, not eighteen web nodes.** Core builds one
option, `core.run_node`, whose `node` argument enumerates
`registry.list(resolution)` — Core's built-ins, the domain's importer nodes and
anything a host registered afterwards. **59 nodes** in this configuration (41
Core built-ins + 18 web outputs), measured. Nothing enumerates a list by hand,
and a node registered later appears with no edit here.

On the coordinator's three questions about that library:

1. **`nodes/registry.ts` `getAutomationNodeDefinitions` is not the library.** It
   is a legacy built-ins-only accessor. The library Flow Bootstrap actually uses
   is `AutomationStudioNodeRegistry` (`nodes/canonical-registry.ts`), which has
   `register`, `registerImporterManifest` and `bindParameterContract`, and is
   taken from `this.nativeNodeRuntime.sdk.nodes`. It does accept domain and
   custom nodes: the 18 web outputs reach it through
   `createWebAutomationOutputNodeManifest()`. So the finding is narrower than
   feared — but the legacy accessor is still exported and still reads like the
   library, which is a trap worth closing.
2. **Truncation no longer decides what can be run.** The run-node argument
   enumerates every available node id, not the byte-bounded `nodeCatalog`, so a
   node that falls off the descriptive catalog is still runnable. Truncation now
   governs only how much prose accompanies a node.
3. **Truncation was severe and is much reduced.** `service.ts` passed
   `maxCatalogEntries: 12` for evidence-guided builds (12 of 59 described) and
   `maxInputTokens: 5_000` for the per-decision catalog. Both were line-neutral
   edits: **64** entries and **16,000** tokens. The grant allows 48,000 input
   tokens per request and the live builds spent about 7,000, so this is
   affordable. I did not measure the post-change `catalogTruncated` flag
   directly — see *Not verified*.

**A step's consequences must reach the permission gate (t081).** Implemented, as
the reserved step word t081 specified, and the design turned out cleaner than
t081 assumed:

- `authoring/consequences.ts` (new) owns the reserved word and its bounds;
  `plan/contracts.ts` gains `consequences?: string[]`; `plan/parsing.ts` bounds
  it; `authoring/assemble.ts` and `authoring/normalise.ts` read it exactly as
  `OUTPUT_ACTION_WORDS` is read; `authoring/json-plan.ts` carries it for the
  nested shape. Core's reader (`plan-step-consequences.ts`, t081's) needs no
  change once these land.
- **Under this design the model never writes that line.** `consequences` is a
  required argument of every `core.run_node` call, so the declaration is made at
  the moment the node runs, is asked of Core's gate *then*
  (`webActionPermission`), and is written onto the plan node by
  `node-tools/draft-step.ts` when the draft is assembled. Proved: my probe of
  the draft→plan path emits `consequences: []` on every node, and live run
  `run-mudai02x-72e4ebe4` ended `flow_bootstrap.permission_required
  (permission.required: create_new)` because the model declared `create_new` for
  a press the instruction did not ask for and no grant held.
- **A node that acts and declares nothing is refused**, not waved through:
  `invalid_input` / `missing_input_keys` naming all three keys. A node that only
  reads may omit it.
- **For t081 to reconcile**: the build-time gate call inside
  `resolve-plan-node.ts` fires on the `resolved` path. A draft-built Flow's
  parameters are already real, so resolution answers `unchanged` and that call
  does not fire. The declaration still reaches Core on `node.consequences`, so
  t081's reader works; what t081 must decide is whether its domain-side
  `step-permission.ts` should also run on the `unchanged` path, or whether the
  exploration-time gate (which did fire, live) is the authority. I recommend the
  latter and a build-time assertion that every acting node carries a
  declaration.

## What changed and why

### Core (`F:\fxwork\t082\!FluxIQ`)

**New — `runtime/llm/node-tools/`.** `run-node.ts` builds the one verb, from
`nodeIds` the caller reads off the registry; `draft-step.ts` writes a run-node
step down as a Flow step, generically, because the call's shape is Core's own.

**`runtime/llm/harness-options/binding.ts`.** A domain declares `runsNodes` and
is offered the library beside its own tools; `automationStudioHarnessOptionRegistry`
takes `nodeIds`. The option is domain-scoped because the domain executes it.

**`runtime/llm/evidence-loop.ts`** (split; see below).
- `AutomationStudioLlmEvidenceTool` gains **`perCallEffect`**: one tool that runs
  whichever of a library's things the call names cannot declare an effect up
  front. Repeats key on the looser epoch, and such a tool may carry the free
  first look although it is declared `mutate`, because the *caller* writes that
  call's argument.
- The execution result gains **`draft`**: what this call did — `actionId`,
  `input`, `ranWith`, `effect`, `proposes` — carried opaquely onto the draft.
- **The three-strike no-progress rule is gone.** The default is now
  `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_STEPS_WITHOUT_PROGRESS = 24`
  (`runtime/loop-limits/evidence-loop.ts`), and Flow Bootstrap's
  `maxConsecutiveUnusableDecisions` uses it. **I chose 24** because a model
  correcting one mistake at a time needs far more than three, and what actually
  bounds a build — its cost, its tokens and its deadline — is already handed to
  the loop as its `budget`; 24 cannot fire during ordinary work and still stops
  a loop that has started repeating itself. `runtime/recovery/` now passes its
  own streak of three explicitly, so its behaviour is unchanged.
- `checkCompletion` is handed the draft.
- `amend_draft` gains **`reorder`** (move a step, renumbering) and **`rerun`**
  (run this step's action again with a corrected argument; the old step is
  dropped and the call goes through the ordinary tool-call path). A rerun is
  never answered from the repeat cache — live, seven decisions were spent asking
  for one and getting `already_answered` (`run-mud9rpmz-16de647b`).
- The draft amendment allowance rose from 4 to 16: editing the draft *is* the
  authoring now.

**`runtime/flow-draft/`.** A step gains `toolId`, `ranWith` and `proposes`.
Three predicates, held apart because they answer different questions:
`IsAction` (of the kind a result is made of — what the draft *lists*, so a
failed step stays on the list with `inResult: false`), `IsProposable` (that, and
it worked), `IsProposed` (that, and the model kept it).

**`runtime/flow-bootstrap/`.** `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_DRAFT_COMPLETION_SCHEMA`
asks for a summary and nothing else. `bootstrap-completion.ts` builds the plan
from the draft **when the draft has proposed steps Core can write** — that is,
steps taken through the library verb — and otherwise reads the reply's own plan,
because a host whose actions are not nodes of the registry must still be able to
build a Flow.

**`runtime/service.ts` — line-neutral, still 6,275 lines.** Five one-line edits:
the draft completion schema; `nodeIds` into the option registry; `context.steps`
into the completion check; the catalog entry and token allowances; and
`"amend_draft"` added to the evidence-trace validator's allowed decisions — t077
added the decision kind and this validator rejected it, so **the first build that
ever reached persistence died there** (`run-mudapml9-ca41b1a6`).

**`runtime/llm/deepseek-provider.ts` and `harness-options/option.ts`** admit
`perCallEffect` in their preflight allowlists. The provider's list is the one
that refuses the whole request over an unknown tool key.

**Split for the 800-line limit**: `runtime/llm/loop-configuration.ts` now holds
`AutomationStudioLlmEvidenceLoopInput` and `resolveLimits`, re-exported from
`evidence-loop.ts` so the public surface is unchanged (914 → 697 lines).

### Downstream (`F:\fxwork\t082\!FluxIQWebExtension`)

**New — `domain/src/runtime/llm-evidence/node-run/`.** `catalog.ts` derives what
this domain can run from its own node definitions (`outputAction.fixedOutputId`
plus `actions/safety.ts`), built lazily so a module-evaluation cycle cannot leave
it empty. `run.ts` resolves the call's handles through
`resolveWebPlanNodeParameters` — the same resolver the built Flow's parameters go
through — asks Core's gate, dispatches `gateway.executeAction`, and returns the
page with what the node did written on the same packet. `read-result.ts` bounds
what a reading node read. `denied-keys.ts` (new, beside them) owns the denied-key
declaration once, because what a read read has to be held to it too.

**`tools.ts`.** Four of the five tools are gone. Detection stays, because an
extraction node cannot be written without the handle it issues and finding a
list is an observation rather than a step. The runtime declares `runsNodes` with
`web.output.dom-capture_snapshot` as the free first look.

**Three behaviours deliberately dropped**, each with its reason in the source:
the checkbox is no longer un-ticked (the press *is* the Flow's step now); a press
that leaves the page looking the same is reported as `pageChanged: false` rather
than refused `no_progress`; and navigating to the address already shown runs,
because the Flow replays from wherever the run starts.

**The two arguments.** `input` is what the model wrote, held to the denied-key
declaration, and is the only one it is ever shown back. `ranWith` is what the
node ran with and is what the Flow keeps. They must differ: a handle names a
control on a page as it was, and a page that re-renders stops having it — live, a
build ran four nodes successfully and had its Flow refused `web.handle.unknown`
when the draft was assembled (`run-mud9rpmz-16de647b`). The one exception is an
extraction's `extractList`, kept as the handle, because the resolver refuses a
literal request outright once a list has been detected — which refused a build 23
times for a fault in what Core had written down (`run-mudakzor-ec549d9d`).

## Commands run and observed results

### Live, against the real DeepSeek in `.env.local`

Isolated Lab instance `t082`, `FLUXIQ_TEST_ENV_FILES=none
FLUXIQ_TEST_TARGET=isolated`. No web panel was started or managed.

| # | run id | observed |
| --- | --- | --- |
| 1–2 | `run-mud963al-…`, `run-mud9audz-…` | `provider_request_failed`, 1 call. The harness-option validator refused `perCallEffect`. |
| 3 | `run-mud9eg4s-30c38c28` | 27 calls, the loop ran. **Every acting call `target_not_found`**: the model wrote the handle bare and the resolver only reads `{handle}`, so a handle went to the page as a literal selector. |
| 4–5 | `run-mud9kycb-…`, `run-mud9p3fa-…` | `provider_request_failed`. Debug instrumentation named it: **a denied key in the draft entry** — the model's own `selector` key, shown back to it, makes Core refuse the whole next request. |
| 6 | `run-mud9rpmz-16de647b` | 33 calls, **4 acting nodes succeeded**, `amend_draft` used 13 times — and seven reruns answered `already_answered`, then the Flow refused `web.handle.unknown`. |
| 7–9 | `run-muda42e1-…`, `run-mudabxqd-266e728d`, `run-mudakzor-ec549d9d` | The extraction shape refused 15 then 23 times; the refusal carried codes and no accepted shape. |
| 10 | `run-mudai02x-72e4ebe4` | 4 acting nodes, then **`flow_bootstrap.permission_required (create_new)`** — the gate working. |
| 11 | `run-mudapml9-ca41b1a6` | **A plan was built and persistence refused it**: `"Flow Bootstrap evidence trace is invalid"`, the `amend_draft` decision kind missing from `service.ts`'s validator. |
| **12** | **`run-mudavyub-d34e3c9b`** | **`flowCreated: true`**, 23 == 23 calls, the four nodes that ran replayed with no model. |
| 13 | `run-muddozj4-257be181` | A Flow was built and **the Lab refused to read the record**: its created-adaptation audit caps `toolCallCount` at 16. See open question 3. |
| **14** | **`run-muddtosq-b92a4d5c`** | **The confirmation after every later change.** `build.outcome: "proposed"`, `adaptation.bootstrap.6e77fb83-…`, **16 == 16** provider calls, $0.0710, 13 tool calls, `failure: null`. The Lab then failed the run on its own wait for Core's replay recovery running out, not on the build. |

### Checks

| Command | Observed |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` (Core) | clean |
| `npx vitest run src/programs/automation-studio/runtime` (Core) | `2008 passed, 1 failed, 1 skipped` — the one failure is `instruction-readiness.test.ts` timing out at 15s under parallel load; it **passes alone in 5.2s**, and I changed nothing it touches |
| `pnpm check` (Core) | **exit 0**; `structure-audit: passed (174 warning(s), 361 baselined)` |
| `wc -l runtime/service.ts` | **6,275 — unchanged** |
| `npx tsc -p domain/tsconfig.json --noEmit`, `-p domain/tsconfig.test.json` | clean |
| `DOMAIN_TEST_BUILD_LABEL=t082 node domain/scripts/test-domain.mjs` | `# tests 736 / # pass 736 / # fail 0` |
| `pnpm check` (downstream) | **exit 0**; `structure-audit: passed (92 warning(s), 122 baselined)` |

**Test migration.** 58 domain tests drove the four retired tools; all are
migrated to `core.run_node` and green, and every deliberate behaviour change
carries a comment saying what changed and why. Six Core suites pinned numbers or
behaviours this task moved and were updated the same way. One new suite,
`domain/src/runtime/llm-evidence/node-run/tests/run.test.ts`, covers the library
derivation, the dispatch, the two arguments, a failure, an unrunnable node and a
refused permission.

## Not verified

- **That the created Flow produces the right answer.** `run-mudavyub-d34e3c9b`
  replayed all four steps and its extraction returned **0 of 16** expected
  records. The standing rule is that success is `matchedRecords` against
  `expectedRecords`; by that measure this build has not succeeded. The Flow's
  extraction handle was detected before the search narrowed the page, which is
  the most likely cause and is a *what the model chose*, not a *what the
  mechanism did* — but it is unproved either way.
- **That a built Flow replays cleanly.** `run-muddtosq-b92a4d5c` built its Flow
  after every later change and then needed a **repair during replay** (2 provider
  calls, 2 interventions) before the Lab's wait ran out. So: the build is
  reproducible, and the Flow it builds is not yet one that replays untouched.
- **The post-change catalog truncation figure.** I raised the two allowances but
  did not read `catalogTruncated` back out of a live request.
- **`reorder`** has no live evidence: the model used `rerun`, `drop` and `keep`,
  never `reorder`.
- **No Core built-in node was run live.** The domain refuses one it cannot
  dispatch, with the ids it can as `instead` — proved by unit test, not live.
- **No browser-level validation beyond the Lab's own Chromium runs.**

## Open questions or contradictions found

1. **A Flow built from the draft cannot contain a node the build could not
   run.** Routing, subflows, branches and every Core built-in are unreachable
   that way, because the Flow *is* the list of nodes that ran. That contradicts
   the standing requirement that the model be able to author routing and
   subflows. The fix is not to reopen free-form authoring: it is to let an
   `amend_draft` decision group a span of steps into a block with a condition,
   which is Design One's own "group a span of nodes into a branch" and is not
   built. **This is the most important follow-up.**
2. **Running a Core built-in node live needs a seam that does not exist.** Core
   has no "execute one node standalone" entry point outside
   `runtime/executor/**`, which this task may not touch. Until there is one, the
   library is fully *nameable* and only partly *runnable*, and the model is told
   so by a refusal rather than by a silence.
3. **The Lab's created-adaptation audit caps `toolCallCount` at 16**
   (`packages/test-runner/src/existing-fluxiq-control.ts`). With the
   three-strike rule gone a build runs longer, and run `run-muddozj4-257be181`
   built a Flow that the Lab then refused to read: *"metadata.phase9 created
   evidence audit exceeded its bounded contract"*. That bound is now the thing
   that fails a good build. It is in a package I do not own.
4. **The instruction-authority derivation spends grant calls the loop does not
   know about.** Live, 26 authorized calls produced 27, and 40 produced 48. I
   built a fix (reserve calls for it) and **reverted it**, because it changes
   arithmetic eight Core tests pin and the brief did not ask for it. Whoever
   owns grant accounting should decide whether the derivation is inside or
   outside `maxCallsPerRun`; today a long build breaches its own grant and the
   Lab fails it on budget.
5. **`nodes/registry.ts`'s `getAutomationNodeDefinitions` should go or be
   renamed.** It returns built-ins from a static array, has no registration
   path, and is exported beside the real registry. Nothing in the Bootstrap path
   uses it, but it reads like the library and the next reader will believe it.
6. **A refusal's teaching value drops when it comes from the plan resolver.**
   The old press tool told a model *which way* a handle had stopped naming one
   control — not in the packet, page moved on, gone, now several — and each
   implied a different next call. The resolver answers `unknown`/`stale`/
   `ambiguous`/`not_unique`, which is coarser. I carry those codes plus the
   accepted shapes in `instead`, and the extraction refusal needed exactly that
   to stop repeating; whether the element refusals need the finer distinctions
   back is measurable and unmeasured.
