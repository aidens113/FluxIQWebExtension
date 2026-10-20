# t730-e2: checkbox and paging modes

## Outcome

Done. Two realistic sites have a new mode, each armed only through the site's own `set-mode`. Neither mode adds a manifest variant, a live task, a repair task or a person check. The two Blocked tests in `typed-browser-readiness.spec.ts` now run on these modes, and the spec's own HTTP server and inline page are gone. All 5 tests in the file pass headed.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

### crossborder-marketplace: mode `cart-add-ons`

- `state/types.ts`: added `cart-add-ons` to `marketModes`, with a doc entry.
- `markup/cart.ts`: in this mode only, each cart line is drawn by a private `addOnsCartLine` (I kept it in this file so `markup/` stays under its 15-file advisory). Each line has:
  - a native `input[name=select]` with `aria-label="Select <title>"`, starting unticked;
  - an "Add-ons" fieldset with three boxes:
    - `giftWrap`, "Gift wrap · 1,50 €";
    - `warranty`, "2-year extended warranty · 4,99 €";
    - `insurance`, "Shipping insurance · 0,99 €";
  - a `role=status` note line.

  The summary starts at "Checkout (0)". The baseline lines, summary and script are unchanged.
- New `client/add-ons-script.ts` (`cartAddOnsScript`, exported from `client/index.ts`):
  - **Select is controlled.** A click flips the cart's own selection and redraws "Checkout (N)". The change event then sets `checked` from that state.
  - **Gift wrap** is unticked in the same change that ticked it. The note reads "<store> doesn’t offer gift wrap on this item."
  - **Warranty** is unticked after `await` on a resolved quote promise, which is a microtask later. The note reads "…no longer available…".
  - **Insurance** is replaced by `cloneNode(true)` with `checked=false`, and the handler is bound again to the new box. The note reads "…already included…".
  - Quantity, remove and checkout work as on the baseline, and checkout uses the selected lines.
- New `tests/cart-add-ons.test.ts` (3 tests):
  - Arming resets the visit.
  - Markup:
    - only the mode has native boxes;
    - nothing starts ticked;
    - the page has no test vocabulary;
    - the page above the cart layout is byte-identical to the baseline.
  - Browser, with a passive click count:
    - Select follows the cart's state, and a scripted change that is not a click is set back;
    - gift wrap reads `{synchronous:false, later:false}`;
    - the warranty reads `{synchronous:true, later:false}`;
    - the insurance box detaches and its replacement is unticked;
    - no page errors.

### professional-network: mode `in-place-paging`

- `types.ts`: added `in-place-paging` to `networkModes`, with a doc entry.
- `search/fragment.ts`: in this mode only, Next is `disabled` on the last page.
- New `search/in-place-paging-script.ts` (`inPlacePagingScript`, exported from the `search/` barrel). Its `refresh(page)` waits the same 0.7 s, fetches the fragment, and morphs the results section in place, the way a keyless virtual DOM does:
  - elements of the same kind in the same position are kept, with their attributes and text synced;
  - extra nodes are added or removed;
  - nothing calls `pushState`;
  - a 429 answer shows the check as the baseline does.
- `search/people-client.ts` and `search/people-page.ts`: when `inPlace` is set, the pager's buttons call `refresh(...)` and the script is appended. The baseline script is byte-identical, and a unit test checks this.
- New `tests/in-place-paging.test.ts` (4 tests):
  - Arming resets the session.
  - Fragments on pages 1 to 3 differ from the baseline only by `disabled` on Next, on page 3.
  - The mode's page equals the baseline page plus the pager script.
  - Browser, from page 2 of the Rotterdam filter:
    - Next changes the first row's urn, name and href;
    - the row and its link are the same nodes;
    - Next is disabled and Previous is enabled;
    - the address is unchanged;
    - a forced press on the disabled Next does nothing;
    - no console errors and no off-machine requests.

### `apps/extension/e2e/runtime/tests/typed-browser-readiness.spec.ts`

- Removed `createServer`, `FIXTURE` and the two tests that served their own page. Updated the header comment.
- New test: "controlled Select reaches the cart's state once; add-ons the cart unticks, unticks a microtask later, or replaces are reported as failed".
  - Setup: arms `cart-add-ons`, then answers consent, the welcome coupons and notifications, then adds the Voltbay hub through the API.
  - Select assertions:
    - `check true` succeeds, the box is checked, the summary shows "Checkout (1)", and there was 1 press;
    - a second `check true` answers "already set" and the press count stays 1;
    - `check false` succeeds, the summary shows "Checkout (0)", and there were 2 presses.
  - `giftWrap`, `warranty` and `insurance` each answer `failed`, and all three are left unticked.
  - The radio and no-op cases still live in the quote-drawer test.
- New test: "Next observes the rows rewritten in place once, then ends on the disabled Next".
  - Setup: arms `in-place-paging`, then answers consent, the app prompt and the chat bubble, then opens page 2 of 3.
  - Assertions:
    - the step answers `moved`;
    - the page shows "Page 3 of 3";
    - the first row's name and href changed, and the row and its link are the same nodes;
    - the address is unchanged;
    - Next is disabled;
    - the second step answers `ended` with `control_disabled`;
    - the pager was pressed exactly once.
  - The unchanged-timeout case still lives in the photo-social test.
- Every test sets `test.setTimeout`, with a comment giving the reason (90 s, 90 s, 90 s, 90 s and 60 s). The header says why: each test starts its own Lab, and the fixture launches and closes the extension.

## Commands run and observed results

- From `apps/scenario-lab`: `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"`. The final build succeeded and printed "stored in the shared store (1099 file(s)…)".
- `node --test` on `crossborder-marketplace/{tests,qualification/tests}` and `professional-network/{tests,qualification/tests}`:
  - Final run: `# tests 102  # pass 102  # fail 0`.
  - One earlier run printed `101 pass, 1 fail`. The failure was the existing `flash-deal-on-arrival` test: a 1 s visibility wait on the home page while other tests were running. Rerun alone, it printed `1 pass`, and it passed in the final run.
- `node --test dist/scenarios/tests/{live-instructions,live-repair-tasks,realistic-site-live-tasks,person-checks}.test.js` printed `# tests 26  # pass 26`.
- From the repo root, `pnpm --filter @fluxiq-web-extension/extension test:e2e:build` printed "e2e-chromium: verified 22 files". The first Playwright run then failed all 5 tests with `environment.missing`, because someone else's rebuild had removed `dist`. I rebuilt once, and later runs reused it.
- From `apps/extension`, `pnpm exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/typed-browser-readiness.spec.ts --headed --workers=2`:
  - First run after the rewrite: `1 failed, 4 passed`. My count of presses on Next was 0.
  - Cause: by design, `follow-next.ts` swaps a script's Next for the pager's following number. A temporary log, since removed, printed `E2PROBE ["3"] {"outcome":"moved","by":"following","page":3}`. The test now counts presses on the whole pager, expects exactly one, and accepts either "Next" or "3".
  - Then `5 passed (58.9s)`, `5 passed (35.1s)` and `5 passed (1.0m)`.
  - After the TS fix, `--output=test-results/e2-1` printed `5 passed (2.5m)`.
- `node_modules/.bin/tsc -p tsconfig.test.json --noEmit` from `apps/extension`:
  - First run: 1 error, `typed-browser-readiness.spec.ts(172,26): error TS2352`.
  - I changed that line to `(event.target as Element | null)?.closest("button")`.
  - Rerun: `tsc exit 0`, no output.
- `node scripts/structure-audit.mjs`:
  - First run: FAIL `[imports]` on `in-place-paging.test.ts`, for importing `../search/in-place-paging-script.js`. I fixed it by exporting the script from the barrel. That run also warned that `markup/` had 16 files; I fixed that by folding the line renderer into `cart.ts`.
  - Final run: `structure-audit: passed (215 warning(s), 633 baselined)`. No line names my files. It also printed "1 baseline entries can be lowered"; that entry is not mine.

## Not verified

- No Firefox run, no full suites, and no `pnpm check`.
- `test.setTimeout` is called in the test body, so it takes effect after the extension fixture has started. A launch that alone took more than the config's 30 s would still fail. In every run here the launch took less.
- In this tree, the build cache reported other processes building at the same time, and an earlier e2e build was "not stamped, because inputs changed while it ran". So the Playwright runs used whatever dist was current then. Playwright compiles the spec and the scenario source itself.
- A stale `dist/.../markup/add-ons-line.js` may still be in the scenario-lab dist from an intermediate build. Nothing imports it.

## Open questions or contradictions found

- On Guildline's pager, the extension presses the following page number rather than Next itself (`by: "following"`). The original fixture's "Next pressed once" is therefore asserted as "the pager pressed once".
- Neither mode is declared as a manifest variant, which follows the c2 and c4 pattern.
