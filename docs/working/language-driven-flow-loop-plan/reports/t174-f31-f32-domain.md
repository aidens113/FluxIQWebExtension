# t174 F31/F32 domain report

## Outcome

Done.

## What changed and why

All paths under `domain/src/runtime/llm-evidence/` unless stated.

- `tools.ts`: `runsNodes` gains `arrival?: { node: string; parameter: string }` with a doc comment (Core writes the start location into that parameter and runs the node as the build's opening call). Declared beside `initial`: the node is derived as the runnable node whose `actionType === WEB_NAVIGATION_ACTION` (resolves to `web.output.browser-navigate`), parameter `"url"`. The `runsNodes` literal is now built with `present<NonNullable<...["runsNodes"]>>` because the structure audit's `contract-spread` rule refused conditional spreads. The find_on_page description now opens "Reads only the page you are on, and is not the site's search (the site's own search is a field[search] line). Search this page for ..."; the rest is kept.
- `node-run/index.ts` (barrel, one line, not named in the brief): re-exports `WEB_NAVIGATION_ACTION` from `./start-location` so `tools.ts` can derive the arrival node without hardcoding it or deep-importing.
- `node-run/run.ts`: the observation node now reads through a new `readablePage` (capture as it stands; `undefined` only for `page_unreadable` when a start location was given). `currentPage` = `readablePage` + the unchanged arrival rule, used by every other node. Comments corrected; comments condensed to keep the file at 800 lines (the audit limit; it was 815 at first).
- `node-run/start-location.ts`, `node-run/arrival.ts`: header comments now say a look reads the page as it stands, only an unreadable page refuses it, and Core opens via `runsNodes.arrival`.
- `page-find/search.ts`: with 0 matches and `after === 0`, a second line: "Nothing on this page holds those words, hidden elements included; find_on_page reads only the page you are on, never the rest of the site. To look across the site, type it into the site's search field tA or tB and submit it, or follow a link to the page that lists it." Without a `field[search]` element (by `webLlmElementKind`), only "To look across the site, follow a link to the page that lists it."
- `harness-options/options.ts`: recovery find description opens with the same sentence.
- Tests: `node-run/tests/arrival.test.ts` (opening look on an open start location now succeeds, shows the page, proposes nothing; re-arm test now proves a press after the second opening is refused), `run.test.ts` (runsNodes includes arrival), `shown-addresses.test.ts` (`arrive` expects refusal only on the blank tab; the "new build forgets" test blanks the tab before the second build, since the look on the results page would otherwise show that address), `press-raw-read.test.ts` (comment only; blank tab still refuses), `start-location.test.ts` (comment only), `state-digest/tests/call-state-digests.test.ts` (unreadable look reports no state; a press before arrival on a readable page reports no state), `tests/tools.test.ts` (arrival asserted; find description opening and 2,000-char bound), `page-find/tests/search.test.ts` (three new tests; pagination test's empty case now checks the count line only).
- `docs/architecture/testing-facility.md` (~179, ~1822): look reads the page; only an unreadable page answers `not_at_start_location`; `runsNodes.arrival` mentioned at ~179.

## Commands run and observed results

- `bash .../heavy.sh "t174 f31 domain check" pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 (`{"build-cache":"build","step":"domain:check",...}`, no tsc errors).
- `node .../t174-dir-tests.mjs <domain> t174-f31-dom runtime/llm-evidence/node-run/tests runtime/llm-evidence/page-find/tests runtime/llm-evidence/tests runtime/llm-evidence/state-digest/tests runtime/llm-evidence/harness-options/tests` -> `# tests 381 # pass 381 # fail 0`. (The known "default wait is ended by cancellation" failure did not occur in these runs.)
- `pnpm structure:check` -> exit 0, `structure-audit: passed (155 warning(s), 118 baselined).` (First run failed: contract-spread in tools.ts and run.ts at 815 lines; both fixed.)
- Failing-first: `search.ts` and `run.ts` temporarily replaced with `git show HEAD:...`, ran `T174_ONLY=search.test.ts,arrival.test.ts,call-state-digests.test.ts,shown-addresses.test.ts` -> `# pass 36 # fail 4`: arrival #1 "opening look ... reads the page as it stands", arrival #5 "opening call re-arms the rule", search "empty search ... names the site's search fields", search "empty search on a page with no search field". Sources restored from scratch copies afterwards (diff stat confirms).

## Not verified

- No live browser/Lab run. Core's consumption of `runsNodes.arrival` (the parallel Core worker) not exercised; Core's runsNodes type may need the same field for the binding to carry it.
- Whole suites not run (per brief).

## Open questions or contradictions found

- Touched `node-run/index.ts` (barrel) to export `WEB_NAVIGATION_ACTION`; not in the brief's owned list but the barrel of an owned directory.
- `docs/working/.../reports/t174-live-lane.md` was already modified in the worktree before this brief; not touched by me.
