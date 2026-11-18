# First sign-in (task t927, worker report)

Branch `task/t927-first-sign-in` in both trees (local only). Security fix for a public repository: keep it local until the lead decides.

Round 1 (commit `ab0e95b3d`) is further down. Round 2 (the lead approved the setup-code recommendation) comes first. Round 2 is not committed.

# Round 2 follow-up: shared Core and the check script

Status: done. (It was paused for a machine restart on 2026-11-17 and resumed afterwards.)

- **Shared Core is only checked, never prepared.**
  - New `scripts/run-fluxiq-web/core-kind.mjs`: `coreKind(coreRoot)` returns `shared` when Core is a linked worktree on a detached HEAD, which is the rule `scripts/worktree/shared-core-move.mjs` uses. Anything on a branch, or a main checkout, is `own`. The base directory's name is not checked, because `--base` and the Lab's worktrees put shared Cores elsewhere.
  - `prepareWorkspace`, for a shared Core, skips Core's install and build and runs `taskToolCoreChecks` in process: `checkCoreCurrent` (source contains Core's `dev`) and `coreBuildFreshness` (the check behind `scripts/check/core-build.mjs`).
    - Current: it prints one line and continues.
    - Stale: it stops with one line naming `pnpm task sync-core`.
  - `scripts/run-fluxiq-web.mjs` catches a preparation failure, prints one line and exits 1.
- **Tests**: `node --test "scripts/run-fluxiq-web/tests/*.test.mjs"` → `# pass 15`, `# fail 0`. They cover `coreKind` for a main checkout, a paired Core, a shared Core, a detached main checkout and a git failure, plus shared-current, shared-stale and the task checks.
- **Real Cores**, read-only probe:
  - `C:/Users/osrs_/FluxStuff/!FluxIQ` → own;
  - `fxwork/t927/!FluxIQ` → own;
  - `fxwork/!FluxIQ` → shared.
  - Real shared-Core stop from `t917-sweep-20261117` (extension install faked): `FluxIQ Core at C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ is shared with other task worktrees and is 1 commit(s) behind Core's dev, so it is not installed into or rebuilt from here: run pnpm task sync-core in C:/Users/osrs_/FluxStuff/fxwork/t917-sweep-20261117, then start again.` Nothing ran inside the shared Core; its HEAD stayed at `07f5096a6` with a clean tree.
- **Root `package.json`**: `"scripts/run-fluxiq-web/tests/*.test.mjs"` was added to the `check` script's `node --test` list, and also to `task:test`.
  - It has to be in `task:test` too: `scripts/build-cache/tests/check-prefix.test.mjs` requires the `check` script's globs to equal the per-suite scripts' globs in order (`structure:test`, `lab:test`, `task:test`, `build-cache:test`, `check:test`). With the glob only in `check`, that guard failed (`# fail 1`).
  - In `task:test` the glob sits after the task globs and before `build-cache:test`, exactly where it already is in `check`. The guard then passed (`node --test scripts/build-cache/tests/check-prefix.test.mjs` → `# pass 2`).
  - A cleaner alternative is a separate `launcher:test` suite, but that needs a new entry in that guard test's `SUITES`, which is outside my paths.
- **Structure audit (extension)**: `passed (251 warning(s), 551 baselined)`, after two packed statements in the new test were split.
- **The `check` script's test step**, run once under a slot after the restart (`heavy-slot.mjs run t927 -- node --test` with the `check` script's nine globs): `# tests 793`, `# pass 792`, `# skipped 1`, `# fail 0`, exit 0. The launcher's tests are in it: searching the output by test name matched 14 of the 15.
- **Not verified**: the shared-but-current path live. It is covered only by a unit test, because the real shared Core is 1 commit behind.

# Round 2: one-time setup link, existing installs, startup sweep, launcher preparation

## Outcome (round 2)

Done.

- **New local installs have no account and no known password.** At start the panel prints a one-time link, `http://127.0.0.1:<port>/setup#<code>`. Opening it lets the person choose their name and password, and they land signed in. There is no email and no platform service.
- **Existing installs still on `admin`/`admin`** keep round 1's enforcement. They also get a fresh link at every start, and every session of that admin is revoked at start (the sweep).
- **The launcher prepares everything first.** `scripts/run-fluxiq-web.mjs` now installs dependencies in both repositories, brings Core's libraries and the panel host up to date through the build caches, and frames the setup link in the terminal.
- All of this was verified by tests and live in a headed browser, for both a fresh install and an existing one.

## What changed (round 2)

Core:

- **`packages/fluxiq/src/programs/identity-access/runtime/first-run/`** (new):
  - `IdentityFirstRunControl`, exposed as `identityAccess.firstRun`.
    - `startUnclaimed()`: before the store's first load, an empty store gets no account. It returns false once loaded, so an existing store is never emptied.
    - `state()`: one of `unclaimed`, `temporary-admin` or `claimed`. It proves the temporary password without minting a session; only the wrong-password refusal means "not temporary", and any other error is thrown.
    - `seed()`: the old `ensureDefaultAdmin`, moved out of `service.ts`.
  - Seeding `admin`/`admin` stays the library's default, so Core's roughly 40 test files and other embedders that sign in with it are unchanged.
  - This is a collaborator object, not new methods, because `IdentityAccessService` sat at the audit's 40-method and 800-line limits. `service.ts` went from 800 to 790 lines.
- **`apps/web/src/lib/fluxiq.ts`**:
  - On `local`, every instance calls `identityAccess.firstRun.startUnclaimed()` in `opened()`, before it serves anything.
  - After start, `prepareLocalFirstRun` runs with the primary's identity service and the panel's public origin.
- **`apps/web/src/server/owner-claim/local/`** (new):
  - `prepareLocalFirstRun`:
    - `claimed`: does nothing.
    - `temporary-admin`: `revokeUserSessions("admin")` (the sweep), then issues a code.
    - `unclaimed`: issues a code.
    - It prints `[FluxIQ] First-time setup: open <origin>/setup#<code> ...`. The code sits after `#`, so a browser never sends it to a server.
  - `localSetupCode`:
    - 160-bit hex, held in process memory as its SHA-256 digest only;
    - a new code at each start, replacing the last;
    - expires after 12 hours;
    - spent by a successful claim.
  - `claimLocalOwner`, one claim at a time with the state re-read inside:
    - `unclaimed`: creates an administrator signing in with the chosen name.
    - `temporary-admin`: turns the `admin` account into the owner's. It signs in by the admin's current name, renames it, and changes the password as its own change with `admin` as the current password, so its sealed keys follow. Its other sessions end, and the proof session is revoked whatever happens.
- **`apps/web/src/app/setup/`**:
  - `page.tsx`: on `local` it renders `LocalSetupClient` while `firstRun.state()` is not `claimed`, and is not found once it is.
  - `submit/route.ts`: on `local` it calls `submitLocalOwnerClaim` (identity access and `restoreLoginKeys` only).
  - `server/submitLocalOwnerClaim.ts`, in order:
    - not found once claimed;
    - same-site only (`readLocalSetupForm`, which takes the code from the body only);
    - this computer only (loopback `Host`);
    - about 10 wrong codes per 10 minutes, then locked;
    - `none` → 503, `wrong` → 401, `expired` → 410;
    - the name has no spaces and at most 64 characters;
    - the password follows round 1's rule;
    - then the claim, the code spent, and the sign-in.
  - `LocalSetupClient.tsx`, `client/takeSetupCodeFromLink.ts`, `client/localSetupMessage.ts`:
    - the page reads the code from `#`, removes it from the address bar with `history.replaceState`, and posts it only in a body;
    - three fields: name, password, confirm;
    - a code field appears only if the link carried none.
  - `server/toSetupHttp.ts`: a signed-in owner's browser also drops round 1's setup cookies.
- **`app/AuthShell.tsx`**: the sign-in form has a one-line hint, "Setting up FluxIQ for the first time? Open the setup link it printed when it started."
- **Tests**:
  - `identity-access/runtime/first-run/tests/first-run.test.ts` (5);
  - `server/owner-claim/local/tests/setup-code.test.ts` (4);
  - `prepare-first-run.test.ts` (3: new install; existing install with the sweep and a fresh link; claimed);
  - `app/setup/server/tests/submitLocalOwnerClaim.test.ts` (6: new install, used once; existing install; wrong code then throttled; expired and none; code in the URL ignored; cross-site, rebinding, bad name, weak or mismatched password);
  - `app/setup/client/tests/takeSetupCodeFromLink.test.ts` (3);
  - `lib/tests/fluxiq.test.ts`: mocks updated; the local first-run step is wired with the right identity and origin; a new test covers both starts with real instances (a new local install comes up `unclaimed` with no users and `admin`/`admin` refused; an existing one comes up `temporary-admin`).

Extension:

- **`scripts/run-fluxiq-web.mjs`**:
  - calls `prepareWorkspace` before setup and prints one line per step;
  - no longer runs `build-web-panel-host.mjs` directly (the host now comes through the build cache);
  - passes the panel's output through and frames the setup link in a banner.
- **`scripts/run-fluxiq-web/`** (new): `prepareWorkspace` runs, in order and stopping at the first failure:
  1. `pnpm install --frozen-lockfile --prefer-offline` in the extension, then in Core: "current" when pnpm says "Already up to date", otherwise "installed from the lockfile";
  2. Core's `contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` through Core's build cache;
  3. `domain:host-build` (the panel host) through the extension's build cache.

  Each step prints "current" or what it rebuilt. Build-cache commands run with this Node directly (no shell), so a path with spaces is passed as it is. Tests (7) are in `scripts/run-fluxiq-web/tests/`.

## Commands run and observed results (round 2)

The machine crashed at 5:13 PM during round 2.

- **Recovery checks**: every changed file ends cleanly with a newline at a plausible size. The Core library build output matched its stamp afterwards: `fluxiq:build` "inputs and outputs match the stamp", and the new `first-run/` files and `IdentityFirstRunControl` are present in `dist`.
- **Heavy slots**: every heavy step after the crash ran under `heavy-slot.mjs run t927 --`. The live session held `acquire t927 60` and ended with `release t927` ("t927 released").

Results:

- `npx vitest run src/programs/identity-access` (Core `packages/fluxiq`): `21 passed (21)`, `184 passed (184)`.
- `pnpm --filter fluxiq check`: exit 0. The first attempt failed on a literal type in my new test (`keyLength: number` vs `32`), which I fixed.
- `node scripts/build-cache/cli.mjs contracts:build ... ui-components:build` (slot): exit 0.
- `pnpm --filter @fluxiq/web check` (slot): `exit=0`.
- Web vitest (slot) over `src/lib/tests/fluxiq.test.ts src/server/owner-claim src/app/setup src/app/api/auth src/app/tests src/app/session-reauthentication`, the panel layout, sign-in, `connect/authorize` and `server/startup`: 22 files passed. `lib/tests/fluxiq.test.ts` failed 7 tests:
  - my new two-instance test timed out at the default 5 s;
  - the rest failed after it (`workspaces.closed`, missing `iamAudit`), because its abandoned body kept running.
  - With a 60 s timeout on that test (as the file's other real-instance test has), the file passes on its own: `1 passed (1)`, `36 passed (36)`.
- `pnpm --filter @fluxiq/web build` (slot): exit 0, `Runtime build identity is stamped: no placeholder in 1382 server files.`
- `node scripts/structure-audit.mjs`:
  - Core: the first run failed `class-methods` (42 > 40), fixed by the collaborator object; it then printed `passed (549 warning(s), 914 baselined)`.
  - Extension: `passed (251 warning(s), 551 baselined)`.
- `node --test "scripts/run-fluxiq-web/tests/*.test.mjs"`: `# pass 7`, `# fail 0`.
- **Live A, fresh install, with a stale Core build** (data from round 1 moved to `test-runs/t927-data/`, so there was no `.fluxiq`):
  - Before starting, I deleted `packages/fluxiq/dist/programs/identity-access/runtime/first-run/read-first-run-state.js`.
  - `PORT=3200 FLUXIQ_CLIENT_GATEWAY_PORT=4977 FLUXIQ_PUBLIC_CLIENT_WS_URL=ws://127.0.0.1:4977/client node scripts/run-fluxiq-web.mjs` printed:
    - `Dependencies (extension): current.`
    - `Dependencies (FluxIQ Core): current.`
    - `Core libraries: rebuilt fluxiq ...` (the deleted file was back)
    - `Panel host: rebuilt domain:host-build ...`
    - the web build `reuse`
    - `Ready in 5.3s`
    - `[FluxIQ] First-time setup: open http://127.0.0.1:3200/setup#<code> ...`, and the framed banner.
  - The code appears in the terminal log twice: that line and the banner.
  - In headed Chromium (`test-runs/t927-setup-link/live-setup-link.mjs`, screenshots `f1`-`f6`):
    - `admin`/`admin` → `401 Invalid username or credentials`;
    - the link opened the setup page and the address bar became `http://127.0.0.1:3200/setup` (code removed, no code field shown);
    - after choosing a name and password: Home, cookie `fluxiq_session`;
    - the same link again shows the not-found page (`f5`);
    - the same code posted again → `404 not_found`;
    - `admin`/`admin` → 401;
    - the chosen name → 200, `requiresCredentialSetup: false`;
    - 147 requests were made, and none carried the code in a path or query.
- **Live B, existing install** (`seed-existing-install.mjs`: store opened in the library default mode, one admin session minted, printed `{"state":"temporary-admin","users":["admin"],"sessions":1}`):
  - The launcher printed all four preparation lines as `current`, then `[FluxIQ] Ended 1 session(s) of the default admin account, which still has its temporary password.`, then the link and banner.
  - The pre-fix session cookie on `/api/programs/identity-access/snapshot` → `401`.
  - In the browser (`e1`-`e6`):
    - `admin`/`admin` still gives only the setup form, with no session cookie (round 1);
    - the link opened the setup page with the address bar cleaned;
    - after setup: Home, only `fluxiq_session` (round 1's setup cookies cleared);
    - the code again → 404;
    - `admin`/`admin` → 401;
    - the chosen name → 200;
    - 0 of 147 requests carried the code.
  - Panel stopped (`taskkill`, nothing listening on 3200 or 4977), slot released. No paid calls.

## Not verified (round 2)

- **"Older than its source", literally**: the stale-Core check deleted a built file instead of editing a Core source file. Both go through the same build-cache decision (outputs, or inputs, not matching the stamp), but a source edit would have rebuilt `fluxiq` and the 10-minute web build on a machine already short of memory. The unit tests cover the "rebuilt" and "current" lines. A missing `node_modules` (the `browser-host` case) was not reproduced; the install step was only seen reporting "current" live.
- **The launcher's tests are not in `pnpm check`**: its `node --test` globs do not include `scripts/run-fluxiq-web/tests/`. That needs `"scripts/run-fluxiq-web/tests/*.test.mjs"` added to the root `package.json` `check` script, which is outside my paths.
- **`pnpm install` in Core**: in a sibling-worktree layout Core is shared and read-only. With a frozen lockfile and current `node_modules` the install changes nothing ("Already up to date"), but if a lockfile change were pending it would install into the shared Core. I did not test that case.
- **Opening a used link answers HTTP 200** with the not-found page (Next streams the page under the root `loading.tsx` before `notFound()`). The public profiles' `/setup` behaves the same way.
- **Restarts between first run and setup**: a code lives only in that process's memory; a restart prints a new link and the old one stops working (tested in `prepare-first-run`).
- **Other first loaders**: an empty store first opened by something other than the web panel (a script or CLI using the library's default) gets `admin`/`admin`. The panel then treats it as an existing install: link, sweep and round 1's enforcement.
- **Not run**: Firefox and Edge, `next dev`, the full suites. I also did not check whether the Lab's own harnesses, which seed their own users, ever start a local panel on an empty store and expect `admin`.

# Round 1

## Outcome

Done. Signing in with the temporary `admin`/`admin` credential no longer creates a panel session. It gives only a setup grant, and the one thing that grant can do is replace the password. Reloading or moving to another page keeps the person on the setup form, and the form also offers Sign out. Every other route and the gateway's pairing approval refuse the setup browser with 401, because no session exists for them to accept. Replacing the password signs the same person in with a normal session at once. A cross-site sign-in is refused with 403, and so is a DNS-rebinding sign-in with the temporary credential. All of this was checked by route tests and live in a headed browser.

## Cause

In `apps/web/src/app/api/auth/login/route.ts`, the old lines 122-131 called `identityAccess.authenticate`. That call creates a full session, and the route then set it as the session cookie whatever `requiresCredentialSetup` said. The setup form was enforced only in the client. Leaving or reloading the form kept a full session on a password everyone knows. The old setup form also replaced the password through `/api/programs/identity-access/set-password` using that full session.

The login route also accepted cross-site posts. The middleware's cross-site guard (`lib/request-guard`) only checks requests that already carry a session cookie. A login post has no cookie, so it was never checked. A `text/plain` form whose body is JSON reaches the route without a preflight, and `request.json()` parsed it. Before the fix, the live check's form post from `http://127.0.0.2:3299` would have signed the browser in as admin.

## Decision on the default password

**There should be no fixed default password. First run should use a one-time setup code printed in the terminal that starts the panel. I did not implement that here, because it needs files outside my paths (listed below).** Reasons:

1. **A fixed credential belongs to whoever uses it first.** After this fix the race is narrow: it lasts only until setup finishes, and only same-site requests from a loopback `Host` can sign in. Even so, any other OS account or local process on the machine can still claim the panel first. A 160-bit code in a mode-0600 file, printed only to the terminal of the person who started the panel, cannot be raced that way.
2. **It is at least as simple for a person.** The terminal can print `http://127.0.0.1:3000/setup#<code>`, which opens the set-password form with the code already filled in. The fragment never reaches the server logs or a referrer. Today the person has to already know `admin`/`admin`; audit finding P1 notes that nothing tells them.
3. **It removes the last exception.** `self-hosted` and `service` already refuse `admin`/`admin` and use exactly this owner claim (`server/owner-claim`, `/setup`). `local` is the only profile still on the fixed password (`prepare-owner-claim.ts`: "the first loopback start keeps today's admin/admin").

The enforcement shipped here is needed either way. Every existing install is still on `admin`/`admin` until its owner replaces it, and this fix is what keeps such an install locked until then.

Files the setup-code follow-up would need (none edited, all outside my paths; the lead should approve them):
- `packages/fluxiq/src/programs/identity-access` (t924): stop seeding a usable `admin` password on an empty local store.
- `apps/web/src/lib/fluxiq.ts` (t924): `announceOwnerClaim` should print the setup link on `local`.
- `apps/web/src/server/owner-claim/prepare-owner-claim.ts` and `is-owner-claim-open.ts`: open the claim on `local`.
- `apps/web/src/app/setup/**`: a local form. The claim currently requires an email as the username, and platform provisioning that `local` does not compose.
- The extension's `scripts/run-fluxiq-web.mjs`: pass the link through or open the browser at it.

## What changed and why

All in Core `apps/web/src`:

- `app/api/auth/temporary-credential/` (new; barrel plus one export per file):
  - `beginCredentialSetup`: the login route's answer to the temporary credential.
    - It revokes every session of the account (`revokeUserSessions`). That covers the session `authenticate` just created and any session left from before this fix.
    - It refuses a `Host` that is not a loopback name (`isLoopbackRequest`, against DNS rebinding).
    - It issues a setup grant and sets two cookies:
      - `fluxiq_credential_setup`: HttpOnly, SameSite=Strict, Path=/api/auth, 30 minutes.
      - `fluxiq_credential_setup_pending=1`: readable marker, no authority, Path=/.
    - It clears any session cookie.
  - `credentialSetupGrants`: in-memory grants on `globalThis` (Next bundles each route separately). The token is 256 bits and only its SHA-256 digest is kept; there is one grant per account and it expires after 30 minutes. A restart forgets grants, and the person signs in with the temporary credential again.
  - `replaceTemporaryCredential`:
    - It proves the temporary credential again, so a grant that outlived the credential does nothing.
    - It calls `setPasswordAuthorized` as the account's own password change, with `admin` as the current password, so sealed keys follow the change.
    - It always revokes the proof session, which never leaves the server.
  - Also in this module: `credentialSetupCookies`, `isTemporaryCredential` (user id `admin` plus password `admin`), and `TEMPORARY_CREDENTIAL`.
- `app/api/auth/credential-setup/route.ts` (new), `POST`. It refuses cross-site and non-loopback requests, then reads the grant from the setup cookie (401 `setup_expired` otherwise). It applies the same password rule as the form (400) and replaces the password: 409 `already_replaced` if the temporary credential no longer works, 400 `password_refused` if identity access refuses the new password. It then signs in with the new password, restores login keys as the login route does, sets the normal session cookie and clears the setup cookies.
- `app/api/auth/credential-setup-rules/` (new, client-safe): `replacementPasswordError` (at least 12 characters, not `admin`, must match the confirmation) and the marker cookie's name. The form and the server share both.
- `app/api/auth/login/route.ts`:
  - It refuses a cross-site request first (403 `cross_site_request`, using the pre-sign-in check from `app/welcome/server`), before parsing or authenticating.
  - The temporary credential goes to `beginCredentialSetup`. A normal sign-in clears any setup cookies, and `requiresCredentialSetup` is `false` there.
  - It imports the cookie name from `lib/session-cookie` instead of `lib/auth`. `lib/auth` pulls in all of `fluxiq/server` just for that constant, and that import cost made the existing logout test time out at 5 s even on the unchanged route: 11.2 s, measured.
- `app/api/auth/logout/route.ts`: it also forgets the setup grant and clears the setup cookies, so signing out of setup returns to the sign-in form. Same cookie-import change.
- `app/AuthShell.tsx` (`LoginPanel`):
  - Setup state is a `setupPending` flag, set by the login answer or, on mount, by the marker cookie (reload, another page).
  - The form posts `{password, confirmation}` to `/api/auth/credential-setup`.
  - `setup_expired` and `already_replaced` return the person to the sign-in form with the server's message.
  - The form has a Sign out button, and the typed temporary password is dropped from state.
  - `setupPasswordError` delegates to the shared rule.
- `app/session-reauthentication/SessionReauthentication.tsx`: a restore with the temporary credential no longer counts as a restored session. The interrupted request fails and the page reloads onto the setup form.
- Tests:
  - `app/api/auth/tests/first-sign-in.test.ts` (new): a real FluxIQ instance in a temporary root on the local profile, calling the real route handlers.
  - `app/api/auth/login/tests/route.test.ts`: the old "admin/admin gets a session cookie" case is now "setup grant, no session", plus a cross-site case.
  - `app/tests/AuthShell.test.tsx`: new body for the setup request, plus three cases: the marker keeps the setup form, `setup_expired` returns to sign-in, Sign out goes through the logout route.
  - `app/session-reauthentication/tests/SessionReauthentication.test.tsx`: a temporary-credential case.

## Commands run and observed results

All run from `fxwork/t927/!FluxIQ` unless noted.

1. **Before the fix**: `npx vitest run src/app/api/auth/tests/first-sign-in.test.ts` (in `apps/web`), with the new test against the unchanged routes. It printed `4 failed`, each for the defect it targets:
   - cross-site: `expected 200 to be 403`;
   - temporary sign-in gives only a setup session: `expected true to be false` (a session cookie was set);
   - setup session refused elsewhere: received `approvePairing: 404, identitySnapshot: 200, setPassword: 200, gatewaySnapshot: 500, listKeys: 503, listProjects: 404` instead of all 401;
   - replacement gives a full session: `Failed to load url ../credential-setup/route`.
2. **After the fix**: `npx vitest run src/app/api/auth src/app/tests src/app/session-reauthentication "src/app/(panel)/tests/layout.test.tsx" "src/app/(panel)/security/sign-in" "src/app/(panel)/security/keys" "src/app/(panel)/settings" src/app/connect/authorize` printed `Test Files 14 passed (14)`, `Tests 89 passed (89)`. The four first-sign-in cases pass, and so do the login (11), logout (2), AuthShell and session-restore suites.
3. `pnpm --filter @fluxiq/web check` exited 0: `{"build-cache":"build","step":"web:check","reason":"inputs changed: apps/web",...}`, with no type errors.
4. `node scripts/structure-audit.mjs`:
   - The first run printed 4 failures, all in my files: `failure-as-empty` in `credential-setup/route.ts` and `is-loopback-request.ts`, and `statement-packing` in two test files.
   - I fixed them: a JSON parse failure now returns 400 `bad_request`, the URL fallback no longer catches, and packed statements are split.
   - The re-run printed `structure-audit: passed (549 warning(s), 914 baselined).`
5. `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`: all five `reuse` ("inputs and outputs match the stamp").
6. `pnpm --filter @fluxiq/web build` exited 0, ending `Runtime build identity is stamped: no placeholder in 1377 server files.` and `"step":"web:build"... "ms":279748`.
7. In the extension worktree, `pnpm build` exited 0: every step `Done`, Core build "current with its source".
8. **Live**: in the extension worktree, `PORT=3200 FLUXIQ_CLIENT_GATEWAY_PORT=4977 FLUXIQ_PUBLIC_CLIENT_WS_URL=ws://127.0.0.1:4977/client node scripts/run-fluxiq-web.mjs`, with no `.fluxiq` beforehand (fresh data). Next printed `Ready in 3.5s` on `127.0.0.1:3200`, and the gateway bound `ws://127.0.0.1:4977/client`. I drove it with headed Chromium (Playwright 1.51.1, `test-runs/t927-first-sign-in/live-first-sign-in.mjs`). Results are in `test-runs/t927-first-sign-in/results.json`, screenshots 01-12 beside it:
   - **Cross-site**: a page on `http://127.0.0.2:3299` sent a no-cors `fetch` and a `text/plain` form post of `admin`/`admin`. The form got `403 {"ok":false,"code":"cross_site_request",...}` and the browser held no panel cookies (01).
   - **Temporary sign-in**: the setup form appeared (03). The browser's only cookies were `fluxiq_credential_setup path=/api/auth HttpOnly Strict` and `fluxiq_credential_setup_pending path=/ Strict`; no `fluxiq_session`.
   - **Reload and leaving the form**: the reload (04), `/settings` (05), `/security/keys` (06) and `/security/sign-in` (07) all showed the setup form.
   - **API calls during setup**: all six answered 401: approve-pairing, `/api/keys`, `/api/client-gateway/snapshot`, `/api/programs/identity-access/snapshot`, `/api/programs/automation-studio/projects`, and `/api/programs/identity-access/set-password`. Opening an API URL in the tab also gave `401 {"ok":false,"error":"Authentication required"}` (08).
   - **After setting the password** (09): Home rendered with the engine running (10), and the browser held only `fluxiq_session path=/ HttpOnly Lax`. The same calls then answered:
     - approve-pairing: 404 (reaches the gateway; there is no such pairing);
     - gateway snapshot: 200; identity snapshot: 200; projects: 200;
     - set-password: 400 (no authorization fields given);
     - `/api/keys`: 503, explained under Not verified.
   - **The panel works**: the reload stayed signed in (11), and `/security/keys` opened signed in (12).
   - **The temporary credential is dead**: `admin`/`admin` afterwards gave `401 Invalid username or credentials`.
   - `panel.log` contains neither the new password nor a setup cookie value (`grep -c` gives 0 for both).
   - I stopped the panel with `taskkill /PID 20456 /T /F`, and nothing still listens on 3200 or 4977. No paid calls were made.

## Not verified

- **Sessions issued before this fix** to an account still on `admin`/`admin` stay valid until they expire (12 h), or until anyone signs in with the temporary credential, which revokes them. Ending them unconditionally needs a check where sessions are validated, or a startup sweep. One option: in `lib/fluxiq.ts` at runtime start, if `authenticate(admin/admin)` succeeds, call `revokeUserSessions("admin")`. Both places are t924's paths, so I did not edit them.
- **`/api/keys` answers 503 `key.unavailable`** for any signed-in person under `run-fluxiq-web.mjs`, because `FLUXIQ_INSTANCE_ID` is not set (`server/key-sessions/config.ts`). An ordinary sign-in with the new password gets the same answer, so this change did not cause it. Saving or using a model key after setup was not exercised.
- **Firefox and Edge**, the extension's own pairing flow end to end (the live run probed the approval route, not a real pairing), and `next dev` were not tested.
- **More than one server process**: setup grants live in one process's memory. That fits `local`, which serves from one process; a multi-process local deployment would need them stored durably.
- **The full suites** (`pnpm check`, `pnpm test`, Core's whole vitest run) were not run, per the twice-a-day rule. I ran only the directories listed above.
- **Logout** has no cross-site check of its own when the browser holds only a setup cookie. Its worst effect is ending someone's setup early.

## Open questions or contradictions found

- The lead must decide the setup-code follow-up and approve the files outside my paths listed above. The recommendation is to adopt it.
- **Compatibility**: any client that signs in with `admin`/`admin` and expects a session cookie now gets `requiresCredentialSetup: true` and no cookie. I found none:
  - The Lab and test-runner seed their own users.
  - Core's e2e fixture uses its seeded credentials.
  - The extension's `http-control` fails clearly with "did not return the expected session cookie".
- **New login answers**: `403 cross_site_request` for cross-site posts, and `403 setup_on_this_computer` for the temporary credential from a non-loopback `Host`.
