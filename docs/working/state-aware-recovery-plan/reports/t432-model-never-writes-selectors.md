# t432: the model never writes, or is asked for, a selector

This is a worker report. Both trees are under `fxwork/t432/` on `task/t432-model-never-writes-selectors`. Nothing was
committed. Core was changed (the brief gave its tree).

## Outcome

**Done.**

- **What the model reads.** It is now told about an element's handle and nothing else:
  - the node catalog and `core.describe_nodes`;
  - the Flow script format and the library verb;
  - the in-run repair instruction;
  - candidate refusal advice and Core's own refusal text.
- **What the model writes.** On every path it writes steps, an element named any way other than by a handle is refused
  with feedback, and is never run or saved raw.
- **What still works unchanged:**
  - hand-authored literal-selector Flows: recovery-matrix case 1 passed, and demo documents are saved directly;
  - draft steps, which the domain resolved itself;
  - steps a Flow already holds.
- **Waiting for an element:** it is kept, named by handle. Waiting for text is unchanged.

**Node id decision.** I kept the public id `web.output.dom-wait_for_selector` (action `web.dom.wait_for_selector`).
Saved Flows name it, so renaming it would orphan them.
- Its label is now "Wait For Element".
- Its description is now "Wait until the element its target handle names is present, visible, enabled, or absent."
- The id is the only place the word survives that a model can read. The domain guard test exempts the id alone.

## What changed and why

### Core: one flag hides host-filled parameters from the model

**`nodes/contracts.ts`**
- `AutomationNodeParameter` gains `shownToModel?: false`, meaning "the host fills it from what a model names".
- The node still declares it, so stored Flows validate.

**`runtime/flow-bootstrap/plan/catalog.ts`**
- `catalogEntry` leaves these parameters out. This one place feeds the build catalog, the names list and
  `core.describe_nodes`.

**`runtime/flow-bootstrap/plan/issue-feedback.ts`**
- A hidden parameter gets no `accepted` shape, and the `bootstrap.unknown_parameter` list omits it.
- Before this, a refusal at `selector` re-taught the model `{type: string, required: true}`.
- `bootstrap.target_not_a_handle` joins `AUTHORED_CODES`, so its fixed sentence reaches the model.

### Core: the model's writing is marked, and Core refuses a fact written with a locator

**`llm/harness-options/binding.ts`**
- `resolvePlanNodeParameters` input gains `writtenByModel?: true`.

**`llm/harness-options/plan-parameter-resolution.ts`**
- Its input takes `writtenByModel` and hands it to the domain with every node and fact.
- With the flag set, Core itself refuses every fact target that names neither a handle nor a dialog, such as
  `at "<locator>"`. The code is `bootstrap.target_not_a_handle`. Its sentence says to name the element by the handle
  the evidence printed.
- The wording avoids "page", because `builtin.test.ts` bans web words in that directory.

**`llm/harness-options/plan-fact-targets.ts`**
- The walker is generalised, and the module adds `automationStudioPlanFactTargetsNotNamingHandles`.

**Who sets the flag:**

| Caller | Flag |
| --- | --- |
| `bootstrap-completion.ts`, plan from the reply (candidate submission, legacy reply) | `writtenByModel: drafted === undefined`, so set |
| `bootstrap-completion.ts`, plan built from the draft | not set: its steps ran with domain-resolved `ranWith` |
| `service.ts` (no-exploration bootstrap, one line) | `writtenByModel: true` |
| `recovery/annotation/step-evidence-resolution.ts` (in-run repair) | `writtenByModel: true` |

**`recovery/annotation/step-evidence-resolution.ts`, more:**
- A fact target that is present but is not `handles` is refused without asking the domain. Before, it passed through
  as written.
- A refusal whose code is `*.handle.not_a_handle` or `target_not_a_handle` gets its own reason: "...names a control by
  something other than the handle the page view printed for it, so the fix was not used."

### Core: model-facing wording

- **`flow-bootstrap/candidate/submission-refusal.ts`:**
  - `extraction_required` no longer says "written from selectors".
  - A new `not_a_handle` advice entry is added.
- **`llm/node-tools/run-node.ts`, `llm/deepseek/system-prompt.ts` and `bootstrap-completion.ts`
  (`FEEDBACK_INSTRUCTION`):** "never write a locator" is reworded to "an address ... of your own (in its place)".
  - A model told "never write a locator" has still been taught that a locator is something it could write.
- **`llm/harness/instruction.ts` (in-run repair):** one new sentence says a fix names each control only by the handle
  the evidence printed, and that a control named any other way refuses the fix.
- **`flow-bootstrap/script-statements/fact-locator.ts`, `fact-condition.ts`:** the `at` refusals no longer say
  "locator". They end with the exported `AUTOMATION_STUDIO_FLOW_SCRIPT_AT_IS_HAND_WRITTEN`, which says to name the
  element by its handle.

### Downstream domain

**`output-nodes/definitions.ts`**
- `selector`, `element` and `visualTarget` are `shownToModel: false`.
- `target` gets a description: "named only by the handle the page view printed ... `{"handle": "t5"}`; in a Flow
  script, `target: t5`". It also gets the example `{handle: "t5"}`.
- The `expectedState` description no longer says `{kind, selector, expected}`. It now points at `done when:` by handle.

**`actions/schemas.ts`**
- Only the wait node's label and description changed (above).
- The schema labels that say "CSS selector" stay. They live in `metadata.parameterSchema`, which no catalog sends.

**List read and Next page text**
- `output-nodes/extract-list/catalog-text.ts`:
  - The literal clause `Or {item: css, fields: ...}` is removed.
  - The example is now the handle form: `{handle: "extraction.1", fields: {title, link: "title@href"}, where: [{field:
    "promoted", is: "absent"}], dedupe, sort, minItems}`. It is from a recipe site, which no scenario is.
- `output-nodes/next-page/catalog-text.ts`:
  - The literal clause is removed.
  - A new `WEB_AUTOMATION_NEXT_PAGE_EXAMPLE` is `{list: "extraction.1", control: "t9"}`.
- `next-page/parameters.ts` uses that example. Before, it was `{item: "li.result", ...}`.

**Other text**
- `runtime/llm-evidence/harness-options/options.ts`: "Returns no values or selectors" becomes "Returns no values".

**`runtime/llm-evidence/plan-resolution/written-literals.ts` (new)**
- `webPlanWrittenLiterals(nodeId, parameters, elementNode)` refuses each of these as `web.handle.not_a_handle`:
  - `selector`, `target` or `element` holding anything but a handle reference. A `target` bound to `$state` with a
    handle fallback is allowed.
  - `visualTarget`.
  - `expectedState.conditions[i].selector`.
- An element-required node that names no element at all is refused as `web.handle.required`.

**`plan-resolution/resolve-plan-node.ts`**
- New input `writtenByModel`, and `scope.model`.
- With it set:
  - the literal refusals above apply;
  - a literal `extractList` that is not the Flow's own list is refused `extraction_required`, whether or not a list
    was detected;
  - a literal or short `nextPage` is refused `not_a_handle`, with `next_page.list_control`.
- Codes:
  - `web.handle.not_a_handle` and `web.handle.required` are added, both placement reasons.
  - `web.handle.expected.selector.handle_location` is **renamed** to `web.handle.expected.target.handle_location`. Only
    domain tests used it.
- The file is at exactly 800 lines, the limit. I trimmed my own comments to get there.

**Other domain files**
- `plan-resolution/issue-position.ts`: `conditions` is a grammar key, so positions read `expectedState.conditions.0.selector`.
- `node-run/run.ts`: exploration's call passes `writtenByModel: true`.
- `tool-rejection.ts`: both new codes map to `target_not_a_handle`.
- `tools.ts` is unchanged: the flag passes through its existing input.
- A hand-authored or recorded step is never flagged, so its literal still resolves `unchanged`. The existing
  resolver tests that pin this still pass.

### Tests

**Core: new files**
- `flow-bootstrap/plan/tests/host-filled-parameters.test.ts` (4 tests). A hidden parameter:
  - is absent from the catalog entry;
  - is absent from feedback shapes and the undeclared list;
  - leaves a shown parameter's shape intact.
- `llm/harness-options/tests/plan-written-by-model.test.ts` (6 tests):
  - the flag reaches the domain for nodes and facts;
  - locator facts are refused at their paths, with a sentence free of locator words;
  - any non-handle, non-dialog fact target is refused;
  - a host plan is not flagged and its locator fact stands;
  - the completion check flags a reply's plan and does not flag a draft's.
- `tests/model-facing/tests/handle-only.test.ts` (6 tests): **the guard test.** It fails if any of these matches
  `/\b(css|xpath|selectors?|locators?)\b/i`:
  - the four Flow script format texts;
  - the run-node description and schema;
  - the in-run repair instruction;
  - every candidate handle-advice reason;
  - the `at` refusals;
  - Core's not-a-handle fact message.

  It is placed in a subfolder because `runtime/tests/` would have gone to 26 files, over the 25-file limit.

**Core: changed tests**
- `recovery/annotation/tests/step-evidence-resolution.test.ts`: 3 new tests. The flag reaches the domain; the
  domain's not-a-handle refusal gets the reason above; a `{locator}` or `{selector}` fact is refused without asking.
- Pins re-pinned for the reworded prose: `submission-refusal.test.ts`, `fact-condition.test.ts`, `run-node.test.ts`,
  `deepseek-provider.test.ts`, `opaque-target-override.test.ts`, `deepseek/tests/system-prompt-pins.json` (the two
  `runtime_patch` pins).

**Downstream: new files**
- `plan-resolution/tests/written-literals.test.ts` (8 tests):
  - a literal on a click, type, scroll or wait is refused, and so is a bare `t1` string;
  - a literal beside a handle, a model-described `element`, a `visualTarget` and a locator in an `expectedState`
    condition are refused;
  - an element node naming nothing is refused `required`;
  - a literal list read or Next page request is refused;
  - a Run Output payload is refused;
  - a handle still resolves;
  - an unflagged host step stands.
- `output-nodes/tests/model-facing-catalog.test.ts` (5 tests). It builds Core's real catalog from the domain's
  definitions and checks:
  - no entry, apart from its id, matches the locator words;
  - element nodes show `target` with the handle description, and hide `selector`, `element` and `visualTarget`, which
    are still declared;
  - "Wait For Element" is present and wait-for-text stays;
  - the system instructions are clean.

**Downstream: changed tests**
- These tests moved off literal exploration reads, because exploration now refuses them:
  - `node-run/tests/run.test.ts`: the list codes are now read by detected handle from captured detections, plus a new
    refusal test;
  - `replay.test.ts`;
  - `catalog.test.ts` (Next page);
  - `rejected-rows.test.ts`, which gains the "no `answer`" assertion.
- Pins updated: `definitions.test.ts`, `extract-list/tests/catalog-text.test.ts`, `resolve-plan-node.test.ts` (codes
  list), `slot.test.ts`, `tool-rejection-detail.test.ts` (the renamed code).

## Commands run and observed results

| Command (tree) | Result |
| --- | --- |
| `npx vitest run` over runtime `flow-bootstrap`, `llm/harness-options`, `llm/node-tools`, `llm/harness`, `llm/tests`, `llm/deepseek`, `recovery`, `tests/model-facing`, `tests/in-run-repair`, `service/runtime-session`, `service/candidate-trial` (Core `packages/fluxiq`) | final run: `Test Files 291 passed \| 1 skipped (292)`, `Tests 3719 passed \| 2 skipped (3721)` |
| `pnpm run check` (Core `packages/fluxiq`) | exit 0 (final run, after every edit) |
| `node scripts/structure-audit.mjs` (Core) | `passed (324 warning(s), 1160 baselined)` |
| `pnpm run build` in Core `packages/contracts`, then `packages/fluxiq` | contracts reused (stamp); fluxiq rebuilt, exit 0, after the last Core source edit |
| `DOMAIN_TEST_BUILD_LABEL=t432 node scripts/test-domain.mjs src/runtime/llm-evidence src/output-nodes src/actions` (domain) | `tests 1253, pass 1253, fail 0` |
| `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` (domain) | both exit 0 |
| `pnpm --filter @fluxiq-web-extension/extension exec tsc --noEmit -p .` | exit 0. The extension was not touched; this checks it against the rebuilt Core. |
| `node scripts/structure-audit.mjs` (downstream) | `passed (184 warning(s), 651 baselined)`, the same count as t429 |
| `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1` | `rmx-2026-10-10T22-08-57-134Z-7ab437`, case 1 **passed** |

**Failures met on the way, all fixed:**
- **Core:**
  - `builtin.test.ts` banned the word "page" in harness-options code; I reworded the message.
  - the guard test's imports;
  - two `system-prompt.test.ts` pins.
- **Downstream:**
  - 7 domain tests (above);
  - `contract-spread` in my test;
  - `resolve-plan-node.ts` at 814 lines, now 800;
  - a Core `directory-files` violation from my test placement.

**A pre-existing failure, not from t432.** `DOMAIN_TEST_BUILD_LABEL=t432 node scripts/test-domain.mjs src/tests
src/runtime/tests src/runtime/facts src/runtime/expectation src/recording src/web-panel` gave `tests 290, pass 288,
fail 2`.
- Both failures are in `src/runtime/tests/lasting-act-statement.test.ts`, where `actUncertain` was expected and is
  undefined. They are:
  - "a click whose confirmation failed is not made again";
  - "typing that sends its form, or a plain type...".
- My reasoning:
  - That test came from downstream `e224b269`.
  - The t432 Core branch equals Core `dev` `aaa7aa8d`, which is t430: "A step's declaration never unlocks a second
    press; the page decides".
  - t432 touches neither side of that seam.
- I did not run it on an unmodified tree to confirm. The coordinator confirms both are fixed on `dev` by t430 (merged),
  and will merge `dev` into this branch. I did not merge, because a merge is a commit.

## Not verified

- **No live or paid run.** No real model met the new refusals or the reworded catalog.
- *(Closed in the follow-up below: `amend_draft` settings are now judged, and the no-exploration flag has a test.)*
- **Matrix case 1 only.** It proves hand-authored literal Flows still compile and run. It does not exercise the new
  refusals.
- **I did not audit every Core-made exploration call** for literal element parameters. Replay, verify and rerun go
  through the separate unflagged entry points (`replay.ts`, `verify.ts`).
- **Docs:** `docs/architecture/` in either repository was not updated. It is outside the brief.
- **No full suites**, per the rule.

## Open questions or contradictions found

1. **The Core web fixture is now stale.** `flow-bootstrap/plan/tests/web-domain-definitions-fixture.ts` is a dated copy
   of the web definitions. It still shows `selector` and the old "CSS selector" texts. Core tests that use it are
   unaffected, but it no longer matches what the domain registers.
2. **`own-extraction-list` is still accepted from the model.** A literal `extractList` equal to the Flow's own detected
   list is still accepted when the model writes it, because it is the domain's own resolved request and not a guess.
   If the rule should refuse even that, it is a one-line change in `resolve-plan-node.ts`.
3. **A "locator" word survives in Core.** `AUTOMATION_STUDIO_WITHHELD_LOCATOR = "[locator withheld]"`
   (`llm/harness/locator-text.ts`) still puts the word "locator" into texts a model reads when a locator is screened.
   It is a placeholder rather than a request, so I left it.
4. **Exploration feedback changed.** Exploration's refusal of a literal now answers `target_unobserved` with reason
   `target_not_a_handle`, through `parameters_not_resolved`'s code table, together with the resolver's codes. Before,
   a literal on an optional-element node, such as a scroll or a wait, simply ran.

## Follow-up (coordinator, same day): three gaps closed, and one regression of mine

### Outcome

**Done.** All three gaps are closed.

While mapping the `amend_draft` path I found that my own t432 exploration flag regressed reruns of seeded steps, and I
fixed that too:
- In a repair or re-author round, a draft step seeded from the Flow holds the Flow's saved selector, element and list
  item (Core `draft-from-flow.ts`).
- A rerun merges only the model's patch over them (Core `rerun-input.ts`).
- Blanket `writtenByModel: true` on every exploration call would therefore refuse two common repair moves: a rerun that
  gives the step a new target handle beside its saved selector, and a rerun of a saved literal list read whose `where`
  the model rewrote. Neither literal was written by the model.

### What changed

**1. `amend_draft` values are judged.** These are the `settings` an amendment carries onto a draft step. Each replaces
its parameter whole when the Flow is written (Core `draft-step.ts`).

*Core:*
- `llm/harness-options/amended-plan-parameters.ts` (new): `automationStudioAmendedPlanParameters` gives each draft
  node's amended setting keys, by ref.
- `bootstrap-completion.ts`: `fromDraft` returns those keys, and they go into the resolution as
  `modelWrittenParameters`.
- `plan-parameter-resolution.ts`:
  - takes `modelWrittenParameters: ReadonlyMap<ref, string[]>` and hands each node its own keys;
  - refuses a locator fact (`bootstrap.target_not_a_handle`) that sits inside an amended parameter;
  - `automationStudioPlanFactTargetsNotNamingHandles` now returns `{path, ref}`.
- `binding.ts`: documents `modelWrittenParameters?: readonly string[]`. It is never sent beside `writtenByModel`.

*Domain:*
- `written-literals.ts` takes a `WebPlanAuthorship` (`model`, `modelKeys`):
  - only parameters the model wrote are judged;
  - `required` applies only to a node the model wrote whole.
- `resolve-plan-node.ts` (799 lines):
  - adds the `modelWrittenParameters` input;
  - the list-read and Next page literal refusals apply only to a key the model wrote;
  - a Run Output's payload is the model's when the model wrote `parameters`.

The existing `settings_rewrite_run` rule still refuses, at amend time, settings that change a parameter the step ran
with. The new check covers the rest, at completion:
- a locator condition inside `expectedState`;
- a `selector` written onto a step that ran without one.

**Exploration rerun regression fix.**
- `node-run/held-literals/` (new: `memory.ts`, `index.ts`, `tests/memory.test.ts`) remembers, per build, what a
  continuing round's opening look carries under `held`.
- A later call's parameter is treated as the host's when its value equals what a held call of the same node holds. A
  list request counts as the host's when its `item` equals the held one.
- Every other parameter is the model's.
- `run.ts` asks it with `run.held.author(input, build)`, which sets `writtenByModel` or `modelWrittenParameters`.
- `arrival.ts` `webNodeHeldFlow` also returns `calls`.
- The memory is wired through `context.ts`, `tools.ts` and `index.ts`.
- A build that continues no Flow holds nothing, so every parameter of every call is judged as before.
- A new build forgets what the last build held.

**2. Test for the no-exploration bootstrap flag.** `tests/service-bootstrap/tests/generation.test.ts`, case "tells the
domain that a plan built with no exploration is the model's own writing". It goes through the real service with
`generateFlowBootstrapAdaptation` and no `evidenceGuided`. Every node the domain is asked about carries
`writtenByModel: true` and no `modelWrittenParameters`.

**3. Docs.**
- Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`:
  - a new paragraph in "The catalog an evidence decision is shown" on `shownToModel: false` and the guard test;
  - `bootstrap.target_not_a_handle` added to the Plan handles code table;
  - a new subsection "What the model wrote names an element by handle only (t432)": `writtenByModel` and who sets it,
    `modelWrittenParameters` from `amend_draft` settings, never-flagged host writing, and the fact refusal.
- Downstream `docs/architecture/build-loop.md`: a new section "Elements Are Named By Handle Only". It covers:
  - the hidden parameters and `target` text;
  - Wait For Element, with its id kept;
  - the handle-only list and Next page grammar;
  - `web.handle.not_a_handle` and `web.handle.required`;
  - the rename to `web.handle.expected.target.handle_location`;
  - who wrote what, including held literals.
- Downstream `docs/architecture/web-capabilities.md`:
  - the Wait row names Wait For Element and handle-only naming;
  - the Structured extraction row says a model writes only the handle form.

### Tests added

*Core `plan-written-by-model.test.ts` (+2):*
- only the amended parameter is named to the domain, and a locator fact inside it is refused while a saved resolved
  fact on another node stands;
- the completion check names an amended draft step's `settings` keys and does not set `writtenByModel`.

*Domain:*
- `plan-resolution/tests/written-literals.test.ts` (+1): with `modelWrittenParameters`:
  - an amended `expectedState` locator condition is refused;
  - an amended `selector` is refused;
  - the step's own address and an amended `wait` stand;
  - nothing is required of the step.
- `node-run/held-literals/tests/memory.test.ts` (4):
  - in a continuing round, a rerun keeps the saved selector and element beside a new handle, and the press goes to the
    handle's control;
  - a saved list read with rewritten `where` still reads;
  - a guessed literal and a new literal list in that round are refused;
  - a build continuing no Flow holds nothing, and a new build forgets.

### Commands run and observed results (follow-up)

| Command (tree) | Result |
| --- | --- |
| `npx vitest run` over runtime `flow-bootstrap`, `flow-draft`, `llm/harness-options`, `llm/node-tools`, `llm/harness`, `llm/tests`, `llm/deepseek`, `llm/evidence-loop`, `recovery`, `tests/model-facing`, `tests/in-run-repair`, `tests/service-bootstrap`, `service/runtime-session`, `service/candidate-trial` (Core `packages/fluxiq`) | `Test Files 371 passed \| 1 skipped (372)`, `Tests 4480 passed \| 2 skipped (4482)` |
| `pnpm run check` (Core `packages/fluxiq`) | stored, exit 0 |
| `node scripts/structure-audit.mjs` (Core) | `passed (327 warning(s), 1160 baselined)` |
| `pnpm run build` in Core `packages/contracts`, then `packages/fluxiq` | contracts reused; fluxiq rebuilt after the last Core edit |
| `DOMAIN_TEST_BUILD_LABEL=t432 node scripts/test-domain.mjs src/runtime/llm-evidence src/output-nodes src/actions` | `tests 1258, pass 1258, fail 0` |
| `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` (domain) | both exit 0 |
| extension `tsc --noEmit -p .` | exit 0 |
| `node scripts/structure-audit.mjs` (downstream) | `passed (184 warning(s), 651 baselined)` |
| `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1` | `rmx-2026-10-10T22-43-08-870Z-c6a8fa`, case 1 **passed** |

**Failures on the way, both fixed:**
- downstream `directory-files`: `node-run/` and `node-run/tests/` reached 26 files, so held-literals moved into its own
  directory;
- running vitest from `packages/` instead of `packages/fluxiq` gave one unrelated failure; it passed from the package
  directory.

### Not verified (follow-up)

- **Settings are judged at completion, not at amend time.** Core's amendment step cannot judge a web literal. The model
  learns of a bad setting when its completion is refused, not when it amends.
- **Held-literal equality is by value.** A model that re-typed a held step's exact saved selector would be treated as the
  host, but the model is never shown `selector` (a denied key).
- **A list's `item` is shown to the model in a re-author draft.** `item` is not a denied key, so the model may see it
  and could copy it into a new read, which would then pass as host-held. This exposure predates t432.
- **No live run.**
