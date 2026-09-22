# d7 — Core structure constraints for the Flow-authoring and defensive-runtime work

Read-only investigation of FluxIQ Core (`F:\!FluxIQ`, branch `dev`, clean tree).
Nothing was modified. Every number below was read out of the source or printed by
Core's own audit on 2026-09-22.

## Outcome in one paragraph

Core's structure rules are enforced mechanically by `scripts/structure-audit.mjs`,
which runs **first** in `pnpm check` and fails the build. Fourteen rules run; the
size rules are ratcheted per key in `.structure-baseline.json`, and the ratchet is
currently **tight to the byte**: the audit reports `lowerable 0`, meaning every
baselined entry sits exactly at its recorded value. In particular
`runtime/service.ts` is 6,275 lines against a baseline of 6,275, and
`AutomationStudioService` has 223 methods against a baseline of 223. **Not one
line and not one method may be added to the Automation Studio service.** That
single fact determines the shape of this whole project: the build loop, the draft,
the edit tools, the dry run and the recovery ladder must all land in new or
existing feature directories under `runtime/`, wired in through barrels, with the
service gaining nothing — or gaining something only in exchange for an equal
removal.

---

## 1. The rules as they are actually enforced

### Where they live

| Thing | Path |
| --- | --- |
| Full methodology | `F:\!FluxIQ\docs\architecture\code-structure.md` |
| Binding summary | `F:\!FluxIQ\AGENTS.md:161-206` ("Code Structure") |
| Entry point | `F:\!FluxIQ\scripts\structure-audit.mjs` |
| Limits | `F:\!FluxIQ\scripts\structure-audit\context.mjs:45-60` |
| Repository config | `F:\!FluxIQ\scripts\structure-audit\config.mjs` |
| Ratchet | `F:\!FluxIQ\scripts\structure-audit\baseline.mjs` |
| Rules (14 files) | `F:\!FluxIQ\scripts\structure-audit\rules\*.mjs` |
| Baseline | `F:\!FluxIQ\.structure-baseline.json` |

`package.json:13` — `"check": "pnpm structure:test && pnpm task:test && node scripts/structure-audit.mjs && pnpm -r check"`. The audit runs before any type check.

### The budgets, verbatim

`scripts/structure-audit/context.mjs:45-60`:

```js
export const LIMITS = {
  fileLines: 800,          fileLinesWarn: 400,
  directoryFiles: 25,      directoryFilesWarn: 15,
  classMethods: 40,        classMethodsWarn: 25,
  exportedValues: 15,      exportedValuesWarn: 8,
  exportedClasses: 1,
  exportedComponents: 1,
  prefixGroup: 3,
  maxPathSegments: 9,
  workingDocLines: 800,    workingDocCurrentStateLines: 150
};
```

`docs/architecture/code-structure.md:169-171` states it in prose: "**800 lines per
file, 25 files per directory, 40 methods per class.** The first two fail
`pnpm check`; the third warns. Existing violations are frozen in
`.structure-baseline.json` and may only shrink." The prose is out of date on the
third point — `rules/class-methods.mjs:47-53` emits `severity: "fail"` above 40 and
only *warns* between 26 and 40. The 40-method limit is a hard failure.

### Which rules ratchet and which do not

A ratcheted `fail` finding is suppressed while `value <= baseline[rule][key]`, fails
when it exceeds it, and **fails outright when the key has no entry**
(`scripts/structure-audit/baseline.mjs:37-65`). `--update` only lowers or removes;
it "never adds or raises one" (`baseline.mjs:6-9`). The one way to add entries is
`--adopt <rule>`, refused once a rule has any entry (`baseline.mjs:134-140`).
`code-structure.md:204-208` names raising a baseline entry an anti-pattern.

| Rule | Severity above limit | Ratcheted? | Consequence for new code |
| --- | --- | --- | --- |
| `file-lines` (>800) | fail | yes, per path | A new file over 800 lines fails outright |
| `file-lines` (>400) | warn | n/a | Advisory only; 170 warnings today, build green |
| `directory-files` (>25) | fail | yes, per directory | A directory crossing 25 fails outright |
| `directory-files` (>15) | warn | n/a | Advisory only |
| `class-methods` (>40) | fail | yes, per `path::Class` | A new class over 40 methods fails outright |
| `class-methods` (>25) | warn | n/a | Advisory only |
| `exported-values` (>15 values, >1 class, >1 component) | fail | yes, per `path::kind` | Barrels (`index.*`) are exempt (`rules/exported-values.mjs:80`) |
| `naming` — path depth >9 segments | fail | **no** | Cannot be baselined at all |
| `naming` — banned basenames/dirs (`utils`, `helpers`, `misc`, `common`, `shared-ui`) | fail | yes | New instance fails outright |
| `naming` — 3+ files sharing a `noun-` prefix in one directory | fail | yes, per `dir::prefix` | New group fails outright |
| `test-placement` — a `.test.ts` not directly in `tests/` or `e2e/` | fail | yes, per directory | New misplaced test fails outright |
| `imports` — forbidden specifier (downstream repo) | fail | **no** | Absolute |
| `imports` — crossing a declared `importBoundaries` edge | fail | **no** | Absolute |
| `imports` — reaching past another directory's barrel | fail | yes, per importer file | New barrel-skipping import fails outright |
| `contract-spread` | fail | yes | Only in configured paths |
| `failure-as-empty` | fail | yes, per file | New `.catch(() => [])` / `catch { return null }` fails outright |
| `swallowed-failure` | fail | yes, per file | New `.catch(() => undefined)` / empty `catch {}` fails outright |
| `web-vocabulary` | fail | yes, per file | A web/DOM word in a *name* under `packages/` fails outright |
| `facade-dispatch` | fail | **no** | A collaborator under `x/service/` may not call a public method of `x/service.ts` through a collaborator field |
| `docs-links` | fail | no ratchet | Every local link and `#fragment` under `docs/` must resolve |
| `working-docs` | fail | yes | Working-doc header, `Current State` ≤150 lines, doc ≤800 lines, index rules |

The four non-ratcheting rules — **path depth**, **forbidden imports**, **import
boundaries**, **facade dispatch** — are the ones that cannot be negotiated with.
They are absolute for this work.

### Directory shape and barrels

- Placement is the procedure `<ownership>/<layer>/<feature>/<kind>/<file>`
  (`code-structure.md:21-27`).
- Layers inside a program: `api/` contracts only, `model/` documents and pure
  transforms, `runtime/` services/executors/orchestration/adapters, `storage/`
  repositories and schema, `ui/` view-state DTOs. `runtime/` "must not own"
  storage formats; `storage/` must not own orchestration (`code-structure.md:47-53`).
- A program may add a **capability area beside the layers** "when it is a genuinely
  separate capability with its own public subpath or contract"
  (`code-structure.md:56-58`).
- **Every directory has an `index.ts` barrel** and imports target the directory
  (`code-structure.md:160-163`); the `imports` rule enforces it.
- **One exported thing per file**; `types.ts` and `index.ts` are the reserved stems
  (`rules/naming.mjs:11`).
- **Tests** live in `<dir>/tests/<name>.test.ts`, one step from the subject
  (`code-structure.md:112-141`). A `tests/` folder does not count toward its
  parent's 25-file cap but carries the cap itself. Test support that ships stays in
  `src/<area>/testing/`.

### Depth — the constraint most likely to be tripped

`rules/naming.mjs:26-47` fails when `file.split("/").length > 9`, does **not**
ratchet, and skips anything under a `tests/` or `e2e/` segment. Counting from the
repository root:

```text
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/context-packet.ts
   1        2     3     4           5             6     7      8         9          = 9  OK
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/<sub>/file.ts
                                                                          = 10 FAIL
```

**Therefore:** a new module may sit at `runtime/<feature>/<sub>/file.ts` (9) but
never at `runtime/<feature>/<sub>/<subsub>/file.ts` (10).
`runtime/llm/harness/`, `runtime/llm/harness-options/`, `runtime/llm/stages/` and
`runtime/flow-bootstrap/plan/` are **already at maximum depth** and can never gain a
subdirectory. They can only grow flat, up to 25 files.

The prefix rule has a matching guard (`rules/naming.mjs:112-117`): it is skipped
when creating the directory it demands would breach the depth limit. So inside
`runtime/llm/harness-options/` three `foo-*.ts` files are allowed; inside
`runtime/llm/` or a new `runtime/<feature>/` they are not.

---

## 2. Size and ratchet status of the files this work will touch

The audit printed `structure-audit: passed (170 warning(s), 361 baselined)` and, via
`--json`, `failures 0 warnings 170 suppressed 361 lowerable 0`.

**`lowerable 0` is the headline.** It means no baselined entry is currently below
its recorded value: every ratcheted file, directory and class sits *exactly* at its
frozen number.

### The service facade

| Item | Current | Baseline | Headroom |
| --- | --- | --- | --- |
| `runtime/service.ts` lines | **6,275** | 6,275 (`.structure-baseline.json:154`) | **0** |
| `AutomationStudioService` methods | **223** | 223 (`.structure-baseline.json:21`) | **0** |
| `runtime/service.ts` `failure-as-empty` | 20 | 20 | 0 |
| `runtime/service.ts` `swallowed-failure` | 6 | 6 | 0 |

History confirms the ratchet is being worked downward deliberately: 6,411 lines at
`50251fb` (2026-09-17) → 6,404 → 6,381 → 6,275 at `56d6106` (2026-09-21, "Move the
bootstrap review projection out of service.ts"). Commit `f774b43` lowered the
baseline 6405 → 6404 as part of adding a *new feature directory* — the pattern is
"new behaviour goes elsewhere, and the service shrinks".

The build loop and the run loop both currently enter through this class:
`generateFlowBootstrapAdaptation` (`runtime/service.ts:1787`),
`createFlowBootstrapAdaptation` (:2005), `reviewFlowBootstrapAdaptation` (:2093),
`runRuntimeSession` (:3038), `startRuntimeSession` (:2764),
`runFlowBootstrapLlmHarness` (:1781, private). Any new public entry point — "start a
build", "dry-run the draft", "apply an edit tool" — **cannot be a new method here**.

### `runtime/llm/` — the LLM runtime

Directory: **16 source files** (warn at 15, fail at 26). Depth 7, so it may gain a
subdirectory.

| File | Lines | Status |
| --- | --- | --- |
| `deepseek-provider.ts` | **797** | **3 lines from the 800 hard limit; no baseline entry, so 801 fails outright** |
| `execution-grants.ts` | **789** | 11 lines of headroom |
| `evidence-loop.ts` | **724** | 76 lines of headroom |
| `run-budget.ts` | 278 | fine |
| `provider-contract.ts` | 216 | fine |
| `grant-capabilities.ts` | 159 | fine |
| `runtime-session-grant.ts` | 145 | fine |
| `unusable-decision.ts` | 144 | fine |
| `run-call-record.ts` | 143 | fine |
| `failure-disposition.ts` | 123 | fine |
| `resolver-contract.ts` / `index.ts` / `diagnosis-instructions.ts` / `token-estimation.ts` / `provider-factories.ts` / `harness.ts` | 38 / 35 / 28 / 9 / 5 / 1 | fine |

Subdirectories: `harness/` **19 files** (depth 8 — max), largest `context-packet.ts`
406; `harness-options/` **9 files** (depth 8 — max); `stages/` **4 files** (depth 8 —
max); `tests/` 22 files.

Prefix hazard in `runtime/llm/`: `provider-contract` + `provider-factories` = 2,
`run-budget` + `run-call-record` = 2. **A third `provider-*.ts` or `run-*.ts` file
added flat to `runtime/llm/` fails the naming rule** (it would demand
`runtime/llm/provider/`, which is legal at depth 8).

### `runtime/recovery/` — the recovery modules

Directory: **18 source files**, depth 7. Largest: `runtime-exploration.ts` 497,
`context.ts` 470, `exploration-budget.ts` 393, `structured-diagnosis.ts` 298,
`plan.ts` 233, `stages.ts` 226, `deterministic-diagnosis.ts` 199,
`progress-guard.ts` 179, `exploration-outcome.ts` 165, `trace.ts` 158,
`adaptation-promotion.ts` 125, `locator-text.ts` 118, `llm-invocation.ts` 110,
`recovery-deadline.ts` 76, `context-summary.ts` 54, `unusable-decision.ts` 22,
`diagnosis-chain.ts` 20, `index.ts` 19. Subdirectories `annotation/` (7 files) and
`exploration-state/` (5 files), both at depth 8.

No file-lines baseline entries here — every file is under 800 and must stay there.
Prefix hazard: `exploration-budget` + `exploration-outcome` = 2; a third
`exploration-*.ts` demands `recovery/exploration/`.

### Adaptation modules

`runtime/adaptation-confidence/` 2 files. `runtime/service/adaptations/` 5 files.
`runtime/flow-bootstrap/adaptation.ts`. `storage/project/adaptation-store.ts` is
**769 lines** (31 from the limit) and its class
`AutomationStudioProjectAdaptationStore` has **28 methods** (warn; 12 from the
40-method failure).

### Flow resource / repository layer

| File | Lines | Notes |
| --- | --- | --- |
| `storage/project/flow-resource-repository.ts` | **554** | class `AutomationStudioProjectFlowResourceRepository` **29 methods** (warn at 25, fail at 40) |
| `storage/project/flow-resource-mutations.ts` | 109 | |
| `storage/project/graph-store.ts` | 440 | owns `AutomationStudioGraphPatchOperation` (:21-29) and `applyPatch` (:121) |
| `storage/project/adaptation-store.ts` | 769 | |
| `storage/project/compiled-plan-store.ts` | 397 | |
| `runtime/service/flows/store.ts` | **607** | |
| `runtime/service/flows/writer.ts` | 386 | `AutomationStudioFlowWriter` — the one place a Flow document is written |
| `runtime/service/flows/mutations.ts` | 248 | `swallowed-failure` baselined at 6 (at its entry) |
| `runtime/service/flows/graph-patch.ts` | 97 | `AutomationStudioFlowGraphPatch.applyFlowGraphPatch` |
| `runtime/service/flows/subflow-migration.ts` | 162 | |
| `runtime/service/flows/mapping.ts` | 157 | 9 exported values (warn) |
| `runtime/service/flows/canonical-document.ts` | 20 | |

`storage/project/` holds **22 source files** — 3 below the hard cap of 25, no
baseline entry, depth 7.

### Directory headroom, at a glance

| Directory | Files | Cap | Headroom | Depth (max 8 dirs) |
| --- | --- | --- | --- | --- |
| `automation-studio/model` | **28** | 25, **baselined at 28** | **0 — a 29th file fails** | 6 |
| `runtime/tests` | **25** | 25 | **0 — a 26th file fails** | 7 |
| `runtime/` (flat) | 24 | 25 | 1 | 6 |
| `runtime/flow-bootstrap/plan` | 20 | 25 | 5 | 8 — **cannot nest** |
| `runtime/executor` | 20 | 25 | 5 | 7 |
| `runtime/llm/harness` | 19 | 25 | 6 | 8 — **cannot nest** |
| `runtime/recovery` | 18 | 25 | 7 | 7 |
| `runtime/llm` | 16 | 25 | 9 | 7 |
| `runtime/service` | 14 | 25 | 11 | 7 |
| `storage/project` | 22 | 25 | 3 | 7 |
| `runtime/flow-bootstrap/authoring` | 13 | 25 | 12 | 8 — **cannot nest** |
| `runtime/llm/harness-options` | 9 | 25 | 16 | 8 — **cannot nest** |
| `runtime/flow-bootstrap` | 7 | 25 | 18 | 7 |
| `runtime/llm/stages` | 4 | 25 | 21 | 8 — **cannot nest** |

---

## 3. What is already at or over budget — new behaviour must go elsewhere

Four hard stops, all confirmed by `lowerable 0`:

1. **`runtime/service.ts` — 6,275 lines, baseline 6,275.** One added line fails
   `pnpm check`. New build/dry-run/ladder behaviour must not be written here. If the
   service must learn a new entry point at all, an equal or larger amount of
   existing code has to move out in the same change — which is exactly what
   `56d6106` and `f774b43` did.
2. **`AutomationStudioService` — 223 methods, baseline 223.** No new public or
   private method. A new capability reaches the outside world through
   `runtime/index.ts` and its own feature barrel, or by replacing a method.
3. **`packages/.../automation-studio/model/` — 28 files, baseline 28.** New Flow
   document types (a draft document, an edit operation, a dry-run verdict) **cannot
   be a new file directly in `model/`**. They go in a new `model/<feature>/`
   subdirectory (a subdirectory is not a file and does not count) or, better, in the
   runtime feature that owns them.
4. **`runtime/tests/` — 25 files, cap 25.** A new cross-layer test cannot be added
   here. Tests for new work belong in the new feature's own `tests/` folder.

Two near-misses worth naming in the plan:

- **`runtime/llm/deepseek-provider.ts` — 797 lines of 800.** Three lines. Any change
  to the provider transport for a new task kind must be net-neutral or move code
  out. `execution-grants.ts` at 789 has eleven.
- **`AutomationStudioProjectFlowResourceRepository` (29 methods) and
  `AutomationStudioProjectAdaptationStore` (28)** are past the advisory threshold.
  They will not fail before 40, but a draft-persistence feature that adds a dozen
  methods to either would.

---

## 4. How a new feature directory is introduced — a worked example from history

### `runtime/action-permissions/`, commit `f774b43`, 2026-09-18

"Ask the user for permission instead of refusing, and let their instruction grant
it" (Task t018, Worker `perm-request`). `git show --stat f774b43` shows the shape.

```text
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/
  index.ts          (8)    barrel, with a comment naming each export's job
  consequences.ts   (104)  the consequences an action can have
  declaration.ts    (107)  what a node declares about its consequences
  gate.ts           (214)  the gate that answers a check for a run
  instructed.ts     (157)  reading permission out of the user's instruction
  request.ts        (185)  the request a run carries out to a person
  tests/
    gate.test.ts
    instructed.test.ts
  client/
    index.ts        (5)    curated browser-safe re-export surface
    tests/
      index.test.ts
```

Six source files, none over 800, none sharing a three-way prefix, all at depth 7
(files at 8), tests one step down, one barrel. The barrel's header comment names the
feature in a sentence — the house style, matched by `runtime/recovery/index.ts`,
`runtime/flow-bootstrap/index.ts`, and `runtime/flow-bootstrap/authoring/index.ts`,
which explicitly lists the files it deliberately does *not* publish and why.

What else the same commit had to touch, and this is the checklist for any new
feature:

- **`runtime/index.ts` +1 line** — `export * from "./action-permissions/index.ts";`
  is how the layer barrel publishes it. (`runtime/index.ts` currently has 26 such
  lines; note it deliberately does **not** export `loop-limits/`, which stays
  internal.)
- **Adapters inside the feature that consumes it**, not beside the new code:
  `runtime/flow-bootstrap/action-permissions.ts` (86 lines new) is the bootstrap
  lane's adapter, placed in `flow-bootstrap/`, not in `action-permissions/`. This is
  "never extract-and-drop" applied in the other direction.
- **API contracts** in `api/contracts/*.ts` and handlers in `api/handlers/*.ts`.
- **Tests beside each touched subject**, e.g.
  `runtime/llm/tests/execution-grant-permissions.test.ts`,
  `runtime/recovery/tests/runtime-exploration-permission.test.ts`.
- **`.structure-baseline.json` changed by exactly one line — a *lowering***
  (`service.ts` 6405 → 6404). A correctly added feature lowers the baseline or
  leaves it alone; it never raises it.
- A **public subpath** only when the surface genuinely needs one.
  `packages/fluxiq/package.json` gained `"./automation-studio/action-permissions"`
  pointing at `runtime/action-permissions/client/index.d.ts` — a five-line curated
  barrel, not the whole feature. Its header says why: "Keep this surface narrow: it
  deliberately excludes the runtime gate, declaration and instruction authority
  modules used to decide permissions on the server."

A second, same-shaped example one day earlier: `runtime/result-verification/`
(`50251fb`, 2026-09-17) — `contracts.ts`, `core-observation.ts`, `result-summary.ts`,
`run-outcome.ts`, `verdict.ts`, `verify.ts`, `verification-status.ts`,
`agreement.ts`, `index.ts`, plus `tests/` with one test per subject, plus one line in
`runtime/index.ts`.

---

## 5. Rules that would forbid or constrain the obvious implementation

### 5.1 The service facade is closed. This is the binding one.

Restated because it governs everything: `runtime/service.ts` and
`AutomationStudioService` are both at their exact ratchet. The obvious
implementation — "add `startFlowBuild`, `applyDraftEdit`, `dryRunDraft`,
`runRecoveryLadder` to the service" — fails `pnpm check` on the first added line.

Additionally, `runtime/service/` is a **facade directory**, so the non-ratcheting
`facade-dispatch` rule applies (`rules/facade-dispatch.mjs`): a collaborator under
`runtime/service/` may not call a public method of `runtime/service.ts` through a
collaborator field. It must go through `AutomationStudioFacadePorts`
(`runtime/service/facade-ports.ts:31`), whose header explains why: a caller may
subclass the service or replace a method on an instance, and routing straight at the
owning collaborator silently ignores the override. **If the build loop's new
collaborators live under `runtime/service/`, every call back into a public service
method must be added to `AutomationStudioFacadePorts` first.** That is a real cost,
and it is an argument for putting the new work in `runtime/<feature>/` rather than
`runtime/service/<feature>/`.

### 5.2 There is no unsaved-draft concept in Core today

Searching `runtime/`, `model/` and `storage/` for "draft" outside tests returns only:
a SQL column `status` with a `'draft'` value (`storage/project/graph-store.ts:47`,
`flow-resource-repository.ts` record type), and a document-id suffix `@draft` used
for an unversioned Flow (`runtime/composite-executor.ts:86`,
`runtime/service.ts:5881`, `model/composites.ts:135`).

Consequences for "a build loop that accrues a draft Flow as a model acts":

- A **persisted** draft is a Flow with `status: 'draft'`, and it must be written
  through `AutomationStudioFlowWriter` (`runtime/service/flows/writer.ts`), which is
  described in its own header as owning "writing a Flow document and everything
  derived from it: its representation checks, the generated source file and config
  artifact, the summary index entries, and the project change feed". A second writer
  would be exactly the duplication that file exists to prevent. Note the writer
  already enforces optimistic concurrency with a message about drafts:
  `FLOW_SAVE_CONFLICT: Flow changed after this draft began` (`writer.ts:92`).
- An **in-memory** draft is a runtime value. The layer table
  (`code-structure.md:47-53`) says `runtime/` must not own storage formats, so an
  in-memory draft may be a runtime type but its serialisation belongs in `model/` or
  `storage/` — and `model/` is at its 28-file ratchet, so it would need
  `model/<feature>/`.
- Incremental edits already have a vocabulary:
  `AutomationStudioGraphPatchOperation` (`storage/project/graph-store.ts:21-29`) —
  `add_node`, `move_node`, `set_node_parameters`, `set_node_metadata`,
  `delete_node`, `add_edge`, `delete_edge` — applied idempotently with inverse
  operations and conflict detection by `applyPatch` (`graph-store.ts:121`) and
  surfaced by `AutomationStudioFlowGraphPatch`
  (`runtime/service/flows/graph-patch.ts`). **Inventing a second edit vocabulary for
  the model's edit tools would be a review failure even though no audit rule catches
  it.** The edit tools should emit graph patch operations.

### 5.3 A new tool surface must go through the existing registry

`runtime/llm/harness-options/registry.ts:1-18` is explicit: "The registry of harness
options: what the exploration loop is allowed to do, and who is allowed to add to
it… Before it, one mutable slot held one domain's tools, with no domain id, no merge
and no gate." Core already ships six read-only built-ins
(`harness-options/builtin.ts:27-33`): `core.flow_graph`, `core.node_detail`,
`core.node_catalog`, `core.state_snapshot`, `core.state_diff`,
`core.prior_adaptations`. Its header says they are "the neutral set… each is
expressible with no page, selector, tab or browser anywhere in it."

Constraints that follow for draft-edit tools and a dry-run tool:

- They are **`core.*` unscoped options in Core's own bundle**, declared in
  `harness-options/builtin.ts` (211 lines today) or a sibling module in that
  directory (9 files, no nesting possible at depth 8). A domain bundle "may only
  declare domain-scoped options and Core's may only declare unscoped ones", and a
  duplicate id throws (`harness-options/option.ts:86-94`).
- The registry caps the whole set: `AUTOMATION_STUDIO_HARNESS_OPTION_LIMIT = 32`
  (`harness-options/option.ts:23`), across every domain and stage. Six are Core's
  today. A large new tool family eats a shared budget the web-extension domain also
  draws on — this needs to be counted in the plan.
- Every mutating option must call
  `AutomationStudioHarnessOptionExecution.permission` before acting
  (`option.ts:71-79`): "An option whose action would move money, delete, send or
  publish, change what already exists or create something new calls this first… An
  option that only looks never calls it." An edit-the-draft tool **creates or
  modifies** something, so on the letter of this contract it is a
  permission-checked option unless the plan argues the draft is not "what already
  exists". Decide this explicitly rather than by omission.
- Instructions for a stage go through `runtime/llm/stages/registry.ts`, capped at
  `AUTOMATION_STUDIO_LOOP_STAGE_INSTRUCTION_LIMIT = 40`, with a domain able to
  `extend` or `replace` a stage's instructions but never reorder
  (`stages/registry.ts:1-16`, :31). "There is deliberately no second prompt
  channel." A new authoring protocol must be expressed as stage instructions, not as
  a parallel prompt path.

### 5.4 The import boundary between `llm/` and `recovery/` is absolute

`scripts/structure-audit/config.mjs:40-52`: files under `runtime/llm/` must not
import a **value** out of `runtime/recovery/` (`valueOnly: true`, so `import type` is
allowed). The reason recorded there is not stylistic: "twice in one day a
`runtime/recovery/` module read a `runtime/llm/` constant during module evaluation
and got `undefined` with a completely clean type check, once silently emptying an
opaque handle's `pattern`, `maxLength` and `maxProperties` out of the JSON schema
actually sent to the provider."

This rule **does not ratchet**. The config even prescribes the remedy: "Import the
type if that is what you need, call the value from the coordinator that already owns
both sides, or move the shared value into `runtime/loop-limits/`, which neither
directory owns." `runtime/loop-limits/` (4 files) exists for exactly this and is
deliberately *not* exported from `runtime/index.ts`.

**Planning consequence:** if the recovery ladder lives in `runtime/recovery/` and the
edit tools live in `runtime/llm/harness-options/`, any constant, limit or predicate
both need goes in `runtime/loop-limits/` or in a new neutral directory — never
imported across the edge. If the new build loop becomes a third participant, consider
adding an `importBoundaries` entry for it in the same commit, so the cycle is refused
rather than discovered later.

### 5.5 A model-free dry run inside a build contradicts a documented boundary

`docs/architecture/automation-studio/llm-flow-bootstrap.md:432-434`: "The evidence
loop is an authoring-time information-gathering boundary, **not a runtime executor
for the workflow being authored**… Tools are used only to resolve information missing
from that candidate, with observation preferred over mutation… filling, selecting,
submitting, or otherwise performing eventual workflow steps is not evidence
collection merely because an action tool is available."

And `llm-flow-bootstrap.md:160-164`: "The validated plan is the only input accepted by
the dedicated Bootstrap Adaptation lifecycle. Provider execution grants, UI controls,
and same-run execution remain separate concerns and **must consume this boundary
rather than bypass it**."

This is authored architecture, not an audit rule, so nothing will fail the build —
which makes it more dangerous, not less. The planned work explicitly puts a dry run
*inside* a build. That is a deliberate change to a documented boundary and must be
written up as one, in `docs/architecture/automation-studio/llm-flow-bootstrap.md`, in
the same work unit (`AGENTS.md:207-219` makes documentation required work for a
change to "Automation Studio architecture or model").

The mechanism itself is already available and does not need inventing:
`runAutomationStudioGraph(flow, options)` (`runtime/executor/graph-run.ts:53`) is a
plain async function exported from `runtime/executor/index.ts`, and
`options.allowLlmDiagnosis !== false` is the flag that admits the model rung
(`runtime/executor/recovery-ladder.ts:55`). A model-free dry run is
`runAutomationStudioGraph(draft, { ...opts, allowLlmDiagnosis: false })` — it does not
require a new executor, and it does not require going through
`AutomationStudioService.runRuntimeSession`.

### 5.6 An ordered recovery ladder already exists — twice

- `runtime/executor/recovery-ladder.ts` (79 lines) — `chooseAutomationStudioRecovery`
  builds priority-ordered candidates: `deterministic_path` (1) →
  `approved_runtime_patch` (2) → `reroute` (3) → `llm_diagnosis` (4), sorted and the
  first selected, with budget exhaustion removing rungs.
- `runtime/recovery/` — `deterministic-diagnosis.ts`, `llm-invocation.ts` (the gate
  that decides whether to spend a call), `diagnosis-chain.ts` (the patch call runs
  only if the diagnosis succeeded), `plan.ts`, `stages.ts`, `trace.ts`.

A *new* ordered ladder that runs deterministic checks before consulting a model would
be a third statement of the same ordering. `runtime/recovery/stages.ts:1-8` warns
against exactly this: "One place, so a run annotated from the deterministic early
return and a run annotated after a full patch attempt cannot describe themselves in
two different ways." Extend one of these; do not add a third.

### 5.7 Domain neutrality — no web words in Core names

`rules/web-vocabulary.mjs` fails on a **name** under `packages/` whose words state a
web or DOM concept: `dom, css, query selector, xpath, iframe, cookie, browser, tab,
click, scroll, inner html, outer html, tag name, class name, aria, shadow root, user
agent`, plus `selector` when it is the whole name (`web-vocabulary.mjs:117-124`).
Comments and non-key strings are not read; tests are skipped. Seven files are
baselined, none of them in the directories this work touches.

A dry run and edit tools are precisely where a web word leaks in ("click the button",
"the tab under test"). Names must stay in Core's vocabulary — `element`, `frame`,
`document`, `window`, `viewport`, `screenshot`, `url` are all explicitly **allowed**
(`web-vocabulary.mjs:78-90`) because Core already owns them.

### 5.8 Failure handling in every new file

`failure-as-empty` and `swallowed-failure` apply to all non-test source, ratchet per
file, and `--update` never adds an entry — so **a new file gets zero allowance**. No
`.catch(() => [])`, no `catch { return null; }`, no `.catch(() => undefined)`, no
empty `catch {}`. Where losing a failure really is acceptable, the escape is a
`/* best-effort: <reason> */` comment of three words or more inside the handler
(`code-structure.md:229-242`). A dry run that swallows an execution error and reports
"the draft is fine" is the exact failure mode these two rules exist to prevent.

### 5.9 `contract-spread` does not yet cover the new work — and possibly should

`config.mjs:66-94` configures two paths: `runtime/service/datasets` and
`runtime/action-permissions`. The comment says a path is configured "only once it is
clean", the finding is ratcheted, and `--update` never adds an entry. If a dry-run
verdict or a permission-shaped escalation is built for an external contract, adding
its directory to `contractSpreadPaths` in the same commit is the cheap, mechanical
way to keep it honest.

---

## Where the new work should live

Four proposals, each justified by the rules above. All four keep `service.ts` and
`AutomationStudioService` untouched, sit at depth 7 (files at 8, leaving one level of
nesting in hand), and publish through `runtime/index.ts`.

### A. The draft Flow — `runtime/flow-draft/`

```text
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/
  index.ts          barrel, with a header naming each export's job
  document.ts       the accruing draft value and its invariants
  revision.ts       how one edit advances it; base-revision checks
  materialise.ts    draft -> AutomationStudioFlowArtifact, for save or dry run
  issues.ts         what is not yet valid about the draft
  tests/
```

Why here. It is a genuinely separate capability with its own contract, which is the
condition `code-structure.md:56-58` sets for a capability area under a layer. It is
`runtime/` rather than `model/` because `model/` is at its 28-file ratchet and because
the draft is orchestration state, not a document type. It is **not** under
`runtime/service/` so it escapes the `facade-dispatch` obligation. Persisting a draft
still goes through `AutomationStudioFlowWriter`; this directory produces the artifact,
it does not write files. Keep the filenames prefix-free — three `draft-*.ts` files at
depth 7 would trip the naming rule.

### B. The edit tools — Core built-ins in `runtime/llm/harness-options/`, mechanics in `runtime/flow-draft/`

```text
runtime/llm/harness-options/
  builtin-edits.ts     declarations + implementations for core.draft_* options
  (registered through the existing registry; ids beside core.flow_graph etc.)
```

Why here. `harness-options/registry.ts` is, by its own header, the one place that
decides "what the exploration loop is allowed to do, and who is allowed to add to it",
and `builtin.ts` is where Core's unscoped options live. A second tool channel would be
the duplication the registry was built to end. The directory is at depth 8, so **no
subdirectory is possible** — this must be one or a few flat files (9 files today, 16
of headroom, and the prefix rule does not apply at that depth).

The *mechanics* of an edit — validating it, applying it to the draft, producing the
inverse — belong in `runtime/flow-draft/`, not in `harness-options/`, so that the
option implementation stays a thin adapter. Edits should be expressed as
`AutomationStudioGraphPatchOperation` values so that persisting a finished draft
reuses `AutomationStudioFlowGraphPatch`. Budget check: the registry caps the whole set
at 32 options and Core already declares 6.

Watch the import boundary: nothing under `runtime/llm/` may import a **value** from
`runtime/recovery/`. If an edit tool and the ladder need a shared constant, it goes in
`runtime/loop-limits/`.

### C. The model-free dry run — `runtime/draft-rehearsal/`

```text
packages/fluxiq/src/programs/automation-studio/runtime/draft-rehearsal/
  index.ts
  rehearse.ts       runs a materialised draft with allowLlmDiagnosis: false
  outcome.ts        the verdict a build reads back
  budget.ts         deadline and step bounds for a rehearsal
  tests/
```

Why a separate directory rather than a method on the service or a file in
`runtime/executor/`. `runtime/executor/` owns *how a graph runs*; this owns *when a
build rehearses one and what it concludes*, which is a different responsibility and
would be extract-and-drop if dropped beside `graph-run.ts`. It calls
`runAutomationStudioGraph` through `runtime/executor/index.ts` (barrel import, as the
`imports` rule requires) with `allowLlmDiagnosis: false`, which
`runtime/executor/recovery-ladder.ts:55` already honours — so no executor change is
needed.

A neutral name matters here: "dry run" is fine, but avoid anything that reads as a
browser action. Note `runtime/service.ts:912` already uses `mode: "dry_run"` for a
different subject (`repairRecordingStateIndex`), so pick a name that does not collide
— `rehearsal` is suggested for that reason.

**This directory is where the documented boundary changes**, so
`docs/architecture/automation-studio/llm-flow-bootstrap.md` must be updated in the
same work unit to say that a build may now rehearse its own draft, and under what
bounds.

### D. The recovery ladder — extend `runtime/recovery/`, do not create a peer

Add the new deterministic rungs as files in `runtime/recovery/` (18 files, 7 of
headroom, depth 7 so it can still nest), and express the *order* in the one place that
already states it. Two candidate homes for the ordering, and the plan should pick one
and say so:

- `runtime/executor/recovery-ladder.ts` — the priority-ordered candidate list a run
  consults (`deterministic_path` 1 → `approved_runtime_patch` 2 → `reroute` 3 →
  `llm_diagnosis` 4). New deterministic rungs slot in below 4.
- `runtime/recovery/llm-invocation.ts` + `deterministic-diagnosis.ts` — the gate that
  decides whether a model call is spent at all.

If the ladder grows beyond seven files, promote it to `runtime/recovery/ladder/`
(depth 8 — legal, files at 9), which is also what the prefix rule would demand the
moment three `ladder-*.ts` files appear. Do **not** create a third statement of the
ordering: `runtime/recovery/stages.ts:1-8` exists to stop exactly that.

### Cross-cutting, for whoever writes the phase plan

1. Every new directory gets an `index.ts` barrel with a header comment naming what it
   holds, and one line in `runtime/index.ts`.
2. Every new file's test goes in that directory's own `tests/`. **Not**
   `runtime/tests/`, which is full at 25.
3. New Flow document types go in a `model/<feature>/` subdirectory, never flat in
   `model/`, which is at its 28-file ratchet.
4. No new file may exceed 800 lines, and nothing may be added to
   `runtime/service.ts` or `deepseek-provider.ts` (797/800) without removing more.
5. Import through barrels; a new barrel-skipping import fails outright.
6. No `catch {}`, no `.catch(() => [])`, no `.catch(() => undefined)` in any new file,
   without a three-word `/* best-effort: … */` reason.
7. No web or DOM word in any new *name* under `packages/`.
8. Run `node scripts/structure-audit.mjs` before `pnpm check`; it is the first gate
   and prints the precise violation.
9. `.structure-baseline.json` may be **lowered** by this work. It must never be
   raised, and `pnpm structure:baseline` refuses to raise one.

---

## Commands run and observed results

| Command | Observed result |
| --- | --- |
| `node scripts/structure-audit.mjs` (in `F:\!FluxIQ`) | `structure-audit: passed (170 warning(s), 361 baselined).` Exit 0. No `FAIL` lines, no "can be lowered" line. |
| `node scripts/structure-audit.mjs --json` | `failures 0 warnings 170 suppressed 361 lowerable 0` |
| `git log --oneline -15` | HEAD `71e2798 Merge task t048: service-headroom`, branch `dev`, clean working tree |
| `git log --diff-filter=A -1 -- .../runtime/action-permissions/index.ts` | `f774b43 2026-09-18 Ask the user for permission instead of refusing…` |
| `git show --stat f774b43` | 30 files; new feature directory; `.structure-baseline.json` changed by one line, a lowering 6405 → 6404 |
| `git show --stat 50251fb` | 42 files, +1840/−78; new `runtime/result-verification/` with one test per subject |
| `wc -l` over the named files | All line counts in sections 2 and 3 |
| `ls -1 <dir>/*.ts \| wc -l` per directory | All file counts in section 2 |

## Not verified

- I did not run `pnpm check`, `pnpm test` or `pnpm build` — only the structure audit,
  which is the first step of `pnpm check`. Type checks and tests were not exercised.
- I did not attempt a trial edit to confirm empirically that adding a line to
  `service.ts` fails. The conclusion is read off `baseline.mjs:52-58` (`finding.value >
  recorded` → failure) plus the measured equality of value and baseline.
- I did not analyse runtime or LLM behaviour, provider transport, prompt content, or
  how the build loop actually works — the brief assigns those to other workers. Where
  I cite `llm-flow-bootstrap.md`, it is as a *documented constraint*, not as an
  analysis of the loop.
- Whether the web-extension repository's mirrored `scripts/structure-audit/` differs
  in any rule was not checked; `config.mjs:1-4` states the config file is the only
  file that differs, but I read only Core's copy.
- The exact set of `harness-options` currently registered at runtime by the downstream
  domain (and therefore how much of the 32-option budget is already spent in practice)
  was not measured — only Core's six built-ins were counted.

## Open questions or contradictions found

1. **`code-structure.md:169-171` says the 40-method class limit "warns".** It does
   not: `rules/class-methods.mjs:47-53` fails above 40 and warns between 26 and 40.
   The doc should be corrected; the plan should assume failure.
2. **`AGENTS.md:187-193` says "path depth (8 segments)"** while
   `context.mjs:57` sets `maxPathSegments: 9` and `rules/naming.mjs:42` fails above 9.
   The enforced number is 9 path parts counted from the repository root (8 directory
   levels plus the filename). `code-structure.md:104-106` calls the seven-directory
   example "seven path segments", which matches neither. Worth fixing so the plan's
   depth arguments are not second-guessed.
3. **The dry-run-inside-a-build contradiction (5.5) is unresolved architecture, not a
   detail.** `llm-flow-bootstrap.md` currently states the opposite of what this work
   will do. Someone has to decide whether the build's rehearsal is an exception to
   that boundary or a replacement of it, and write the answer into that document.
4. **Is the accruing draft "what already exists" for permission purposes?** If yes,
   every edit tool is a permission-gated mutating option (`option.ts:71-79`) and a
   build could stall asking a person to approve its own scratch work. If no, the plan
   must say so in the option declarations. This is a design decision the structure
   rules surface but do not settle.
5. **Three ordering statements risk.** `runtime/executor/recovery-ladder.ts` and
   `runtime/recovery/` already state the deterministic-before-model ordering in two
   places that serve different consumers. Adding a third for the build lane would be
   the exact duplication `runtime/recovery/stages.ts:1-8` argues against. Decide which
   of the two existing statements the build lane reuses.
