# t191 core wording — worker report

## Outcome

Done.

- Core now names each tool call and each run step from the call's own input. The extension uses those words.
- The contract already had room for this: `detail.title`, `detail.kind` and `phase` carry it. `packages/contracts` is untouched.
- One extension test fails in the full run. It is a relay timing test in a parallel worker's area, and it does not touch wording (see Commands).

## What changed and why

### Core (`!FluxIQ`, `packages/fluxiq/src/programs/automation-studio/runtime/`)

**New directory `activity/wording/`**, with its own barrel. It is a directory so that `activity/` stays under the 15-file advisory threshold.

- `human-label.ts` — `automationStudioActivityHumanLabel(text, max)`:
  - keeps a person's words, with whitespace collapsed and surrounding quotes stripped;
  - returns nothing for an id-like string (no space and a dot) or an empty one;
  - bounds the length.
- `action.ts` — `automationStudioActivityAction({ id, parameters, label })`. It returns, in order of preference:
  1. the authored label;
  2. otherwise the verb named by the id's last segment, with the element's name when the step carries one: `parameters.element.accessibleName`, the element identity that a resolved node keeps in the Flow. For example "Clicking “Get a free quote”", "Typing into “Search”".
  3. otherwise the verb alone: "Opening a page", "Looking at the page", "Reading the list", "Looking for the list of items".
  4. otherwise `undefined`.

  The verbs are generic words only; no domain id is hardcoded. It never reads typed text, URLs or evidence.
- `tool-call.ts` — `automationStudioActivityToolCall(call)` returns `{ phase, kind, title, label, dryRun, node? }`, worked out from `callId`, `toolId` and `value`:
  - **Dry-run step** (`callId` starts with `dryrun.`): phase `verifying`, kind `tool`. Label: "Trying the Flow from the start: clicking “X”".
  - **Dry-run reset** (`value.replay === "reset"`): phase `verifying`, kind **`note`**. Title: "Putting the page back to where the Flow starts". Label: "Trying the Flow from the start".
  - **Core's opening call** (`callId` starts with `initial.`): phase `exploring`, kind **`note`**.
  - **Draft tool:** phase `building`, "Updating the draft Flow".
  - **Any other call:** phase `exploring`, kind `tool`. Named by its action. The fallbacks are "Trying a step on the page" for `core.run_node` and "Working on the page" for any other tool.

**`activity/observer.ts`**
- `toolActivity` now uses the describer above:
  - `detail.title` is the human action;
  - `detail.ref` is still the tool id;
  - `detail.text` is `Result: <code> · Node: <node id>`, the raw record, starting with `Result:` as before;
  - `label` is the human sentence. When the call ends, it adds " — done", " — didn't work" or, for a dry-run code `core.replay.*` other than `replayed`, " — didn't work the same way again". The label never contains a raw code.
- U11 wording, which comes from here: "Checking the proposed result" is now "Checking the proposed Flow". "The proposed result passed its check" is now "The proposed Flow’s plan checks out; it still has to run cleanly", and "The proposed result was refused" is now "The proposed Flow was sent back to be fixed". `detail.title` stays "Completion check".

**`activity/step.ts`**
- It takes two new optional inputs, `definitionId` and `parameters`.
- The label reads "Running step N of M: <action>". The action is the authored label, or the verb with the element name.
- A label that is an id is dropped, both from the sentence and from `step.label`.
- With no action, the label is "Running step N of M" and `detail.title` is "Step N of M". The node id appears only in `detail.ref` and `step.nodeId`.

**Other Core files:**
- `activity/index.ts` re-exports the three new functions.
- **The one call site outside `activity/`** is `runtime/executor/graph-run.ts:455`. It now also passes `definitionId: currentNode.definitionId, parameters: currentNode.parameterValues`, and nothing else changed there. `service.ts`, `llm/**`, `flow-bootstrap/**` and `contracts/**` are untouched.

**Tests:**
- New `activity/wording/tests/wording.test.ts` covers the three pure functions: labels, verbs, element names, ids never used as names, typed values never read, dry-run and bookkeeping marking.
- New `activity/tests/wording.test.ts` covers the observer and step events end to end: no raw id in any label or title, the evidence never reaches the event, the refused-action wording, the dry-run wording, the U11 sentence, and run steps without node ids.
- `activity/tests/scope.test.ts`: the untitled step's title is now "Step 6", no longer the node id "n3".

### Extension (`apps/extension/src/shared/activity/`)

**`wording.ts`.** Its exports are unchanged. `ActivityWording` gains one field, `internal: boolean`.
- **Core's words first.** For a tool row, the action is Core's sentence up to " — ", or else `detail.title`, whenever it is human and not "Using X". The draft tool still reads "Updating the Flow". The old id heuristics remain as the fallback.
- **Internal rows.** A `note` row with a `ref`, in phase `exploring` or `verifying`, is treated as a tool row and marked `internal: true`, so a reader can hide it. Nothing reads `internal` yet: the pacer is not my file.
- **Outcomes:**
  - `core.replay.changed` and `core.replay.unreproducible` now read "it didn't work the same way again". Before, they read "done".
  - The result code is read from `Result: X · Node: Y`.
  - Whether a call has ended now comes from `detail.status` when there is one. Before, a label ending in ":…" counted as ended, and that would have misread the dry-run label "…: clicking “X”".
  - A code is taken from the label only in the legacy "Using T: code" form.
- **Completion check:** it recognises the new sentences. A passed check whose sentence says "checks out" reads "Checking the Flow does what you asked — the plan checks out, it still has to run cleanly". The legacy "passed its check" still reads "— done", which is what the parallel worker's replay test expects.
- **Run steps:** Core's "Running step N of M: <action>" is kept when it is human. Otherwise the sentence is rebuilt from `step`, as before.
- **U6:** a name is whitespace-collapsed and stripped of its own quotes before it is wrapped in “ ”, and "Click…" is matched on a word boundary.

**`tests/wording.test.ts`:** six new tests covering Core's human titles, dry runs, the internal flag, the new check sentences, run steps and U6 spacing and quoting. The existing tests are unchanged.

## Before and after, from the real trace fixture

**Method.** Each tool call in `T174_BUILD_TRACE` (64 calls) was passed through the new Core observer, via a temporary vitest file that has been deleted, and then through the new extension `activityWording`.

**A limit of the fixture.** The trace logs `callId`, `toolId` and the result code, **not the tool input**. So the node verb and the element name cannot come from it:
- exploration calls fall to the plain fallback;
- dry runs fall to "running a step".

| Count | Before (Core label) | After (Core label) | Kind | After (extension sentence) | Internal |
| --- | --- | --- | --- | --- | --- |
| 34 | Using core.run_node: web.action.succeeded | Trying a step on the page — done | tool | Trying a step on the page — done | no |
| 16 | Using core.run_node: core.replay.replayed (callId `dryrun.N.P`) | Trying the Flow from the start: running a step — done | tool | Trying the Flow from the start: running a step — done | no |
| 5 | Using core.run_node: web.inspect.succeeded | Trying a step on the page — done | tool | Trying a step on the page — done | no |
| 4 | Using core.run_node: core.replay.replayed (callId `dryrun.N.reset`) | Trying the Flow from the start — done | note | Trying the Flow from the start — done | **yes** |
| 3 | Using web.detect_repeating_structure: web.structure.detected | Looking for the list of items — done | tool | Looking for the list of items — done | no |
| 2 | Using core.run_node: web.action.rejected.target_unobserved | Trying a step on the page — didn't work | tool | Trying a step on the page — couldn't find it on the page | no |
| 1 | Using core.run_node: web.action.rejected.not_at_start_location (callId `initial.core.run_node`) | Looking at where the Flow starts — didn't work | note | Looking at where the Flow starts — that didn't work, trying another way | **yes** |

**The first sample run caught a fallback error.** On that run, the 39 `core.run_node` rows in the first and third lines of the table read "Working on the page", because a run-node call with no `node` fell to the generic fallback. I fixed it to read "Trying a step on the page" and added a test for it.

**With the real input shapes.** These inputs are the ones the domain's own tests use, and they are asserted in the Core tests:

| Input | Sentence |
| --- | --- |
| `{node:"web.output.dom-click", parameters:{element:{accessibleName:"Get a free quote"}}}` | "Clicking “Get a free quote”" |
| the same, as dry-run step `dryrun.2.6` | "Trying the Flow from the start: clicking “Get a free quote”" |
| `{node:"web.output.browser-navigate", parameters:{url}}` | "Opening a page" |
| `{node:"web.output.dom-capture_snapshot"}` | "Looking at the page" |
| a run step with id-like label `node.bootstrap…`, definition `web.output.dom-click` and an element name | "Running step 1 of 7: Clicking “Get a free quote”" |
| a run step with no known verb | "Running step 3 of 7" |

## Commands run and observed results

**Core activity tests.** `npx vitest run src/programs/automation-studio/runtime/activity --minWorkers=1 --maxWorkers=2` (in `packages/fluxiq`) → 5 files passed, 36 tests passed. That was the final run, after the move into `wording/`.

**Core check.** `bash heavy.sh "t191 corewording core check" pnpm --filter fluxiq check` → `tsc --noEmit`, exit 0. It ran twice: before and after the move.

**Core structure audit.** `node scripts/structure-audit.mjs` → `structure-audit: passed (194 warning(s), 354 baselined)`, the same count as before my change.
- The intermediate layout, with 17 files flat in `activity/`, added one advisory `directory-files` warning. I removed it by moving the three new files into `wording/`.
- The audit's line "1 baseline entries can be lowered" was already there before my change.

**Extension quick loop.** A scratch esbuild runner (`scratchpad/t191cw-run.mjs`, the same config as `test-extension.mjs`, output to `.test-build-scratch/t191-corewording-quick`) ran `shared/activity/tests/wording.test.ts` and `background/activity/tests/activity-replay.test.ts` → 20 tests, 20 passed, 0 failed.

**Earlier pacer and relay failures, not from wording.** An earlier quick run of `pacer.test.ts` and `activity-relay.test.ts` had 6 failures. All were headline or echo assertions: for example, a "Build failed" detail was dropped by `isHeadlineEcho`, and the headline changed between repairing and exploring. The events involved have no `detail`, and their wording output is unchanged. The files behind them are `headline.ts`, `headline-echo.ts` and `unit-situation.ts`, which the parallel worker was editing at the time. By the full run below, they passed.

**Extension check.** `EXTENSION_TEST_BUILD_LABEL=t191-corewording bash heavy.sh "t191 corewording ext check" pnpm --filter @fluxiq-web-extension/extension check` → exit 0.

**Extension test.** `bash heavy.sh "t191 corewording ext test" pnpm --filter @fluxiq-web-extension/extension test`, with the same label → exit 1, `# tests 1304 # pass 1303 # fail 1`.
- The one failure is `activity-relay.test.ts:339`, "a finished status is re-drawn on a new page while it is still showing, not after it has faded": expected 1 delivery, got 2.
- That is done-visible timing, from the untracked `shared/activity/done-visible.ts` owned by the parallel worker. It does not involve tool wording.

## Not verified

- **No browser run,** as the brief says.
- **Exploration-time element names.** An exploration call names its element only by an opaque handle (`target: {handle}`), so during exploring the action is "Clicking on the page" without a name. The name exists only in the domain's handle store (`target-packets.ts`) and in the evidence, which the brief forbids as a source. Dry runs and real runs do carry `element.accessibleName` in `ranWith` and `parameterValues`, so they are named.
- **Which page is opened.** "Opening a page" does not say which page. The URL is not an authored label or an accessible name, so I excluded it. "Opening the services page" would need the URL, or a page title, to be allowed as a source.
- **Hiding internal rows.** Nothing hides the `internal` rows yet: the pacer, overlay and chat rows belong to the parallel worker. The parallel worker's `activity-replay.test.ts` fixture builder (`build-trace-events.ts`) still emits the old Core shapes, so its sentence set is unchanged.
- **Node names in executor-run steps.** A real Flow's `parameterValues` for a web output node is assumed to carry `element.accessibleName`, which is what `resolve-plan-node.ts` and `element-identity.ts` produce. I did not check this on a stored Flow.

## Open questions or contradictions

- **U11's cause lies outside `activity/`.** The sentence is emitted at `runtime/activity/observer.ts:76` (formerly line 63), and its wording is fixed. However, `llm/evidence-loop/completion-attempt.ts:47-60` runs `checkCompletion` *before* the dry run, so the check can pass while the dry run then refuses. That ordering is why the old sentence was wrong. Run 18's "completion 48 accepted with no dry run although dry runs 4 and 5 found step 8 unreproducible" is a separate loop decision in `llm/**`: it belongs to t174 (new cause A) and was not touched.
- **One sentence the parallel worker may want to update.** `activity-replay.test.ts` expects "Checking the Flow does what you asked — done" only because its fixture emits the legacy "passed its check". Once the fixture emits Core's new sentence, that expectation becomes "— the plan checks out, it still has to run cleanly".
