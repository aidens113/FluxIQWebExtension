# w2-audit-swallowed-writes — worker report

Repositories: FluxIQ Core (`F:\!FluxIQ`), then this repository (`F:\!FluxIQWebExtension`).
Nothing was committed or pushed. No live calls were made. No source file outside `scripts/` was
changed, and none of the recorded instances was fixed.

`AS/` = `packages/fluxiq/src/programs/automation-studio/`. `TR/` = `packages/test-runner/src/`.

## Outcome

**Done.** All three parts of the brief are complete in Core, and the script changes are mirrored
here byte for byte.

1. **`--adopt <rule>` added.** It records a rule's current findings only when that rule has no
   baseline entries yet. It refuses otherwise, writes nothing when it refuses, and never changes
   another rule's entries.
2. **New ratcheted rule, `swallowed-failure`.** Existing instances are adopted in both repositories:
   - **Core:** 35 files, 61 instances. The baseline diff is `37 insertions, 0 deletions`.
   - **Extension:** 46 files, 94 instances. The baseline diff is `48 insertions, 0 deletions`.
3. **Docs.** Core `docs/architecture/code-structure.md` now has `failure-as-empty` and
   `swallowed-failure` entries in its anti-patterns list, plus one sentence on `--adopt`.

In both repositories:

- `pnpm structure:test` passes, 162 of 162.
- A probe of each flagged form failed the audit, and the probe file was then removed.
- The mirror is identical: 32 files, same file set.

**The full audit is not green in either repository, because of files other agents are editing.**
Neither failure comes from this work.

- **Core:** 2 `docs-links` failures in `docs/architecture/automation-studio.md`, which another agent
  has modified. With every rule except `docs-links`, the audit passes.
- **Extension:** 1 `working-docs` failure, because `docs/working/README.md` is out of date with the
  plan document. It was already failing before I adopted anything. With every rule except
  `working-docs`, the audit passes.

See "Commands run" for the exact output.

## What changed and why

### Files

| Repo | File | Change |
| --- | --- | --- |
| Core | `scripts/structure-audit.mjs` | Parses `--adopt <id>`, and documents it in the usage header |
| Core | `scripts/structure-audit/baseline.mjs` | New `planBaselineAdoption()`; header says adoption is the only way an entry is added |
| Core | `scripts/structure-audit/tests/baseline.test.mjs` | 6 new adoption tests (16 in the file) |
| Core | `scripts/structure-audit/failure-handling/` (new) | `index.mjs` barrel, `expressions.mjs`, `caught-error.mjs`, `promise-chains.mjs`, `non-test-scripts.mjs` |
| Core | `scripts/structure-audit/rules/failure-as-empty.mjs` | Imports the moved helpers, 359 → 203 lines. One header sentence now mentions `.finally` |
| Core | `scripts/structure-audit/rules/tests/failure-as-empty.test.mjs` | 2 assertions for `.finally` |
| Core | `scripts/structure-audit/rules/swallowed-failure.mjs` (new) | The rule |
| Core | `scripts/structure-audit/rules/tests/swallowed-failure.test.mjs` (new) | 26 tests |
| Core | `.structure-baseline.json` | Only a new `swallowed-failure` section (35 entries) |
| Core | `docs/architecture/code-structure.md` | Two anti-pattern entries and the `--adopt` sentence |
| Extension | the same 12 script files | Byte-identical copies |
| Extension | `.structure-baseline.json` | Only a new `swallowed-failure` section (46 entries) |

**Files I did not change:**

- `config.mjs` in either repository.
- `package.json` in either repository. `pnpm structure:baseline --adopt <rule>` works as it is: pnpm
  appends the argument after `--update`, and `--adopt` takes precedence over `--update`.

### `--adopt <rule>`

- **The planner.** `planBaselineAdoption(findings, previous, limits, rule)` is a pure function.
  - It records only `rule`'s ratcheted `fail` findings, each key at the highest value among its
    findings.
  - It copies every other rule's entries exactly as recorded, even when their current findings have
    grown, shrunk or gone.
  - If `rule` already has an entry, it returns `refused` with a reason and `baseline: null`.
  - A rule recorded as an empty `{}` may still be adopted. Adopting zero findings adds no rule key.
- **The command line.**
  - `--adopt` runs only the named rule. It must name exactly one rule and cannot be combined with
    `--rule`; otherwise it exits 2. An unknown rule id also exits 2.
  - A refusal exits 1 and does not write the baseline.
  - It never calls a rule's `update()` hook. So `pnpm structure:baseline --adopt x` does not
    regenerate `docs/working/README.md`, which the plain `pnpm structure:baseline` does.

### Why a shared `failure-handling/` directory

The new rule needs almost every AST helper `failure-as-empty` had: `unwrap`, `isEmptyValue`,
`someOwn`, `errorNames`, `testsError`, `isDiscarded`, `onlySettles` and others. Copying about 120
lines would repeat the pattern the code-structure standard forbids.

- **Where the helpers went.** I moved them verbatim into four focused modules plus a barrel, and
  `failure-as-empty` now imports them. They cannot live in `rules/`, because the audit loads every
  `.mjs` file there as a rule.
- **No change in `failure-as-empty` findings.** They are byte-identical before and after, in both
  repositories: Core 132 instances in 66 files, extension 77 in 59.
- **One deliberate change to the shared discard check.** `isDiscarded` now also follows
  `.finally(...)`, which settles to the same value, so `void x.catch(h).finally(f)` counts as
  discarded.
  - Neither repository has a real instance, so no findings changed. The one textual match is inside
    a browser-script template string in `apps/scenario-lab`.
  - This keeps the two rules disjoint. `failure-as-empty` judges a `.catch` result that something
    reads, and `swallowed-failure` judges one that is thrown away.
  - Measured: no line is counted by both rules in either repository.

### `swallowed-failure`: what it counts

It runs on the TypeScript AST, over the same file set as `failure-as-empty`: non-test source,
excluding `tests/` and `e2e/`.

**A discarded promise whose inline rejection handler drops the failure.** "Discarded" means an
expression statement, optionally under `await`, `void`, parentheses, a type assertion or
`.finally`. Examples:

- `await x.catch(() => undefined)`
- `void x.catch(() => {})`
- `x.catch((error) => {})`
- `void x.then(use, () => {})`

**A `catch` block with no statement**, with or without a binding, even if it holds an ordinary
comment. Examples: `catch {}`, `catch { }`, `catch (e) {}`, `catch { /* ignore */ }`.

**When a handler counts as reporting or propagating.** Every path through the handler must do one
of these:

- throw;
- return `Promise.reject(...)`;
- call something that is passed the error, anywhere in its arguments. Examples: `log.warn("x",
  error)`, `reject(error)`, `failures.push({ error })`, `setState((s) => ({ ...s, error }))`;
- assign a value that refers to the error, e.g. `this.lastError = error`.

Some details of that check:

- Locals computed from the error carry it, e.g. `const message = String(error)`. So do
  destructured parameters, e.g. `({ message }) => warn(message)`.
- Paths are checked with a small backward pass over the statements, so it takes time linear in the
  handler's length.
- A loop, `switch` or `try` counts as reporting if it throws or reports anywhere inside.

### `swallowed-failure`: what it allows (each has a test)

1. **Naming the expected failure and reporting or rethrowing the rest.** An `if`, `?:`, `&&` or
   `||` whose condition tests the caught error may leave one side silent, if the other side reports
   or propagates. "Tests the error" is `failure-as-empty`'s test. Allowed examples:
   - `if (isMissingFile(error)) return; throw error;`
   - `if (!String(error).includes("SQLITE_CONSTRAINT")) throw error;`
   - `isAbort(error) || log(error)`

   A guard on anything else still counts, e.g. `if (signal.aborted) return; log(error);`.
2. **Waiting for a held promise to settle.** This covers a `.catch(h)`, `.then(undefined, h)` or
   `.then(noValue, h)` called directly on a name, property or element.
   - Examples: `await previous.catch(() => undefined)`, `void promise.catch(() => undefined)`.
   - It excuses 10 waits in Core and 8 in the extension. I read every one: each is a queue wait, a
     wait on another caller's in-flight work, or a handler attached early to a promise that is
     awaited or raced right afterwards.
   - A chain that starts the work in the same expression still counts, e.g.
     `await purge().catch(...)` or `void tail.then(write).catch(...)`.
   - A queue tail that is kept rather than discarded (`tail = run.catch(...)`) is not examined.
3. **The best-effort marker**, kept narrow:
   - The comment must start exactly `best-effort:`, lowercase and hyphenated.
   - The reason after it must be at least three words.
   - It must sit inside the handler (including just before it within the call's parentheses, or at
     its end) or inside the empty catch block's braces.
   - A comment after the `);`, above the statement, above the `try`, between `catch` and `{`, or in
     a function nested inside the handler does not count.
   - No `best-effort:` comment exists in either repository today, so the adopted counts are exact.
4. **A handler passed by name** is not opened.
   - Only two discarded chains in the two repositories pass a handler by name, and both pass
     `reject` onward: Core `AS/runtime/llm/deepseek-provider.ts:757` and extension
     `scripts/lab/live-campaign/lab-run/spawn.mjs:23`.

**Holes, stated in the rule header:**

- a named handler that ignores its argument, e.g. `.catch(noop)`;
- a catch block that has statements but ignores the error;
- the direction of a guard: `if (isAbort(error)) log(error);` passes;
- a report that runs on only some paths inside a loop, `switch` or `try`;
- a held promise whose owner never reads it, e.g. `const p = write(); await p.catch(...)`.

The message tells a developer to let the error propagate, report it, or name the expected failure,
and shows the marker syntax.

### Adopted instances

Line numbers are as of this run.

#### Core: 35 files, 61 instances

`apps/web/src/features/`:

- `automation-studio/authoring/BlankFlowAuthoringPanel.tsx` (1): 114
- `automation-studio/flow-editor/palette-preferences-repository.ts` (2): 25, 38
- `automation-studio/graph/draft-store.ts` (2): 83, 124
- `automation-studio/graph/viewport-store.ts` (1): 288
- `automation-studio/live/hooks/useGatewayRecordingBridge.ts` (1): 48
- `automation-studio/project/use-project-catalog-loader.ts` (1): 20
- `automation-studio/runtime/FlowRunView.tsx` (1): 310
- `automation-studio/state/StateRawPanel.tsx` (1): 17
- `automation-studio/sync/background-work.ts` (1): 120
- `automation-studio/workspace/cache/backends.ts` (7): 34, 41, 44, 52, 57, 65, 118
- `programs/components/data/CodeViewer.tsx` (1): 32
- `programs/live-views/docs.tsx` (1): 309
- `programs/live-views/secret-keys.tsx` (1): 85

`packages/fluxiq/src/programs/` outside Automation Studio:

- `_shared/storage.ts` (1): 80
- `background-tasks/runtime/service.ts` (1): 238
- `database-manager/storage/sqlite-repository.ts` (3): 111, 116, 182
- `identity-access/runtime/credential-seal.ts` (1): 87
- `identity-access/runtime/run-credential-change.ts` (2): 44, 66
- `secret-keys/runtime/service.ts` (1): 193

`AS/runtime/`:

- `AS/runtime/llm/execution-grants.ts` (1): 612
- `AS/runtime/service.ts` (6): 3806, 3905, 4527, 4539, 4799, 4804. These are the lines the previous
  report left unreviewed, e.g. `uiCache.purgeProject(...).catch(() => undefined)`.
- `AS/runtime/service/datasets/run-datasets.ts` (1): 229
- `AS/runtime/service/flows/mutations.ts` (6): 152, 153, 154, 155, 156, 167
- `AS/runtime/service/projects/artifacts.ts` (1): 61
- `AS/runtime/service/recordings/store.ts` (1): 106
- `AS/runtime/service/summaries/run-detail-writer.ts` (1): 96
- `AS/runtime/service/summaries/store.ts` (3): 117, 157, 196

`AS/storage/`:

- `AS/storage/object-store.ts` (2): 314, 324
- `AS/storage/project/adaptation-store.ts` (1): 214. Another worker is editing this file; the line
  moved from 215 during this run, and the count did not change.
- `AS/storage/project/content-store.ts` (1): 151
- `AS/storage/project/database.ts` (2): 120, 155
- `AS/storage/project/flow-resource-mutations.ts` (1): 58
- `AS/storage/project/reusable-llm-context-store.ts` (1): 157
- `AS/storage/project/ui-cache-store.ts` (1): 252
- `AS/storage/recording-index-store.ts` (2): 105, 115

A heuristic breakdown, not hand-verified: about 15 empty catch blocks, about 40 silent handlers, and
about 5 handlers that respond without the error.

#### Extension: 46 files, 94 instances

`apps/extension/src/`:

- `background/connection.ts` (1): 377
- `background/connection/active-page.ts` (2): 109, 111
- `background/connection/dom-snapshot.ts` (1): 412
- `background/connection/recorded-event-intake.ts` (1): 96
- `background/connection/recording-evidence.ts` (1): 189
- `background/extraction/control.ts` (2): 208, 279
- `background/tabs.ts` (1): 76
- `content/action-runtime/keyboard/text-edits.ts` (1): 72
- `content/picker/messages.ts` (1): 84
- `content/picker/session.ts` (2): 110, 191
- `page-world/dialog-override.ts` (1): 74

Other apps and packages:

- `apps/scenario-lab/src/server.ts` (2): 32, 43
- `packages/test-evidence/src/bundle.ts` (2): 87, 94

`TR/`, outside `demo-*`:

- `auth-session.ts` (1): 75
- `bench/campaign/lease.ts` (1): 143
- `bench/campaign/machine-slots/acquire-machine-cell-slot.ts` (2): 138, 139
- `bench/durable-file.ts` (3): 130, 132, 174
- `browser-evidence.ts` (1): 70
- `clone-cache.ts` (2): 71, 115
- `coordinator.ts` (6): 147, 178, 179, 180, 181, 230
- `core-web-build/prepare.ts` (1): 110
- `core-web-build/publication.ts` (1): 91
- `flow-lane/persisted-flow-run.ts` (1): 341
- `interactive-session.ts` (3): 262, 263, 264
- `persistent-identity.ts` (1): 57
- `process-supervisor.ts` (2): 113, 119
- `run-manifest/create-run-manifest.ts` (1): 130
- `run-scenario.ts` (14): 459, 464, 481, 492, 509, 514, 525, 528, 539, 544, 561, 604, 732, 793
- `scenario-steps/extract-records.ts` (1): 115
- `scenario-steps/scripted-navigation.ts` (1): 123
- `workspace-lock.ts` (2): 63, 64

`TR/demo-llm-create-ui/`:

- `explore-proposal-ui.ts` (2): 69, 128
- `generation-failure.ts` (1): 50
- `generation-readiness.ts` (1): 51
- `settings-save-failure.ts` (1): 23

`TR/demo-workspace/`:

- `blank-preparation.ts` (1): 53
- `browser-session.ts` (7): 77, 115, 119, 120, 165, 169, 269
- `core-process.ts` (1): 103
- `diagnosis-lanes.ts` (2): 81, 109
- `exploration-adaptation.ts` (2): 277, 278
- `panel-navigation.ts` (2): 146, 188
- `provisioning.ts` (1): 52
- `scenario-lab.ts` (2): 44, 102
- `subflow-authoring.ts` (7): 82, 109, 119, 161, 162, 173, 181
- `workspace-lanes.ts` (1): 71

`scripts/`:

- `scripts/lab/live-campaign/lab-run/output.mjs` (1): 19

A heuristic breakdown, not hand-verified: about 20 empty catch blocks and about 70 handlers.

## Commands run and observed results

### Before any change

A scratch script ran `failure-as-empty` through each repository's own context. It printed
`66 files, 132 instances` for Core and `59 files, 77 instances` for the extension. The two
`failure-as-empty.mjs` copies had the same sha256, `9f77b102…`.

### Refactor parity

After moving the helpers, and again after the `.finally` change, the same dump was byte-identical
(`cmp`) in both repositories. The last extension comparison used the mirrored copy.

`node --test scripts/structure-audit/rules/tests/failure-as-empty.test.mjs` printed `# pass 25
# fail 0`.

### Rule tests

`node --test scripts/structure-audit/rules/tests/swallowed-failure.test.mjs` printed `# tests 26
# pass 26 # fail 0`.

### Mutation check

A scratch script applied each mutation to the rule or to `promise-chains.mjs`, ran the rule tests,
restored the file, and checked it matched a backup. It printed `all restored`, and the backups were
deleted.

The first run missed two mutations, "marker matched anywhere in the comment" and "assignment of
anything counts". Both were gaps in the fixtures, so I added a fixture for each. On the rerun, both
were caught (`pass 25 fail 1`).

Final results, where "caught" means at least one test failed:

| Mutation | Result |
| --- | --- |
| Discard check ignores `.finally` | pass 25, fail 1 |
| Held promises never excused | pass 25, fail 1 |
| `.then(undefined, h)` not treated as a wait | pass 25, fail 1 |
| Marker ignored on handlers | pass 24, fail 2 |
| Marker ignored in catch blocks | pass 25, fail 1 |
| Marker needs a one-word reason | pass 25, fail 1 |
| Marker matched anywhere in the comment | pass 25, fail 1 (after the fix) |
| Only leading comments scanned | pass 23, fail 3 |
| Marker scan enters nested functions | pass 25, fail 1 |
| Named guard never excuses a side | pass 25, fail 1 |
| Any guard excuses a side | pass 25, fail 1 |
| Right side of `&&` or `\|\|` always counts | pass 25, fail 1 |
| No carriers beyond the binding | pass 24, fail 2 |
| Any call counts as a report | pass 24, fail 2 |
| Any assignment counts | pass 25, fail 1 (after the fix) |
| Bare `return` counts as handling | pass 23, fail 3 |
| `Promise.reject` not recognised | pass 25, fail 1 |
| Empty catch blocks not counted | pass 22, fail 4 |
| Kept (non-discarded) chains examined | pass 24, fail 2 |
| Destructured binding ignored | pass 25, fail 1 |

### Baseline tests

`node --test scripts/structure-audit/tests/baseline.test.mjs` printed `# tests 16 # pass 16
# fail 0`.

### Core, in order

**1. Tests.** `pnpm -s structure:test` printed `# tests 162 # pass 162 # fail 0`.

**2. Audit before adoption.** `node scripts/structure-audit.mjs` exited 1 with `structure-audit:
35 violation(s) across 1 rule(s).` All 35 were `swallowed-failure`. No warning mentioned the new
files.

**3. Refused and invalid `--adopt` calls.** The baseline was unchanged afterwards (`cmp`):

| Command | Exit | Output |
| --- | --- | --- |
| `--adopt failure-as-empty` | 1 | `structure-audit: --adopt refused: failure-as-empty already has 66 baseline entries. A rule is adopted once; after that its entries may only be lowered, with --update. .structure-baseline.json was not written.` |
| `--adopt` with no id | 2 | `--adopt takes exactly one rule id, and cannot be combined with --rule.` |
| `--adopt swallowed-failure --rule naming` | 2 | same message |
| `--adopt no-such-rule` | 2 | `unknown rule: no-such-rule` |

**4. Adoption.** `pnpm -s structure:baseline --adopt swallowed-failure` exited 0 and printed
`structure-audit: baseline written: adopted 35 swallowed-failure entries, values summing to 61;
other rules' entries kept.` `git diff --numstat` showed `37 0 .structure-baseline.json`.

**5. Checks after adoption.**

- The audit printed `structure-audit: passed (152 warning(s), 355 baselined).` with exit 0.
- Adopting again exited 1: `swallowed-failure already has 35 baseline entries...`.
- `pnpm -s structure:baseline` printed `baseline already current, not rewritten: 355 entries across
  9 rules (0 lowered, 0 removed).` `git status docs/working` was empty afterwards.

**6. Probes.** `packages/fluxiq/src/w2-swallowed-probe-scratch.ts` held one form at a time, and each
run printed `FAIL [swallowed-failure] ...: 1 failure is silently dropped, at line 2.` with exit 1.
The forms were:

- `await write().catch(() => undefined);`
- `void write().catch(() => {});`
- `write().catch((error) => {});`
- `void write().then(() => undefined, () => {});`
- `try { await write(); } catch {}`
- `try { await write(); } catch (error) { }`

The file was deleted after each run. At the end, `test ! -e` confirmed it was gone, and the audit
passed.

**7. Final audit (later).** It exited 1 with two `FAIL [docs-links] docs/architecture/automation-studio.md`
lines, for `#repair-targets-and-their-refusals` (line 214) and `#what-a-failed-call-does-to-its-grant`
(line 374).

- That file is modified in the working tree by another agent, and I never touched it.
- With every rule except `docs-links`, the audit printed `passed (152 warning(s), 355 baselined).`
  with exit 0.
- `--rule docs-links` output mentions `code-structure.md` 0 times.

### Extension, in order

**1. Mirror check before copying.** Each file I changed matched Core's `HEAD` version, so the copy
overwrote nothing local. After copying, `cmp` over `scripts/structure-audit.mjs` plus every file
under `scripts/structure-audit/` except `config.mjs` printed `32 files compared, 0 differ`, with the
same file set.

**2. Tests.** `pnpm -s structure:test` printed `# tests 162 # pass 162 # fail 0`.

**3. Audit before adoption.** It exited 1 with 46 `swallowed-failure` failures and 1
`[working-docs] docs/working/README.md is out of date with the documents' header blocks.`

**4. Adoption.** `pnpm -s structure:baseline --adopt swallowed-failure` exited 0 and printed
`structure-audit: baseline written: adopted 46 swallowed-failure entries, values summing to 94;
other rules' entries kept.`

- `docs/working/README.md` was byte-identical before and after (`cmp`).
- `git diff --numstat` showed `48 0 .structure-baseline.json`.

**5. Checks after adoption.**

- The audit exited 1 with only the same `working-docs` failure.
- With every rule except `working-docs`, it printed `structure-audit: passed (60 warning(s), 119
  baselined).` with exit 0.
- `--rule swallowed-failure` printed `passed (0 warning(s), 46 baselined).`
- Adopting again exited 1 with the refusal message.

**6. Probes.** `domain/src/w2-swallowed-probe-scratch.ts` was tried with the same six forms, and
each exited 1 with the `FAIL [swallowed-failure]` line. A seventh probe,
`catch { /* best-effort: probe of the marker escape */ }`, exited 0. The file was removed
(`test ! -e`), and `--rule swallowed-failure` passed afterwards.

### Final checks

- **Mirror.** `cmp` printed `32 files compared, 0 differ`, with the same file set. The sha256
  prefixes are `97822b643e4b073b` for `swallowed-failure.mjs` and `14da87e65b2dcad0` for
  `baseline.mjs`, identical in both repositories.
- **No leftovers.** No `*.bak-w2sf` file and no probe file remains in either repository.
- **The two rules never overlap.** In each repository, the lines `failure-as-empty` flags and the
  lines `swallowed-failure` flags have `0` in common.

## Not verified

- **Broader gates.** `pnpm check`, `pnpm test` and `pnpm build` were not run in either repository.
  The change touches only `scripts/structure-audit*`, the baselines and one Core architecture
  document.
- **The `--adopt` command-line path.** It is covered by the manual runs above, not by an automated
  test. The planner behind it is unit-tested.
- **The plain `pnpm structure:baseline` in the extension.** I did not run it, because its
  `working-docs` hook would regenerate `docs/working/README.md`, a shared document. I ran it twice
  in Core, where it was a no-op and left `docs/working` unchanged.
- **Classification of the instances.** I read the flagged line for all 155. I read the surrounding
  code for about 25, and for every excused held-promise wait. The empty, silent and responding
  counts are heuristic.
- **Concurrent edits.** Other agents were editing Core source (`AS/runtime/flow-change/`,
  `adaptation-store.ts`, `patches.ts`) and the extension's working documents during this run. The
  baselines reflect the working trees at adoption time. A later Core run found the same 61 lines,
  except that `adaptation-store.ts` moved from 215 to 214.
- **Growth past a baseline entry.** No probe made a baselined file's count grow, because that would
  mean editing another agent's source. The existing baseline tests cover growth.

## Open questions or contradictions found

1. **Handlers that respond to a failure without passing the error are counted.** This follows the
   brief's definition: "a logging or reporting call passed the error". The examples below do make
   the failure visible, so a reader may see them as honest. Each clears with a one-line change that
   passes the error to what it already calls.

   | Repo | Location | What the handler does |
   | --- | --- | --- |
   | Core | `BlankFlowAuthoringPanel.tsx:114` | Sets the preflight state to "rejected" |
   | Core | `StateRawPanel.tsx:17` | Shows "Copy failed" |
   | Core | `CodeViewer.tsx:32` | Shows a global alert |
   | Core | `execution-grants.ts:612` | Revokes the grant, which fails closed |
   | Core | `secret-keys.tsx:85` | Reports the error, but its guard tests the abort signal rather than the error |
   | Extension | `content/picker/messages.ts:84` | Sends a refusal response |
   | Extension | `apps/scenario-lab/src/server.ts:32` and `:43` | Answers 500, but logs the error only under a debug flag |

   Allowing "any visible response" would need a way to tell `setStatus("failed")` apart from
   `.catch(() => resolve())`. Syntax cannot do that, so I kept the rule strict.
2. **The held-promise allowance is a heuristic.**
   - `const p = write(); await p.catch(() => undefined)` passes. It is stated as a hole.
   - All 18 waits it excuses today read as genuine.
   - Tightening it, for example to require that the name was not assigned in the same function,
     would be a follow-up.
3. **The audit is red in both repositories because of other agents' in-progress files.** The
   supervisor needs to clear these before committing:
   - **Core:** 2 `docs-links` anchors in `docs/architecture/automation-studio.md`.
   - **Extension:** the `working-docs` index. `pnpm structure:baseline` would regenerate it; I did
     not run it, because the file is shared.
4. **Findings in files other agents are editing.** Core `AS/storage/project/adaptation-store.ts:214`
   is a best-effort `apply_failed` audit append inside a `catch` that rethrows the original error.
   The marker fits it well.
5. **Clear best-effort candidates.** Many extension instances are cleanup inside failure paths that
   already rethrow, e.g. `rm(temporary).catch(() => undefined)` and `handle.close().catch(...)` in
   `TR/`. Adding `/* best-effort: <reason> */` to each would clear them one by one; I fixed none, as
   the brief required.
6. **Helper move and `.finally` change.** The brief did not ask me to move the helpers or change
   `failure-as-empty`. I did both inside `scripts/structure-audit/**`, which I own, to avoid copying
   about 120 lines. `failure-as-empty` findings are byte-identical in both repositories, and its
   tests pass.
