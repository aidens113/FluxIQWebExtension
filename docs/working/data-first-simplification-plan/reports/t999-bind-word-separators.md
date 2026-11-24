# t999: a declaration naming a site key binds the column labelled in the page's words

Worker report, 2026-11-23. Brief: `briefs/t999-bind-word-separators.md`.

Trees:
- Core: `fxwork/t999/!FluxIQ` (branch `task/t999-bind-word-separators`, from 27e8fabc9).
- Downstream: `fxwork/t999/!FluxIQWebExtension` (at 1485a34c1, with t997 merged).

No git mutation, no provider or paid call. No behind-Core override was used. The only browser was visible and held to the snapshot sandbox.

## Outcome

**Done.** The earbuds recorded read now binds the declaration exactly as written: `brightaisle_plus` binds to `plus`, and `data-ad-id` binds to `sponsored`.
- Readiness is `ready`, with 11 of 13 expected records matched in order and 44/44 fields.
- The 2 missing records are on pages the run never read; t990 and t997 found the same gap.
- Model, provider and external calls were all 0.

The `model-aliases.ts` rewrite and its tests are removed.

## What changed and why

**Core (`packages/contracts`)**
- `record-sets/process/binding/name-key.ts` (new, one export): `automationStudioRecordBindingNameKey` reads `_`, `-` and runs of whitespace as one space, then trims and lower-cases.
- `binding/bind.ts`: label matching now uses that key instead of `foldedText`. Nothing else changed:
  - an exact id still wins first;
  - more than one match is still `ambiguous`;
  - an exclusion still refuses.
- `cell-text.ts`, which holds `foldedText`, is unchanged, so cell comparisons are unaffected.
- `binding/tests/name-key.test.ts` (new, 11 tests) covers:
  - snake-case, kebab-case, mixed-case and doubled-separator keys bind a worded label;
  - a worded name binds a key-shaped label;
  - an exact id beats a label that matches across separators;
  - two labels that collide after normalisation give `ambiguous`;
  - an exclusion refuses across separators;
  - a name whose words differ binds nothing;
  - the key leaves other punctuation alone;
  - cell `contains` and `equals` still need the `_` or `-`.
- `packages/contracts/package.json`: version 0.23.1 → **0.23.2**.

**Downstream (`packages/test-runner/src/recorded-attempt-replay/read-oracle/`)**
- `command.ts` hands Core the fixture declaration as written. The `declarationAsWritten` input flag and the `declarationRewritten` report field are removed: there is nothing left to switch between.
- `model-aliases.ts`, `tests/model-aliases.test.ts` and the `declarationInRunTerms` export in `index.ts` are deleted.
- `docs/architecture/recorded-offline-proof.md`:
  - The t990 paragraph now says the declaration reaches Core as written and how Core binds it.
  - It notes that the rewrite was removed in t999.
  - It drops the stale claim that stored labels embed a first-item sample, which t997 fixed.

## Commands run and observed results

Every command ran through `heavy-slot.mjs run`, one at a time. Logs are in downstream `test-runs/t999-logs/`.

**Core**
- `npx vitest run src/record-sets/process --maxWorkers=1 --minWorkers=1 --fileParallelism=false` (in `packages/contracts`):
  - first run: 334/335. My own test named one field twice in `columns`, which the strict grammar refuses; I fixed the test.
  - then: **17 files, 335/335 pass**.
- `pnpm --filter @fluxiq/contracts check` → **exit 0**.
- `pnpm --filter fluxiq check` → **exit 0**.
- `node scripts/structure-audit.mjs` → **exit 0**, "passed (569 warning(s), 903 baselined)".
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` → **exit 0**, with all five rebuilt. The first proof attempt (r1) had refused a stale Core build, which is why this rebuild ran.

**Downstream**
- **Evidence:** copied from `fxwork/recorded-evidence/t997/t997-evidence/mwocg0zw` into `test-runs/t999-evidence/`, with a working copy in `test-runs/t999-work/`. `diff -rq` against the original run folder and the t959 store files showed no difference.
- **Proof, as written, before removing the rewrite** (`earbuds-mwocg0zw-aswritten-r2.json`):
  - 4/4 reads admitted;
  - bindings `brightaisle_plus→plus` and `data-ad-id→sponsored`;
  - ready; 62 rows collected, 2 repeats, 11 kept; 11/13 matched in order.
- **Proof, final code with no flag** (`node scripts/lab/run-lab.mjs recorded-read everything-store --task everything-store-plus-earbuds-under-50 --input test-runs/t999-oracle/earbuds-mwocg0zw.json --out test-runs/t999-oracle/earbuds-mwocg0zw-r3.json`):
  - the Lab prelude rebuilt `test-runner`;
  - the result was the same: 4/4 admitted, ready, 11/13, 44/44 fields;
  - 0 model, provider and external calls.
- `node --test --test-concurrency=1` on read-oracle `collect`, `command` and `snapshot-gateway` → **8/8 pass**. The count was 10 before the 2 rewrite tests were removed.
- `pnpm --filter @fluxiq-web-extension/test-runner check` → **exit 0**.
- `node scripts/structure-audit.mjs` → **exit 0**, "passed (259 warning(s), 551 baselined)".

## Not verified

- Core's whole vitest suite and any other Core package's tests (the brief rules out full suites).
- Other Core callers of the binding:
  - the answer-first data stage is exercised by the Lab proof;
  - the run-repair binding paths were not tested.
- The other t990 tasks (hubs, job board, Netherlands, photo) were not rerun as written. Their declarations did not depend on the rewrite (t990 recorded a rewrite only for earbuds), but that is inferred, not observed.

## Open questions or contradictions found

1. **Domain label uniqueness is now looser than Core's binding.**
   - The domain's `structure/stored-labels.ts` (t997) makes labels unique by case and whitespace only. Two stored labels such as `unit_price` and `Unit Price` stay distinct there, but Core's binding now finds them ambiguous.
   - The result is a refusal, never a wrong bind, but a declaration naming either would not bind.
   - The fix is one line: have `stored-labels.ts` fold `_` and `-` as Core does, or import Core's key if it is exported. That file is domain code, which this brief forbids, so it is not done.
2. **The `fluxiq` package version is not bumped.** `packages/fluxiq/**` belongs to t994, so it is left alone. If the release rule wants `fluxiq` bumped alongside a contracts behaviour change, that belongs to whoever owns `packages/fluxiq`.
3. **The name key is not re-exported from the binding barrel.** It is internal to `binding/`. Export it if the domain should share it (question 1).
