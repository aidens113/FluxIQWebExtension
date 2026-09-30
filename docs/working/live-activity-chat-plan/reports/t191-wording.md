# t191 wording — worker report

## Outcome

Done in my paths. Two things are short of it:

- The package-wide `check` and `test` exit 1. Every error is under `panel/**`, where parallel workers were moving files during my runs.
- Because of that, I ran every non-panel test file through the same bundler setup instead. All 1,035 tests pass.

The overlay, the chat header (`display.detail`) and the new wording function never show a tool id or a result code. The pacing bound and its measured numbers are unchanged.

## What changed and why

### `shared/activity/wording.ts` (new)

It exports `activityWording(event)`, which returns `{ action, outcome, sentence }`, and the type `ActivityWording`. It is pure. It lives in `shared/` so that the chat rows can use the same words as the overlay. It is exported from `shared/activity/index.ts` and re-exported from `background/activity/index.ts`. Existing exports are unchanged.

**Tools.** Tool events are recognised by `detail.kind === "tool"` with `detail.ref`, or, when there is no detail, by Core's "Using X" or "Amending the draft Flow" sentence.

| Tool | Wording |
| --- | --- |
| `core.flow_draft` (`AUTOMATION_STUDIO_FLOW_DRAFT_TOOL_ID`) | "Updating the Flow" |
| `web.detect_repeating_structure` | "Looking for the list of items" |
| any other tool | "Working on the page" |
| `core.run_node` | see below |

`core.run_node` is named from `step.label` or `step.nodeId` when the event has one. The leading word is tried first, then the whole text.

| Words in the node id or label | Wording |
| --- | --- |
| nav, open, visit, back | "Opening the page" |
| click | "Clicking on the page"; "Clicking “<label>”" when there is an authored label; the label as written when it already starts with Click |
| extract, read, list, records | "Reading the list" |
| type, fill, search | "Typing into the page" |
| scroll | "Scrolling the page" |
| wait | "Waiting for the page" |
| snap, inspect, look | "Looking at the page" |

When nothing names the node, the result-code family is used: `web.inspect.*` → "Looking at the page", `core.replay.*` → "Trying the Flow out". Otherwise it is "Trying a step on the page".

**Outcomes.** A tool's end adds " — <outcome>":

| Result code contains | Outcome |
| --- | --- |
| not_found, unobserved, missing, not_detected, empty, … | "couldn't find it on the page" |
| rejected, failed, error, timeout, … | "that didn't work, trying another way" |
| anything else, or no code | "done" |

A failed status with no code gives "that didn't work, trying another way".

**Other events:**
- Decisions (the thinking phase, or a `thought` row): "Thinking about the next step".
- Completion check: "Checking the Flow does what you asked", ending in " — done" or " — not yet, trying another way".
- Run steps: "Running step N of M: <label>", rebuilt from `step`. A label that looks like an id is dropped.
- Core's other sentences are kept when they contain no id. This covers "Saved N records", "Build finished: a Flow is proposed", "Run started", the recovery and repair sentences, and the waiting sentences. A sentence that does contain an id (or is empty) is replaced by the plain wording for its phase.

The raw ids stay on the event (`detail.ref` and `detail.text`) for the expandable chat row.

### Other files

- **`background/activity/pacer.ts`:** `display.detail` is now `bounded(activityWording(event).sentence)` instead of `event.label`. The pacing rules are untouched.
- **Comment-only updates:** the `ActivityDisplay` docs in `shared/activity/activity-display.ts`, and `content/activity-overlay/overlay-view.ts`.
- **Content overlay, checked:** it renders only `display.headline`, `display.detail`, its own "Step N of M", and the phase names as a fallback headline. None of them is a raw id, and there is a test for that.
- **Tests:**
  - New file `shared/activity/tests/wording.test.ts` covers every mapping and every outcome family. Every visible string is asserted not to match `/\b[a-z]+\.[a-z_]+/`.
  - `pacer.test.ts`: expectations now use the human words. The whitespace, empty and bounded test now uses the repairing phase, and an empty sentence now reads as its phase ("Fixing a step that didn't work") instead of `null`. A new test checks that a raw result code never reaches `detail`.
  - `activity-relay.test.ts`: the 40-event bound test alternates `repairing`/`exploring` instead of `thinking`, so its "Sentence N" labels are kept as written. The bound it asserts is unchanged.
  - `activity-replay.test.ts`: over the real t174 trace, it now asserts that no paced headline or detail, and no overlay view text (expanded or collapsed), matches the id pattern. A new test lists the whole build's sentences: 14 distinct ones.
  - `overlay-view.test.ts`: a new test covers the fallback headlines and the step text.

## Commands run and observed results

**Quick loop.** A scratch esbuild runner (the same config as `test-extension.mjs`) ran the activity and overlay tests: `# tests 70 # pass 70 # fail 0`.

**Every non-panel test, after the final rename.** 127 files, run with the same runner, output to `.test-build-scratch/t191-wording-subset` (removed afterwards), through `heavy.sh "t191 wording non-panel tests"`: exit 0, `# tests 1035 # pass 1035 # fail 0`.

**Replay measurement** (t174, 259 lines, 202 events):

| Measure | Before this change (t191 round 1) | After (with wording) |
| --- | --- | --- |
| t185 heading | 103 / 0.52 per s / max 3 | same (Core input) |
| t185 detail | 188 / 0.95 / 4 | same |
| paced headline | 2 / 0.01 / 1 | 2 / 0.01 / 1 |
| paced detail | 128 / 0.65 / 2 | 128 / 0.65 / 2 |
| paced page sends | 128 / 0.65 / 2 | 128 / 0.65 / 2 |
| shortest gap between working sentences | 1,200 ms | 1,200 ms |
| gap before the settle | 250 ms | 250 ms |

**Package check.** `EXTENSION_TEST_BUILD_LABEL=t191-wording bash heavy.sh "t191 wording check" pnpm --filter @fluxiq-web-extension/extension check` → exit 1. The only errors:
- TS2307 in `src/panel/automations/*`, `src/panel/chat/*` (`./chat-target`, in an earlier run);
- the popup and side-panel bundles failing on `src/panel/index.ts` and `src/panel/shell/*`.

There were no errors outside `panel/`.

**Package test.** `heavy.sh "t191 wording test" pnpm --filter @fluxiq-web-extension/extension test` → exit 1. esbuild could not resolve imports in:
- `src/panel/automations/controller.ts`;
- `src/panel/recording/tests/record-control.test.ts`;
- `src/panel/settings/tests/*.test.ts`.

No test ran.

**Structure audit.** `node scripts/structure-audit.mjs`: my first name, `activity-wording.ts`, broke the shared-prefix naming rule (three `activity-*` files), so I renamed it to `wording.ts`. After that, the one remaining violation is in `panel/getting-started/start-view.ts`, which is not mine.

## Not verified

- A full-package `pnpm test` or `check` pass, which was blocked by the parallel `panel/**` restructuring.
- No browser run, as the brief says.
- Real `core.run_node` tool events from Core carry no node id or label. The observer passes only `toolId`, so in live builds exploring steps read "Trying a step on the page" unless the result code names them. The node-hint path is covered only by unit tests.

## Open questions or contradictions

- **Node names need a Core change.** To get "Opening the page" or "Clicking …" during a build, Core's observer (`observer.ts` `toolActivity`) would have to put the call's node id or label on the event, for example in `step.nodeId` and `step.label`, or put the `callId` in `detail`. The t174 trace shows `callId`s such as `nav.start` and `click.voltbay-item` that would map well. I did not touch Core.
- **Empty sentences.** An empty Core sentence now shows its phase's words instead of no detail. I chose that because the brief asks for human words always. Say if an empty detail is wanted instead.
- **No draft-tool events in the trace.** The t174 trace has no `core.flow_draft` tool calls: its drafts are `decide … kind=amend_draft`. "Updating the Flow" is therefore covered by unit tests only.
