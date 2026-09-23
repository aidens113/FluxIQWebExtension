# t109 — reading a list is not a consequential act

Worktree: `F:/fxwork/t109/!FluxIQWebExtension` paired with `F:/fxwork/t109/!FluxIQ`,
both on `task/t109-extraction-is-not-consequential`. Nothing committed or pushed.
No Lab run, campaign or provider call was launched.

## Outcome

Done. The cause is found, fixed at one seam that covers the whole class of reads
rather than `extract_list` by name, and proved in both directions by tests in
both repositories. The cache-hit-token question is diagnosed and written down,
not implemented: it is a ten-file change across two repositories with three
strict parsers in it, which is more than "a small fix in Core's accounting".

## The run, walked

`test-runs/run-mueozmp8-348a2057`, task `everything-store-first-page-plus-earbuds`,
`deepseek-flash`, 21 provider calls, 233,440 tokens, $0.030, 336s. The instruction:

> Search the store for wireless earbuds, narrow the results to Brightaisle Plus
> items, and collect every product on the first page of results, leaving out
> sponsored placements, into a table with columns name, price, rating and url.

`snapshots/live-llm.json` `build.evidenceLoop.steps` reads, in order: a navigate
refused `not_at_start_location`, a navigate that worked, two `target_unobserved`,
one `blocked_by_dialog`, a click that worked, a structure detection, four clicks
that worked, a second detection — and then
`core.run_node` → `web.action.rejected.permission_required`, a
`core.decision_unusable` (`dry_run_refused`), a second
`permission_required`, and three `amend_draft` decisions that could not answer it.
The build ended `flow_bootstrap.permission_required` at stage `review`.

`build.declaredConsequences` has 36 entries. Thirty-three declared `[]` and were
permitted — every navigate, click and type, exploration and Flow step alike.
Three were refused, and all three are the same action:

```
{ actionKind: "exploration_step", actionId: "core.run_node", ref: "extract.list.1",
  verb: "extract list", controlKind: "step", consequences: ["create_new"],
  permitted: false, missing: ["create_new"] }
```

So the navigation, the search, the dismissal of a dialog and the Brightaisle Plus
filter all passed. The only thing FluxIQ stopped for was **reading the list of
products the instruction asked for**. `consequences.instructed` was `[]` — Core's
own reader of the person's words did *not* read "collect ... into a table" as
`create_new`, which is the right reading — so the model's per-action declaration
was the sole outlier, and `crossCheckVerdict: "beyond_instruction"` is that same
outlier reported a second time.

## The cause

Nothing "attached" `create_new` downstream. **The model declared it**, on the
`core.run_node` call, and every layer below took its word.

`core.run_node`'s schema (`Core runtime/llm/node-tools/run-node.ts`) requires
`consequences` on *every* call, reads included, and its guidance said `[]` "only
when it leaves nothing behind". An extraction produces a dataset, so the model
answered `create_new`. That answer then travelled untouched:

- `domain/src/runtime/llm-evidence/node-run/run.ts` passed `value.consequences`
  straight to `webActionPermission`;
- `domain/src/runtime/llm-evidence/permission.ts` passed it straight to Core's
  check;
- Core's `AutomationStudioActionDeclaration` had no way to say *whether the
  action acts at all*, so `gate.checkFor` had only the classes to go on, found
  `create_new` in neither the grant nor the instruction, and raised the request.

The contradiction the brief points at is real and it is a contradiction of
knowledge, not of code: `domain/src/actions/safety.ts` says
`"web.dom.extract_list": "safe"`, and `node-run/catalog.ts` already turns that
into `effect: "observe"` — the domain **knew** the node only reads, and had no
field in which to say so. Core's own `consequences.ts` already documents the rule
("Moving about, opening, expanding, filtering, choosing a row ... needs no
permission"); it simply could not be enforced for an action whose domain knew it
was a read.

**It is a whole class, not one node.** `WEB_AUTOMATION_ACTION_SAFETY` marks six
outputs safe: `wait_for_selector`, `wait_for_text`, `extract`, `capture_snapshot`,
`assert`, `extract_list`. Every one of them except the snapshot (which returns
before the check) reached the gate on the model's word alone, on **three** paths:

1. exploration, `node-run/run.ts`;
2. the pre-proposal replay, `node-run/replay.ts`;
3. the Flow's own steps, `plan-resolution/step-permission.ts` — which gated any
   step carrying a `consequences` declaration regardless of what the node does,
   so the same extraction written into the Flow would have been refused too.

## The seam chosen, and why

The correction belongs on **the declaration**, in Core, and not on the extraction,
the dataset write or the cross-check.

- *Not the extraction's declared consequence.* The model is the authority on what
  an act means on this page — that is the whole reason the declaration exists.
  Teaching it "an extraction is []" is prose, and prose is not enforcement.
- *Not the classification of a dataset write.* There is no dataset write to
  classify: the run-scoped rows are the product's own output, and no code
  anywhere classified them. Inventing a classification would be inventing the
  thing that was missing rather than supplying it.
- *Not the cross-check.* `beyond_instruction` was a faithful report of a bad
  input. Fixing the report would have left the refusal.
- **The declaration**, because that is the one place where the side that knows
  (the domain, from its own registry) meets the side that decides (Core, holding
  the grant), and because Core reads every declaration there — exploration step,
  replay, Flow step and recovery patch — through one function.

So `AutomationStudioActionDeclaration` gains `effect: "observe" | "mutate"`, the
domain states it from its own safety table, and Core treats an observing action
as having no lasting consequence whatever it named. Absent means `mutate`, so
nothing is widened by default; only an action whose domain states it reads leaves
the gate's reach.

## What changed

### FluxIQ Core (`F:/fxwork/t109/!FluxIQ`)

- `runtime/action-permissions/declaration.ts` — new `AutomationStudioActionEffect`
  (`"observe" | "mutate"`); `AutomationStudioActionDeclaration.effect?`;
  `AutomationStudioReadActionDeclaration.effect` (defaulting to `mutate`); the
  reader accepts the field and throws `effect_invalid` on any other word, so a
  misspelling fails closed rather than reading as `mutate`.
- `runtime/action-permissions/gate.ts` — `checkFor` treats an observing action's
  classes as not lasting: `consequences` becomes `[]`, the named classes are kept
  on the record as `disregarded`, the instruction is never derived and no request
  is raised. `automationStudioActionPermissionDenied` (the "nobody to ask" check)
  permits an observing action for the same reason.
- `runtime/action-permissions/declared.ts` — the record's `action` gains `effect`;
  the record gains optional `disregarded`; `automationStudioDeclaredNothingLasting`
  excludes reads, because "it acted and said it would cause nothing" is not true
  of something that did not act.
- `runtime/action-permissions/cross-check.ts` — `declaredNothing` now uses that
  helper, so the sentence a person is shown stays true.
- `runtime/llm/node-tools/run-node.ts` — the consequences guidance now reads
  "`[]` when it only reads or leaves nothing behind". **Eight characters, not a
  sentence**: the description is 1,990 of the 2,000 characters a provider
  accepts, and going over kills a build at its first request with HTTP 400
  (`run-mudkec90-f2489d35`, pinned by `node-tools/tests/run-node.test.ts`).

### Web extension (`F:/fxwork/t109/!FluxIQWebExtension`)

- `domain/src/actions/effect.ts` (new) — `webAutomationActionEffect`, the one
  derivation of `safe → observe` / `review → mutate` from the one safety table.
- `domain/src/runtime/llm-evidence/permission.ts` — `webActionPermission` takes
  `effect` and passes it on; with no check to ask, an observing action is
  `no_consequence` instead of `refused`.
- `node-run/run.ts`, `node-run/replay.ts` (both sites), `plan-resolution/step-permission.ts`,
  `press.ts` — every call site states the effect: the node's own where there is a
  node, `mutate` for a press and for the replay's reset navigation.
- `node-run/catalog.ts` — uses the shared derivation instead of its own copy.
- Lab: `existing-fluxiq-control/adaptation-consequences.ts` and
  `flow-lane/creation/build-proposal.ts` carry `effect` and `disregarded` through
  to `snapshots/live-llm.json`; `scripts/lab/live-campaign/row/consequences.mjs`
  reports `reads` and `readsOverDeclared` and excludes reads from
  `declaredNothing`. Without this the next run would show the model still calling
  a page read `create_new` nowhere at all — the fault would be fixed and invisible.

## Commands run and observed results

All in the two t109 worktrees.

- `pnpm --filter fluxiq check` (Core) → clean, no output after the banner.
- `npx vitest run --maxWorkers=1 --minWorkers=1 src/programs/automation-studio/runtime/action-permissions src/programs/automation-studio/runtime/flow-bootstrap`
  → `Test Files 21 passed (21)`, `Tests 269 passed (269)`.
- `npx vitest run --maxWorkers=1 --minWorkers=1 .../runtime/llm .../runtime/recovery .../runtime/conversations`
  → first attempt `Tests 1 failed | 865 passed` — the run-node description at
  2,201 characters, which is why the guidance edit is eight characters. After the
  edit: `Test Files 76 passed (76)`, `Tests 866 passed (866)`.
- `npx vitest run --maxWorkers=1 --minWorkers=1 .../runtime/service .../runtime/tests .../runtime/live-patch .../runtime/parking`
  → `Test Files 98 passed (98)`, `Tests 665 passed | 1 skipped (666)`.
- `pnpm check` (Core, full) → `EXIT=0`; `structure-audit: passed (179 warning(s), 360 baselined)`,
  all four projects `check: Done`.
- `pnpm --filter fluxiq build` → clean; description length measured from `dist` as
  **1,990**.
- `pnpm --filter @fluxiq-web-extension/domain test` → `# tests 771 / # pass 771 / # fail 0`,
  including the two new rows by name:
  `ok 426 - a node that only reads runs under a grant that permits nothing, whatever it declared`
  and `ok 427 - a press that would move money still stops and asks, under that same gate`.
- `pnpm lab:test` → `# tests 90 / # pass 89 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` → `# tests 1335 / # pass 1335 / # fail 0`.
- `pnpm check` (web extension, full) → `EXIT=0`; `structure-audit: passed (99 warning(s), 121 baselined)`,
  every project `check: Done`. Re-run after Core's final rebuild: `EXIT=0` again.

### The two directions, proved

**A read the instruction asks for proceeds.** Core
`action-permissions/tests/declared.test.ts`, describe block "an action that only
reads": permitted with no request; recorded as `consequences: []` with
`disregarded: ["create_new"]` and `action.effect: "observe"`; the instruction is
never derived; the cross-check says `agreed` with `beyondInstruction: []`;
permitted even with nobody to ask. Domain
`node-run/tests/run.test.ts` drives the same thing end to end through a **real**
`AutomationStudioActionPermissionGate` holding `permittedConsequences: []`: a
read node declaring `create_new` dispatches its command, `gate.request` is
`undefined`, and the record carries `disregarded: ["create_new"]`. Domain
`plan-resolution/tests/plan-step-permission.test.ts` does the same for a **Flow
step** that reads.

**A consequential act still asks.** Same Core describe block: a press declaring
`move_money` under the same gate is refused with `missing: ["move_money"]` and a
request id, its `disregarded` is absent, and `automationStudioActionPermissionDenied`
still refuses it; a `send_or_publish` + `create_new` press whose effect nobody
stated is refused exactly as before with `action.effect: "mutate"`; a declaration
whose effect is an unknown word throws `effect_invalid`. Domain
`node-run/tests/run.test.ts`: the click declaring `move_money` comes back
`permission_required`, the gate's request names `move_money`, and **no click
command was dispatched**. The pre-existing Core and domain rows for a publishing
press, an undeclared press and a `move_money` step with nobody to ask are all
still green.

## The cache-hit tokens: diagnosed, not fixed

Caching is working and the number simply is not persisted. Arithmetic against
Core's own `deepseek-flash` peak rates (0.3 / 0.006 / 1.2 USD per million for
cache-miss input, cache-hit input, output): 230,895 input and 2,545 output tokens
would have cost **$0.072322** with every token a miss; the recorded
**$0.030024132** reconciles exactly at **143,872 cache hits, 62.3% of input**.

Where it is lost: `AutomationStudioBootstrapAccounting`
(`flow-bootstrap/adaptation.ts`) has no `cacheHitInputTokens` field, so
`loopAccounting` in `runtime/service.ts` (~line 1562) drops `spent.cacheHitInputTokens`
while naming the other four totals, and `bootstrapHarnessAccounting`
(`service/flow-bootstrap-commands/harness-accounting.ts`) types `result.usage`
without it. The evidence loop *does* accumulate it
(`runtime/llm/evidence-loop.ts:790`) and the DeepSeek provider *does* read both
`prompt_cache_hit_tokens` and `usage.prompt_tokens_details.cached_tokens`
(`llm/deepseek/pricing.ts`), so the loss is entirely in the hand-off to the
stored proposal and the failure diagnostic.

**Why it was left.** The full chain is: Core — `adaptation.ts` (type),
`review-projection.ts` (`sanitizedBootstrapAccounting` bound),
`service.ts` (`loopAccounting`), `harness-accounting.ts` (+ its
`AutomationStudioBootstrapAuthorityUsage` and the instruction-authority producer),
`generation-failure.ts` (diagnostic type, builder ~line 489, and the
`hasExactFields` parser ~line 687, which a *refused* build like this one goes
through); web extension — `existing-fluxiq-control/adaptation-consequences.ts`'s
sibling accounting reader, `flow-lane/creation/build-proposal.ts`
(`CreatedFlowBuildAccounting`, `accountingOf`), `live-llm/build-usage.ts`,
`live-llm/observed-usage.ts` (`ExistingRunLlmAccounting`, shared with the
non-build path), and the campaign summary. Ten files, two repositories, three
strict parsers and a wire-contract field. That is its own task, not a rider on
this one.

## Not verified

- **No live run.** Nothing here has been exercised against a real provider or a
  real page; the proof is Core's real permission gate driven by the domain's real
  runtime over a stub gateway. The next campaign run on
  `everything-store-first-page-plus-earbuds` is the measurement that matters, and
  the supervisor owns it.
- **Core's full `pnpm test` was not run.** `pnpm check` (which type-checks all
  four projects) passed, and the whole of `automation-studio/runtime` — the area
  that changed — passed. A first attempt at a wide vitest run died in
  `tinypool` with `RangeError: Maximum call stack size exceeded`; every suite
  above was then run with `--maxWorkers=1 --minWorkers=1` and passed. That crash
  is the environment, not the change.
- **The extension bundle was not rebuilt** and no browser was opened. Nothing
  changed in `apps/extension`.
- **`web.dom.extract_list` itself was not driven end to end** in a test: the two
  domain rows use `web.dom.wait_for_text`, which is the same `safe → observe`
  class and needs no extraction handle to reach the gate. The class is what the
  fix is about; exercising the specific node needs a structure detection first.

## Open questions and contradictions found

1. **One read can still be gated, in Core's recovery patch seam.**
   `runtime/recovery/annotation/patches.ts` (~line 277) builds a declaration
   *itself* — `verb: "press"`, no domain involved — for a
   `temporary_target_override` or `temporary_action_sequence` on a failed node. If
   the failed node is a read and the model declares a class for the patch, the
   repair will still stop and ask. Core cannot decide this today:
   `AutomationStudioNodeDefinition` carries no observe/mutate. Two options, both
   deliberate choices rather than edits: give `AutomationStudioNodeSafety` a real
   `effect`, which the web domain already computes; or read the existing
   `safety.requiresOperatorApproval`, which for this domain is the same table but
   is a different question and would be an implicit coupling. I did not do either.
2. **The `run_node` description is at its ceiling.** 1,990 of 2,000 characters.
   Anything further the model must be taught about this tool requires removing
   prose first, and every sentence in there was added for a measured reason. This
   is a standing constraint worth recording, not a defect.
3. **A model that declares a class for a read is now free, and invisible unless
   the Lab is read.** That is why `disregarded`, `reads` and `readsOverDeclared`
   exist. If the next run shows `readsOverDeclared` high, the fix is guidance, not
   the gate.

## What Core's paired working document should record

- `AutomationStudioActionDeclaration` has a third field, `effect`, and it is the
  one field on a declaration that is not the model's claim: it is what the domain
  knows about its own action. Absent means `mutate`. A domain that adds an
  observing action must state it, or its reads will be gated on whatever the model
  writes.
- The gate's contract is now: *an action that only observes has no lasting
  consequence, whatever it declared.* What it named is kept on the record as
  `disregarded` and excluded from `automationStudioDeclaredConsequences` and from
  the cross-check.
- `AutomationStudioActionDeclarationRecord` is wider by two fields
  (`action.effect`, `disregarded?`). It travels to a person and to a stored
  proposal; the downstream reader in this repository was widened with it.
- `run-node`'s description is 1,990 of 2,000 characters.
- The bootstrap accounting drops `cacheHitInputTokens` between the evidence loop
  and both the stored proposal and the failure diagnostic; the file list is in the
  section above. Core's side is `adaptation.ts`, `review-projection.ts`,
  `service.ts`'s `loopAccounting`, `harness-accounting.ts` and
  `generation-failure.ts`.
