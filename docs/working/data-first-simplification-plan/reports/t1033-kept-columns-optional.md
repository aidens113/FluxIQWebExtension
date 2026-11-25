# t1033 report: kept columns are optional

## Outcome
Done. The spec `social-read-completion.spec.ts` passes (3 passed).

## What changed and why
Cause: every field reached the page as `required: false`, so the list reader could not tell asked from kept-only columns and pressed "See more" for (or would refuse `incomplete_text` over) kept ones.

- Request: new `askedFields?: string[]` on `WebAutomationExtractListRequest` (`domain/src/actions/extraction/request.ts`), parsed in `read-request.ts` (only keys of `fields`; unnamed/invalid left out = all asked), declared in `schema.ts`.
- Builders: `plan-resolution/extraction/slot.ts` sets it to the plan's named columns when other detected columns are kept beside them; `output-nodes/extract-list/declared-columns.ts` sets it to the shown columns; `structure/packet.ts` carries `askedFields: undefined` (type requirement).
- Reader: new `item-record/whole-fields.ts` (asked fields plus any named by `where`, `dedupe`, `sort`); `read-record.ts` and `assert-disclosed.ts` take that set; `list-reader.ts` passes it. A kept-only field is read as shown, never pressed, never refuses. No `askedFields` = every field held whole, as before.
- Tests: reader tests (kept-only collapsed field read as shown with 0 presses; asked one pressed; discloseText:false does not refuse kept-only but refuses asked; condition-named field still pressed); domain request parse/schema tests; slot resolution test; `retained-resolution.ts` helper and `one-record.test.ts` updated for the new field.
- Spec `social-read-completion.spec.ts` edited (only because it pinned a now-wrong shape): since t982 (retention) the helper's rows, the For Each scoped rows, the answer receipt `fields` and captured answer rows carry every retained column, not only `identity`/`description`. Oracles now require the asked columns (identity present; first two answer columns identity,description) instead of exact key lists. The "at least one disclosure must actually expand" and no-collapsed-control oracles are untouched.

## Commands run and observed results
- `node scripts/test-content.mjs social-read-completion --headed` (apps/extension) -> `3 passed (5.2m)`.
- `node scripts/test-extension.mjs src/content/extraction/text-disclosure src/content/extraction/item-record` (label t1033) -> tests 19, pass 19, fail 0. The earlier full `src/content/extraction` run had 2 fails, both my new tests' expected body missing the control text "Read more"; fixed and rerun green on those directories.
- `node scripts/test-domain.mjs` over `src/actions/extraction/tests src/runtime/llm-evidence/plan-resolution src/output-nodes src/runtime/llm-evidence/node-run` -> pass 1381, fail 1 (one-record draft round trip); fixed; then `one-record disclose-text slot.test` -> 27/27 pass; `llm-evidence/structure/tests` -> 77/77 pass.
- `tsc -p tsconfig.json --noEmit` in domain (after the packet.ts fix) and tsconfig.test.json -> no errors; in apps/extension -> exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (260 warning(s), 551 baselined)`.

## Not verified
- I did not rerun the whole `src/content/extraction` extension directory after the test expectation fix, nor the full domain `llm-evidence` tree, only the named subsets above. Not `pnpm check` (it wraps the same tsc plus build cache).
- Old saved Flows: their requests carry no `askedFields` so they behave as before (all fields held whole); their kept columns still get pressed. Not exercised live.

## Open questions or contradictions found
- Stale-vs-t982 oracles in the spec as noted above; no other spec pins these shapes that I found, but I only ran this one spec.
- A resolved draft that names every column drops `askedFields` (all are asked); `one-record.test.ts` documents that.
