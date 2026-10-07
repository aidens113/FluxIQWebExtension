# t287-rerun-merge: rerun merge-patch builds inputs the model never wrote

Worker report. Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t287/!FluxIQ`, branch `task/t287-fix-refusal-churn`. Nothing committed.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. One rule in `R/llm/evidence-loop/rerun-input.ts` fixes both causes: an object the model writes out again drops the keys it was shown and left out, and keeps the keys the screen withheld. The domain's `deniedEvidenceKeys` now reach the merge from `rerun-request.ts`. Six fail-first tests failed before the fix and pass after it. Six guard tests pass before and after. The listed suites pass, and no type or audit error is in my files.

## Cause

### C3 (`run-mustvzvg-99695308`)

**Nothing on the draft step names the refused keys.** I checked the run bundle (`lab-runs/2026-10-03/run-mustvzvg-99695308/steps/0060-tool-core.run_node`):

- `meta.json` has `resultCode: web.action.rejected.target_unobserved` and `resultReason: malformed_handle`.
- The key list (`detail.instead: [..., "web.handle.malformed:extractList.maxPages", ...]`) is only in the evidence (`result.json`), in the domain's vocabulary.
- The draft step (`R/flow-draft/step.ts`) keeps `resultCode` only. `failed-call.ts` and `evidence-loop.ts:479` never put the reason or detail on the step.
- A failed rerun attempt also records no link to the input that last ran. `replacedBy` and `standsFor` are set only when a rerun works (`rerun-replacement.ts`). So "merge over the last input that ran" is not available either without changing `R/flow-draft/**`.

**What the model actually wrote** (0061 `decision.json`): it restated the whole `extractList` of step 8.

- `handle`, `fields`, `where` and `minItems` were repeated unchanged.
- `paginate` was changed to `{mode, next, maxPages: 10}`.
- The stray top-level `maxPages` was the only key it left out.

The RFC 7386 merge keeps every left-out key, so `extractList.maxPages: 10` went back into 0063, 0070 and 0073. So the root cause is the merge misreading a restatement as a patch, not missing refusal data.

### R3 (`run-murdouox-c5294247`)

0051 (`steps/0051-decide/response.txt`) wrote `fields: {name: "kA" (repeated), mutualFriends: "kB" (renames mutual)}` and left `confirm` out. The merge kept `confirm`. The existing rename rule fixed only the rename.

## Fix and why it is the smallest honest one

`R/llm/evidence-loop/rerun-input.ts`:

- `automationStudioLlmEvidenceRerunInput(previous, patch, deniedKeys?)` takes the domain's denied evidence keys. The keys are normalised with `automationStudioEvidenceKey`, the same comparison the draft screen uses (`R/llm/harness/draft-screen.ts`, which withholds by key name only, at any depth).
- New `leftOutOfRestatement`: an object the patch writes over a stored object **restates** it when it says more of it unchanged than it leaves out. Concretely:
  - **Repeated:** entries it repeats exactly as the model was shown them. The comparison uses the stored value with withheld keys removed, ignoring key order.
  - **Renamed:** entries the existing rule renames.
  - These two counts together must outnumber the stored keys it does not write.
  - A changed entry counts on neither side. So a patch that repeats `handle` beside one or two changes is still a patch.
- Of a restatement, every left-out key the model was shown is dropped. A key the screen withheld (for example `selector`) is never counted as left out and is kept.
- The patch root and a node's `parameters` are never read as restatements. They are the patch, and leaving a parameter out keeps it.
- With `deniedKeys` absent, nothing is dropped. Core cannot tell a key the model saw from one it never saw, and the codebase forbids defaulting an absent declaration to `[]` (`R/llm/harness-options/binding.ts:430-438`).
- The header now explains the rule and both runs. The old sentences "what it left out is kept rather than dropped" and "Leaving a key out still keeps it" are rewritten.

`R/llm/evidence-loop/rerun-request.ts`:

- Passes `deniedEvidenceKeys` to the merge.
- The header now says that a rerun of a domain-refused step merges over the refused input. Nothing on the step names the refused keys, so the restatement rule is what keeps them out. A key kept without being written is still named with the rerun's answer (`retained`).

Why this and not the alternatives:

- **Drop the refusal's key paths:** the data is not on the step, and the domain's `web.handle.malformed:<path>` code is vocabulary Core does not read.
- **Merge over the last input that ran:** the failed attempt has no link to that input. It would also undo the earlier patch's other changes that the model still showed as current (0057's `where`).
- **The fallback the debug proposes** (tell which keys came from the stored input): it **already exists**. `llm_evidence_loop.rerun_kept_keys`, from `R/llm/rerun-arguments/note.ts` and `retained-paths.ts`, landed in commit 115f67e9 at 2026-10-04 03:51 UTC, after this run (2026-10-03 20:16 UTC). It still covers the case the new rule leaves alone: a minimal patch over a refused step. A guard test pins it.

## Tests (fail-first output recorded before the fix)

### `R/llm/evidence-loop/tests/rerun-input.test.ts`

New describe block: "an object a rerun writes out again".

| Test | Before the fix | After |
| --- | --- | --- |
| drops a key the model was shown and left out of a map it restated (R3 0051; plus a whole-argument restatement with `[]` declared) | FAIL: received `{name, mutualFriends, confirm: "kC"}` | pass |
| keeps a key the screen withheld (re-author columns restated as shown, `ad` left out; `selector` kept in each column and at `extractList.selector`) | FAIL: `ad` still present | pass |
| drops the bound C3's rerun moved under paginate (step 8's stored input with 0061's exact patch) | FAIL: diff `+ "maxPages": 10` beside `paginate.maxPages: 10` | pass |
| is still a patch when it says less than it leaves out, or changes what it names (handle plus `dedupe`; 1 vs 1 map; handle plus two changes) | guard, passed | pass |
| never reads the patch itself, or a node's parameters, as a restatement | guard, passed | pass |
| keeps every left-out key when no denied keys are declared | guard, passed | pass |

Fail-first run: `Tests 3 failed | 23 passed (26)`.

Two existing comments were corrected:

- The "0051's map" comment now says the old result holds only without a declaration.
- The schema-assertion comment now says the schema text is stale (see Open questions).

### `R/llm/evidence-loop/tests/rerun-request.test.ts`

Two new describe blocks.

| Test | Before the fix | After |
| --- | --- | --- |
| a rerun of a step the domain refused: runs without the key left out of the object it restated (C3 through `automationStudioLlmEvidenceRerunRequest`, `deniedEvidenceKeys: ["selector"]`; `retained` absent) | FAIL: `expected { handle: 'extraction.3', …(5) } to deeply equal { …(4) }` | pass |
| ...still names the key it kept when the patch changed only what it named (minimal patch over the refused step; `retained.paths` include `extractList.maxPages`) | guard. Its first run failed on **my own wrong expectation** (I had omitted `["extractList","paginate","next"]`). After correcting that it passes before and after | pass |
| a rerun that restates a column map: runs with the columns it wrote, given the denied keys (R3) | FAIL: `expected { name: 'kA', confirm: 'kC', …(1) } to deeply equal { name: 'kA', mutualFriends: 'kB' }` | pass |
| ...keeps the column without them, as before | guard, passed | pass |

Fail-first run: 3 failed of 28.

In a second pre-fix run, two **existing** tests in this file also failed, with `ReferenceError: wayOut is not defined` at `R/llm/draft-amendment-feedback.ts:253`. That was another worker's in-progress edit; I had changed no source yet. Every later run passed.

## Commands run and observed results

All vitest commands ran from `packages/fluxiq`.

| Command | Result |
| --- | --- |
| `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-input.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-request.test.ts`, run 1 | `Test Files 2 passed (2)`, `Tests 54 passed (54)` |
| The same command, run 2 | `Test Files 2 passed (2)`, `Tests 54 passed (54)` |
| `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-replacement.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/repeat-guard.test.ts src/programs/automation-studio/runtime/llm/tests/evidence-loop.test.ts` | `Test Files 3 passed (3)`, `Tests 67 passed (67)` |
| Core root: `node scripts/build-cache/cli.mjs fluxiq:check` | exit 0, 0 `error TS` lines. The first run was not stamped because other workers changed inputs while it ran. The second was stored. |
| Core root: `node scripts/build-cache/cli.mjs structure-audit:check` | 1 violation: `FAIL [file-lines] packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts: 942 lines exceeds the 800-line limit`. That file is **another worker's**. No line mentions my files. |

Owned file sizes: `rerun-input.ts` 334, `rerun-request.ts` 168, `rerun-input.test.ts` 356 and `rerun-request.test.ts` 346 lines. No new file was added to `evidence-loop/tests/`.

## What a live run should see

- **C3 shape:** a refused list read is rerun with the whole `extractList` restated and the bound moved under `paginate`. The call sent (the `call.json` of the next `tool-core.run_node`) has `paginate.maxPages` and **no** top-level `extractList.maxPages`. The domain's `malformed_handle` / `web.handle.malformed:extractList.maxPages` refusal does not repeat with `repeatedAnswer` 2-4.
- **Minimal patch** over a refused step (only `paginate` written): the stray key is still sent. The answer carries `llm_evidence_loop.rerun_kept_keys` naming `extractList.maxPages` with `removal: {parameters: {extractList: {maxPages: null}}}`.
- **R3 shape:** a column map restated without a column runs without it. The call has exactly the columns the model wrote, and the next corrected rerun is no longer refused as an exact repeat it never made.
- **Re-author (Flow nodes):** a restated column list keeps each column's `selector`.

## Not verified

- No live, Lab or browser run, and no provider call (per the brief).
- That the web domain's `deniedEvidenceKeys` reach `context.input.deniedEvidenceKeys` in every loop. I read that the build loop forwards `this.llmEvidenceRuntime?.deniedEvidenceKeys` (`R/service.ts:1577`) but did not run it. Where it is absent, the old keep-everything merge applies.
- The counting threshold is a judgement. A restatement of a two-entry map that drops one entry (1 repeated vs 1 left out) is read as a patch and keeps the entry; `null` still removes it, and the `rerun_kept_keys` note names it after a failure. A partial patch that repeats more unchanged keys than it leaves out would lose the left-out ones; I know of no observed run that does this.

## Open questions or contradictions found

1. **Schema text outside my files is now stale.** `R/flow-draft/amendment/schema.ts:24` says "a key left out is kept, and a new key given a left-out key's value renames it". `rerun-input.test.ts:63` asserts that exact sentence. Proposed replacement for the `R/flow-draft/**` owner, with the assertion changed in the same edit: "a key left out is kept, except that an object written out again with more of it unchanged than left out drops the keys it leaves out; a new key given a left-out key's value renames it". I did not edit either line.
2. **Contract change for others to know:** `automationStudioLlmEvidenceRerunInput` now has an optional third parameter. Its only production caller is `rerun-request.ts`. `rerun-arguments/retained-paths.ts` is unchanged and still computes retained paths correctly from the actual merge, because it walks `merged`.
3. Other workers' current breakages seen while working: `draft-amendment-feedback.ts` `wayOut` was briefly undefined (since resolved), and `draft-amendment-feedback.test.ts` is over the 800-line audit limit.
