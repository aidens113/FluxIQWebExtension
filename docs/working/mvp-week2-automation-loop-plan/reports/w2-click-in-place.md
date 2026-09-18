# w2-click-in-place: a script-handled link click is judged by what the page did

Worktree `F:\fxwork\t010-click-landing-in-place`, branch
`task/t010-click-landing-in-place`. Nothing committed. Nothing in the main
checkout was edited except this report.

## Outcome

Done at unit, content-harness (Chromium and Firefox) and `pnpm check` level.
The live DeepSeek runs were not done, as the supervisor directed (a worktree
Lab fault; the supervisor runs them in the main tree).

## What the fixture does on click (reproduced before any change)

I drove the real content-script bundle in the Playwright content harness,
against the `company-directory` fixture. I clicked `[data-testid="sector-logistics"]`
(`href="?sector=logistics"`) with `history.pushState`/`replaceState` wrapped, and
recorded the URL and the results region:

- `apps/scenario-lab/src/scenarios/company-directory/client-script.ts`: a
  document-level click listener calls `event.preventDefault()` on any
  `[data-sector]`/`[data-letter]`/`[data-page]` element. It sets
  `aria-busy="true"` on the results region synchronously, waits 150 ms, fetches
  `results?...`, and replaces `results.innerHTML`.
- **It never touches the history API.** The spy recorded zero
  `pushState`/`replaceState` calls. The URL was identical before the click,
  right after it, and 1.5 s later.
- **The content did change.** "320 companies listed", starting with Abbeyfield
  Construction, became "40 companies listed / Showing: Logistics", starting with
  Abbeyfield Logistics.
- The reply before the fix was `status: failed`, `validation.actual: "the click
  was prevented and the location did not change"`,
  `failure.code: web.validation.output_not_observed`.

## The condition that failed, and where

`apps/extension/src/content/actions/click.ts`, `navigationValidation` (old
line 78): for a link, `after === before` (the location had not changed) and
`accepted === false` (the default action was prevented) returned `failed`, and
`deps.success` turned that into `output_not_observed`.

Two other places were checked and are not involved:

- `runtime/click-landing.ts` returns a non-succeeded reply untouched.
- `domain/src/runtime/expectation/click-landing.ts` only claims a URL path for
  *recorded* clicks, and only when the landing path differs. `?sector=` does not
  change the path.

## The rule that replaces it

A link click passes when:

1. The location changed before the click event returned (same-document
   navigation). This is unchanged.
2. The page allowed the default action ("navigation initiated"). This is
   unchanged, and is still answered at once, before the document is torn down.
3. The page cancelled the navigation, **and then answered the click in place**
   within a window. The window is 5 s, the same as the recorder and domain
   landing windows. A command's `timeoutMs` can shorten it but never lengthen
   it, because the domain passes node timeouts through. The verb passes on the
   first of:
   - **Address moved.** `location.href` differs, polled every 100 ms. This
     catches a `pushState` made after an async fetch.
   - **Content changed.** `body.innerText` (rendered text) differs from its value
     at the press, **and** since the press the page's structure moved outside
     the link. That means an element was added or removed anywhere outside the
     link, an attribute changed on an element outside the link, or the link's
     own attributes were left different. Class lists are compared as token sets,
     and an empty `class` or `style` counts as absent.

The watch is created between the hover events and the press, so what hovering
alone does is not counted. The text is re-read only after the structure has
moved and something changed since the last read, so a quiet page costs no
layout.

New `actual` strings (they name no page content):

- `the page prevented the navigation and changed its content in place, N ms after the press`
- `the page prevented the navigation and moved its address to <url> in place, N ms after the press`
- failure: `the page prevented the navigation, and in <window> ms neither its address nor its content changed`

`expected` is now `navigation to <href> begins, or the page answers the click in place`.

A side effect worth knowing: a passing in-place click now replies after the
page answered. On the fixture the rows are already loaded (`aria-busy="false"`)
when the reply arrives, so the next step does not race the fetch.

## How a no-op click still fails

- A dead link or a swallowed click has no effect, so it fails when the window
  runs out.
- A press that only restyles the link, or grows a ripple inside it, is ignored:
  changes inside the link are not structure, and the link's own attributes count
  only if they last.
- Clocks, counters and relative timestamps rewrite text nodes or character data
  only, which never opens the structural gate.
- A busy flag with no new text opens the gate, but the text comparison fails.
- A disabled, hidden or covered control is still refused by the actionability
  gate before any gesture, which is unchanged.

The discrimination check was load-bearing. The first run of the "pressed dead
link beside ticking clocks" row **passed the dead link**:
`classList.add`/`remove` leaves `class=""` on a link that had no class, which my
first signature read as a lasting change. The clock then supplied the text
difference. I fixed it with the token-set and empty-attribute normalization
described above, and the row now fails the click as it should.

## What changed and why

- `apps/extension/src/content/action-runtime/in-place-effect.ts` (new):
  `watchInPlaceEffect(link)` returns `{ settle(timeoutMs), stop() }`. It is the
  DOM observation, built on MutationObserver plus a 100 ms poll, and works on
  the link's own `ownerDocument`.
- `apps/extension/src/content/actions/click.ts`: the verb is now async. The
  gesture takes a `beforePress` hook. `linkValidation` implements the rule
  above, and the watch is always stopped in `finally`. The non-link hit-test
  path is unchanged.
- `apps/extension/src/content/actions/types.ts`: new dependency
  `watchInPlaceEffect`.
- `apps/extension/src/content/action-runtime/execute-action.ts` wires the new
  dependency, and `action-runtime/index.ts` exports its types.
- `apps/extension/src/content/actions/tests/click.test.ts` (new, Node): 8 rows
  covering content effect passes, address effect passes, no effect fails,
  allowed navigation passes without waiting, synchronous location change
  passes, the watch starting between hover and press, the timeout shortening
  but never lengthening the window, and a button staying on the hit test with
  no watch.
- `apps/extension/e2e/content/tests/click-link.spec.ts` (new): the link rows,
  moved out of `click.spec.ts` to keep it under the 400-line advisory
  threshold, plus these new rows:
  - company-directory sector link passes, with the rows already there and the
    URL unchanged;
  - company-directory profile link passes at once (under 1 s) and lands;
  - a router `pushState` after 150 ms passes on the address;
  - a tab revealing a hidden panel passes;
  - a link that sets `aria-current` while only character data changes elsewhere
    passes;
  - a pressed dead link with a ripple, beside two ticking clocks, fails;
  - a dead link that raises only a busy flag fails.
- `apps/extension/e2e/content/tests/click.spec.ts`: the link rows were removed
  from it (moved as above).
- `apps/extension/e2e/content/tests/failures.spec.ts`: the swallowed-navigation
  row's `actual` was updated. It deliberately keeps the default 5 s window.
- `docs/architecture/web-capabilities.md`: the Click row now states the rule and
  its limits.

No domain, background (`runtime/click-landing.ts`), protocol, or manifest change.
`dom-snapshot.ts` and `element-traits.ts` were not touched. Nothing new leaves the
evidence boundary: the new strings carry only the link href or current URL,
which link results already carried, and a millisecond count.

## Commands run and observed results

All were run in the worktree.

- Reproduction (a temporary spec, deleted), `pnpm test:content -- t010-repro`:
  - before the fix: reply `failed`, `output_not_observed`, history calls `[]`,
    rows changed;
  - after the fix: reply `succeeded`, "changed its content in place, 202 ms
    after the press".
- `EXTENSION_TEST_BUILD_LABEL=t010 pnpm --filter @fluxiq-web-extension/extension test`:
  "Extension smoke test passed.", `# tests 686 / # pass 686 / # fail 0`. The 8
  new rows are ok 300-307.
- `DOMAIN_TEST_BUILD_LABEL=t010 pnpm --filter @fluxiq-web-extension/domain test`:
  `# tests 679 / # pass 679 / # fail 0`. No domain source changed.
- `pnpm test:content` (full Chromium content harness, 3 workers): **298
  passed**. This ran after the signature fix and before the spec split; the
  split moved rows only.
- After the split, `pnpm test:content -- click.spec click-link.spec failures.spec`
  (Chromium): 29 passed.
- Firefox harness (`e2e/playwright.content.firefox.config.ts`, with
  `FLUXIQ_FIREFOX_EXECUTABLE` pointed at the installed `firefox-1538`, because
  Playwright expects 1475): every new link row passed. Two rows failed, **both
  pre-existing**, and I proved it by swapping the HEAD versions of the touched
  files back in and re-running (identical failures), then restoring:
  - `click.spec` "every event carries the hit-tested point": 339,249 against
    339,248, a 1 px rounding difference in Firefox.
  - The hash-link row: Firefox does not move `location` synchronously for a
    synthetic click, so it passes through "navigation ... was initiated" rather
    than "the page navigated to". Its status is `passed` either way.
- `pnpm check`: exit 0, `structure-audit: passed (73 warning(s), 122 baselined)`.
  The remaining warnings on touched paths are advisory directory counts:
  `content/action-runtime/` has 18 files (it had 17, already past the advisory
  15), and `content/actions/` has 20.

Mutations (each restored afterwards, with the restore verified):

1. The no-effect branch in `linkValidation` returns `passed`. Unit: 2 fail
   ("a link the page cancelled and did not answer fails", "a command's own
   timeout shortens the window"). Harness: 4 fail (swallowed link, pressed dead
   link with clocks, busy-flag dead link, and `failures.spec` OUTPUT_NOT_OBSERVED).
2. The structural gate is dropped (text read on any change): the "pressed dead
   link ... clocks tick" row fails.
3. The text comparison is dropped (any structural move counts): the "busy flag"
   dead-link row fails, **and** the company-directory row fails, because the
   reply came back on `aria-busy` before the rows loaded.

## Not verified

- **Live DeepSeek runs** of `company-directory-logistics-sector` and
  `company-directory-no-companies` were not run, per the supervisor's direction.
  The supervisor runs them in the main tree.
- Behaviour in the loaded extension, including background delivery, the
  side panel and a real tab, was not checked. The harness runs the content
  bundle in a page with a stub runtime.
- `pnpm build` and `pnpm test` at the repository root were not run.
- Firefox was checked through the harness with a newer build than Playwright
  pins (1538 against 1475).

## Open questions or contradictions found

- **A script navigation after `preventDefault`** (for example
  `setTimeout(() => location.href = x)`) now makes the verb wait, and the page
  unloads during the wait, so the reply is lost. `runtime/click-landing.ts`
  deliberately rethrows a lost reply after a 200 landing (a test pins this), so
  the router reports a generic `web.action.failed`. Before this change the same
  click failed at once with `output_not_observed`. Both outcomes are retryable
  failures, so the verdict did not get worse, but neither is right. The fix
  belongs in `click-landing.ts`: pass a lost-reply click whose top frame
  committed a non-refused page. I did not make that change because it reverses
  a documented decision.
- **Known false pass:** on a page already changing on its own in both ways at
  once (a live feed adding elements, or a script animation beside a ticking
  clock), a dead link can read as answered. A link whose press leaves a lasting
  mark on itself, on a page whose text ticks, is the same case.
- **Known false fails** (they failed before this change too): an in-place
  answer with no text (a single-image lightbox), one inside a shadow root, one
  in another tab or window, a pure text-node update where nothing structural
  moved and the link kept no lasting state, and a page slower than 5 s.
- The company-directory pager is a `<button>`, so it never took the link path.
  Pagination *links* on other sites are covered by the same rule as the sector
  links.
