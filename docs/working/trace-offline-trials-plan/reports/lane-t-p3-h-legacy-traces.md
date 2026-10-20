# Report: lane-t-p3-h-legacy-traces (t742, Core `fxwork/t742/!FluxIQ` + downstream `fxwork/t742/!FluxIQWebExtension`)

## Outcome

Done. Core's harness now classifies older traces itself, and the downstream runner uses it as is.

- **Round 4 (16 traces).** As recorded, through Core alone:
  - all 16 are `single_session`;
  - 4,274 of 6,941 delivery points match;
  - the other 2,667 are each a v1-disposition capture gap;
  - 0 intake defects, 0 nondeterminism, and no `manifest.artifacts` divergence.

  These are R4's single-session-view figures exactly. The difference is that Core now produces them from the stored trace, with the normalization declared in the report. Before this change, Core matched 0 of 6,941 and reported 16 false intake defects.
- **Replay stores (D2, R4 and repeats; 19 traces in 10 workspaces).**
  - 18 traces are `recorded` and match at every point: 3,333 of 3,333.
  - 1 trace, everything-store `trace.d9d46b`, is refused as a mixed trace. It has 10 capture gaps and 285 of 295 points matched; details below.
- **Downstream.** The single-session labelling and the trace relabelling store are deleted. The runner's CLI arguments and output layout are unchanged.

## What changed and why

### Core (`packages/fluxiq/src/client-gateway/trace-replay/`)

**1. Legacy single-session traces (new `session-references/`).**

`evaluation.ts` (`evaluateClientGatewayTraceSessionReferences`) returns one of three results:

- `recorded`: every inbound, outbound, disposition, lifecycle and artifact event names its session reference. This also covers a trace with none of those events.
- `single_session`: a legacy trace whose own events show it held one session. The `checks` list states each check, all of which must pass:
  1. No event names a session reference. A mixed trace is refused.
  2. The outbound envelopes and lifecycle records name exactly one `sessionId`. Zero or two or more is refused.
  3. They and the hellos name at most one `clientId`.
  4. No `session.connected` comes after the trace's first session-bound event. A reconnect or second session would.
  5. Nothing is sent or received after `session.disconnected`. A disposition settling an earlier input is allowed.
- `refused`, with a fixed `reason` naming the first check that failed.

Supporting modules:

- `attached.ts` (`clientGatewayTraceEventsWithOnlySession`) gives each session-bound event that has no reference the reference `session-1`. That is the reference the replay's own tap gives its one session. It works on an in-memory copy of the events; the store is never written.
- `bound-kinds.ts` holds the five kinds.
- `index.ts` is the barrel.

`replay-trace.ts` evaluates the events first, and then:

- For `single_session`, the walk and the comparison read the attached events. The report gains a new normalization, `session reference of a legacy single-session trace` (`comparison/normalizations.ts`, `onlySession`), whose reason names the checks.
- For `refused`, the walk gets a refusal gap: `the event does not say which session it belongs to, and the trace cannot be shown to hold one session: <reason>`.

`walk/walk.ts`:

- `drive` notes that gap for every session-bound event with no reference, before any feed. This also covers a `session.claimed` record, which was previously skipped without a gap and came out as `intake_defect`.
- The `connect` branch for an unreferenced connect became unreachable, so it is reduced to a guard.
- The file is 398 lines.

`types.ts`: the new `ClientGatewayTraceSessionReferences` type, and a required `sessionReferences` field on `ClientGatewayTraceParityReport`. The field is additive for readers. Core's report writer is the only thing that constructs the type.

**2. v1 dispositions (new `comparison/older-disposition.ts`).**

`clientGatewayTraceOlderDispositionView` applies when the recorded disposition is `client-gateway.trace.disposition` v1 and the replay's is the current v2. It reads the replay's disposition as v1 would have written it: version `1`, payload without `delivered`, key order kept.

In `parity-report.ts`, the comparison then runs against that view:

- **Any difference in a field v1 carries** is classified as usual. Changing `disposition` gives `intake_defect`, as tested.
- **Otherwise**, after the order check, the point is a `capture_gap` with fields `["payload.value.delivered"]` and the detail "the disposition was recorded under schema version 1, which does not record what Core delivered for the message; every field it records matched".

Why a gap at each delivery point rather than one limitation for the whole trace:

- `matched` should keep meaning "compared in full". A single limitation would let 2,667 points read `matched` although what Core handed the caller was never compared.
- A per-point gap tells the reader exactly which points, and how many, could not be fully compared.
- It also keeps every point's status consistent with the rest of the report.

**3. The artifact-list classification (`parity-report.ts`, `artifacts()`).** The old rule looked for a gap reason containing the word "artifact" (old `:137`). The new rule uses the capture gap of any recorded artifact event, whatever its reason. A trace that cannot be fed because of its session reference therefore gets `capture_gap` on `manifest.artifacts`, never `intake_defect`.

**4. Found while testing: outcomes of commands the replay could not issue.** The downstream two-session test showed this.

- The problem: an answer-never-came outcome, or anything else Core derived for a command whose recorded `server.execute_action` the replay could not issue, came out as `intake_defect`.
- The fix: `gapOf` now takes the gap of that command's recorded outbound (`issuedBy`, which replaces the `issuedCommands` set).
- **This also applies to current traces.** If a command's outbound has a capture gap (for example an unreadable command), what Core derived for it is now that gap and not an intake defect.

### Downstream (`packages/test-runner/src/trace-parity/`)

- **Deleted:** `session-evidence.ts` and `single-session-store.ts`. These were the labelling and the read-only relabelling store. The runner switched in the same unit.
- **`check-store-traces.ts`:** one replay per trace through `replayClientGatewayTrace`. It reports:
  - `sessionReferences`: Core's status, or `null` when the harness produced no report;
  - `recorded`;
  - `olderDispositionSchemaOnly`: Core's v1 gaps, counted by their fixed reason and field;
  - the tail, from Core's entries.
- **`types.ts`:**
  - `TraceSessionEvidence` is removed.
  - In `StoreTraceCheck`, `session` becomes `sessionReferences` and `singleSession` is removed.
  - `TraceParitySummary` is unchanged, so Lab receipts are unchanged.
- **`parity-reason.ts`:** keeps the new v1 reason, and the refusal reason only with one of its six fixed refusals. Any other tail is withheld (tested).
- **`index.ts`:** barrel and header.
- **CLI:** `cli.ts` is unchanged. Its arguments and output layout (`{ parity, inspections }`) are the same.
- **Tests:**
  - `check-store-traces.test.ts` is rewritten against Core's behaviour:
    - a session-stripped trace is `single_session`, matched at every point, with the normalization named;
    - with v1 dispositions as well, exactly the dispositions are capture gaps with Core's reason;
    - a current trace is `recorded`;
    - two named sessions are `refused`, with 0 intake defects and the fixed refusal reason.
  - `check-project-trace-parity.test.ts`: the older-fixture test now expects Core's precise refusal reason ("no outbound envelope or lifecycle record names a session id": the fixture's envelopes carry no `sessionId`) and 0 intake defects.
  - `parity-reason.test.ts`: the new reasons, and a withheld tail.

### Tests in Core

- **`trace-replay/tests/replay-legacy-trace.test.ts`** (6 tests):
  - a legacy single-session trace matches, `single_session`, with the normalization listed; the stored copy still has no references;
  - a current trace is `recorded`, with no legacy normalization;
  - v1 dispositions give exactly one gap per disposition, with the rest matched;
  - a changed v1 field gives `intake_defect`;
  - a refused trace keeping its claim record and an answer-never-came outcome gives only capture gaps;
  - a refused two-session trace gives only capture gaps that state the refusal, with `manifest.artifacts` a capture gap.
- **`trace-replay/session-references/tests/evaluation.test.ts`** (9 tests): each refusal rule on its own, the single-session case, and that attaching touches only session-bound events.
- **Mutation checks.** I reverted each change in turn, ran `replay-legacy-trace.test.ts`, then restored and confirmed each restore by `diff`:

  | Reverted | Tests failed |
  | --- | --- |
  | attach | 3 of 5 |
  | v1 view | 2 of 5 |
  | old artifact rule | 1 of 5 |
  | claim record unnoted | 1 of 6 |
  | synthesized outcome not traced to its command | 1 of 6 |

## Commands run and observed results

**Core**, from `packages/fluxiq` unless noted:

- `pnpm exec vitest run src/client-gateway/trace-replay`, final run: `Test Files 6 passed (6)`, `Tests 28 passed (28)`.
- `pnpm exec vitest run src/client-gateway`, after the last source edit: `Test Files 43 passed (43)`, `Tests 267 passed (267)`.
  - The test-only edit that followed (the 6th legacy test) was re-run in the trace-replay run above: 28 passed.
- `pnpm exec tsc --noEmit`: `tsc exit 0`.
- `node scripts/structure-audit.mjs`, from the worktree root: `structure-audit: passed (428 warning(s), 1152 baselined).`
  - There are no findings on `trace-replay/`.
  - The warnings listed nearby are pre-existing: `service/trace-tap/tap.ts` 460 lines, and `programs/automation-studio/runtime/flow-bootstrap/generation-failure/` (19 files; a 678-line test). Neither is mine.
- Core build, from the root: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`.
  - contracts and websocket: `reuse`.
  - `fluxiq:build ... "build" ... inputs changed: packages/fluxiq ... "ms":171447`, then `Done`, `build exit 0`.
  - This was the second build, after the fixes in item 4.
- `node scripts/check/core-build.mjs`, from the downstream root: `core-build: FluxIQ Core's build at C:\Users\osrs_\FluxStuff\fxwork\t742\!FluxIQ is current with its source.`

**Downstream:**

- `pnpm exec tsc -p tsconfig.json`, in `packages/test-runner`: `tsc exit 0`.
  - I removed the stale `dist/trace-parity/session-evidence.*` and `single-session-store.*` first.
- `node --test dist/trace-parity/tests/*.test.js dist/trace-inspection/tests/*.test.js dist/saved-flow-replay/tests/*.test.js dist/saved-flow-replay/provider/tests/*.test.js`: `# tests 77`, `# pass 77`, `# fail 0`.
  - The first run against the first Core build gave 3 failures: the older-fixture reason, my grouping assertion, and the 2 intake defects that led to fix 4.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (215 warning(s), 618 baselined).` There are no findings on `trace-parity/`.

**Re-run:** `node packages/test-runner/dist/trace-parity/cli.js <store>/automation-studio --tail 10 --out test-runs/t742h-checks/<name>.json`, serial.

- **Stores used:**
  - The round-4 stores are R4's working copies in `test-runs/t742r4-stores/`, which R4 had already opened and migrated.
  - The replay stores were copied first from `test-runs/persistent-isolated/t742-*/fluxiq-root/.fluxiq/artifacts/automation-studio` into `test-runs/t742h-stores/`. No live workspace was opened.
- **`exits.txt`:** all 14 runs `exit=0`.
  - Round-4 stores: 13 s, 12 s, 130 s (social), 24 s.
  - Replay stores: 4 to 20 s each.
- **Output:** `test-runs/t742h-checks/{r4,replays}/*.json`. I summarised them with a scratch script that reads only names, counts and screened reasons.

### Round 4: per trace, as recorded, by Core

All 16 traces are `single_session` with verdict `diverged`. The only divergences are v1-disposition capture gaps.

| store (lane) | trace | activity / termination | compared | matched | capture gaps (v1 disposition) | other |
| --- | --- | --- | --- | --- | --- | --- |
| office run-mvgvyaip | 772fdd | exploration / completed | 1,200 (+6 outside) | 728 | 472 | none |
| | faef40 | test / completed | 184 | 116 | 68 | none |
| | 535e84 | test / completed | 161 | 100 | 61 | none |
| | ba1086 | test / completed | 208 | 130 | 78 | none |
| job run-mvgw1854 | 5ef4fa | exploration / completed | 1,328 (+2 outside) | 813 | 515 | none |
| | 53d442 | test / completed | 181 | 111 | 70 | none |
| social run-mvgw3ve5 | 5c07f1 | exploration / completed | 876 (+16 outside) | 540 | 336 | none |
| | 7480fe | test | 126 | 80 | 46 | none |
| | a4d596 | test | 115 | 73 | 42 | none |
| | b414b6 | test | 332 | 215 | 117 | none |
| | e855db | test | 118 | 75 | 43 | none |
| | f53b35 | test | 89 | 56 | 33 | none |
| | b2b598 | test | 117 | 74 | 43 | none |
| | 92d5dd | test | 124 | 79 | 45 | none |
| | 3e3534 | test | 89 | 56 | 33 | none |
| photo run-mvgw7320 | 9d22eb | exploration / failed | 1,693 | 1,028 | 665 | none |
| **total** | 16 | | **6,941** | **4,274** | **2,667** | **0** |

### Replay stores (D2, R4 and repeats): per trace

| workspace | trace | events | sessionReferences | verdict | compared / matched | capture gaps |
| --- | --- | --- | --- | --- | --- | --- |
| auction-marketplace | 1f0541 | 170 | recorded | matched | 170 / 170 | 0 |
| bigbox-retail | 328b69, 23bb51, 56b8f3, d8ed66 | 307, 312, 309, 308 | recorded | matched x4 | all matched | 0 |
| company-website | 0480a5 | 155 | recorded | matched | 155 / 155 | 0 |
| crossborder-marketplace | 90fbd9, 6d383d, 3ace7d, d13e25 | 127, 128, 128, 128 | recorded | matched x4 | all matched | 0 |
| everything-store | 9f5885 (D2) | 285 | recorded | matched | 285 / 285 | 0 |
| everything-store | d9d46b (15:23Z, earlier) | 295 | **refused** | diverged | 295 / 285 | 10: "some of its events name their session and others do not" |
| job-board (t567 Flow) | 6e6fb5 | 155 | recorded | matched | 155 / 155 | 0 |
| job-board-t342-weak | 1578e3, 36c0f8 | 115, 117 | recorded | matched x2 | all matched | 0 |
| local-classifieds | bc0c72 | 55 | recorded | matched | 55 / 55 | 0 |
| professional-network | cfbabf | 85 | recorded | matched | 85 / 85 | 0 |
| social-network-feed | fc2d63, 5da5f2 | 222, 227 | recorded | matched x2 | all matched | 0 |

Totals: 19 traces, 3,628 compared, 3,618 matched, 10 capture gaps, 0 nondeterminism, 0 intake defects.

**The refused trace, `trace.d9d46b`.** Its 10 gaps are:

- 5 inbound `client.action_result` events (sequences 149, 154, 157, 168, 171);
- their 5 dispositions (150, 155, 158, 169, 172).

None of those 10 events carries a session reference, while every other event in the trace does. The trace has no `session.claimed` record, so it was captured before D23. The rule refuses a mixed trace rather than guessing a session for part of it.

The previous harness also left these 10 points as capture gaps, with the old reason. So nothing that used to be compared is lost.

## Not verified

- Why the tap of 15:23 left 5 routed action results in `trace.d9d46b` without a session reference. Later traces of the same flow (`9f5885`) carry every reference. I did not investigate whether the cause is fixed or only did not recur.
- Legacy traces with a reconnect, two sessions, or late events after a disconnect, in real captures. None exist. Synthetic tests cover each refusal rule.
- Full suites (`pnpm check`, `pnpm test`, Core's whole vitest), per the repository's twice-a-day rule. No Lab or live run, and no model calls.
- Whether the Lab's receipts render the new normalization name. `TraceParitySummary` passes normalization names through unchanged; I did not read the Lab script.

## Open questions or contradictions found

1. **Contract change in Core.** `ClientGatewayTraceParityReport.sessionReferences` is a new required field.
   - Core's writer is the only constructor. Readers only gain the field.
   - The downstream runner reads it, and `TraceParitySummary` is unchanged.
   - Anything else outside these trees that builds a report object would need the field. I found none in either tree.
2. **Current traces also change in one case (fix 4).** What Core derived for a command whose recorded outbound the replay could not issue is now that outbound's capture gap, not `intake_defect`. I believe that is the honest class. The supervisor may want to note it.
3. **Unreachable reason.** `walk.ts`'s "the event does not say which session connected" can no longer occur, because an unreferenced event is now gapped before it is driven. The downstream screen still keeps its pattern, which is harmless. A later cleanup can drop it.
4. **The mixed everything-store trace** may deserve a look by whoever owns the tap's inbound routing (`service/trace-tap/tap.ts`, `inboundSinks` routed by command). I did not touch it; it is outside my files.
5. **Core audit warning count.** It is 428 against F2's 427. The extra warning is not on my files; the listed ones are in `flow-bootstrap/generation-failure/`.
