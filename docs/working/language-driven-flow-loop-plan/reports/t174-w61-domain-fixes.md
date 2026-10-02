# t174-w61: domain check, structure audit, and the `interruption` flag (case 2, downstream half)

## Outcome

Done. All three parts are in. `pnpm check` in `domain` exits 0, and the structure audit passes. The narrow test
directories pass (386/386), and so do the test-runner dist tests (116/116).

## What changed and why

D = `domain/src/runtime/llm-evidence`.

1. **TS2379 in `page-changes.ts`.** The conditional `{ ...now, words: was.words }` could set `words: undefined`. It is
   now a named `const named: WebLlmLineFact`. The spread happens only when `was.words !== undefined` and
   `now.words === undefined`; otherwise `now` is used as it is.
2. **Structure audit.**
   - **[contract-spread]** In `press-changes.test.ts`, the swatch element is now two whole literals chosen by a
     ternary, replacing `...(item.chosen ? { setApart: true } : {})`.
   - **[directory-files]** New feature directory `D/node-run/press-effect/`:
     - `page-changes.ts` moved there.
     - New `answered-layer.ts`.
     - Barrel `index.ts` exporting `webAnsweredLayer` and `webNodePageChanges`.
     - `tests/` holding `page-changes.test.ts`, `press-changes.test.ts` (both moved) and the new
       `answered-layer.test.ts`.

     `node-run/tests` is now at 25 files. `run.ts` imports from `./press-effect`.
   - **[naming]** `page-view/line-{choice,facts,kind,render}.ts` moved to `page-view/line/{choice,facts,kind,render}.ts`,
     with a barrel `line/index.ts`. `tests/line-facts.test.ts` moved to `line/tests/facts.test.ts`. Relative imports
     inside them were updated. `page-view/index.ts` now re-exports from `./line`, and `page-text.ts` imports from
     `./line`. A grep of all tracked and untracked `.ts` and `.mjs` files in DS found no other importers; `apps/` and
     `packages/` import only the `page-view` barrel.
3. **Case (2), domain half.**
   - **Shared layer predicates.** The predicate from `covered-target.ts` (isDialog / kind / frontLayer) was exported as
     `D/node-run/layer-element.ts` (`webIsLayer`). The `closersOf` membership test (parent chain, or centre inside the
     layer's box and not `coveredBy` it) was exported as `D/node-run/layer-member.ts` (`webInLayer`).
     `covered-target.ts` now uses both, so the logic exists in one place only.
   - **`press-effect/answered-layer.ts`: `webAnsweredLayer(before, after, handle)`.** It takes page evidence and
     returns true when all of these hold:
     - the handle is canonical and both pages are present;
     - both pages have the same location;
     - in `before`, the control lies in a layer (its `inDialog`, itself a layer, or `webInLayer` of any layer
       element);
     - one of those layers is absent from `after`, or no longer `webIsLayer` there.
   - **`run.ts`.** The success draft statement now carries
     `interruption: node.effect === "mutate" && !webMovesThePage(node) && webAnsweredLayer(current?.evidence, after?.evidence, firstHandle(written)) ? true : undefined`.
     Every other `present<WebNodeDraftStatement>` gives `interruption: undefined`: the look, the refusal, the
     never-acted person draft and the robot-check standing draft.
   - **`capture.ts`.** `WebLlmEvidenceToolExecution["draft"]` gains `interruption?: true`, with a doc comment.

**Failing-first.** I wrote `press-effect/tests/answered-layer.test.ts` (5 tests) against a stub that returned `false`,
and added rows to `node-run/tests/draft-control.test.ts`:
- A new test: a promotion popup's "No thanks" that closes it gives `draft.interruption === true`. The main-page
  "Add to cart" pressed next gives no key.
- "No `interruption` key" assertions on the existing tests: the main-page "Not now" press, the look, the navigation and
  the refused press.

First run: 3 failed (Decline cookies, Close chat, and the run.ts row with `undefined !== true`); 7 passed. After the
implementation, all pass.

**Line endings.** `draft-control.test.ts`, which an earlier worker left untracked, had CRLF endings. I converted it to
LF, like the rest of the tree, before editing it.

## Commands run and observed results

- `node scripts/structure-audit.mjs` in DS:
  - before: 3 violations (contract-spread, directory-files, naming);
  - after: `structure-audit: passed (157 warning(s), 118 baselined).`, exit 0.
- `T174_ONLY=answered-layer.test.ts,draft-control.test.ts node .../t174-dir-tests.mjs <DS>/domain t174-w61 ...`:
  `# tests 10 # pass 7 # fail 3` (failing first).
- `node .../t174-dir-tests.mjs <DS>/domain t174-w61` over `runtime/llm-evidence/node-run/tests`,
  `runtime/llm-evidence/node-run/press-effect/tests`, `runtime/llm-evidence/page-view/tests`,
  `runtime/llm-evidence/page-view/line/tests` and `runtime/llm-evidence/tests`: exit 0, `# tests 386 # pass 386 # fail 0`.
  The first full-directory run came before the `interruption: undefined` additions; I re-ran it after them with the
  same result.
- `bash .../heavy.sh "t174-w61 domain-check" pnpm check` in `DS/domain`:
  - first run: exit 2, TS2345 at `run.ts` 206/519/569/571, because the other `present<WebNodeDraftStatement>` calls
    lacked `interruption`;
  - after the fix: exit 0. The build cache did not stamp it, because "inputs changed while it ran
    (core:packages/fluxiq/src)": someone was editing Core at the same time.
- `heavy.sh "t174-w61 tr-build" sh -c 'node scripts/domain-dist.mjs && node ../../scripts/build-cache/cli.mjs test-runner:build'`:
  exit 0.
- `node --test dist/flow-lane/creation/tests/*.test.js dist/lab-runs/tests/*.test.js` in `packages/test-runner`:
  exit 0, `# tests 116 # pass 116 # fail 0`.

## Not verified

- Not tested in a live browser or a Lab run.
- The Core seam is not done. Core still rejects the `draft.interruption` key: the brief notes that a strict
  `evidence-loop-decision.ts:199` refuses unknown keys. **Until the Core half lands, any successful press that closes a
  layer will make Core refuse the call result.** Core and this change must land together, or this must be gated.
- No full suites were run, by design.

## Open questions or contradictions found

- **Heuristic risk.** Box membership uses `webInLayer`, which counts any element whose centre is inside a layer's box
  and not `coveredBy` it. A large `frontLayer` element (for example a sticky header, if the capture marks one) that
  disappears after an in-place press would mark that press as an interruption. Same-location and same-page checks
  limit this, but they do not rule it out.
- **Stale path references I did not edit (outside what I own).** Each could be fixed with a one-word change:
  - `D/node-run/outcome.ts:38` still says `./page-changes.ts`; it should be `./press-effect/page-changes.ts`.
  - `D/page-view/element/traits.ts:63` says `../line-choice.ts`.
  - `D/system-instructions/instructions.ts:18` says `line-render.ts`.
  - `docs/architecture/page-evidence.md:244` and `:347` say `page-view/line-choice.ts`.
- **Extra file touched.** `covered-target.ts` was not on the owned list. I edited it only to export its predicate, as
  the brief asked ("do not copy it if it can be exported").
