# t272-c1-pagination — C1 `paginate: true` reads one page

Worker: t272-c1-pagination. Tree: `fxwork/t272/!FluxIQWebExtension` (on `dev` 3e0e2fc5). Core untouched.

## Outcome

Partial. The defect is confirmed on current dev and fixed in the files I own, with fail-first tests. Partial for one reason only: the model-facing detect tool description (`domain/src/runtime/llm-evidence/tools.ts`), its test and the `packet.ts` doc comment still say "absent or true keeps the detected bound, often just 1 page". Those files are outside my ownership, so they are now stale. The exact change is below for the supervisor to apply.

## Established on current dev (fail-first)

`domain/.../plan-resolution/extraction/slot.ts` `keptPagination` returned the detection's own pagination for `paginate: true`, and for a model-written pagination with no bound (`{next: "a[rel=next]"}`). Detection proposes `maxPages: 1` (`detect-pagination.ts` `PROPOSED_MAX_PAGES = 1`), so `true` read one page. This matches lane C's run `run-mustvzvg-99695308`, steps 0015-0028: five `paginate: true` reruns, each reading 1 page (the debug is in `fxwork/t194/.../debugs/run-mustvzvg-99695308.md`; it is not in this tree). The read result was not silent: it already said "truncated; page bound reached". But the model kept writing `true`, because `true` was what read one page.

Fail-first run: I put HEAD's `slot.ts` back with the new tests in place. Result: `# pass 12 # fail 3`. Each failure was `+ maxPages: 1` (or `3` on the old catalog capture) against `- maxPages: 50`. The extension test failed before the extension change: `# pass 7 # fail 1`. At the domain cap, the old text still offered "rerun with input: {extractList: {paginate: {maxPages: N}}} to read more", although any N above 50 is refused.

## What changed and why

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts`: new `everyPage(detected)` returns the detected controls with `maxPages` (or, for a feed, `maxScrolls`) set to `WEB_AUTOMATION_EXTRACT_MAX_PAGES` (50, the existing domain bound). `paginate: true` and an unbounded model-written pagination now use it. **Absent `paginate` still keeps the detection's proposal** (one page), so "first page" instructions stay correct (the 2026-09-24 measurement in `detect-pagination.ts`). `false`, explicit bounds, the refusal past 50 and bounds lifted from beside `paginate` are unchanged. `true` with nothing detected still resolves to no pagination, as before. Header and function comments are updated.
- `apps/extension/src/content/actions/extract-list.ts` `pagingAccount`: a `page_limit` stop whose clamped bound equals the domain cap now says `extractList.paginate.maxPages = 50, the most one read may take, was reached while the list went on; the read is incomplete -- narrow the list on the page (a search or filter) to read the rest`. It no longer offers a larger bound that would be refused. Below the cap, the exact nested override is offered as before.
- Tests: `slot.test.ts` has a new C1 test (true, `{next}` and `{mode: numbered, pages}` all resolve to 50; absent resolves to 1; `{maxPages: 2}` resolves to 2; `false` means no paginate; a feed's `true` resolves to `maxScrolls: 50`). I updated the rows of two existing tests that encoded the old meaning ("true keeps the detected one-page bound" is renamed and inverted for `true`). `extract-list-paging-account.test.ts` has a new cap-wording test (pages and scrolls), and I dropped one assertion that required the "N" offer at the cap.

## Change needed outside my ownership (not made)

In `domain/src/runtime/llm-evidence/tools.ts:380` (detect description), replace
`paginate absent or true keeps the detected bound, often just 1 page; false reads only the current page. For more pages write paginate: {maxPages: N}, or paginate: {maxScrolls: N} for a feed.`
with
`paginate absent keeps the detected bound, often just 1 page; true reads every page until the list ends, up to 50; false reads only the current page. For a set number of pages write paginate: {maxPages: N}, or paginate: {maxScrolls: N} for a feed.`
Then make two matching edits:
- `domain/src/runtime/llm-evidence/tests/tools.test.ts:164`: change the regex to `/absent keeps the detected bound/u`, and assert `/true reads every page/u`.
- `domain/src/runtime/llm-evidence/structure/packet.ts:147`: change the doc to `absent paginate keeps it; true reads to the domain bound`.

The description is about 1708 characters (per the t262 report), plus about 40 for this change, which stays under Core's 2000 limit. Unverified: I did not measure the length after the edit.

## Commands run and observed results

- Runner: a copy of the brief's runner at `scratchpad/t272-c1/run-subset.mjs`. The original resolves esbuild from `<packageDir>/../../domain`, which for `domain` points outside the repository and failed with `Cannot find module 'esbuild'`. The copy resolves from `<packageDir>`. The esbuild options are unchanged.
- Domain after the change: all of `plan-resolution/extraction/tests/*`, `plan-resolution/tests/*`, `structure/tests/*` and `llm-evidence/tests/tools.test.ts`, run with `node --test`, gave `# tests 138 # pass 138 # fail 0`.
- Extension after the change: `extract-list*.test.ts` (4 files) plus `extraction/tests/{detect-pagination,pagination,pagination-pace}.test.ts`, run with `node --test`, gave `# tests 87 # pass 87 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` exited 0. `pnpm.cmd --filter @fluxiq-web-extension/extension check` exited 0. Both reported "Core's build ... is current with its source".
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (170 warning(s), 118 baselined)` and exited 0.
- `git diff --check` printed nothing.

## Not verified

- No live run. The live proof needed is a lane C rerun of the Brightaisle earbuds scenario (`run-mustvzvg` class). It must show `paginate: true`, or a model-chosen bound, reading pages 2-5, the 13/52 oracle, judge acceptance, and a provider-free replay of the saved Flow.
- Whether 50 pages fits inside the command's `timeoutMs` on real sites. A read that runs out of time reports `deadline`, not success.
- Core prompts and other domain text were checked only by grepping for "absent or true" and "paginate: true". No other match was found outside the files named above.
- I did not run the full suites.

## Open questions or contradictions found

- Codex's `next-c-live-readiness.md` says "Do not change default to everypage". I left the detection default at one page, and absent still means one page. Only an explicit ask to page (`true`, or an unbounded pagination object) changed. The supervisor should confirm that this reading is intended.
- `paginate: true` on a list with no detected pagination still silently reads the page shown, and the result says "1 page". A refusal there would be more honest, but it could break models that write `true` habitually. I left it unchanged.
