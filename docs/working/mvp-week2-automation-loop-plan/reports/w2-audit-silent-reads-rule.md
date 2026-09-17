# w2-audit-silent-reads-rule — worker report

Repositories: FluxIQ Core (`F:\!FluxIQ`), then this repository (`F:\!FluxIQWebExtension`).
Nothing was committed or pushed. No live calls were made. No source file outside `scripts/` was
changed, and none of the recorded instances was fixed.

`AS/` = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done.** A new structure-audit rule, `failure-as-empty`, now fails the build when non-test source
turns a caught failure into an empty or absent value. Existing instances are recorded per file in
both baselines, and the entries may only shrink:

- **Core:** 132 instances in 66 files.
- **Extension:** 77 instances in 59 files.

In both repositories:

- `pnpm structure:test` passes (130 of 130).
- `node scripts/structure-audit.mjs` passes.
- A throwaway `.catch(() => [])` probe failed the audit and was then removed.
- The rule and its tests are byte-identical.

## What changed and why

### Files

| Repo | File | Change |
| --- | --- | --- |
| Core | `scripts/structure-audit/rules/failure-as-empty.mjs` | New rule, 359 lines |
| Core | `scripts/structure-audit/rules/tests/failure-as-empty.test.mjs` | New tests, 25 cases, 210 lines |
| Core | `.structure-baseline.json` | +68 lines: only the `failure-as-empty` section (66 entries) |
| Extension | `scripts/structure-audit/rules/failure-as-empty.mjs` | Mirror (sha256 `9f77b102…`, same as Core) |
| Extension | `scripts/structure-audit/rules/tests/failure-as-empty.test.mjs` | Mirror (sha256 `8ecd9328…`, same as Core) |
| Extension | `.structure-baseline.json` | +61 lines: only the `failure-as-empty` section (59 entries) |

Two files needed no change:

- `scripts/structure-audit.mjs`: it discovers every file in `rules/` by itself.
- `config.mjs` in either repository: the rule takes no configuration.

### What the rule counts

It works on the TypeScript AST, not regular expressions. It skips test files and anything under a
test root (`tests/`, `e2e/`).

**Rejection handlers.** An inline `.catch(h)` or `.then(ok, h)` handler is counted when:

- its expression body is empty, e.g. `() => []`, `() => ({})`, `() => undefined`, `() => null`;
- its block body returns an empty value, returns bare, or falls off the end, e.g. `() => {}`,
  `(e) => { log(e); }`;
- its body is a conditional with an empty branch, unless it has the allowed form described below.

**Catch blocks.** A `catch` block is counted for each return of an empty value: `return []`,
`return undefined`, `return null`, `return {}`. A bare `return;` counts only when the enclosing
function returns a real value elsewhere.

**What "empty" means:**

- `undefined`, `null`, `void x`, `[]`, `{}`, `""`;
- an object whose every property is empty, e.g. `{ sessions: [] }`;
- `new Map()`, `new Set()`, `new WeakMap()`, `new WeakSet()`, `new Array()` with no entries;
- `Promise.resolve()` with no value or an empty value;
- a call to a function whose name starts with `empty`, e.g. `emptyFlowSummaryIndex()`,
  `this.empty()`;
- `false` and `0` are not counted.

**The finding.** One finding per file, keyed by the file path, with `value` = the number of
instances, `severity: "fail"` and `ratchet: true`. The message lists the lines and says what to do:

- let the error propagate;
- or fail closed with an error that says what could not be read;
- or name the one expected failure and rethrow the rest:
  `catch (error) { if (isMissingFile(error)) return []; throw error; }`.

The message also gives the allowed way to write a queue tail.

### What the rule allows (each has a test)

1. **A named expected failure, with everything else rethrown.** The empty exit must sit under an
   `if` that tests the caught error, or come after an `if` that tests the error and throws. The
   block must also contain a `throw` or a `return Promise.reject(...)`.
   - "Tests the error" means one of:
     - a call that is passed the error or a value read from it;
     - a method call on the error that takes an argument;
     - an `instanceof` check against anything except plain `Error`;
     - an equality comparison of a value read from the error with something non-empty, e.g.
       `(error as Errno).code !== "ENOENT"`.
   - Aliases such as `const code = error.code` are followed.
   - `if (error)` and `error === undefined` do not count.
   - For an expression body, `isMissing(e) ? [] : Promise.reject(e)` is allowed.
   - Checked against real code: all 13 `ENOENT` guards in Core's non-test source are recognised and
     not flagged.
2. **A `.catch` whose result is discarded.** This means an expression statement, optionally under
   `await` or `void`.
3. **A chain that only settles.** The success side gives no value either, so nothing is read:
   - `tail.then(() => undefined, () => undefined)`;
   - `tail = tail.then(async () => {...}).catch(() => undefined)`;
   - `previous.catch(() => undefined).then(() => next())`, where the next step takes no parameter.

   Without this exemption, 10 Core queue tails were flagged: `database.ts`, `schema-migrations.ts`,
   `sqlite-repository.ts`, two write-order queues, and the graph history queue.
4. **A `.catch` handler that stores the error itself**, e.g. `trusted-clients.ts` with
   `this.loadError = error`, which `ready()` rethrows later. This excuses only falling off the end
   of the handler; an explicit empty return is still counted.
5. **A handler passed by name**, e.g. `.catch(ignoreMissing)`. The rule does not open it.

**Known gaps, stated in the rule header:**

- an empty value bound to a name first;
- an empty value assigned inside a `catch` block that then falls through;
- a `continue` past a failed item;
- the direction of a guard: `if (isMissing(e)) throw e; return [];` passes;
- a fallback that is not empty, e.g. `.catch(() => defaults)`.

### How the baseline entries were recorded

This departs from the brief's wording. `pnpm structure:baseline` cannot record a new rule's
entries: `baseline.mjs` (Core commit `4867c5c`) deliberately refuses to add entries on `--update`,
and writes nothing when an entry is missing. I did not change `baseline.mjs`; it is outside my files,
and changing it would reopen the grandfathering that commit closed.

Instead, a scratch script (`<scratchpad>/w2-audit/seed.mjs`) did the one-time adoption through the
audit's own functions:

1. Load the baseline, and refuse if the rule already has entries.
2. Run only this rule and add its current values.
3. Call `planBaselineUpdate(..., ["failure-as-empty"])`, requiring 0 blocked, 0 lowered and
   0 removed.
4. Write with `saveBaseline`.

The result:

- Both baseline diffs are additions only, and every other rule's entries are untouched.
- `pnpm structure:baseline` then printed
  `baseline already current, not rewritten ... (0 lowered, 0 removed)` in both repositories.

### Recorded instances

Line numbers are as of this run.

#### Core: 132 instances in 66 files

`apps/web`:

- `apps/web/src/app/api/auth/login/route.ts` (1): 49
- `apps/web/src/app/api/client-gateway/approve-pairing/route.ts` (1): 9
- `apps/web/src/app/api/client-gateway/automation-studio-context/route.ts` (1): 9
- `apps/web/src/app/api/client-gateway/dismiss-pairing/route.ts` (1): 9
- `apps/web/src/app/api/framework/io/validate/route.ts` (1): 11
- `apps/web/src/app/api/framework/setup/route.ts` (1): 23
- `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts` (1): 37
- `apps/web/src/app/AuthShell.tsx` (3): 79, 156, 206
- `apps/web/src/app/GlobalClientGatewayPairing.tsx` (3): 68, 71, 128
- `apps/web/src/features/automation-studio/clients/client-commands.ts` (1): 30
- `apps/web/src/features/automation-studio/datasets/download-href.ts` (1): 40
- `apps/web/src/features/automation-studio/flow-editor/palette-preferences-repository.ts` (1): 26
- `apps/web/src/features/automation-studio/graph/draft-store.ts` (1): 63
- `apps/web/src/features/automation-studio/instructions/instruction-draft-repository.ts` (1): 21
- `apps/web/src/features/automation-studio/live/commands/recording-domain-commands.ts` (2): 126, 158
- `apps/web/src/features/automation-studio/live/hooks/useGatewayRecordingBridge.ts` (2): 76, 83
- `apps/web/src/features/automation-studio/model/live-helpers.ts` (1): 61
- `apps/web/src/features/automation-studio/project/project-hydration.ts` (1): 28
- `apps/web/src/features/automation-studio/project/request-coordinator.ts` (4): 117, 121, 146, 150
- `apps/web/src/features/automation-studio/sync/project-revalidation.ts` (1): 43
- `apps/web/src/features/automation-studio/workspace/cache/backends.ts` (4): 22, 30, 83, 156
- `apps/web/src/features/automation-studio/workspace/cache/coordinator.ts` (1): 320
- `apps/web/src/features/programs/program-api.ts` (1): 159
- `apps/web/src/features/programs/ui-performance.ts` (1): 149
- `apps/web/src/lib/login-attempts.ts` (1): 124

`packages/contracts`, the framework, and shared program code:

- `packages/contracts/src/failure/parse-record.ts` (1): 48
- `packages/fluxiq/src/framework/index.ts` (1): 457
- `packages/fluxiq/src/framework/storage-layout.ts` (2): 45, 93
- `packages/fluxiq/src/framework/storage-migration.ts` (4): 73, 81, 83, 192
- `packages/fluxiq/src/programs/_shared/docs-generators.ts` (4): 266, 304, 449, 454
- `packages/fluxiq/src/programs/_shared/storage.ts` (1): 256

`AS/` outside `runtime/service/` and `storage/`:

- `AS/client-gateway/bridge.ts` (2): 572, 577
- `AS/runtime/executor/host-state.ts` (1): 15
- `AS/runtime/flow-bootstrap/generation-failure.ts` (1): 347
- `AS/runtime/flow-bootstrap/plan/catalog.ts` (1): 173
- `AS/runtime/llm/provider-contract.ts` (1): 154
- `AS/runtime/recovery/annotation/annotate.ts` (1): 150

`AS/runtime/service.ts` and `AS/runtime/service/`:

- `AS/runtime/service.ts` (20): 994, 1194, 1583, 1645, 2665, 2799, 2880, 2965, 2968, 2991, 2993,
  3000, 3168, 4188, 4223, 4275, 4292, 4936, 4944, 5143
- `AS/runtime/service/adaptations/patches.ts` (1): 102
- `AS/runtime/service/catalogue.ts` (2): 37, 77
- `AS/runtime/service/flows/mutations.ts` (2): 86, 164
- `AS/runtime/service/flows/store.ts` (3): 64, 245, 421
- `AS/runtime/service/flows/writer.ts` (1): 258
- `AS/runtime/service/legacy/store.ts` (1): 116
- `AS/runtime/service/projects/artifacts.ts` (1): 45
- `AS/runtime/service/proposals/approval.ts` (2): 69, 72
- `AS/runtime/service/recordings/deletion.ts` (3): 53, 120, 122
- `AS/runtime/service/recordings/proposal-candidates.ts` (1): 168
- `AS/runtime/service/recordings/store.ts` (5): 87, 93, 101, 441, 500
- `AS/runtime/service/summaries/run-audit.ts` (1): 41
- `AS/runtime/service/summaries/run-detail-writer.ts` (2): 83, 97
- `AS/runtime/service/summaries/store.ts` (3): 317, 332, 407

`AS/storage/`:

- `AS/storage/object-store.ts` (3): 53, 72, 252
- `AS/storage/project/adaptation-store.ts` (1): 640
- `AS/storage/project/content-store.ts` (3): 124, 152, 159
- `AS/storage/project/event-stream-writer.ts` (1): 111
- `AS/storage/project/migration-cutover.ts` (3): 344, 597, 607
- `AS/storage/project/object-index-migration.ts` (1): 29
- `AS/storage/project/run-dataset-store.ts` (1): 524
- `AS/storage/project/runtime-stream-store.ts` (1): 653

Other programs and scripts:

- `packages/fluxiq/src/programs/deployment-sync/runtime/service.ts` (6): 277, 278, 279, 280, 281, 282
- `packages/fluxiq/src/programs/docs/runtime/service.ts` (2): 107, 229
- `packages/fluxiq/src/programs/identity-access/runtime/service.ts` (1): 702
- `packages/fluxiq/src/programs/secret-keys/runtime/seal-upgrades.ts` (1): 39
- `packages/fluxiq/src/programs/secret-keys/runtime/value-sealer.ts` (1): 123
- `scripts/docs-reference.mjs` (2): 71, 72

#### Extension: 77 instances in 59 files

`apps/extension/src/background/connection/`:

- `active-page.ts` (1): 132
- `core-api.ts` (2): 46, 89
- `project-context.ts` (1): 61
- `recordable-page-address.ts` (1): 22
- `recorded-event-intake.ts` (2): 75, 100
- `scripted-navigation/intent.ts` (1): 58
- `state-assets.ts` (1): 56
- `value-readers.ts` (1): 48

`apps/extension/src/content/`:

- `action-runtime/file-input.ts` (1): 79
- `action-runtime/keyboard/text-edits.ts` (1): 82
- `action-runtime/resolve-target.ts` (1): 585
- `actions/assert.ts` (1): 128
- `element-finder.ts` (1): 62
- `evidence/navigation.ts` (1): 47
- `extraction/detect-structure.ts` (2): 133, 141
- `extraction/field-reader.ts` (1): 89
- `message-handler.ts` (1): 125

`apps/extension/src/runtime/` and `apps/extension/src/shared/`:

- `runtime/automation-tab.ts` (2): 72, 94
- `runtime/browser-download.ts` (1): 144
- `runtime/browser-tab.ts` (1): 126
- `runtime/click-landing.ts` (1): 181
- `runtime/frame-address.ts` (1): 65
- `runtime/navigation-outcome.ts` (1): 48
- `shared/dialog-channel.ts` (1): 106

`domain/src/`:

- `output-nodes/payloads.ts` (1): 62
- `recording/proposals/late-target-wait.ts` (1): 110
- `runtime/adapter.ts` (2): 405, 429
- `runtime/expectation/click-landing.ts` (1): 122
- `runtime/llm-evidence/location.ts` (1): 30
- `runtime/llm-evidence/page-evidence.ts` (1): 260

Other packages:

- `packages/agent-orchestrator/src/audit.ts` (1): 82
- `packages/test-evidence/src/capture.ts` (1): 33

`packages/test-runner/src/`:

- `auth-session.ts` (1): 134
- `bench/campaign/machine-slots/acquire-machine-cell-slot.ts` (1): 299
- `bench/durable-file.ts` (1): 80
- `bench/persistence-discard-diagnostics.ts` (1): 24
- `bench/read-run-bundle.ts` (4): 57, 58, 76, 87
- `browser-evidence.ts` (1): 120
- `clone-cache.ts` (1): 130
- `core-web-build/publication.ts` (1): 61
- `demo-llm-create-ui/explore-proposal-ui.ts` (1): 168
- `demo-workspace/browser-session.ts` (2): 114, 164
- `existing-fluxiq-control.ts` (2): 139, 269
- `facility-failure/project-facility-failure.ts` (2): 70, 88
- `failure.ts` (1): 83
- `flow-lane/repair/declared-repair.ts` (1): 83
- `flow-lane/repair/judge-repair.ts` (1): 119
- `http-control/index.ts` (4): 149, 226, 242, 253
- `lab-control/frame-origin-proof.ts` (1): 22
- `live-llm/lane-settlement.ts` (1): 54
- `network-guard.ts` (1): 94
- `run-evaluation/flow-lane-evidence-sizes.ts` (1): 64
- `run-scenario.ts` (4): 356, 386, 453, 507
- `scenario-assertions.ts` (2): 72, 73
- `web-flow-exploration.ts` (1): 230

`scripts/`:

- `scripts/demo/launcher-failure.mjs` (1): 19
- `scripts/lab/build-lock.mjs` (1): 88
- `scripts/lab/live-campaign/row/bundle.mjs` (1): 11
- `scripts/prepare-demo-llm-workspace.mjs` (1): 37

## Commands run and observed results

**Rule tests.** `node --test scripts/structure-audit/rules/tests/failure-as-empty.test.mjs` (Core)
printed `# pass 25 # fail 0`, both before and after compacting the rule.

**Mutation check.** I changed the rule one way at a time, ran the tests, then restored it; `cmp`
against the backup printed `RESTORED`. Every mutation made tests fail:

| Mutation | Result |
| --- | --- |
| Named-failure form always refused | `pass 22 fail 3` |
| Discarded results not recognised | `pass 24 fail 1` |
| Settle-only chains not recognised | `pass 24 fail 1` |
| Stored error ignored | `pass 24 fail 1` |
| `instanceof Error` accepted as naming the failure | `pass 24 fail 1` |
| Bare `return` always counted | `pass 24 fail 1` |
| Object of empties not treated as empty | `pass 24 fail 1` |

**Measurement.** A scratch script printed the source line of every finding.

- Core, first version: 142 instances in 73 files.
- Core, after the settle and stored-error exemptions: 132 in 66. Exactly the 10 queue-tail lines
  and `trusted-clients.ts:20` dropped out.
- Extension: 77 in 59.
- Compacting the rule did not change either list (`diff` was empty).

**Seeding.**

- Core: `seeded failure-as-empty: 66 files, 132 instances; written=true`, and the baseline diff was
  `68 insertions(+)`.
- Extension: `59 files, 77 instances; written=true`, and the diff was `61 insertions(+)`.

**Final checks.**

| Command | Core | Extension |
| --- | --- | --- |
| `pnpm structure:test` | `# tests 130 # pass 130 # fail 0` | `# tests 130 # pass 130 # fail 0` |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (152 warning(s), 320 baselined).`, exit 0 | `structure-audit: passed (60 warning(s), 76 baselined).`, exit 0 |
| `pnpm structure:baseline` | `baseline already current, not rewritten: 320 entries across 8 rules (0 lowered, 0 removed).` | `baseline already current, not rewritten: 76 entries across 5 rules (0 lowered, 0 removed).` |

- None of the warnings in either repository is on the new files; a grep of the audit output was
  empty.
- `--list` shows
  `failure-as-empty       A caught failure is never turned into an empty or absent value`.

**Probe.** I added
`export async function probe(load) { return await load().catch(() => []); }` as
`packages/fluxiq/src/w2-audit-probe-scratch.ts` (Core) and `domain/src/w2-audit-probe-scratch.ts`
(extension).

- In both repositories the audit printed
  `FAIL  [failure-as-empty] <path>: 1 caught failure is turned into an empty or absent value, at line 2. …`
  and `structure-audit: 1 violation(s) across 1 rule(s).`, with exit 1.
- After the file was deleted (`test ! -e` confirmed), the audit passed with exit 0 in both.

**Mirror.** `cmp` over every file under `scripts/structure-audit/` except `config.mjs`, plus
`scripts/structure-audit.mjs`: all 25 files are the same. The sha256 of the two new files matches
between the repositories.

## Not verified

- `pnpm check`, `pnpm test` and `pnpm build` were not run in either repository. The change touches
  only `scripts/structure-audit/` and the baselines.
- No probe made an already-baselined file's count grow, because that would mean editing someone
  else's source. Growth handling is covered by the existing `baseline.test.mjs`, which passed.
- I read the flagged line for every finding, but the surrounding code for only about 25 of them.
- Other workers were editing both repositories during this work. The baselines reflect the working
  trees at seeding time, and the last audit run passed.

## Open questions or contradictions found

1. **The brief's "run `pnpm structure:baseline` to record" contradicts the ratchet.** I seeded
   through the audit's own planner and serializer, then ran `pnpm structure:baseline` as a no-op
   check. Recommendation: add an explicit adoption path to Core's `baseline.mjs`, for example
   `--adopt <rule>`, allowed only when that rule has no entries.
2. **Findings in files other workers are editing.** Both instances already exist at HEAD; only
   their line numbers moved.
   - Core `AS/runtime/flow-bootstrap/generation-failure.ts:347`: `catch { return null; }` in
     `parseAutomationStudioFlowBootstrapGenerationError` (line 332 at HEAD).
   - Core `AS/storage/project/adaptation-store.ts:640`: `catch { return {}; }` in `object()`
     (line 563 at HEAD).
   - Nothing is flagged in the extension's in-progress files (`resolve-plan-node.ts`,
     `build-proposal.ts`).
3. **Not counted by design: a `.catch(() => undefined)` whose result is discarded,** i.e. a
   swallowed write or side effect.
   - A variant of the rule counted 49 of these in 23 Core files and 86 in 42 extension files.
   - They include the earlier report's "unreviewed" `service.ts` lines, now at 3806, 3905, 4527,
     4539, 4799 and 4804, e.g. `await this.uiCache.purgeProject(projectId).catch(() => undefined);`.
   - If the standard should also cover swallowed writes, that needs a second ratcheted rule.
4. **Recorded findings that are arguably fine, each with a one-line rewrite that clears it.**
   - Queue tails in the extension: `packages/agent-orchestrator/src/audit.ts:82`,
     `packages/test-runner/src/browser-evidence.ts:120` and `bench/durable-file.ts:80`. Rewrite as
     `op.then(() => undefined, () => undefined)`, or as `.then(() => operation())`.
   - Best-effort work whose promise is kept: Core `secret-keys/runtime/seal-upgrades.ts:39` and
     `apps/web/.../project-revalidation.ts:43`. Pass a handler by name instead.
   - `service.ts:2880` (`flowScope`) is a documented fail-closed choice, but it is still counted.
5. **Many instances are HTTP-body and cache reads** in `apps/web` and `packages/test-runner`, e.g.
   `response.json().catch(() => undefined)`. Whether each should change is a per-file decision.
6. **Docs.** I made no `docs/**` change. Core's `docs/architecture/code-structure.md`
   "Anti-Patterns" list probably deserves a `failure-as-empty` line, as `contract-spread` has.
