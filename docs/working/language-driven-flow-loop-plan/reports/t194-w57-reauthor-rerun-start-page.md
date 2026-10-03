# t194-w57: re-author rerun start page (C6, run-muqk713g)

## Outcome

Partial. The Core work the brief let me own is done and tested. I added:

- a reader for where each node started in the refuted run;
- the seed's start pages, kept beside the steps;
- `step-place` putting a seeded step's page back before a rerun;
- a `rerunPlace` note on every rerun result.

The fix still does nothing live. It needs wiring through files I do not own, and through one new host seam (Core plus downstream). The exact proposal is below. Nothing is in `R/flow-bootstrap/authoring/**`. I did not touch `reauthor.ts`, because the run detail reaches the build through `service/runtime-adaptation/reauthor-build.ts`, not through `reauthor.ts`.

## Design

**Where the refuted run holds each node's start page.** The executor captures host state before every attempt (`R/executor/node-execution.ts:144`, `captureHostState(... "before_action")`). It stores that on the trace as `stateRefs.beforeAction` (`R/executor/host-state.ts:47-53`). The run record copies `stateRefs` whole onto `actionAttempts[i].metadata.stateRefs` (`R/service/summaries/conversions.ts:194`). So the refuted run's `AutomationStudioFlowRunDetail.actionAttempts` already holds, for each node, an `AutomationStudioHostStateSnapshotRef` taken before it ran. That ref has `{ stateSnapshotId, stateRef, capturedAt, summary }`. Its only page-identifying content is inside the host's `summary`. For the web, that is `web-llm-page.v3` with a top-level `location` (`domain/src/runtime/host-runtime.ts:104-125`, `published-page.ts:30`). Core reads no domain's summary, so nothing on the record is a host-neutral reset token today.

**The token to use.** A reset already takes the host's own token, carried unread: `{ replay: "reset", from }` (`R/llm/node-tools/replay.ts:92`), where `from` is what the host states as a step's `replay.from`. For the web that is `{ location }` (`domain/.../node-run/replay.ts:98`). The design: the host also writes that same token on its snapshot ref as `from`. Core reads `metadata.stateRefs.beforeAction.from` from **each node's first attempt**, whole and unread. It uses the first attempt because a retry starts where its failed attempt left the page, which is the very thing a rerun must not inherit.

**How it reaches the rerun without touching the dry-run gate.**
- The seed keeps the start pages beside its steps as `startedOnByStepId`, next to `nodeIdByStepId`. It does **not** put them in `replay.from`.
- I checked every reader of `step.replay`. Besides the gate (`flow-draft/dry-run.ts:189,195`), `replay.from` is read as "where this step acted" by:
  - `flow-draft/verify-only.ts:171-172`
  - `flow-bootstrap/instructed-acts/object-binding.ts:107,110`
  - `flow-bootstrap/instructed-acts/quantity-fault.ts:84`
  - `llm/evidence-loop/rerun-request.ts:75`
- Seeding `replay.from` would change those readers' answers, so the seeded steps stay byte-identical. A test asserts that steps seeded with and without start pages are `toEqual`, and that `automationStudioFlowDraftReplayable` is still `false`.
- `step-place` takes a new optional `startedOn`, used only when the step has no `replay.from` of its own. The step's own `from` wins: it is where this build saw the step start.
- A seeded step has no `stateBefore`, so a rerun with a known start page always resets (a navigate, through the same executor and permission gate as any reset).

**When no start page is known.** The rerun still runs where the page is, as before. The place is now `{ kind: "in_place", why: "start_page_unknown" }`, and `automationStudioNodeRerunPlaceNoted` writes this into the result's evidence:

```
rerunPlace: { place: "in_place", reason: "start_page_unknown", detail: "This rerun ran where the page is now, not where its step started: nothing recorded the page the step started on, so the page was not put back. If an earlier call moved the page (another results page, a scroll, a filter), this answer is about that page and not the step's own." }
```

Other outcomes are noted too:
- `{ place: "in_place", reason: "already_on_start_page" }`
- `{ place: "put_back", startPage: "step" | "seeded_run" }`

The note is not added in two cases. An unreachable place already answers `rerun_place_unreachable`. Evidence that is not an object (an array or a string) is left as it is rather than reshaped. This closes the debug gap "no 'ran in place' note in 0042-0060", once wired.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/`.

- `run-start-pages.ts` (new): `automationStudioRunNodeStartPages(run)` maps node id to a copy of the `beforeAction.from` token on that node's first attempt (ordered by `order`). It accepts objects only.
- `draft-from-flow.ts`:
  - The seed takes `startPages?` and returns `startedOnByStepId` (copies), keyed by seeded step id.
  - The steps themselves are unchanged.
  - The header comment explains why the start page is not `replay.from`.
- `step-place.ts`:
  - `automationStudioNodeRerunFromItsPlace` takes `startedOn?`.
  - The place union now carries `in_place.why` (`already_there` | `start_page_unknown`) and `put_back.startPage` (`step` | `seeded_run`).
  - New `automationStudioNodeRerunPlaceNoted(place, ran)`.
  - The existing caller (`llm/evidence-loop.ts:425-427`) reads only `.kind` and `.result`, so it still compiles and behaves as before.
- `index.ts`: exports `./run-start-pages.ts`.
- `tests/run-start-pages.test.ts` (new, 6 tests), `tests/step-place.test.ts` (new, 8 tests), and `tests/draft-from-flow.test.ts` (+4 tests).
  - The step-place scenario test is the C6 shape: five results pages, the page left on 5, and a seeded read built from a fake refuted run through `automationStudioRunNodeStartPages` and the seed.
  - With the start page, the rerun resets to `page=1` and reads 13 rows over 5 pages.
  - Without it, the rerun reads page 5 alone (11 rows, unfiltered), and its result carries the `start_page_unknown` note.

## Wiring proposal (not done: outside my ownership)

In order:

1. **Core seam, `R/host-runtime.ts:15-20`.** Add `from?: JsonObject` to `AutomationStudioHostStateSnapshotRef`: "the host's own token for putting the target back to the state this snapshot was taken in, the same token its tool results state as `replay.from`; Core carries it unread." This is generic, has no web concepts, and is backward compatible: a host without it yields no start pages and the rerun runs in place with the note.
2. **Downstream, `domain/src/runtime/host-runtime.ts` `captureStateSnapshot`.** Return `from: { location }` beside `summary`, using exactly the location that `node-run/replay.ts:98` writes for a step's `replay.from`. Check whether that is the screened or the raw location. A reset to a URL with `(withheld)` in its query would not reach the page.
3. **`R/service/runtime-adaptation/reauthor-build.ts:98`.** Pass `automationStudioRunNodeStartPages(input.detail)` to `deps.generate`, as a 4th argument or an internal request field. Thread it through `refuted-result-port.ts` / `service.ts` into `generateFlowBootstrapAdaptationInternal(input, repairBrief, repairCostLeftUsd, startPages)`. This also serves `step-failure-port.ts`, which shares `reauthor-build`.
4. **`R/service/flow-bootstrap-commands/extend-subject.ts:46`.** Take `startPages` and call `automationStudioFlowDraftSeedFromFlow({ nodes, edges, startPages })`.
5. **`R/llm/loop-configuration.ts:265`.** Add `seedStartedOn?: Readonly<Record<string, JsonObject>>` beside `seed`. In `service.ts:1589`, pass `{ seed: extend.seed.steps, seedStartedOn: extend.seed.startedOnByStepId }`.
6. **`R/llm/evidence-loop.ts:425-427`:**
   ```ts
   const startedOn = rerunReplaces?.id !== undefined && input.draft ? input.draft.seedStartedOn?.[rerunReplaces.id] : undefined;
   const place = rerunReplaces ? await automationStudioNodeRerunFromItsPlace({ step: rerunReplaces, startedOn, now: handling.repeats.state(), callId, executeTool: input.executeTool, signal: input.signal }) : undefined;
   ...
   ran = place?.kind === "unreachable" ? place.result : automationStudioNodeRerunPlaceNoted(place, await input.executeTool({ callId, toolId: decision.toolId, value: decision.input, ...(input.signal ? { signal: input.signal } : {}) }));
   ```
   Step 6 alone (with no start pages) already delivers the "ran in place" note. It is worth landing first. Optionally, also put `rerunPlace` on the decision row in `recordRow` so the trace carries it without the evidence.
7. Add a test beside `llm/evidence-loop/tests/rerun-place.test.ts` that drives the loop with a `draft.seed` plus `seedStartedOn`, like the step-place scenario here.

## Commands run and observed results

- Failing first (tests written before the code): `npx vitest run .../node-tools/tests/{step-place,run-start-pages,draft-from-flow}.test.ts`
  - With no implementation: `Test Files 3 failed (3)`, `Tests 3 failed | 13 passed (16)`. `run-start-pages.test.ts` and `step-place.test.ts` failed to load (`Failed to load url ../run-start-pages.ts`). The three new `draft-from-flow` tests failed with `expected undefined to deeply equal { Object (f2) }`, `expected undefined to deeply equal {}`, and `Cannot read properties of undefined (reading 'f2')`.
  - After `run-start-pages.ts` only, step-place failed on behaviour: `Tests 8 failed | 6 passed (14)`. Examples: `expected { kind: 'put_back', callId: 'r.place' } to deeply equal { kind: 'put_back', …(2) }`, `expected { kind: 'in_place' } to deeply equal { kind: 'in_place', …(1) }`, and `automationStudioNodeRerunPlaceNoted is not a function`.
  - After the implementation: `Test Files 3 passed (3)`, `Tests 30 passed (30)`.
- `npx vitest run src/programs/automation-studio/runtime/llm/node-tools src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-place.test.ts` gave `Test Files 51 passed (51)`, `Tests 590 passed (590)`, both before and after the type fixes.
- `bash .../heavy.sh "t194-w57 pnpm check fluxiq" pnpm check` (in `packages/fluxiq`):
  - Run 1, rc 2: two errors in my code (spreads over a generic in `step-place.ts`; a test import path one level short).
  - Run 2, rc 2: after my fixes, one error in a file I did not touch, `result-verification/read-account/accounts.ts(88,29): Cannot find name 'automationStudioResultReadDedupe'`. Another worker was editing that file concurrently.
  - Run 3: **rc 0**.
- `node scripts/structure-audit.mjs` (Core root): rc 0, `structure-audit: passed (218 warning(s), 349 baselined)`. No warning names a node-tools file.

## Not verified

- No live run and no provider call. Nothing here changes a live run until the wiring above lands.
- Whether stored run details keep `stateRefs.beforeAction` intact through persistence and the run detail read. This is inferred from `conversions.ts:194` and was not observed in a stored record.
- Whether a refuted run's attempt `nodeId` equals the seeded graph node id for nodes run inside a subflow. The debug names `node.bootstrap.<hash>.main.s5`, so they appear to match, but I did not check this against a run detail.
- Whether the Lab's step `result.json` shows evidence keys added by Core (the `rerunPlace` note).
- The concurrent edits by other workers in the same tree (`llm/harness`, `diagnosis-instructions`, `result-verification`, `service/summaries`) are part of what `pnpm check` compiled.

## Open questions or contradictions found

- The brief names `reauthor.ts` as the pass-through. The run detail actually reaches the build through `service/runtime-adaptation/reauthor-build.ts` → `deps.generate` → `service.ts`. `reauthor.ts`'s `generate()` takes no arguments.
- Core cannot get a start page from the run without a host seam: the only page identity on the record is inside the host's opaque `summary`. This needs a Core plus downstream change (wiring steps 1 and 2).

## Commit message

```
Seeded step rerun puts the page back to where its node started in the refuted run

A step seeded from a Flow records no replay.from, so every re-author rerun of
the Flow's list read in run-muqk713g ran where the refuted run left the page
(results page 5: 1 page, 11 items, kept 0) and said nothing about it (C6).

- node-tools/run-start-pages.ts: read each node's first-attempt
  stateRefs.beforeAction.from, the host's own reset token, off the run record.
- draft-from-flow.ts: the seed keeps those as startedOnByStepId beside its
  steps; the steps are unchanged, so the dry-run gate sees the same draft.
- step-place.ts: a rerun with no replay.from of its own resets to startedOn;
  the place says why it ran in place (already_there | start_page_unknown) and
  whose start page it went back to; automationStudioNodeRerunPlaceNoted writes
  rerunPlace into the rerun's result.

Wiring (host snapshot `from`, re-author build -> seed -> loop -> evidence-loop)
is proposed in the t194-w57 report, not done here.

Task: t194
Worker: t194-w57
```
