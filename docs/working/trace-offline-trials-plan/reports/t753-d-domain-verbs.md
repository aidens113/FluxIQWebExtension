# t753-d domain verbs — report

## Outcome
Done.

## What changed and why
- New `domain/src/runtime/llm-evidence/node-run/act-verb/act-verb.ts` exporting `webNodeActVerb(node, parameters)`: the check node (`actionType === "web.dom.check"`) gives `"untick"` when `parameters.checked === false`, otherwise `"tick"` (a missing `checked` is a tick, matching the extension command's `action.checked ?? true`); every other node keeps `node.definition.label.toLowerCase()`. Barrel `act-verb/index.ts`; re-exported from `node-run/index.ts`.
- Callers switched in the same change: `run.ts` (permission `verb: webNodeActVerb(node, written)`) and `replay.ts` (`verb: webNodeActVerb(node, parameters)`).
- Put in a subfolder rather than loose in `node-run/` because `node-run/` and `node-run/tests/` were each at the 25-file hard limit (the first placement failed the audit at 26). `run.ts` was at exactly 800 lines; the added import made it 801, so one existing three-line comment inside the same `webActionPermission` call was rewrapped to two lines (text unchanged).
- Test: `node-run/act-verb/tests/act-verb.test.ts` (untick for `checked: false`; tick for `true`, missing, and undefined parameters; click and navigate keep their label verb).

Other check-label derivations searched (`grep` for `definition.label`, `label.toLowerCase`, `set checked` in `domain/src`): only `run.ts:340` and `replay.ts:303` turned a label into a verb. `actions/extraction/recorded-definition.ts`, `output-nodes/definitions.ts` and `output-nodes/extract-list/record-output.ts` read `definition.label` as the node's catalogue name or an extraction's label, not as act wording; nothing else needed changing. The catalogue label "Set Checked" (`actions/schemas.ts`) is unchanged (outside Owns, and it is the node's name).

## Commands run and observed results
- Before fix, from `domain`: `DOMAIN_TEST_BUILD_LABEL=t753-d node scripts/test-domain.mjs node-run/tests` -> esbuild `ERROR: Could not resolve "../act-verb"` (test written first; helper absent).
- After fix: `DOMAIN_TEST_BUILD_LABEL=t753-d node scripts/test-domain.mjs node-run/tests node-run/act-verb/tests` -> `# tests 268 # pass 268 # fail 0`, including `ok 1 - a check asked to clear its control is an untick`.
- `pnpm exec tsc -p tsconfig.json --noEmit` -> exit 0, no output; `pnpm exec tsc -p tsconfig.test.json --noEmit` -> exit 0, no output.
- Repo root `node scripts/structure-audit.mjs` -> no violation in my files (node-run/ 25 files, tests/ 25, run.ts 800 lines, warnings only). One remaining FAIL is outside my Owns: `apps/extension/src/panel/chat/tests/stop-control.test.ts` statement-packing (another worker's file).

## Not verified
- The comment rewrap in run.ts came after the last test run; only `tsc -p tsconfig.json` was rerun after it (comment-only change).
- No live or Core-side check that the ledger's `did` text now reads "untick"; Core's wording of the verb is outside this brief.

## Open questions or contradictions found
- The `did` text the supervisor repeated also depends on how Core phrases the verb; if Core prefixes or rewrites it, that is a Core-side change.
