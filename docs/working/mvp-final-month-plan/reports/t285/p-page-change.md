# t285-p-page-change: the draft statement carries what a press changed

## Outcome

Done. The domain now sends `draft.changed` (at most 16 `{ words, how }` lines) on
an in-place press, read from the same walk as the outcome's `changed` strings.
Core parses it, screens it line by line, carries it onto the step, and a checked
rerun clears it. No commits, Lab runs, browser runs or provider calls.

## What changed and why

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t285/!FluxIQWebExtension`):

- `domain/src/runtime/llm-evidence/node-run/press-effect/change/` (new directory; the structure audit refused three `change-*` files side by side):
  - `walk.ts`: `webPageChangeWalk(node, before, after)` is the one walk. It returns `WebPageChange[]` in page order (`appeared`/`went` with `line`, or `both` with `was`/`now` when the words or tokens differ), or `undefined` under the outcome's old conditions (not mutate, the node moves the page, a page is missing, or the location differs).
  - `words.ts`: `webChangeWords.quoted(line, what)` and `.was(words)` are the outcome's cut rule (ENTRY_LENGTH 120, LEAST_WORDS 24), moved here unchanged. The outcome and the statement now quote the same cut words.
  - `rose.ts`: `webWordsRose(was, now)` is true when the two have the same number count and the same text around the numbers (plural endings ignored), exactly one number differs, and that number went up. Thousands commas are handled.
  - `statement.ts`: `webNodePageChangeStatement(node, before, after)` gives these lines:
    - A text line that appeared or went, in the outcome's cut words.
    - A line of any kind with words on both pages whose words changed, with its words now: `rose` or `reads`.
    - Never a state-token change, never a line without words. At most 16 lines, and `undefined` when none.
  - `index.ts`: the barrel.
- `press-effect/page-changes.ts`: now derives its strings from the walk. `webNodePageChanges` keeps its signature (`replay.ts` calls it and was not touched) and its output byte for byte. All the existing outcome tests pass unchanged.
- `press-effect/index.ts`: exports `webNodePageChangeStatement` and `WebNodePageChangeLine`.
- `capture.ts`: the draft type gains `changed?: Array<{ words; how: "appeared"|"went"|"reads"|"rose" }>`, documented like `toggle`.
- `node-run/run.ts`:
  - The success statement sets `changed: webNodePageChangeStatement(node, current, after)`, the same `current`/`after` that the outcome's `changed` uses.
  - The look, the refusal and `personDraft` (both branches) set `changed: undefined`.
- `node-run/written-step.ts`: sets `changed: undefined`.
- `docs/architecture/build-loop.md`: a new "What A Press Changed" section beside the `reads` one. I also removed the stale sentence saying `capture.ts` did not declare `reads` yet (it does).

Core (`C:/Users/osrs_/FluxStuff/fxwork/t285/!FluxIQ`, under `R = packages/fluxiq/src/programs/automation-studio/runtime`):

- `R/llm/evidence-loop/tool-execution.ts`: the draft type gains `changed?: AutomationStudioFlowDraftStepChange[]`, documented in the style of `reads`.
- `R/llm/evidence-loop-decision.ts`:
  - `"changed"` is added to the exact key list.
  - `changedOf` runs only when `effect === "mutate"`. It takes an array of at most 16 entries; each entry is a record with no keys besides `words` and `how`, `how` must be one of the four, and `words` goes through `automationStudioFlowDraftControlWords(words, evidence)`.
  - A bad entry is withheld, never refused. An empty result, a non-array, or an array longer than 16 gives no field (withheld whole).
- `R/llm/evidence-loop/call-record.ts`: copies `changed` onto the record. `evidence-loop.ts` already spreads the record into the step, so the step carries it with no edit there.
- `R/llm/node-tools/rerun-check.ts`: `delete step.changed` next to `toggle` and `reads`.

## Commands run and observed results

The fail-first runs came before any implementation:
- Core: `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests/authored-draft.test.ts` gave "Tests 4 failed | 66 passed (70)". The new `changed` describe block failed, because the result with an unknown key was refused.
- Domain `page-changes.test.ts`: the bundle failed with `Could not resolve "../change-statement"` / `"../change-walk"` (the modules did not exist yet; they were later moved under `change/`).
- Domain `run.test.ts`: `node --test` gave "not ok 20 - an in-place press's draft statement says which lines it changed…", "# pass 19 # fail 1".

After implementation:
- Core: `npx vitest run …/evidence-loop/tests/authored-draft.test.ts`, run twice: "Tests 70 passed (70)" both times.
- Core: `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests`: "Test Files 25 passed (25), Tests 287 passed (287)".
- Core (extra, for rerun-check and second-copy): `npx vitest run …/llm/node-tools/tests …/llm/decision-handlers/tests/second-copy.test.ts`: "Test Files 26 passed (26), Tests 282 passed (282)".
- Downstream: `run-subset.mjs <abs domain> t285p` bundled all 6 `press-effect/tests` files plus `node-run/tests/run.test.ts` and `draft-control.test.ts` with no errors. `node --test` on those bundles, run twice: "# tests 66 # pass 66 # fail 0" both times. The script needs an absolute package dir; `domain` alone throws `ERR_INVALID_ARG_VALUE`.
- Core root `pnpm.cmd build`: completed (web:build finished, no error).
- Downstream `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0 ("core-build … is current with its source"; tsc for src and tests).
- Downstream `node scripts/structure-audit.mjs`:
  - First run: "FAIL [naming] …/press-effect/: 3 files share the prefix "change-"". I fixed this by moving them to `press-effect/change/`.
  - Rerun: "structure-audit: passed (174 warning(s), 118 baselined)".
- Core `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0, `"build-cache":"reuse" … "inputs and outputs match the stamp"`. It reused the stamp; it did not run a fresh tsc. Core source was unchanged after `pnpm build`.

## Not verified

- No live browser or Lab run. Whether real pages give useful `rose`/`reads` lines, such as a cart badge whose words are inside a link line, is not exercised.
- No Core test asserts that `rerun-check.ts` clears `changed`. It is one line next to `toggle` and `reads`, and the brief named one Core test file.
- Core's `act-evidence.ts` (another stream) is not checked against these values.
- The full suites were not run, per the brief.

## Open questions or contradictions found

- Core keeps only lines whose words appear in the call's evidence. The outcome names at most 8 changes, but the statement sends up to 16. A line that went and was cut, or that sits past the outcome's 8th entry, is not on the after page or in the outcome, so Core will usually withhold it. Lines that appeared, rose or read otherwise are still on the after page and pass, unless the outcome cut them with "…" and they also fall past the 8th entry.
- If the words contain a `"`, the outcome quotes them with `\"`. Only the page view then shows them unescaped, so a line with a `"` that went is withheld.
- Core withholds an array longer than 16 whole, rather than keeping its first 16. The domain never sends more than 16.
