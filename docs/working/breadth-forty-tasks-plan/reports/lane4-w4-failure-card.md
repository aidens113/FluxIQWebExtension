# lane4-w4-failure-card (live-lane-4, t567)

## Outcome

Done. A failed build's chat now reads in plain words. The changes are in Core and the extension. Nothing was committed.

## What changed and why

Where the texts came from (traced through run `run-mvcwqwec-0aa4f98b`, its `global.sqlite` ending record and `events.ndjson`):
- **The act list.** `project-agents/supervisor/left-on-target.ts` builds `note` from the ledger's `did` strings. The ledger itself is in `flow-bootstrap/site-reset/ledger.ts` and was not touched. Example: `click "X" link (declared no lasting act, but had an effect: possibly lasting)`. `service/project-build/run.ts` `toldEnding` then put that note into the failed build's chat note row.
- **The ending sentence.** It combines two things:
  - `conversations/commands/progress.ts`: "the supervisor ended it because it could not finish the Flow".
  - The supervisor model's free-text reason, after `automationStudioActivityReasonText`. That screen turned `flow_bootstrap.evidence_completion_plan_invalid` into "flow bootstrap.…" and `(bootstrap.source_port_cardinality)` into "(bootstrap.source port cardinality)".

Core (`C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`):
- **`activity/wording/left-told.ts` (new):** `automationStudioActivityLeftTold(acts, possibly)` rewrites the ledger's acts for the person.
  - Each act appears once, as verb plus name: "clicked “No thanks”". Names under one verb are grouped.
  - Typing, scrolling and navigating are left out, and so are controls with no readable name (the `"–" div`).
  - The latest 5 are named and the rest are counted.
  - When nothing is left it says so plainly: "The build left no change on the site that it knows of."
  - Acts still in place are said with why they cannot be undone, where that applies.
  - It is here rather than in `supervisor/`, because both `supervisor/` and its `tests/` would otherwise go over the 25-file structure limit.
- **`activity/wording/ended-reason.ts` (new):** `automationStudioActivityEndedReason(reason, max)` is the backstop for the model's reason.
  - It drops parenthesised asides that hold a code.
  - It drops any sentence or clause that holds a dotted code (`a.b_c`), or that names build machinery: subflow, brief, builder, proposal, bootstrap, evidence loop, port, declared, lasting act, supervisor, revision, assembly, candidate, refusal, ledger.
  - A clause whose following clause was dropped is ended with a full stop.
  - What is left goes through the existing reason screen. If nothing is left, it returns undefined.
  - A word counts as a code only if it contains `_`, so "example.com" and "e.g." are kept.
- **Barrels:** both new helpers are exported from `activity/wording/index.ts` and `activity/index.ts`.
- **`project-agents/supervisor/left-on-target.ts`:** adds a `told` field with the person's words, and passes `{ note, told }` to `leftAtEnding`. The ledger's `note` and `reason` are unchanged, so the build record and evidence keep the full technical detail.
- **`project-agents/supervisor/ports.ts`:** `leftAtEnding` now takes `{ note; told? }`.
- **`service/project-build/run.ts`:**
  - The chat row, the provider-unavailable message and the time-limit text now use `left.told`.
  - The supervisor's reason now goes through `automationStudioActivityEndedReason`.
  - `ENDED_WORDS` now reads "FluxIQ could not finish the Flow." or "FluxIQ stopped with the Flow only partly built."
  - `NOTHING_LEFT` now reads "The build left no change on the site that it knows of."
  - The record reason is still stripped of the ledger note as before.
- **`conversations/commands/progress.ts`:** the supervisor-ending words are now "FluxIQ could not finish the Flow" and "FluxIQ stopped with the Flow only partly built".
- **Supervisor guidance (generic, no scenario wording):**
  - `project-agents/supervisor/guidance.ts`, step 7: the person reads your reason as it is, so write it in plain words, saying what could not be done and why. No codes, tool or subflow names, or build terms.
  - `project-agents/supervisor/completion.ts`: the same instruction as the `reason` field's schema description.
- **Tests:**
  - New: `activity/wording/tests/left-told.test.ts` (the screenshot's presses), `activity/wording/tests/ended-reason.test.ts` (the screenshot's reason, which now yields nothing), and a screenshot-case test added to `project-agents/supervisor/tests/left-on-target.test.ts` using the real ledger.
  - Updated for the new wording: `conversations/commands/tests/plain-failure.test.ts`; `service/project-build/tests/project-build-{facade,reset,time-limit}.test.ts`; `service/tests/provider-unavailable-authoring-modes.test.ts`.

What the screenshot's case now renders:
- **Note row:** "FluxIQ could not finish the Flow." with the text "The build left no change on the site that it knows of. It also clicked “Reject non-essential”, “No thanks” and “Platform Engineer”, which changed the page and might have left something behind, so check them if you need the site exactly as it was."
- **Ending:** "The build failed: FluxIQ could not finish the Flow." The existing create-here sentence still follows: the Flow keeps the instruction and can be built again.

Extension (`C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQWebExtension/apps/extension/src/background/activity/`):
- **`supervisor-ending.ts`:** `SUPERVISOR_ENDED` now also matches Core's new plain words, so the toast still recognises a supervisor ending and adds the why. A time limit's words still do not match.
- **`tests/supervisor-ending.test.ts`:** adds a test for the new words, including the time-limit negative.

## Commands run and observed results

- Core, from `packages/fluxiq`: `npx vitest run <runtime>/activity/wording/tests <runtime>/project-agents/supervisor/tests <runtime>/service/project-build/tests <runtime>/conversations/commands/tests <runtime>/service/tests/provider-unavailable-authoring-modes.test.ts` printed "Test Files 69 passed (69) / Tests 540 passed (540)".
  - Before the tests were updated, the run showed 7 and then 2 expected failures. All of them were assertions on the old wording.
- Core: `npx tsc --noEmit -p tsconfig.json` exited 0 with no output.
- Core: `node scripts/structure-audit.mjs` exited 0 and printed "structure-audit: passed (399 warning(s), 1155 baselined)".
  - An earlier run failed on directory-files limits (26 > 25), on failure-as-empty for a JSON.parse catch, and on web-vocabulary for the `click` key. All three were fixed by moving the helpers to `activity/wording`, unescaping without try/catch, and using a verb Map.
  - The only remaining warning on a touched file is advisory: `service/project-build/run.ts` is 414 lines (advisory threshold 400).
- Extension, from `apps/extension`: `EXTENSION_TEST_BUILD_LABEL=lane4-w4 node scripts/test-extension.mjs src/background/activity` printed "# tests 124 / # pass 124 / # fail 0", including "ok 116 - a newer Core's plain ending is still known as the supervisor's, and says why".
- Extension: `npx tsc --noEmit -p tsconfig.json` exited 0, and `npx tsc --noEmit -p tsconfig.test.json` exited 0.
- Extension: `node scripts/structure-audit.mjs` printed "structure-audit: passed (205 warning(s), 638 baselined)".
- No dist builds were run: not Core's, the extension's, or the domain's.

## Not verified

- No live run. The chat rendering in the browser was not checked against a real failed build. The extension shows Core's text as it is, so the new text should appear unchanged.
- Core's other test directories that do not reference these words, and Core's full vitest suite, were not run, as the brief instructed.
- `flow-bootstrap/generation-failure/tests/ended-because.test.ts` passed in an earlier run, but it was not part of the final command.

## Open questions or contradictions found

- The ledger's `did` text is parsed here because the ledger snapshot carries no structured verb or control name. A structured `control`/`verb` on the snapshot act (in `flow-bootstrap/site-reset`, not this worker's to touch) would make the plain words exact rather than parsed.
- Whether typing should count as "may have changed something lasting" is a judgement call. Typed text alone is left out of what the person reads, though it stays in the note that is logged.
- Other files that still say "supervisor" to the person were not in scope: for example `project-agents/supervisor/state.ts`, "The supervisor ended the build before a repair to add that was made."
- Core's working tree also contains flow-bootstrap changes from another worker (`script-statements/*`, `authoring/*`). I did not touch them.
