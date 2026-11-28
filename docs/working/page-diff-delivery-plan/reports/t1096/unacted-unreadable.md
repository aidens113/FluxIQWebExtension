# t1096 unacted-unreadable

## Outcome
Done.

## What changed and why
(2) `apps/extension/src/content/actions/next-page.ts`: a missing `nextPage` request now fails through a `NextPageRefusal`
carrying `webAutomationFailureRecord(INVALID_PARAMETER)` (stage `dispatch`, not retryable) with `effect: "unacted"`
added, mirroring playback's `invalidRequest`. It was a plain `Error`, filed generic with no stage or effect, which
`webLastingActStatement` then called ambiguous for the commit verb Next. The missing request is the only guard in the
file before any gesture; every other early fault comes from the page move and already carries `noEffect`/`listAbsent`.
`webLastingActStatement` needed no change: an explicit `unacted` on a commit verb already stays unacted; a test now pins it.

(7) `node-run/frozen-execution/page/`: new `read-page.ts` (`webNodeReadPage`) keeps "read" and "unreadable" apart.
`readable.ts` now swallows an unreadable page (returns undefined) only for a build with a start location that has NOT
arrived; otherwise it throws the `page_unreadable` rejection, which carries the host failure and which `run.ts`'s
existing catch turns into a `page_unreadable` refusal. `current.ts` does the same for the call's look before, except a
page-moving node (navigation, `webMovesThePage`) still proceeds from nowhere, since a navigation is the way out;
`run.ts:273` passes that flag. Arrived + unreadable is therefore never `not_at_start_location`, and the refusal carries no
start page. Model text unchanged (the existing generic `page_unreadable` refusal).

## Commands run and observed results
- `node scripts/test-domain.mjs unreadable-after-arrival lasting-act-statement node-run/tests/arrival node-run/tests/start-location` (heavy slot) -> 37 pass, 1 fail (my host-failure assertion text), fixed; then unreadable-after-arrival: 3 pass, 0 fail.
- `node scripts/test-domain.mjs llm-evidence/node-run` -> 634 tests, 634 pass, 0 fail (before the test file moved into `tests/unreadable-arrival/tests/`).
- `node scripts/test-extension.mjs content/actions/tests/next-page` -> 15 pass, 0 fail.
- `tsc -p tsconfig.json --noEmit` and `tsconfig.test.json` in domain -> exit 0 (first run); `tsc` in apps/extension -> exit 0.
- `node scripts/check/model-text.mjs` -> ok.
- `node scripts/structure-audit.mjs` first run: 2 failures in my new test (an `as never` cast and the 25-file limit of `node-run/tests/`); fixed by a typed stub and moving the test to `node-run/tests/unreadable-arrival/tests/`; after the fix the audit was not rerun in full; `as never` is gone (grep 0) and the test lives in its own tests/ subfolder. Final: domain test tsc exit 0, unreadable-arrival + lasting-act-statement 10 pass 0 fail.
- `pnpm --filter ... test` itself refuses: this tree's Core build is stale ("Core's build cache would rebuild fluxiq:build"). I did not rebuild Core (../!FluxIQ is off limits), and ran `node scripts/test-domain.mjs` / `test-extension.mjs` directly against the existing Core dist.

## Not verified
Live behaviour; the pnpm wrapper with a current Core; the full domain suite. "Which look it was" is not on the refusal: the rejection detail set is closed, so only the host failure (code) rides on it.

## Open questions or contradictions found
Other content/actions verbs with the same pre-gesture plain-Error pattern (not edited): `assert.ts:74` (`web.dom.assert` without parameters, throws plain Error) and `extract-list.ts:98` (`deps.failure(action, new Error("... needs extractList parameters."))`). Both are read-only verbs, so the ambiguity matters less, but they also lack stage/effect.
Not owned and unchecked: the extension's wire payload (`webAutomationActionResultPayload`) does not carry `failure`; the failure travels on the result itself.
