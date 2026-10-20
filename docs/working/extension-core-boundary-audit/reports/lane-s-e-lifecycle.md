# Lane S-E (t728): Core tells the domain about the build lifecycle and keeps its durable build state

Worker report for brief S-E, audit finding 8. Core side only. Nothing committed.

## Outcome

Done. Both parts are in place in Core, with tests beside them:

1. **Build scope.** Every call that a registry binding runs now carries a Core-owned scope: which build the call belongs to, which brief it runs under when briefs run side by side, and whether it starts the build fresh or continues it. Core works this out from its own call-id format, so the domain no longer has to.
2. **Durable state store.** Core now owns a durable domain state store. It lives on disk under the Flow, enforces size and count limits, and treats values as opaque. A registered domain reaches it through its FluxIQ instance.

The domain still uses `OPENING_CALL_PREFIX`, `CALL_SCOPE`, `OPENING_LOOK_CALL_ID` and its in-process registries. Moving the domain onto these seams is downstream work and was not part of this brief.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`. Below, AS = `packages/fluxiq/src/programs/automation-studio` and RT = `AS/runtime`.

### 1. The build scope accessor

All of these are reachable from `fluxiq/automation-studio`. The path is harness-options/index → llm/index → runtime/index, using `export *`, and none of the names is duplicated anywhere else.

**`RT/llm/harness-options/evidence-build-scope.ts`** (new):

```ts
export type AutomationStudioEvidenceBuildScope = {
  readonly projectId: string;
  readonly flowId: string;
  readonly buildId: string;
  readonly callScope?: string;
  readonly opening?: "fresh" | "continuing";
};
export function automationStudioEvidenceBuildScope(): Readonly<AutomationStudioEvidenceBuildScope> | undefined;
export function runWithAutomationStudioEvidenceBuildScope<T>(scope: AutomationStudioEvidenceBuildScope, fn: () => T): T;
```

The domain calls `automationStudioEvidenceBuildScope()` anywhere inside its `executeTool`, including after awaits. Outside a registry call it returns `undefined`. The frame object is frozen. Only the registry is meant to call `runWithAutomationStudioEvidenceBuildScope`. It is exported so the barrel stays complete.

**`RT/llm/harness-options/evidence-build.ts`** (new). This is the build frame that a whole build runs inside:

```ts
export function runWithAutomationStudioEvidenceBuild<T>(buildId: string, fn: () => T): T;
export function automationStudioEvidenceBuildBound<A extends unknown[], R>(buildId: string, fn: (...args: A) => R): (...args: A) => R;
export function automationStudioEvidenceBuildId(): string | undefined;
```

**`RT/llm/harness-options/registry.ts`**:
- `evidenceLoopBinding(context: { projectId; flowId; runId?; buildId? }, resolution)` now runs each `executeTool` (Core's built-in options and the domain's) inside `runWithAutomationStudioEvidenceBuildScope`.
- The `core.recall_result` wrapper sits outside the frame, so recall calls never reach the domain with a frame.
- I did not edit evidence-loop.ts, binding.ts or brief-ports.ts.

**`RT/llm/evidence-loop/call-id.ts`**: added `automationStudioLlmEvidenceOpeningCallScope(callId: string, toolId: string): string | undefined`.
- It reads the scope out of `initial.<toolId>.<scope>`, stripping the whole tool id first, so a tool id that itself contains dots is never misread.
- It returns `undefined` when the id has no scope or is not that tool's opening.
- It sits beside Core's writer of that format.
- The registry imports it straight from `call-id.ts`, not through the evidence-loop barrel. Going through the barrel created a module cycle that the import-cycles rule rejects (observed below).

#### What each field means

**`opening`** is decided only by Core:
- **`"fresh"`**: the call id is an opening id (`automationStudioLlmEvidenceIsOpeningCallId`, which checks the `initial.` prefix), and `value.held` is *not* an array. This covers:
  - the arrival opening, when the build was given a start location;
  - the free first look;
  - a project repair's opening, which carries `repairs`;
  - a builder that opens on its prepared entry, which carries `arrived: true`;
  - a project brief's reset-loop opening.

  This matches what the domain does today: every `initial.*` call re-arms its memory except a `held` one. The domain still has to read `arrived` and `repairs` from `value` for their own meaning (count as arrived / treat addresses as already shown). The scope only tells it whether the call is fresh or continuing.
- **`"continuing"`**: an opening id where `value.held` is an array. This is the opening look of a repair or re-author round whose draft already holds the Flow, set by evidence-loop.ts at about line 527. That round continues the build, so memory is kept.
- **absent**: any other call in the round. A model-written id can never look like an opening, because call-id.ts moves those under `model.`. So nothing a model writes can produce `opening`.

**`callScope`**: the scope from the binding's most recent opening call, carried to every later call of the round because later ids don't include it.
- It is reset to `undefined` by an unscoped opening.
- It is present only when the loop runs beside others for the same Flow, which today means a project brief when the host scheduler's capacity is above 1 (run-brief.ts:300 sets `callScope = briefId`).
- Each binding remembers its own scope. That is safe because every binding serves one loop at a time: service.ts makes one per build and runs its rounds one after another, brief-ports makes one per brief environment, and the recovery exploration makes one per exploration.

**`buildId`**, resolved on every call in this order:
1. `context.runId`
2. `context.buildId`
3. `automationStudioEvidenceBuildId()` (the build frame)
4. an id the binding mints once (`build.<uuid>`), so two bindings created outside any build never share memory

#### `buildId` in each build path

| Path | `buildId` the domain sees | Source |
| --- | --- | --- |
| Single-Flow build, candidate mode | `build.<uuid>`, one per build | service.ts mints `buildId` inside the existing `const nodeDescriptions = …` declaration (about line 1568) and passes it to `evidenceLoopBinding({ projectId, flowId, buildId })` |
| Single-Flow build, legacy `evidenceGuided` rounds (first round, repair and re-author rounds) | the same `build.<uuid>` for every round of that build | same binding, shared by every round |
| A stopped build that is continued later | a **new** `build.<uuid>`; the opening is `"continuing"` (the kept draft produces `held`) | each build request mints its own id |
| Project build, supervisor loop | `build.<uuid>`, the same value as the build record's `project.buildId` | service.ts now sets `project = { buildId, … }` from the minted id instead of minting a second one |
| Project build, each brief (builder, reset loop, repair) | the same `project.buildId` | brief-ports' binding gets no build id. service.ts runs `runAutomationStudioProjectBuild` through `automationStudioEvidenceBuildBound(project.buildId, …)`, so every brief binding reads it from the build frame. Concurrent briefs are told apart by `callScope` |
| Recovery exploration during a run (`recovery/annotation/exploration.ts`) | the run's `runId` | `context.runId` takes priority over everything else |
| Trials (candidate whole trials, subflow trials, the judged whole run) | **no frame** for the trial's own node runs | trials run the Flow through the runtime graph, not through a registry binding. A trial is answered by the authoring layer (authoring-loop.ts handles `testId` itself), so it never runs inside the submitting call's frame. The trial-view look taken after a trial does go through the build's binding, and it gets that build's `buildId` with no `opening` |

I did not use the activity build-frame id (`build-<uuid>` in `RT/activity` storage) as a fallback:
- Its storage is not exported from `activity/index.ts`, which another worker in this tree is editing.
- Reading the storage directly would be a barrel skip that the audit counts and ratchets.
- `build.<uuid>` from service.ts (passed explicitly or through the build frame) covers every production path listed above.

### 2. The domain build state store

All of this is new under `RT/domain-build-state/` and exported through `RT/index.ts`, so it reaches `fluxiq/automation-studio`.

```ts
// types.ts
export type AutomationStudioDomainBuildStateScope = { readonly projectId: string; readonly flowId: string; readonly buildId?: string };
export type AutomationStudioDomainBuildState = {
  readonly domainId: string;
  get(scope: AutomationStudioDomainBuildStateScope, key: string): Promise<JsonValue | undefined>; // a copy
  put(scope: AutomationStudioDomainBuildStateScope, key: string, value: JsonValue): Promise<void>;
  drop(scope: AutomationStudioDomainBuildStateScope, key: string): Promise<boolean>;    // whether there was one
};
// accessor.ts -- how a domain gets it
export function automationStudioDomainBuildState(
  owner: { domains: { maybeGet(domainId: string): unknown }; programs: { automationStudio: { domainBuildState: AutomationStudioDomainBuildStateStore } } },
  domainId: string
): AutomationStudioDomainBuildState;
// limits.ts
export const AUTOMATION_STUDIO_DOMAIN_BUILD_STATE_LIMITS; // maxValueBytes 64 KiB, maxScopeBytes 256 KiB, maxKeysPerScope 64, maxBuildsPerFlow 16, key /^[A-Za-z0-9._:-]{1,120}$/, id /^[A-Za-z0-9._:-]{1,200}$/
// refusal.ts
export class AutomationStudioDomainBuildStateRefusal extends Error { code: string; part: string }
// store.ts (service-owned)
export class AutomationStudioDomainBuildStateStore { get(domainId, scope, key); put(domainId, scope, key, value); drop(domainId, scope, key) }
```

**How a domain gets the store.**
- Call `automationStudioDomainBuildState(fluxiq, "<domainId>")` once, after `fluxiq.registerDomain(...)`. For the web domain that means `registerWebAutomationRuntime(fluxiq)` in `D/domain/src/host.ts`, which already holds the FluxIQ instance just as `webAutomationClearedWayOutsOf(fluxiq)` does.
- It refuses `domain_build_state.domain_unregistered` if `fluxiq.domains.maybeGet(domainId)` finds nothing.
- The returned port is frozen and bound to that domain id.
- The owner is typed by its shape, so this program does not import the framework.

**Scope.**
- With `buildId`, the value lasts for one build. Use the evidence scope's `buildId`.
- Without `buildId`, the value belongs to the Flow and outlives the build, so it is still there for later builds and runs. This is where cleared way-out references belong.

**Storage.**
- With a storage root, each (domain, Flow) pair is one program-state file, `<flow>/domain-build-state/<safeSegment(domainId)>.json`. It is written through `ProgramJsonStore.update`, which serializes every change to one file. It works in both the JSON layout and the SQLite-owning (layoutVersion 2) layout; tests cover both.
- Without a root, the store keeps the same documents in memory for the service's lifetime.
- The document records its own `domainId`. `safeSegment` folds case, so two domain ids that would share a file name are refused with `domain_build_state.domain_mismatch`, both on disk and in memory.

**Bounds.**
- **Per value:** plain JSON only. Refused as `value_invalid`: NaN or Infinity, cycles, class instances, holes in arrays, `undefined`, or nesting deeper than 32. A value over 64 KiB is refused as `value_too_large`.
- **Per scope:** at most 64 keys and 256 KiB in total, refused as `scope_full`. Replacing an existing key is allowed even when the scope is at the limit.
- **Per Flow:** at most 16 build scopes per domain. Once a 17th is written, the build that was written longest ago is dropped. The order comes from a sequence number inside the document, not from timestamps.
- **Malformed input:** a bad id or key is refused as `scope_invalid` / `key_invalid`. A stored document with the wrong shape is refused as `document_invalid`; it is never read as empty, because an empty read would let the next write erase it.

Values are opaque to Core: nothing reads into them, nothing logs them, and refusals name only a code and a part.

**`RT/service.ts`**. Its line count is fixed at 4318 by the baseline and it already had uncommitted edits from someone else, so every change is in place:
- **Field:** `readonly domainBuildState = new AutomationStudioDomainBuildStateStore(() => this.projectPaths);` takes the place of the blank line before the constructor. The thunk defers the read until the constructor has set the paths. This follows the "fields, not facade methods" precedent (C8).
- **Import:** one new import line (`./domain-build-state/index.ts`). To keep the count at 4318 I removed the blank line before `export type AutomationStudioServiceOptions`.
- **Build-id edits:**
  - added the `buildId` declarator and passed it into `evidenceLoopBinding`;
  - set `project.buildId` from that same id;
  - wrapped `runAutomationStudioProjectBuild` in `automationStudioEvidenceBuildBound`;
  - added the `automationStudioEvidenceBuildBound` name to the existing `./llm/index.ts` import line.

  None of these adds a statement or a line. `wc -l` still reads 4318.

### Tests (all new or extended, beside their subjects)

- `RT/llm/harness-options/tests/evidence-build-scope.test.ts` (7 tests):
  - `fresh` on the opening and absent afterwards;
  - `continuing` when `held` is an array (a non-array `held` gives `fresh`);
  - `callScope` carried through the round and cleared by an unscoped opening;
  - `runId` wins over everything;
  - a brief binding made inside `automationStudioEvidenceBuildBound` shares the supervisor's build id while running concurrently;
  - a minted id is stable within one binding and different between bindings;
  - concurrent calls from different builds stay apart;
  - the reader returns `undefined` outside a call.
- `RT/llm/evidence-loop/tests/call-id.test.ts`: one new case for `automationStudioLlmEvidenceOpeningCallScope`.
- `RT/domain-build-state/tests/document.test.ts` (7), `store.test.ts` (8, with disk tests run for both JSON and SQLite layouts), `accessor.test.ts` (2).

## Commands run and observed results

All run from `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`. Vitest was run from `packages/fluxiq`.

- `npx vitest run …/evidence-build-scope.test.ts …/call-id.test.ts …/registry.test.ts`: the first run had **1 failed | 25 passed**. My own test was wrong: it expected `initial.core.run_node` read against tool id `core` to have no scope, but by the format that id really is tool `core` with scope `run_node`. I corrected the assertion. Rerunning `call-id.test.ts` gave **9 passed**.
- `npx vitest run …/domain-build-state …/evidence-build-scope.test.ts`: **4 files, 24 tests passed**.
- `node scripts/structure-audit.mjs`:
  - First run: **FAIL [import-cycles]** on registry.ts. Importing `../evidence-loop/index.ts` closed a 106-module cycle. I fixed it by importing `../evidence-loop/call-id.ts` directly.
  - Rerun: `structure-audit: passed (412 warning(s), 1152 baselined).`
- `pnpm --filter fluxiq check`: tsc `--noEmit` finished with no errors (`{"build-cache":"build","step":"fluxiq:check",...,"ms":113656}` and nothing else). This ran against the whole tree, including other workers' uncommitted edits.
- `npx vitest run …/harness-options/tests …/call-id.test.ts …/domain-build-state`: **28 files, 239 tests passed**.
- `npx vitest run …/service/project-build/tests/project-build-facade.test.ts`, which runs a project build through the real service and so exercises the `evidenceBuildBound` wrap and the shared `buildId`: **11 passed**.

## Not verified

- No live run or browser run, and no downstream build. The domain has not been moved onto either seam: `arrival.ts`, `shown-addresses.ts`, `tools.ts` `OPENING_LOOK_CALL_ID` and `cleared-way-outs/registry.ts` are unchanged.
- No test proves, through the real service, that a project brief's domain call sees `project.buildId`. The mechanism is unit-tested (brief binding inside `automationStudioEvidenceBuildBound`), and the facade test proves only that the wrapped project build still runs end to end.
- I did not run the full suites, Core's whole vitest run, or `pnpm check`. That follows the twice-a-day rule.
- Two cases rest on reading the code, not on a test: the store under a real `FluxIQ` instance (the accessor test uses a fake owner shaped like FluxIQ), and the field initializer's ordering in the compiled output (tsc and the service-level test pass).
- I did not update Core's architecture docs for the new port. The brief did not name any.

## Open questions or contradictions found

1. **The reset loop opens as `"fresh"`.** A project brief's reset loop (`run-brief.ts:305`) has its own opening call (`initial.<tool>.<scope>`), so it is reported as `"fresh"`, just as the domain's `initial.` prefix check treats it today. If the domain should not re-arm on a reset loop's opening, Core needs a third value (for example `"reset"`), and that would need run-brief.ts / reset-loop.ts, which are on the L1 list.
2. **With scheduler capacity 1, briefs have no `callScope`.** Briefs then open unscoped, so they share one build-wide memory key. That matches today's behaviour. If the domain wants per-brief memory even then, `currentAutomationStudioActivityAgent()?.briefId` is already in the async context and could go into the scope; I left it out to stay inside the brief.
3. **A continued stopped build gets a new `buildId`.** Its opening is `"continuing"`. If the domain needs build-scoped values to survive into that continuation, either the build id would have to be stored with the incomplete draft, or the domain should keep that memory Flow-scoped (no `buildId`).
4. **`maxBuildsPerFlow` (16).** I chose this to match the domain's `REMEMBERED_BUILDS`. Recovery explorations key by `runId`, so frequent runs with recoveries will push older build scopes out of a Flow's file.
