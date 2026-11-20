# p2: hubs script answers four attempts

## Outcome
Partial: code and script tests are done and pass in an ad-hoc run (16/16); the package `pnpm check` and `pnpm test` could not run because another worker's domain edit does not compile (see Commands).

## Cause of request 17 ("The read's fields hold no title")
Run `run-mwa3kh87-d34c2f04` (attempt 2). Step numbers are the run's `steps/` folders.
1. The failing script reply (0038) read the fields of the detection result at 0037. That result is `{ok:false, code:"target_unobserved", detail:{handle_not_in_packet, target:"t2441"}}`: no fields, so the script's old `fieldsOf` returned `[]` and the message "fields hold no title" hid the real failure (a detection that failed).
2. Why the handle was wrong (0036 chose card `t2441`): the sort press (0035, `sort-by-price`) met a traffic check a person cleared. Core answered it as `{personCompletedCheck:true, now:{page:...}}` (the sorted page under `now`, URL `...&maxPrice=10&sort=price_asc`, handles t27xx). `core.current_view` in the 0036 request still showed the page of the earlier `ceiling-applied` call (`URL ...&maxPrice=10`, which has t2441). The script read cards from the view, so it named a handle that is not on the live page. Script defect plus a possible Core defect, below.
3. Separate, already fixed in the current script: at 0028 the run pressed Free shipping though the page URL already had `freeShipping=y` (0027/0028), turning it off (0029 page URL has no `freeShipping`). The t885/t905 script reads the filters off the URL and replayed against 0028 now answers `ceiling-applied`, not `free-shipping` (I replayed 0028, 0030, 0036, 0038 through the compiled t885 script: 0028/0030 give `ceiling-applied`; 0036 still gives the stale `t2441`; 0038 throws the "no title" error). The run used a script from before that URL reading, so this is not a current defect.

## Possible product defect (reported, not hidden)
`core.current_view` (request 0036) does not follow a call whose answer carries the page under `now` (`personCompletedCheck`): its top group stays on `ceiling-applied`, a page the sort has already replaced. Any model, not only the script, would read the stale page. Evidence: steps 0035 (result.json has `now.page` with the sorted URL) vs 0036 request.txt (`core.current_view` group `callId: ceiling-applied`, URL `maxPrice=10`). The script now works around it (it reads the newest page), so the Lab proof will not show this; the product fix belongs in Core's current-view building. Not a request for the model to rebuild what a saved Flow should replay: attempt 2's rounds there were a failed replay at step 7 (`executor.target.gone`, "Not now" cover absent), a separate open question from the t885 report (open question 2).

## What changed (owned files only)
- `scripts/crossborder-marketplace-free-hubs-under-ten.ts`
  - `plain` form now sized from `1 + LATER_ATTEMPTS`: 4 `panel_command`, 8 `loop_verification` (two judges per attempt, as `left-out`). Decisions stay at 30 as `left-out`.
  - `withNewestPage`: if a call newer than the view's top call answered with `now.page`, decisions read that page (patches the view the script sees).
  - A detection with no `fields` is asked again once (`detect-hubs-again`), then refused with its answer quoted, never read as an empty card shape.
  - No dependence on the list read's answer shape: the script only checks that `read-hubs` was called; a test covers an answer with `answer: "kept"`, `extracted`, `listKey`, `place`.
- `scripts/tests/crossborder-marketplace-free-hubs-under-ten.test.ts`: plain asserts 4 chat turns and at least 8 judges; variant row 4; new tests for the `now` page (request 36 shape), the failed detection (steps 37/38), and the read answer shape.

## Commands run and observed
- Replay of recorded requests 0028/0030/0036/0038 through the t885 compiled script (scratch script): outputs as above.
- Ad-hoc (not the repo's runner): esbuild-bundled test file plus a shim, `node t.test.mjs` -> `# tests 16  # pass 16  # fail 0`. The scratch dir was deleted.
- `node scripts/structure-audit.mjs` in E: fails with violations in `apps/extension/src/content/extraction/**` (list-reader.ts 812 lines, address-place.ts failure-as-empty, read-place.ts import), none in my files (grep for "hubs-under-ten": 0 hits). Those belong to another lane.
- Slot: `heavy-slot.mjs run t905 -- "... pnpm check && pnpm test | tail -40"` queued about 5 hours behind other lanes, took slot-1, and `pnpm check` failed at `domain:build` (exit 2, ELIFECYCLE) with 3 TS2345 errors in domain, none in my files: `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts(302,51)`, `columns.ts(339,51)`, `structure/packet.ts(494,49)`: "Property shown is missing ... WebAutomationExtractFieldSpec" (another worker mid-edit of the field spec). `pnpm test` therefore never ran. The narrowest check I could run is the ad-hoc 16/16 bundle above.

## What the supervisor's Lab proof should look for
- `--attempts 4`: attempt 2..4 rounds that meet a check on a press should still reach `read-hubs`; a request whose evidence shows `now.page` newer than the view is the case handled. Check `core.current_view` in those requests for the staleness above.
- Any `detect-hubs-again` call in a run is the sign a detection failed; two failures throw "gave no fields, twice".
- A script exhaustion (more than 30 decisions, or more than 4 chat turns or 8 judge calls) means a later attempt asked the model to rebuild what the saved Flow should replay: report it with its step numbers, do not enlarge the lists.
- The saved Flow stopping on an absent cover ("Not now", `executor.target.gone`) is open question 2 of the t885 report, still unresolved in the product.

## Not verified
Type check and the full `pnpm test` of the package; no Lab run (forbidden). The 16/16 result is from an ad-hoc bundle, not the package build.
