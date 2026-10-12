# t468 — dev tests failing after the Codex-supervised merges

## Outcome

Done. I fixed all three failures. Two were code regressions and one was a test bound that had gone out of date. No test was weakened.

| # | Test | Broken by | Wrong side | Fix |
| --- | --- | --- | --- | --- |
| 1 | Core `plan/tests/extraction-vocabulary.test.ts`, the 3,000-byte entry bound | Core `6e353ace` (t458, merge `0cfb4f45`) | Test (outdated bound) | Bound set to 4,000 with the reason recorded |
| 2 | Core `verification/tests/durable-session.test.ts` (10 tests) | Core `1c0374ea` (t454, merge `4fcb0940`) | Code (migration ID collision) | Candidate-verification migration renumbered `0025_…` → `0029_…`; ordering guard added |
| 3 | Downstream `live-llm/tests/authoring-mode-env.test.ts` (2 tests) | Core `4c1e0f1a` (t450, merge `b27c0d64`) | Code (Lab default followed Core's default) | Lab owns its default, `legacy` |

## What changed and why

### 1. Extraction-vocabulary entry size

The extraction node's catalog entry grew from about 2,500 to 3,769 bytes. The cause is t458, "fix: publish supported record-output processing contract". It appended `processingText()` (dedupe/where/sort/limit/columns/minRows) to the recordOutput help in both full and condensed form. That added about 1,270 bytes, which I measured with a temporary probe test and then deleted.

The growth was intended. Core's `docs/architecture/automation-studio-native-nodes.md` records the change: "Flow-authoring catalog entries ... publish the parser's supported `process` shapes in both full and condensed help". It also fits the no-catalog-budget rule of 2026-09-30.

The 3,000 bound is a cost tripwire ("so a change that doubles it is visible here"). It fired on that intended addition, but nobody updated it. I set it to 4,000, which sits just above the intended entry. The comment above it now names t458 and the measured sizes. The other assertions are unchanged: the grammar arrives whole, `withheldParameterText` is undefined, and `usedBytes` equals the catalog size.

- Changed: Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`

### 2. Durable session: "Automation Studio migrations must have unique, ascending IDs."

`AutomationStudioCandidateVerificationStore.open` runs `[...AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS, AUTOMATION_STUDIO_CANDIDATE_VERIFICATION_MIGRATION]`. The runner requires IDs to ascend by string order.

- t454 (`1c0374ea`, "fix: persist recording timelines with durable identity and restart proofs") appended `0025_recording_stream_identity_index` to the administration list.
- The candidate migration has been `0025_candidate_verification_receipts_v1` since `59ebc780` (2026-10-07). Because `"0025_c…" < "0025_r…"`, every open of the candidate store has thrown since t454.
- The other three ledger-extension stores were unaffected: accepted-state is `0026`, command-ledger `0027` and authority-guard `0028`.

The fix renumbers the candidate migration to `0029_candidate_verification_receipts_v1`. I left the recording migration alone for two reasons. It may already be applied in live project databases, and its statements are non-idempotent `create table`/`create trigger`, so renumbering it would fail on those databases.

The candidate statement is `create table if not exists`. A project that already applied the old `0025_candidate…` ID therefore just records the new ID as well. The runner only checks IDs in its own list, so the old ledger row is harmless.

To stop this recurring as an unexplained failure in another store's tests, I added a guard to `storage/project/tests/administration.test.ts`. It runs `it.each` over the four stores that append to the administration list and asserts that each one's ID is not an administration ID and sorts after the last one. The message names both IDs.

I checked that the guard fires. With the old ID temporarily restored it failed with: `0025_candidate_verification_receipts_v1 must sort after 0025_recording_stream_identity_index`. I then put the new ID back.

I first wrote the guard as its own file. That took `storage/project/tests/` to 26 files and the Core structure audit failed (directory-files limit is 25), so I folded it into `administration.test.ts`.

The candidate store test asserted the old ID as a literal. It now reads `AUTOMATION_STUDIO_CANDIDATE_VERIFICATION_MIGRATION.id`. That test was failing for the same reason (it was not in the brief's list).

- Changed: Core `packages/fluxiq/src/programs/automation-studio/storage/project/candidate-verification/migration.ts`
- Changed: Core `.../storage/project/candidate-verification/tests/store.test.ts`
- Changed: Core `.../storage/project/tests/administration.test.ts`

### 3. Lab authoring-mode default

When no `--authoring-mode` was given, `labAuthoringModeValue` returned Core's `AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT`. That was harmless under t338, when Core's default was `legacy`. t450 (`4c1e0f1a`) changed Core's configured product default to `candidate`, which silently moved every Lab run that names no mode to candidate.

The intended contract is that the Lab default stays `legacy`. Three things say so:

- **The t450 brief:** "Must not touch: ... Lab defaults" (`live-testing-handoff-audit-2026-10-11/archive/2026-10-11-settled-worker-briefs.md`, Brief: candidate-default).
- **`docs/architecture/build-loop.md`, as updated during t450 (`f0fbcbd0`):** "The Lab starts each Core in the mode a run names (`--authoring-mode`, `legacy` by default); the current creation-qualification lanes explicitly select `candidate`".
- **The rest of the Lab:** `testing-facility.md` (t338 section) and `planLiveLlmExecution`, whose `coreAuthoringMode` default is `"legacy"`.

The test therefore measured the intended behaviour and the code was wrong. I changed `authoring-mode-env.ts` to use a Lab-owned constant, `LAB_DEFAULT_AUTHORING_MODE = "legacy"` (not exported), in place of Core's constant. I also corrected its header comment, which still described candidate mode as "nothing executes". In the test I changed only the first test's title (the default is the Lab's, no longer Core's) and the header comment. The assertions are untouched.

- Changed: downstream `packages/test-runner/src/live-llm/authoring-mode-env.ts`
- Changed: downstream `packages/test-runner/src/live-llm/tests/authoring-mode-env.test.ts`

## Commands run and observed results

All Core commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t468/!FluxIQ`. All downstream commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t468/!FluxIQWebExtension`.

**Reproduce, before the fix.** Ran `npx vitest run <extraction-vocabulary.test.ts> <durable-session.test.ts>` in `packages/fluxiq`:
- Observed `Tests 11 failed | 4 passed (15)`.
- The extraction failure was `expected 3769 to be less than or equal to 3000`.
- The durable-session failures were `Automation Studio migrations must have unique, ascending IDs.` at `schema-migrations.ts:293`, called from `candidate-verification/store.ts:16`.

**Core tests, after the fix.** Ran `npx vitest run` on:
- `extraction-vocabulary.test.ts`
- `verification/tests/` (controller, detached-execution, durable-session, process-restart)
- `candidate-verification/tests/`
- the first version of the guard file
- `accepted-state/`, `authority-guard/`, `command-ledger/`

Observed `Test Files 13 passed | 3 skipped (16)` and `Tests 197 passed | 6 skipped (203)`. The 3 skipped files were already skipped. durable-session showed 10 tests, all ✓.

**Guard, after moving it.** `npx vitest run storage/project/tests/administration.test.ts` reported `Tests 11 passed (11)`.

**Core typecheck.** `pnpm check` in `packages/fluxiq` (`tsc --noEmit`) printed no diagnostics, and its last line was the build-cache "build" record. I ran it once before and once after moving the guard.

**Core structure audit.** `node scripts/structure-audit.mjs` exited 0 with no violations, and printed `structure-audit: 2 baseline entries can be lowered.` I did not update the baseline; see Open questions.

**Core libraries.** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` exited 0. The downstream `core-build.mjs` check required this rebuild.

**Downstream build.** In `packages/test-runner` I ran `core-build.mjs && domain-dist.mjs && build-cache test-runner:build -- "clean-dist && tsc -p tsconfig.json"`. It exited 0, so the test-runner typecheck is clean.

**Downstream target test.** `node --test dist/live-llm/tests/authoring-mode-env.test.js` reported `# tests 4 # pass 4 # fail 0`.

**Downstream tests beside the change.** `node --test dist/live-llm/tests/*.test.js` reported `# tests 146 # pass 146 # fail 0`.

**Downstream consumers of the mode.** I ran `node --test` on these files:
- `chat-build.test.js`
- `readiness.test.js`
- `lane.test.js`
- `lane-candidate.test.js`
- `candidate-draft.test.js`
- `build-from-chat.test.js`
- `tests/commands.test.js`
- `tests/environment.test.js`

Observed `# tests 116 # pass 116 # fail 0`.

**Downstream structure audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (186 warning(s), 646 baselined).` and exited 0.

## Not verified

- I did not run the full suites in either repository (user rule).
- Upgrading a real project database that already applied `0025_candidate_verification_receipts_v1` is reasoned from the runner code and the idempotent statement, not exercised by a test.
- I ran no live or Lab runs. The Lab default change only affects runs that pass no `--authoring-mode`; per build-loop.md, the qualification lanes pass `candidate` explicitly.

## Open questions or contradictions found

- **Live runs since t450 may have used candidate mode without saying so.** Any Lab run or campaign launched after t450 without `--authoring-mode` started Core in candidate mode, contrary to build-loop.md. Such runs recorded `coreAuthoringMode: candidate` in `snapshots/live-llm.json`, so they can be identified. The supervisor may want to check whether any recent evidence relied on that.
- **The ledger-extension ordering is fragile by design.** Any future administration migration numbered at or above `0029_c…` will break one of the four extension stores again. The new guard test now names that failure directly, but the design itself is unchanged.
- **The Core audit's "2 baseline entries can be lowered" note.** I left `.structure-baseline.json` alone (not in my files). I did not check whether those two entries existed before my change.
- **Other affected test:** besides the brief's list, `candidate-verification/tests/store.test.ts` was also failing on dev for the same reason. It is fixed.
