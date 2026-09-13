# f-authgate-followups: the rest of the password text

Worker report for `f-authgate-followups` in the twenty-sixth dispatch of
[finish-week1.md](../briefs/finish-week1.md). Repository `F:\!FluxIQWebExtension`.
HEAD was `eb8bf99` when work began and `dd9b9f9` when it ended. `f-authgate-fixture`'s
diff, which I was told to build on, was committed as `413dcb3` while I worked. My diff
sits on top of that commit. Written 2026-09-13.

The password value is never printed, hashed or quoted here. "The password constant"
means `authGateDemoCredentials.password` in `auth-gate/constants.ts`.

## Outcome

**Partial.** The scenario-lab half is done, verified, and has a mutation proof. The
content-harness half could not be done inside the files I own.

- **Done.** The sign-in page's password placeholder is now an exported constant,
  `authGatePasswordPlaceholder`. The page and the scenario test both use it.
- **Done.** Every comment in my files that said the page shows the password now says
  it does not.
- **Not done.** The two content-harness rows in `failures.spec.ts` still read the
  placeholder off the page. The only way for them to import the constant without
  failing the structure audit is through `auth-gate/index.ts`, and that file is not
  in my brief. See Open question 1. I left `failures.spec.ts` untouched.

**Re-verified at HEAD first.** This was not already done. Before my edits,
`pages.ts:32` held the placeholder as a literal string. The scenario test pinned the
same literal, and `constants.ts:9` and `manifest.ts:28-30,97-98` still said the page
shows the password.

## What changed and why

All paths are under `apps/scenario-lab/src/scenarios/auth-gate/`.
`git diff --numstat` against `dd9b9f9` gives: `constants.ts` 11 added and 3 removed,
`manifest.ts` 7 and 5, `pages.ts` 5 and 4, `tests/scenario.test.ts` 3 and 2.

### `constants.ts`

- **The new constant, at line 21.**
  `export const authGatePasswordPlaceholder = "Withheld: a run supplies it as the declared secret auth-gate-password.";`
  The text is exactly what `f-authgate-fixture` put on the page, so the rendered page
  does not change. Its doc comment says why the text is fixed, and that a test should
  name the text rather than read it off the page.
- **The credentials doc comment (line 9)** no longer says the credentials are "stated
  on the sign-in page". It now says the page states the username but never the
  password, which a run supplies as the declared secret `auth-gate-password`.
- **Export count.** The file now exports 4 values, under the audit's advisory limit
  of 8.

### `pages.ts`

- **The password row renders the constant.** At line 33 it is now
  `<dd data-testid="demo-password">${escapeHtml(authGatePasswordPlaceholder)}</dd>`,
  and the import is at line 3.
- **The doc comment (line 14)** names the constant instead of "a fixed placeholder".

### `tests/scenario.test.ts`

- **The pinned rendering uses the constant.** Line 234 is now
  `` `data-testid="demo-password">${escapeHtml(authGatePasswordPlaceholder)}<` ``
  instead of the hard-coded text. The import is at line 6.
- **A new guard, at line 222**, in "no rendering of the fixture contains the password
  constant":
  `assert.equal(authGatePasswordPlaceholder.includes(credentials.password), false, "the placeholder the page shows is not the password")`.
  - It is needed because the pinned rendering now follows the constant. If someone
    edited the constant to contain the password, the pin would still pass. The mutation
    below shows exactly that.
  - It compares a boolean, so a failure never prints the value.

### `manifest.ts`

- **Lines 29-31.** "sign in with the stated demo credentials" now reads "sign in with
  the demo credentials, of which the page states only the username".
- **Lines 98-101.** "which the sign-in page states in plain sight" now reads
  "`authGateDemoCredentials.password`, which the sign-in page never shows (its row reads
  `authGatePasswordPlaceholder`)".
- **Nothing else.** No other comment or description in the auth-gate directory said
  the page shows the password. I searched it for "stated", "states", "plain sight" and
  "credential".

### `apps/extension/e2e/content/tests/failures.spec.ts`: unchanged

The reason is in Open question 1.

## Commands run and observed results

Output went to scratch logs named `fafu-*.log`. Each exit status was echoed directly,
never through a pipe. The content harness ran with
`EXTENSION_TEST_BUILD_LABEL=f-authgate-followups`. Scenario-lab was built into a private
`dist-fafu` directory, never the shared `dist`, and `dist-fafu` was deleted at the end
(`rm dist-fafu exit=0`).

| Step | Command | Observed |
| --- | --- | --- |
| Scenario-lab check | `pnpm check`, run in `apps/scenario-lab` | `check exit=0`; the log shows `> tsc -p tsconfig.json --noEmit` |
| Scenario-lab build | `FLUXIQ_LAB_SCENARIO_OUT_DIR=dist-fafu node scripts/build-scenario-lab.mjs` | `build exit=0` |
| Scenario-lab test | `node --test "dist-fafu/**/*.test.js"` | `test exit=0`, `# tests 204`, `# pass 204`, `# fail 0`, `# cancelled 0`. Includes `ok 38 - no rendering of the fixture contains the password constant`, `ok 39 - the sign-in page states the demo username, withholds the password, …` and `ok 40 - through the lab server …` |
| Structure audit | `pnpm structure:check`, run at the repository root | `structure exit=0`, `structure-audit: passed (39 warning(s), 17 baselined).` No line names an auth-gate file or `failures.spec` |
| Content harness | `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 --reporter=list failures.spec.ts -g "on auth-gate"`, run in `apps/extension` | `content exit=0`, `4 passed (2.8s)`: `failures.spec.ts:116:3`, `:144:3`, `:176:3` and `:186:3`, all under "on auth-gate" |
| Mutation | `constants.ts:21` changed to `` `Withheld: ${authGateDemoCredentials.password}` ``, which refers to the password by name, so the value never appears in the edit. Then rebuilt into `dist-fafu` and ran `node --test dist-fafu/scenarios/auth-gate/tests/scenario.test.js` | `mutation build exit=0`, `mutation test exit=1`, `# tests 13`, `# pass 11`, `# fail 2` (quoted below) |
| Restore | Undid the edit; `cmp` against a copy taken before the mutation | `identical=True` |
| After the restore | Rebuilt into `dist-fafu`; `node --test "dist-fafu/**/*.test.js"` | `restore build exit=0`, `restore test exit=0`, `# tests 204`, `# pass 204`, `# fail 0`, `# cancelled 0` |
| No value in any log | `node fafu-value-scan.mjs <dist-fafu constants.js> <logs>`, which counts UTF-8 and UTF-16LE matches and prints only counts | `hits=0` for the check, build, test, structure, content, mutation-build, mutation-test, second build and second test logs (`total hits=0`) |
| Barrel-rule proof | `node fafu-barrel-proof.mjs`: the repository's real rule `scripts/structure-audit/rules/imports.mjs`, run on an in-memory context shaped like its own unit tests | direct import of `constants.js`: `1 finding(s)`, `severity=fail ratchet=true apps/extension/e2e/content/tests/failures.spec.ts: 1 import(s) reach into another directory's files instead of its barrel, e.g. "../../../../scenario-lab/src/scenarios/auth-gate/constants.js" …`; import through `index.js`: `0 finding(s)` |

**The mutation's two failures, quoted from `fafu-mutation-test.log`:**

1. **`not ok 11 - no rendering of the fixture contains the password constant`.**
   `error: the placeholder the page shows is not the password … true !== false`,
   `expected: false`, `actual: true`. This is the new guard at line 222.
2. **`not ok 13 - through the lab server the account route redirects, records each GET, and serves protected content`.**
   `error: the served sign-in page does not contain the password constant … true !== false`.

`ok 12 - the sign-in page states the demo username, withholds the password, …` passed
under the mutation. That is expected, because the pin now follows the constant, and it
is why the separate guard exists.

## Not verified

- **The two content-harness rows still read the page, not the constant.** Their
  sentinel is still the placeholder read off the page, never tested against the
  password constant. Open question 1 has the fix.
- **The Lab proof** (no Lab command in this dispatch). This change only renames where
  the placeholder is defined; the rendered page is the same. A Lab run must show what
  `f-authgate-fixture`'s report lists:
  - on the `auth-gate` recording lane and on `--flow`, the attestation reports no page
    text holding the value;
  - W18 still passes and its password node still types (`web.dom.type:succeeded`);
  - the state path `elements.demo.password` holds the placeholder text, which is not a
    finding.
- **The rendered HTML was not compared byte for byte, before and after.** The
  placeholder contains no character that `escapeHtml` changes, and the pinned test
  shows the row renders exactly `escapeHtml(authGatePasswordPlaceholder)`. That is an
  inference, not a diff.
- **Not run:** scenario-lab's own e2e `auth-gate.spec.ts` (not in my brief's tests);
  root `pnpm check`, `pnpm test` and `pnpm build`; extension `check`; the rest of
  `failures.spec.ts`. I made no extension change.
- **The barrel-rule proof ran on an in-memory context**, not on a real edit to
  `failures.spec.ts`. I did not edit that file just to make the audit fail.
- **Every result is a single observation** (faulty-RAM machine). Nothing failed except
  the deliberate mutation, so nothing was rerun.

## Open questions or contradictions found

1. **The brief's ownership stops at the file, not at the whole change.** Step 1 asks
   for the placeholder constant in "the two content-harness rows". That cannot be done
   inside my files:
   - **Direct import fails the audit.** `failures.spec.ts` sits outside `auth-gate/`,
     and `auth-gate/` has a barrel. The imports rule counts a direct import of
     `constants.js` from there as a barrel skip, with `severity=fail`, ratcheted and no
     baseline entry. The proof is in the table above.
   - **The barrel doesn't export it.** `auth-gate/index.ts` exports only
     `authGateScenario`, `authGateDemoCredentials` and the `AuthGateState` type.
   - **Missing from the brief:** `apps/scenario-lab/src/scenarios/auth-gate/index.ts`.
     The change there is one line:
     `export { authGateDemoCredentials, authGatePasswordPlaceholder } from "./constants.js";`
   - **Then in `failures.spec.ts`,** import both through the barrel:
     `import { authGateDemoCredentials, authGatePasswordPlaceholder } from "../../../../scenario-lab/src/scenarios/auth-gate/index.js";`
     This is the same barrel `apps/scenario-lab/e2e/auth-gate.spec.ts` already uses.
     `harness.ts:30` already imports `registry.js`, which loads every scenario, so the
     import adds nothing new at runtime.
   - **Suggested row body, for both rows,** in place of `:137-141` and `:169-173` and
     keeping `:172`'s `harness.url` check:
     - `const passwordRow = await page.locator('[data-testid="demo-password"]').innerText();`
     - `expect(passwordRow === authGatePasswordPlaceholder, "the gate page shows the placeholder, not the password").toBe(true);`
     - for `record` set to each of `JSON.stringify(reply.failure)` and
       `JSON.stringify(reply.validation)`: `expect(record.includes(authGateDemoCredentials.password), "the record never quotes the password constant").toBe(false);`
       and `expect(record.includes(authGatePasswordPlaceholder), "the record never quotes the page's password row").toBe(false);`
   - **Why boolean assertions.** A `toHaveText` or `not.toContain` on the value would
     print the received text if the page ever regressed.
   - **Type checking.** `apps/extension/tsconfig.test.json` includes `e2e/**/*.ts`, so
     extension `check` would type-check that edit.
2. **Structure baseline.** No auth-gate file or `failures.spec.ts` is baselined, and no
   entry should change.
