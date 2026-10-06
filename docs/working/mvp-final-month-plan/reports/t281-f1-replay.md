# t281-f1-replay: worker report (lane A round 3, F1 fix 2, domain)

## Outcome

Done. A replayed press that the client answers `web.target.not_found` now answers `core.replay.failed` when the whole `before` read, taken at the step's `from.location`, holds a control named by the step's `parameters.element.accessibleName`. The answer says: `the page shows a control named "<name>" but the step could not find it (target_not_found)`. Every other path is unchanged: `remembered` / `unreproducible` through `missing-target.ts`, D2-2's `listNeverAppeared`, and `failedOnPage`.

## What changed and why

- New `domain/src/runtime/llm-evidence/node-run/named-control-shown.ts`, with one export, `webNodeNamedControlShown(before, parameters, value): string | undefined`. It returns the name when all of these hold:
  - the read is not truncated and stands at `value.from.location`;
  - the step's identity has a non-empty `accessibleName`;
  - some non-hidden element has a `name` equal to it, ignoring case and spacing. Only `name` is compared, never text, ownText or label;
  - that element is a control: `webLlmElementKind` gives a kind, and the kind is not h1-h6, img, dialog or layer.
  - If `element.context.record` is present, only an element whose `within` equals `record.text` counts. A record that has a key but no text lets nothing count, so it stays as it was.
- `node-run/replay.ts`: in the failure branch, a `TARGET_NOT_FOUND` with a `before` read checks the helper against `ran` and `value` first. A match goes to `failedOnPage`, so the answer carries the page and `acted: true`, because the press went out. No match falls through to `webNodeReplayMissingTarget`, exactly as before.
- `node-run/index.ts`: the barrel exports the helper.
- `node-run/tests/replay-remembered.test.ts`: `stub` and `page` take optional extra elements. There are 4 new tests:
  1. The report's test: a div named "Space Grey" with a click handler gives `failed`, and the answer names the control.
  2. A span whose visibleText is "Space Grey" is not a named control, so the answer stays `remembered`.
  3. The bigbox record restriction. With only other cards showing "Set as my store", the answer is `remembered`. With the step's own Millbrook card showing it, the answer is `failed`.
  4. A step with no accessibleName stays `remembered` even when a matching control is shown.

## Commands run and observed results

- Fail-first: the scratch subset runner (below) on `replay-remembered`, before the fix, printed `...X.X.`. Two failures, each `actual 'core.replay.remembered'`, `expected 'core.replay.failed'`: the main test and the Millbrook half of the record test.
- After the fix, the same filter printed `.......`, so 7/7 passed.
- All of `node-run/tests` (25 files) gave `# tests 205`, `# pass 205`, `# fail 0`.
- `npx tsc -p tsconfig.json --noEmit` (domain) exited 0 with no output. `npx tsc -p tsconfig.test.json --noEmit` exited 0.
- `node scripts/structure-audit.mjs` exited 1 with one violation, in `apps/extension/src/content/action-runtime/resolve-target.ts` (801 lines). That file belongs to the extension worker, not to me. The node-run files show only advisory warnings, which were there before: replay.ts is 514 lines, and the directory has more than 15 files.
- How the subset ran: `domain/scripts/test-domain.mjs` has no filter, and importing it runs every domain test. So I used a scratch script, `<scratchpad>/t281-f1-run.mjs`. It applies the same esbuild options to the node-run test entries only, writes to the ignored `domain/.test-build-scratch/t281-f1/`, and runs `node --test` on the bundles. Core was not built.

## Not verified

- The full domain suite and `pnpm check` were not run, as the brief asked.
- There was no live or browser run.
- No real run-mux6n7m4 packet was replayed. The tests use stub snapshots.

## Open questions or contradictions found

- A step whose record is known only by key (`context.record.key` with no text) never counts as shown, so it stays `remembered`. This is the conservative reading of the brief's restriction.
- `within` is published only on look-alike or `repeats` elements. A record-scoped step whose own card's control is the only one of its kind may therefore carry no `within`. Such a step stays `remembered`, which is again the conservative side.
