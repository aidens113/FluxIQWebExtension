# Sweep fix S4 (downstream)

Worktree `C:/Users/osrs_/FluxStuff/fxwork/t723/!FluxIQWebExtension`, branch `task/t723-sweep-1019-fixes`. Nothing committed.

## Outcome

Done. Both sweep failures are fixed. The extension package's own tests now run. They fail only on the three known `content/extraction/tests/pagination` tests, which I left alone because another branch is fixing them.

Before starting, `node scripts/check/core-build.mjs` said the Core build at `fxwork/t723/!FluxIQ` (a22b3a0f) was current, so I did not rebuild Core.

## What changed and why

### 1. `apps/extension/e2e/site-reset/tests/installed-project.spec.ts`: the spec file was wrong, not its parameter types

- **The real cause:** the sweep log (`fxwork/sweep-1019/ext-check.log`) shows 18 errors, not 2. The first one is `TS2307: Cannot find module '@fluxiq-web-extension/domain/node'`. The 17 TS7006 "implicitly any" errors (including 125,47 and 316,216) all follow from it, because the parameters lose their contextual types when the module cannot be found.
- **Why the module was missing:** `./node` points at the built `domain/dist`. A fresh clone has no `dist`, and `pnpm -r check` checks the extension before `packages/test-runner`'s `domain:dist` guard builds it. My worktree already had a `dist`, so the check passed there until I reproduced the clean-tree case.
- **Where the import came from:** the spec added it in 737c9d5c ("test: reproduce reset inverse refusal through installed gateway", t719).
- **Why the import was wrong:** `docs/architecture/repository-layout.md` ("Consuming the domain package") reserves `./node` for plain Node ESM consumers such as `packages/test-runner`. Every other e2e spec imports from the source entry `@fluxiq-web-extension/domain`.
- **Fix:** I switched the import to `@fluxiq-web-extension/domain`, which exports the same names from the same barrel. I added no type annotations and no `any`; contextual typing comes back on its own.

### 2. `domain/src/runtime/tests/adapter.test.ts`: the test was out of date

- **The commit that broke it:** e8b2d7fd ("Bind reset inventories to trusted browser resources and complete collections", t719). It added `metadata: { sessionId }` to the result of `dispatchWebAutomationOutput` in `domain/src/io/gateway-output-dispatcher.ts`.
- **That change was intended:** the same commit asserts it in `gateway-output-dispatcher.test.ts` ("the selected gateway session reaches private host-state resource binding"). `host-runtime.ts` reads it for `webResetResource`.
- **Why the adapter is correct:** `domain/src/runtime/adapter.ts` spreads `result.metadata` into the runtime result on purpose (`metadata: compact({ outputId, ...(result.metadata ?? {}), ... })`). Its snapshot path already reports `sessionId` in metadata, and a session id is not a secret.
- **Fix:** the test now expects `{ outputId: "web.dom.click", sessionId: "session.one" }`, with a comment that cites e8b2d7fd.

### 3. Extension package tests

No other failures, so the extension code is unchanged.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `node scripts/check/core-build.mjs` (before any edit) | "FluxIQ Core's build ... is current with its source." exit 0 |
| `node apps/extension/scripts/check-extension.mjs` (before any edit, with `dist` present) | exit 0, so the failure does not reproduce in this tree |
| Clean-tree reproduction: `domain/dist` moved aside, then `tsc -p apps/extension/tsconfig.test.json --noEmit` | original import: 18 `error TS`, first is TS2307 `domain/node` at (8,247), matching the sweep log. Fixed import: 0 errors. `dist` restored afterwards. |
| `DOMAIN_TEST_BUILD_LABEL=s4 node domain/scripts/test-domain.mjs runtime/tests/adapter.test` | tests 26, pass 26, fail 0 |
| `pnpm --filter @fluxiq-web-extension/extension test` | smoke test passed. tests 3210, pass 3207, fail 3, all in `content/extraction/tests/pagination.test` (the known three: "a load-more control that is present and hidden ends the list...", "a load-more control with no box is hidden too", "at the page bound a hidden load-more control ends the list rather than truncating it"). Exit 1 for that reason only. |
| `pnpm check` | exit 0, 0 `error TS`. It also rebuilt `domain/dist` through test-runner's guard, because the domain and Core sources had changed; Core itself was not rebuilt. |
| `node scripts/structure-audit.mjs` | "structure-audit: passed (212 warning(s), 638 baselined)." exit 0 |

## Not verified

- I did not run the e2e spec itself, because Playwright and browser runs are out of scope. Its runtime import now goes through the same source entry that the sibling specs load under Playwright, but I have not exercised it.
- I did not run the full domain suite again, only the adapter test file. The sweep showed this was the only domain failure (2165/2166).
- I did not run `pnpm check` from a fresh clone. I reproduced the clean-tree condition only for the extension test tsconfig, by moving `domain/dist` aside.

## Open questions or contradictions found

- The brief said to "type them properly" for the two TS7006 errors. They were downstream of an unresolvable import, so I fixed the import instead of adding annotations.
- `pnpm check` depends on the order of checks. The extension check passes only because the fixed spec no longer reaches `./node`. If any extension-checked file imports `@fluxiq-web-extension/domain/node` again, a fresh clone breaks the same way. A structure-audit rule could forbid `domain/node` imports outside `packages/test-runner`; I did not add one because it is outside this brief.
