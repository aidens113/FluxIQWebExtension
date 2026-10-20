# Report: lane-t-p3-d2-final-parity (t742, downstream test-runner)

## Outcome

Done. I replayed the five saved Flows once each, headed and provider-free, with the Lab's default settings (no `FLUXIQ_DOMAIN_ID`). Every trace now reaches parity: 1,069 of 1,069 delivery points matched, with 0 divergences of any class. On the same Flows, D1 had 12 divergences.

Under the defaults every trace had 117-312 events, so parity is not vacuous. That confirms D24: the P2 double-instance defect is fixed.

| scenario | exit | verdict | receipt | events | parity | compared / matched | divergences |
| --- | --- | --- | --- | --- | --- | --- | --- |
| crossborder-marketplace | 0 | passed | replay-mvgvqldo-be73a6e8 | 128 | matched | 128 / 128 | none |
| bigbox-retail | 0 | passed | replay-mvgvvskk-671e4dd7 | 312 | matched | 312 / 312 | none |
| everything-store | 0 | passed | replay-mvgvy8tz-68a1202f | 285 | matched | 285 / 285 | none |
| social-network-feed | 0 | passed | replay-mvgw4hff-a1ac24ef | 227 | matched | 227 / 227 | none |
| job-board (weak Flow) | 1 | failed | replay-mvgw8tcl-6bfaad77 | 117 | matched | 117 / 117 | none |

All five traces had the same health results:

- Completeness was `complete` by Core's evaluator, with 0 issues.
- 0 model calls (`coreProviderCallCount 0`).
- The secret scan checked 3 secrets and found 0 hits in events and 0 in artifacts.
- `parityFailure` was null.
- `tracesSkipped` was 1 in each project. That is D1's earlier trace in the same project, and the filter skipped it correctly.

job-board failed for the same reason as in D1: "the records the Flow stored do not match the task's expected dataset". Core ran its Flow `succeeded` in 16 actions. The Flow comes from a failed build, so its graph is wrong; intake is fine.

**What changed since D1:**

- everything-store now has **0 redacted events**, down from 5. The page-artifact digest is no longer screened as a card number (D21).
- Its 10 `capture_gap`s are gone (D21's session fix and digest exemption).
- The two reorder `nondeterminism` points, at store and social, are gone (D22, parity per causal chain).

### Stored trace size (read from the store, not estimated)

| scenario | logical event bytes | stored bytes | ratio | inline events / bytes | chunked events | digest lists | chunks used / stored bytes | of which used by no other trace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| crossborder | 5,186,814 | 568,930 | 0.110 | 97 / 136,250 | 31 | 30,464 | 404 / 402,216 | 99 / 121,017 |
| bigbox | 16,444,115 | 1,279,173 | 0.078 | 253 / 420,481 | 59 | 96,928 | 772 / 761,764 | 177 / 236,128 |
| everything-store | 30,009,685 | 2,961,158 | 0.099 | 248 / 375,843 | 37 | 234,720 | 2,961 / 2,350,595 | 725 / 579,437 |
| social | 9,081,991 | 836,022 | 0.092 | 173 / 255,247 | 54 | 55,808 | 493 / 524,967 | 135 / 178,894 |
| job-board | 3,956,743 | 461,825 | 0.117 | 96 / 157,259 | 21 | 25,920 | 279 / 278,646 | 62 / 83,222 |
| **total** | **64,679,348** | **6,107,108** | **0.094** | | | | | |

- **Stored bytes** = inline JSON + chunk digest lists + the stored (possibly deflated) bytes of every chunk the trace uses. No legacy 0030 object rows were present: `objectEvents` was 0 everywhere.
- **Marginal cost.** About 75% of each trace's chunks are shared with D1's earlier trace of the same Flow in the same project. The bytes this replay actually added are inline + digest lists + its exclusive chunks: 2,987,618 bytes in total, a ratio of 0.046.
- **Comparison with the store's own measure.** Core's synthetic measure (P3-A) gave 0.045. On a fresh project, the honest single-trace figure is the 0.078-0.117 column.

## What changed and why

The read-back measured nothing real. `summarizeTrace`'s `eventBytes` estimates where events would go from a threshold, which was 0030's inline/object model. Core's store API (`AutomationStudioProjectGatewayTraceStore`) answers events, not storage, and I may not edit Core. So I added a reader in `packages/test-runner/src/trace-inspection/`:

- **`stored-event-bytes.ts`, `readTraceStoredBytes(database, traceId, logicalBytes)`.**
  - It runs aggregate-only SELECTs (counts and `length()`; never a body or a digest) on the lease from Core's `AutomationStudioProjectDatabasePool`. This is the same database, and the same SQL shape, as Core's own `store-chunk-measure.test.ts`.
  - It returns the per-trace fields shown in the table above. It also returns exclusive chunks: chunks no other trace in the project uses.
- **`storage-dedupe.ts`, `readTraceStorageDedupe`.** Covers all the traces read, counting each distinct chunk once.
- **`types.ts`:**
  - new `TraceStoredBytes` and `TraceStorageDedupe`;
  - new `TraceEventSummary` (= `TraceSummary` without `storedBytes`), which is what `summarizeTrace` now returns;
  - `TraceSummary.storedBytes`, which is required;
  - `ProjectTraceInspection.storage`, which is optional. It has to be optional because `saved-flow-replay/tests/replay-tracing.test.ts`, which I do not own, builds stand-in inspections without it. The real read always sets it.
- **`inspect-project-traces.ts`.** Acquires one extra lease from the same pool while the store is open, joins the stored bytes into each summary and adds `storage`. Receipts carry the new fields automatically through `stored-traces.ts`.
- **`summarize-trace.ts`.** Only the return type changed.
- **`index.ts`.** Exports the two new files.
- **New test, `tests/stored-event-bytes.test.ts`, with 3 cases. Each writes through Core's real SQLite store:**
  - small events: everything inline, ratio 1, 0 chunks;
  - two events carrying the same ~48 KB view: both are chunked, and the ratio is below 0.6;
  - two traces with the same view: the edge chunks (which hold trace and event ids) are exclusive, and the rest are shared. The identities `distinctChunks = a.chunks + b.exclusiveChunks` and `storage.storedBytes = outside(a) + outside(b) + distinctChunkStoredBytes` hold. My first version of this test wrongly expected 0 exclusive chunks; the edge chunks are real, and I corrected the test, not the reader.

I left `eventBytes` (the threshold estimate) unchanged, so existing receipts keep their shape. Its inline/object split no longer describes how the store keeps events; use `storedBytes`.

## Commands run and observed results

1. In the Core tree: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
   - contracts and client-gateway-websocket: `reuse`;
   - `fluxiq:build ... "build" ... inputs changed: packages/fluxiq ... "ms":80304`, `Done`, exit 0.
   - Core HEAD is e48ec8fe, with 50 `git status` entries before and after. No Core source was edited.
2. `node scripts/check/core-build.mjs` -> `core-build: FluxIQ Core's build at C:\Users\osrs_\FluxStuff\fxwork\t742\!FluxIQ is current with its source.`
3. `pnpm --filter @fluxiq-web-extension/extension build` -> `chrome: verified 22 files`, `firefox: verified 22 files`, `e2e-chromium: verified 22 files`, exit 0.
4. `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json` -> exit 0 (final).
5. `node --test dist/trace-inspection/tests/*.test.js dist/trace-parity/tests/*.test.js dist/saved-flow-replay/tests/*.test.js dist/saved-flow-replay/provider/tests/*.test.js`
   - Final: `# tests 70 # pass 70 # fail 0`.
   - An earlier run gave `# pass 62 # fail 1` (the shared-chunks test's wrong `exclusiveChunks === 0`; 4 !== 0). It is fixed as described above.
6. `node scripts/structure-audit.mjs` -> `structure-audit: passed (215 warning(s), 618 baselined).`
7. Replays: `test-runs/t742d2-logs/run-all.sh`.
   - It ran `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay <scenario> --workspace t742-<scenario> --flow <id> --project <id> --instruction-task <task>` for each scenario in turn, with `FLUXIQ_DOMAIN_ID` unset (checked: 0 in env).
   - The ids are those from D0. No `--live-llm`, so `lab-slots` were not touched.
   - `exits.txt`: crossborder 0, bigbox 0, store 0, social 0, jobboard 1.
   - The prelude rebuilt `domain:build` and `test-runner:build`, so the replays used the new read-back.
   - Logs are in `test-runs/t742d2-logs/`, receipts in `test-runs/replays/<receipt>.json`.
   - runMs: crossborder 27,524; bigbox 50,057; store 105,798; social 84,427; job-board 29,554.
   - Parity time: crossborder 1,345 ms; bigbox 5,870; store 14,374; social 4,537; job-board 2,881.
8. Extraction: a scratch script (outside the repository) printed only verdicts, counts, sizes and parity groups from the receipts. No payload text was printed.

## Not verified

- **Headed mode.** The Lab's default is headed, and I passed no headless flag, but I did not inspect a window.
- **Repeats and stability.** Each Flow ran once. Run-to-run stability of parity was not measured.
- **Coverage.** Only 5 of the 10 sites are covered (D0: the other Flows live only in forbidden lane trees, or do not exist). Live round traces, and Firefox, are not covered.
- **Unexercised harness paths.** These traces still never exercise: reconnects mid-trace, pairing approval, reconcile questions, host-lease commands, `answer_never_came` and parse failures.
- **Fresh-project size.** I did not take a size reading on a fresh project with no prior trace. The per-trace column counts shared chunks in full, so it equals what a fresh project would store for that trace, up to chunk-boundary effects.
- **Chunk bytes and encryption.** As P3-A noted, chunk bytes sit outside the content store's sweep and encryption. I did not examine this.

## Open questions or contradictions found

1. **The size read-back reads SQL through Core's pool lease, not through a store method,** because the store has no storage-size API. If the lead wants this kept strictly behind Core's store, the fix is a Core method (for example `measureTrace(traceId)`) that this reader would then call. The SQL depends on the 0031 schema and would break silently if the schema changed.
2. **`TraceSummary.eventBytes` (the threshold estimate) is now misleading beside `storedBytes`.** Remove it, or rename it to `logical`, when `saved-flow-replay` and its test can be edited in the same change.
3. **No divergence remains,** so step 4 had nothing to classify.
