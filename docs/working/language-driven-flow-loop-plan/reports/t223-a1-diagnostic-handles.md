# t223 A1: the refusal diagnostic speaks `tN` handles

Worktree `C:/Users/osrs_/FluxStuff/fxwork/t223/!FluxIQWebExtension`, branch
`task/t223-compact-page-view`. `LE/` = `domain/src/runtime/llm-evidence/`.

## Outcome

Done. The refusal diagnostic producer and bundle screen now accept a target
handle in either spelling and always record the canonical `tN`. The failing
domain test "a declared consequence nobody permitted refuses the run" passes,
and the whole domain suite reports 0 failures.

## What changed and why

- `LE/refusal-diagnostic/from-page.ts`: removed the private
  `HANDLE = /^target\.[1-9][0-9]{0,15}$/u`. `handle()` now returns
  `canonicalWebLlmTargetHandle(candidate)` (from `../handle-spelling`) for
  `input.target`, or for `parameters.target`/`selector`/`element` given as a
  string or `{handle}`. The element lookup uses that canonical form.
  `coveringTargets` maps the element's `coveredBy` through the canonicaliser
  and keeps only the entries that are handles. The old regex accepted only
  `target.N`, so it dropped every `tN` target the domain now mints.
- `LE/refusal-diagnostic/screen.ts`: removed the same private regex. A
  `target` that is present, and every `coveringTargets` entry, must
  canonicalise, or the record is rejected (`undefined`). The returned record
  carries the canonical forms. All other rules are unchanged.
- `LE/refusal-diagnostic/tests/diagnostic.test.ts`: changed every page and
  expected handle to `tN`, and added three tests:
  - a model-written `target.1` as `target` or in `parameters`
    (`target` `{handle}`, `selector`, `element`) yields `target: "t1"` with
    covering targets `t2`/`t3`;
  - the screen turns a legacy `target.1`/`target.2` record into `t1`/`t2`,
    that output re-screens to itself, and a `tN` record round-trips
    unchanged;
  - the screen rejects `t0`, `t1234567` and `target.0`, both as `target` and
    as a covering target.
- `LE/node-run/tests/run.test.ts`, test "a node this domain cannot run is
  refused...": kept the model input `{ handle: "target.1" }` and changed the
  expected `refused.diagnostic?.target` to `"t1"`.
- Changed `"target.1"` to `"t1"` and `"target.2"` to `"t2"` in the diagnostic
  fixture of:
  - `packages/test-runner/src/existing-fluxiq-control/tests/publishable-step-value.test.ts`
  - `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
  - `scripts/lab/live-campaign/row/tests/bundle.test.mjs`

  Nothing else in those files changed.
- Import cycle check: a scratch script followed the non-type
  `import`/`export ... from` edges starting at `LE/handle-spelling/index.ts`.
  It reached 4 files: `handle-spelling/index.ts`,
  `canonical-target-handle.ts`, `stable-handles.ts` and `present.ts`. None of
  them is `refusal-diagnostic`, `node-run` or `LE/index.ts`, so the change
  adds no import cycle.

## Commands run and observed results

Each heavy command ran through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t223 A1 <what>" ...`.

1. `pnpm --filter @fluxiq-web-extension/domain build`: exit 0, with
   `rewrite-dist-specifiers: 1051 specifier(s) in 318 file(s) under dist` and
   build-cache `"step":"domain:build"` stored 669 files.
2. `pnpm --filter @fluxiq-web-extension/domain check`: exit 0, with no tsc
   errors (build-cache `"step":"domain:check"`).
3. `pnpm --filter @fluxiq-web-extension/domain test` (unlabelled): exit 0,
   with `# tests 1138  # pass 1138  # fail 0`. These tests reported `ok`:
   - 598 "a node this domain cannot run is refused..."
   - 599 "a declared consequence nobody permitted refuses the run..."
   - 747 to 749, the three new diagnostic tests
4. `pnpm --filter @fluxiq-web-extension/test-runner test`: exit 0, with
   `# tests 1731  # pass 1731  # fail 0`.
5. `node --test scripts/lab/live-campaign/row/tests/bundle.test.mjs`: exit 0,
   with `# tests 1  # pass 1  # fail 0`.
6. `node scripts/structure-audit.mjs`: exit 0, with
   `structure-audit: passed (137 warning(s), 118 baselined).` None of the
   warnings shown is in a file I touched.

## Not verified

- I made no Lab, live or browser run, as the brief requires.
- I did not run the extension build or `pnpm check`/`pnpm build` for the
  whole repository.
- I did not look for other consumers of `WebBuildRefusalDiagnostic` outside
  the files I own. Any that compare against a `target.N` literal would only
  show up through the suites above.

## Open questions or contradictions found

- The old private regex allowed up to 16 digits (`{0,15}`). The canonicaliser
  allows at most 6 (`WEB_LLM_TARGET_HANDLE_PATTERN`). A stored pre-t223
  diagnostic with a 7-digit or longer handle is now rejected by the screen.
  This matches the brief ("must canonicalise, or the record is rejected").
- `docs/working/language-driven-flow-loop-plan/reports/t223-compact-page-view.md`
  was already modified in the worktree before I started. I did not touch it.
