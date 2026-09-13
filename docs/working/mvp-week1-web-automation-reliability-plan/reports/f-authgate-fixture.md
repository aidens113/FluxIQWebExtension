# f-authgate-fixture — the sign-in page stops showing its password

Worker report for `f-authgate-fixture` in the twenty-fourth dispatch of
[finish-week1.md](../briefs/finish-week1.md). Repository `F:\!FluxIQWebExtension`,
HEAD `e3df022` when work began and `eb8bf99` when it ended (supervisor commits in
between; none touched my files). Written 2026-09-13.

The value is never printed, hashed or quoted here. "The password constant" means
`authGateDemoCredentials.password` in `apps/scenario-lab/src/scenarios/auth-gate/constants.ts`.

## Outcome

**Done.** The auth-gate sign-in page no longer renders the password constant as
page text.
- The `demo-password` `<dd>` now shows a fixed placeholder.
- A unit test proves that no rendering of the fixture contains the constant. A
  mutation that restores the old `<dd>` fails it.
- Scenario-lab `check`, `test`, the auth-gate e2e spec, the structure audit, and
  the content harness's auth-gate failure rows all pass.

**Re-verified at HEAD first:** not already settled. At `e3df022`,
`auth-gate/pages.ts:26` rendered
`<dd data-testid="demo-password">${escapeHtml(authGateDemoCredentials.password)}</dd>`.

## What changed and why

### `apps/scenario-lab/src/scenarios/auth-gate/pages.ts` (+8 −2)

- **The password row renders a fixed placeholder.** The `<dd data-testid="demo-password">`
  now reads `Withheld: a run supplies it as the declared secret auth-gate-password.`
  The username row is kept.
- **The doc comment says why.** Every state snapshot captures visible text, so a
  shown password reaches Core's workspace whatever typing withholds.
- **Why a placeholder rather than dropping the `<dd>`.** Two content-harness tests,
  in a file I do not own, read that element from the page:
  - `apps/extension/e2e/content/tests/failures.spec.ts:138-141` and `:169-173` call
    `page.locator('[data-testid="demo-password"]').innerText()`;
  - they assert the text is non-empty;
  - they use it as the "not leaked" sentinel against the failure and validation
    records.

  Dropping the element would leave `innerText()` waiting until the test timed out.
  The placeholder keeps those rows passing, and keeps the page's structure
  unchanged. See Open question 1 for what they lose.

### `apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts` (+26 −4)

- **New test: "no rendering of the fixture contains the password constant".**
  - It renders the sign-in page seeded, armed (`expire-session`) and signed in,
    and the account page through `route`.
  - For each rendering it asserts that neither the raw constant nor
    `escapeHtml(constant)` occurs.
  - It also asserts that the account rendering is the protected page.
  - Every assertion compares a boolean, so a failure prints the rendering's name,
    never the value.
- **The rendering test is renamed and re-pinned.** It is now "the sign-in page
  states the demo username, withholds the password, marks the password field, and
  reveals the expiry notice only on ?expired=1". It pins the placeholder `<dd>`
  instead of the password `<dd>`.
- **The lab-server test checks what is served.** It now asserts that the
  sign-in page served by `startScenarioLab` (`/scenarios/auth-gate/?expired=1`)
  does not contain the constant. That is the HTML a browser snapshot sees.
- **Smaller changes.**
  - The replay-secret test's comment no longer says the page "states [the
    password] in plain sight".
  - `escapeHtml` is imported from `../../../html.js`.

### `apps/scenario-lab/e2e/auth-gate.spec.ts` (+3 −2)

I treated this as one of "that scenario's tests".
- **What broke.** The W18 test asserted
  `page.getByTestId("demo-password")` `toHaveText(authGateDemoCredentials.password)`
  (old line 70), which the fix breaks.
- **What replaced it.**
  `expect((await page.content()).includes(authGateDemoCredentials.password), "the sign-in page does not show the password constant").toBe(false)`.
  A failure reports a boolean, never the value.
- **The title changes** from "signs in with the stated demo credentials" to
  "signs in with the demo credentials".

### What still works without the page text (checked in code)

- **Recording script.** `enter-password` types `authGateDemoCredentials.password`,
  imported in `auth-gate/manifest.ts:44`, not read from the page.
- **Runner.** The Flow lane resolves the value from
  `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` (`manifest.ts:105`, the declared secret).
  No file under `packages/` references `demo-password`.
- **Oracle and page facts.** `SIGN_IN_PAGE_FACTS` (`manifest.ts:22-26`) are
  `sign-in-form-visible`, `demo-username-stated` (the kept username `<dd>`) and
  `expiry-notice-hidden`.
  - None reads `demo-password`.
  - `finalState` and `extracted` read only the account page and the expiry notice.
- **Sign-in gate recognition** keys on a visible password control inside a form
  (`apps/extension/src/content/action-runtime/results.ts:375-378`), not on page text.
- **Every reference to `demo-password`.** Grep over `apps`, `packages`, `domain`
  and `scripts` found `pages.ts`, the two scenario-lab tests above, and
  `failures.spec.ts:138,169`. The credentials heading and its test id are
  referenced only in `pages.ts`.

## Commands run and observed results

All runs used `EXTENSION_TEST_BUILD_LABEL=f-authgate-fixture`, with output
redirected to scratch logs named `f-authgate-*.log` and exit status echoed
directly, never through a pipe.

| Step | Command | Observed |
| --- | --- | --- |
| Type check | `pnpm -C F:/!FluxIQWebExtension --filter @fluxiq-web-extension/scenario-lab check` | `check exit=0`; the log shows `> tsc -p tsconfig.json --noEmit` ran in `apps/scenario-lab`. The `-C` form also printed `No projects matched the filters "f:\!FluxIQWebExtension"`, but the filtered script still ran |
| Structure audit | `pnpm -C F:/!FluxIQWebExtension structure:check` | `structure exit=0`, `structure-audit: passed (39 warning(s), 17 baselined).` No warning names an auth-gate file |
| Unit tests, with the fix | `pnpm --filter @fluxiq-web-extension/scenario-lab test` (builds `dist/`, then `node --test dist/**/*.test.js`) | `test exit=0`, `# tests 204`, `# pass 204`, `# fail 0`; includes `ok 38 - no rendering of the fixture contains the password constant` and `ok 39 - the sign-in page states the demo username, withholds the password, …` |
| Mutation: restore the old `<dd>` | Edit `pages.ts:26` back to `${escapeHtml(authGateDemoCredentials.password)}`; `pnpm --filter … scenario-lab build`; `node --test dist/scenarios/auth-gate/tests/scenario.test.js` | `mutation build exit=0`; `mutation test exit=1`; `# tests 13`, `# pass 10`, `# fail 3` (quoted below) |
| Restore | Edit back to the placeholder; `Get-FileHash -Algorithm SHA256` | `after-restore=A89D5341…E1D2C1`, `before-mutation=A89D5341…E1D2C1`, `identical=True` |
| Unit tests, after restore | `pnpm --filter @fluxiq-web-extension/scenario-lab test` (also rebuilds `dist/` from the restored source) | `test exit=0`, `# tests 204`, `# pass 204`, `# fail 0`, `# cancelled 0` |
| Scenario-lab e2e | `pnpm --dir apps/scenario-lab exec playwright test -c e2e/playwright.config.ts --reporter=list auth-gate.spec.ts` | `e2e exit=0`, `6 passed (3.7s)`, including `ok 1 e2e\auth-gate.spec.ts:66:1 › W18 signs in with the demo credentials, reaches the account page, and reads the protected content` |
| Content harness, auth-gate rows (not my file) | `pnpm --dir apps/extension exec playwright test -c e2e/playwright.content.config.ts --workers=2 --reporter=list failures.spec.ts -g "on auth-gate"` | `content exit=0`, `4 passed (2.9s)`, including `failures.spec.ts:116:3 › on auth-gate › a target missing behind a sign-in gate is AUTH_REQUIRED, not a bare missing target` and `:144:3 › … a URL claim that fails on a sign-in gate is AUTH_REQUIRED, and the record never quotes the page's address` |
| No value in any log | `node f-authgate-value-scan.mjs <dist constants.js> <logs>` (counts UTF-8 and UTF-16LE occurrences, prints counts only) | `hits=0` for each of `f-authgate-check.log`, `-structure.log`, `-test1.log`, `-mutation-build.log`, `-mutation-test.log`, `-test2.log`, `-e2e.log`, `-content.log` |

**The mutation's three failing tests, quoted from `f-authgate-mutation-test.log`:**

1. **`not ok 11 - no rendering of the fixture contains the password constant`.**
   `error: sign-in, seeded … true !== false`, `expected: false`, `actual: true`.
2. **`not ok 12 - the sign-in page states the demo username, withholds the password, marks the password field, and reveals the expiry notice only on ?expired=1`.**
   `error: 'data-testid="demo-password">Withheld: a run supplies it as the declared secret auth-gate-password.<'`,
   `expected: true`, `actual: false`.
3. **`not ok 13 - through the lab server the account route redirects, records each GET, and serves protected content`.**
   `error: the served sign-in page does not contain the password constant … true !== false`.

**Final tree.** `git status --short` lists my three files as `M`, with
`git diff --numstat`: `3 2 auth-gate.spec.ts`, `8 2 pages.ts`,
`26 4 scenario.test.ts`. The other modified and untracked paths (under
`packages/test-runner/src/...` and `docs/working/...`) belong to other workers and
were not touched. The browser runs left no untracked files.

## Not verified

- **The Lab proof** (no Lab command in this dispatch). A Lab run must show:
  - **`auth-gate` recording lane.** None of the 6 page-text objects or 3 page-text
    database rows from `i-secret-in-workspace` holds the value. Those are the state
    snapshot body, the 5 recording state snapshots, the two `global.sqlite`
    `"automation.state"` rows and `project.sqlite` `state_paths` rowid 36. The
    attestation should report `findingCount` 0, and once the SQLite scan
    (`g-attestation-sqlite`) lands it must still be 0.
  - **`auth-gate --flow`.** The page-text key paths are gone. On state snapshots
    those are `elements.demo.password.value.visibleText` / `.text` /
    `.presentation.label` and the visual-frame layer labels. On the three command
    attempts they are `result.payload.result.snapshot.interactiveElements[*].text`,
    `.visibleText` and `.accessibleName`.
  - **What `--flow` findings remain.** Only run inputs and
    `command.parameters.text`, until fixes 2-4 land.
  - **W18 still works.** It still passes, and its password node still types
    (`web.dom.type:succeeded`).
  - **The placeholder is expected in state.** The `elements.demo.password` state
    path now holds the placeholder text, which is not a finding.
- **The e2e spec is not type-checked.** Scenario-lab `check` does not cover it
  (`tsconfig.json` includes only `src/**/*.ts`). It was proven only by running it
  under Playwright's transpile.
- **Only the unit-test guard has a mutation proof.** The e2e `page.content()`
  check was not mutated.
- **Gates not run.** Root `pnpm check`, `pnpm test`, the full content harness, and
  the other `failures.spec.ts` groups. Only the "on auth-gate" group ran.
- **Other scenarios' pages were not examined** for declared secrets rendered as
  text.
- **Every result above is a single observation** (faulty-RAM machine). None
  failed, so nothing was rerun.

## Open questions or contradictions found

1. **The ownership boundary was drawn around the file, not the change.** The
   brief should also have included
   `apps/extension/e2e/content/tests/failures.spec.ts` (`:138-141`, `:169-173`).
   - Those rows take the page's `demo-password` text as the credential sentinel.
     With the placeholder they still pass, but the sentinel is now the placeholder
     text, not a credential.
   - So "Recognising the gate reads the page's structure, never a credential" is
     no longer tested against a credential.
   - The fix belongs in that file: use `authGateDemoCredentials.password`, as
     `apps/scenario-lab/e2e/auth-gate.spec.ts` does, instead of reading it from the
     page.
   - If the `<dd>` is ever dropped, both rows hang on `innerText()` until they
     time out.
2. **Stale comments in files I do not own.** Each still says the page shows the
   password:
   - `auth-gate/constants.ts:9`: "Fixture-only demo credentials, stated on the
     sign-in page";
   - `auth-gate/manifest.ts:28-30`: "sign in with the stated demo credentials";
   - `auth-gate/manifest.ts:97-98`: "which the sign-in page states in plain sight".

   `docs/architecture/testing-facility.md:749` ("Sign-in form with fixture-only
   demo credentials") is still accurate.
3. **Structure baseline.** No auth-gate file is baselined, and no entry should
   change.
