# t1096-effect: a lost page turn is settled from the page

## Outcome

Partial. Done for page turns made with `web.dom.next_page`, and for any press whose page moved, on the exploring path. Two gaps remain, both outside my paths (see Open questions): test-run replays, and `not_landed` for a plain click on a pager's Next.

## What changed and why

- `domain/src/runtime/llm-evidence/node-run/retries/page-effect.ts` (new). `webNodePageEffectCheck(run, actionType, found, declared?, timing?)` is the check Core asks about an uncertain lasting act.
  - It runs the step's declared `expectedState` check first (`./effect-check.ts`, unchanged). Only when that answers `unknown` (or throws) does it read the page.
  - The page is read with `captureAfterAction`, reused as is. It waits out a page between documents within that function's own window. There is no new or shorter timeout.
  - That page is compared with the page the call found on three things: the address with its query, the words of the rendered controls marked `aria-current`, and the first record (row or card) by its key or words.
  - `landed` when any of the three moved. This holds for every act, so a press whose page moved counts as done.
  - `not_landed` only for `web.dom.next_page`, and only when the page answered with the same address, the same current marks, and the same non-empty rows in the same order (the verb's own `list_unchanged`).
  - `unknown` when the call found no page, no page could be read afterwards, or what changed proves neither. Any other act whose page shows no change stays `unknown`: no change proves nothing.
- `retries/dispatch.ts`. `noted` is typed as the call's own record `{ attempts?, found? }`. `run.ts` already passes `record` there and sets `record.found = current` before the command goes out (run.ts:276 and :445). So the dispatch wraps the caller's `checkEffect` in `webNodePageEffectCheck(run, command.actionType, () => noted?.found, checkEffect)`.
  - This needed no edit to `run.ts`. With no `found` (replay.ts:403 and run.ts:496 pass `undefined`), the behaviour is exactly as before.
- What did not change:
  - `next_page` keeps `effectClass: "commit"`.
  - A landed act already counts as done in `run.ts` (`lastingAct === "landed"`), and that file's own `look.after` carries the page it left.
  - A `not_landed` act is dispatched again by Core's retries.
- `retries/index.ts` exports it. `retries/effect-check.ts` gains a two-line header pointer.
- No text the model sees was added. The fixtures are synthetic (`listings.example.test`, cards `a1..a4`/`b1..b4`) and contain none of the recording's text.

## Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t1096-effect node scripts/test-domain.mjs node-run/retries/tests/page-effect node-run/retries/tests/effect-check` (via heavy-slot) printed `# tests 20 / # pass 20 / # fail 0`. That is 12 new tests and the 8 existing effect-check tests. They cover:
  - a found page shaped like 0029 and an after page shaped like 0049 give `landed`;
  - found and after both shaped like 0029 give `not_landed`;
  - no readable page after (looks time out, waited out on a fake clock) gives `unknown`;
  - a generic click with no change gives `unknown`, and with the page moved gives `landed`;
  - each signal on its own gives `landed`;
  - rows that differ only after the first give `unknown`;
  - a page with no records gives `unknown`;
  - the declared check answers first;
  - under Core's retries, a lost turn that landed is sent once, and one that did not land is sent again;
  - a lost click on an unchanged page stays `uncertain` and is sent once;
  - end to end through `createWebAutomationLlmEvidenceRuntime`, a click on "Next page" whose answer timed out while the page turned is pressed once and gives `effectApplied: true`.
- Mutation check: with the dispatch wiring reverted, the end-to-end test and the "sent once / sent again" test failed (2 failures, 10 passes). After restoring it, they pass.
- `node scripts/structure-audit.mjs` reported 2 violations, both in another worker's untracked `node-run/tests/unreadable-after-arrival.test.ts`: an `as never` cast at line 30, and `node-run/tests/` now holds 26 files against a limit of 25. Nothing in `retries/` was flagged.
- `node scripts/check/model-text.mjs` printed `model-text: ok (202 scenario tokens, 576 model-facing Core files, 14402 string literals)`.
- `node scripts/test-domain.mjs node-run/retries/tests` (label t1096-effect): `# tests 96 / # pass 96 / # fail 0`. This is every test in the folder, run because the dispatch change reaches every caller.
- Nearby tests that read uncertain outcomes (`frozen-execution/tests/binding`, `fresh-receipts`, `press-effect/tests/no-effect-press`, `node-run/tests/run.test`, `llm-evidence/tests/page-refusal`, `tools.test`, `paging-progress/tests/evidence`): `# tests 91 / # pass 91 / # fail 0`.
- `pnpm check` (domain) did not run. Its guard refused because the nested Core `../!FluxIQ` build is stale ("Core's build at ... is not current with its source"). Rebuilding Core is outside my paths. So I ran tsc directly against the current Core dist:
  - `npx tsc -p tsconfig.json --noEmit`: exit 0, no output.
  - `npx tsc -p tsconfig.test.json --noEmit`: exit 2, with one error, in another worker's file and not in mine: `node-run/tests/unreadable-arrival/tests/unreadable-after-arrival.test.ts(20,61): TS2353 'category' does not exist in type '{ code?: unknown; actual?: unknown; }'`.

## Not verified

- No live or browser run, as the brief required.
- The recording's real 0029 and 0049 bindings were not fed in, because the recording keeps the page view text, not the binding's record maps. The fixtures copy their structure.
- A slow single-page list could be read too early. If its rows change only after the act's own timeout plus one capture, the page answers unchanged and a `next_page` would be sent again, skipping a page. The extension's verb waits for the list to move before it answers, so the chance is small. This is the brief's rule as written (no added wait), but it is the one way `not_landed` could be wrong.

## Open questions or contradictions found

1. **Test-run replays get no page check.** `node-run/replay.ts:403` passes `undefined` as `noted`. It has the page found as `before` (replay.ts:390, set only for in-place steps). The fix there is to pass `{ found: before }` as the fourth argument of `webNodeDispatchWithRetries`. replay.ts is outside my paths.
2. **A plain click on a pager's Next never gets `not_landed`.** It gets `landed` when the page moved, which is the 0047 case, and `unknown` otherwise. Telling that a clicked control is "the control a detected list names as its next" needs the retained list bindings. `WebLlmExtractionHandles` (`structure/handles.ts`) resolves only by handle and cannot list them, and the detection packet does not give the model the pager control's handle. Adding a lookup by pager selector there would let the dispatch treat such a click as a page turn. structure/ is outside my paths.
3. When a `next_page` lands but its answer was lost, `run.ts` has no `nextPage` payload. So `listPages.pagerAnswered` does not record the list as moved. A site that pages by path (`/page/2`) could then have a later read refused by t1022's list-stands check. Query-paged sites (as in this run) are unaffected. This belongs to `run.ts` or `list-pages/`.
