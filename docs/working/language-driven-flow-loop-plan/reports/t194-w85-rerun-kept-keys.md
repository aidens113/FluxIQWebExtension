# t194-w85: a refused rerun names the keys it kept

## Outcome

Done. When a rerun is refused (its answer has `ok: false`) or fails, and its merged argument carries keys its patch did not write, the model now gets a `core.rerun_check` note. The note names those keys by path, says they came from the argument step N was last given, and says that `null` at a key's place removes it, with an example patch built from the first path. When the refusal itself names a kept path, as `malformed:extractList.maxPages` did, that path is listed first, called out under `namedByRefusal`, and the instruction leads with it. The merge rule is unchanged: the call still carries the kept key.

## What changed and why

All paths are relative to `R/` = `packages/fluxiq/src/programs/automation-studio/runtime/` in Core `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`.

- `R/llm/evidence-loop/rerun-input.ts`: new `automationStudioLlmEvidenceRerunKeptKeys(previous, patch)`. It lists the keys the merged argument holds that the patch did not write, but only inside an object the patch wrote, which is where a key the model meant to drop hides. It does not list:
  - keys at the patch's top level (the rest of the argument);
  - anything inside a list (a list is written whole);
  - keys the patch removed or renamed.

  For a node call (`{node, parameters}`), paths are relative to the parameters, whether the patch was written as their keys alone or under `parameters`. These are the paths the node's refusals use, and a removal patch written at that level gets placed under the parameters anyway. Without this, the explicit `{parameters: {rows: ...}}` form listed every sibling parameter as kept; an existing test caught that.
- `R/llm/evidence-loop/rerun-request.ts`:
  - `AutomationStudioLlmEvidenceRerunCall` gains an optional `kept?: string[]`, set only when non-empty, so existing `toEqual` tests stand.
  - New `automationStudioLlmEvidenceRerunKeptNote(step, kept, result)` builds the note: `code: llm_evidence_loop.rerun_kept_keys`, `step`, `kept` (named paths first, at most 20 listed, then `keptNotListed`), `namedByRefusal`, and `instruction`. The only domain text in it is the key paths.
  - Named matching looks for the whole path inside any string of the result, with no word character on either side.
  - New constant `AUTOMATION_STUDIO_LLM_EVIDENCE_RERUN_CHECK_TOOL_ID = "core.rerun_check"`.
  - The header explains the `run-mustvzvg-99695308` cause.
- `R/llm/decision-handlers/amendment.ts`: the rerun's result actually reaches the model in `evidence-loop.ts` `runCall`, which I do not own. The only hook it calls after the result is pushed is `automationStudioLlmEvidenceSettleHeldAmendments`, through the `held` record. So:
  - A rerun with kept keys is now always held, with no amendments if none are held. In that case `refusals` is `[]`, so the decision is not told twice.
  - The kept keys ride on the held record as `kept` through a local intersection type, `RerunHeldWithKept`, because `types.ts` is not mine.
  - In settle, `tellKept` supersedes any earlier `core.rerun_check`. It then pushes the note when `rerun` is absent (the call threw, answered nothing usable, or left no step) or when the evidence entry for `rerun.callId` has `ok: false`.
  - A settle that had no held amendments returns `{}`, so the rerun's trace row is unchanged.
- Tests:
  - `R/llm/evidence-loop/tests/rerun-request.test.ts`: the musp shape. A base with `extractList.maxPages` and a patch without it give `kept: ["extractList.maxPages"]`, and the note names it under `namedByRefusal` with `{"extractList":{"maxPages":null}}`. A refusal naming none still lists it. A patch that writes every key, with `maxPages: null`, gives no `kept` and no note. Three tests run the real evidence loop: a refused rerun shows the note, a rerun that threw shows the note, and a rerun that worked shows none.
  - `R/llm/evidence-loop/tests/rerun-input.test.ts`: both patch forms give the same parameter-relative paths, and null-removed keys and lists are not listed.
  - No test file was added; that `tests/` folder is at 25.

## Commands run and observed results

- Tests first: `npx vitest run .../evidence-loop/tests/rerun-request.test.ts` before the implementation printed `Tests 3 failed | 13 passed (16)` (`automationStudioLlmEvidenceRerunKeptNote is not a function`). After it: `Tests 16 passed (16)`.
- Wiring check: I disabled the `tellKept(...)` call in `amendment.ts` and the run printed `Tests 2 failed | 17 passed (19)`; the failures were the refused and threw loop tests. I then restored the file.
- `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop src/programs/automation-studio/runtime/llm/decision-handlers src/programs/automation-studio/runtime/tests/deepseek-bootstrap` (in packages/fluxiq) printed `Test Files 30 passed (30)`, `Tests 250 passed (250)`.
  - My first run of this showed 1 failure in `rerun-input.test.ts` ("is what the loop runs"): explicit `{parameters: ...}` patches listed sibling parameters as kept. I fixed that as described above.
- `npx tsc --noEmit -p tsconfig.json` printed nothing (`tsc exit 0`).
- `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: passed (240 warning(s), 349 baselined).` None of the warnings is on a file I touched.

## Not verified

- I did no live run. Whether the model acts on the note, writing `extractList.maxPages: null`, is unproven.
- The note's wording has no prompt-pin or system-prompt test.
- Edge case: a checked rerun of a done act that took (`rerunTook`) passes the old step to settle. If that old step's own answer was `ok: false`, a note could appear after a rerun that worked. I did not test this and judge it rare.
- Kept keys that Core withholds from the model (for example a `selector` inside a column object the patch restated) would be listed as kept. The instruction says "to keep one, leave it out", but I did not measure how a model reacts to a withheld key's path.

## Open questions or contradictions found

- The brief places the hand-back in `rerun-request.ts` and `amendment.ts`. In fact the rerun's tool result is pushed to the model in `R/llm/evidence-loop.ts` (`runCall`, `evidence.push`). I avoided editing it by riding the held-amendments settle hook. The cleaner shape is a typed optional `kept` on `AutomationStudioLlmEvidenceRerunHeld` in `R/llm/decision-handlers/types.ts`, replacing the local intersection type and cast in `amendment.ts`. That is a one-line change outside my ownership.
- `R/llm/evidence-loop/` is at the 25-file directory limit, so the helper went into `rerun-input.ts` and `rerun-request.ts` instead of a new file.
- Other workers have uncommitted changes in this Core tree (for example `evidence-loop.ts` and `repeat-guard/`). My diffs touch only the five files listed.
