# Report: w2-waits

Worker: `w2-waits`. Brief: `### Brief: w2-waits` in
[briefs/wave-2.md](../briefs/wave-2.md), against the contract in
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** The wait-conditions capability, both wait verbs, and the waiting
engine are implemented, and a new T2 spec proves all six conditions in the real
content bundle: `pnpm --filter @fluxiq-web-extension/extension test:content
waits.spec` → **exit 0, `10 passed (4.6s)`**, and the same ten passed inside the
full harness run (`ok 76`–`ok 85`).

Two gates did not come back clean, and **neither failure is in a file I own**;
both are live parallel edits, reran as the concurrency note requires:

- `extension check` → exit 2, naming a **different file on each of my three
  runs**: `actions/scroll.ts` (`w2-scroll`), `action-runtime/file-input.ts`
  (`w2-upload-dialog`), `action-runtime/actionability.ts` (`w2-click`), then
  `content/describe-element.ts` (`w2-identity-capture`) — each fixed by its
  owner and replaced by the next worker's in-progress edit. **No file I own
  appeared in any run.**
- `test:content` (full) → exit 1 on three specs in `upload-dialog.spec.ts`
  (`w2-upload-dialog`). `82 passed`, and every one of mine among them.

**A gap the supervisor should act on:** `pnpm check` never type-checks any T2
spec — see [Open questions](#open-questions-or-contradictions-found). I
type-checked mine separately, clean.

## What changed and why

### `content/action-runtime/waits.ts` — the waiting engine

`waitUntil(evaluate, timeoutMs)` re-evaluates a predicate **on every DOM
mutation and on a 50 ms poll**. The poll is not belt and braces: a
same-document URL change (`history.pushState`) mutates nothing, a CSS reveal
mutates nothing, and "the page stopped changing" is by definition an event that
never fires. A mutation-only wait — which is what this module was — cannot
express `url` or `stable` at all.

The engine hands the predicate a `WaitProgress` (`startedAt`, `lastChangeAt`),
which is what makes `stable` a predicate rather than a second observer with its
own lifecycle. Running out of time resolves `undefined` (an outcome), while a
throw from the predicate — an invalid selector — rejects rather than being
retried until the timeout. `evaluate` runs once synchronously, so an
already-satisfied wait costs nothing.

`waitForElement` and `waitForText` keep their exact signatures and error
strings because `ContentActionDependencies` still declares them; they are now
thin wrappers over the engine.

### `content/action-runtime/wait-conditions.ts` — the capability (stub replaced)

`waitForCondition(request)` with the contract's signature and outcome type.

| Condition | Satisfied when | `actual` on success |
| --- | --- | --- |
| `present` | selector matches, or the text is in the page | `the element was found` / `the text was found` |
| `visible` | the element has a layout box and is not `visibility:hidden` | `the element was visible` |
| `enabled` | not `:disabled` and not `aria-disabled="true"` | `the element was enabled` |
| `absent` | nothing matches the selector, or the text is gone | `no element matched the selector` |
| `url` | `location.href` equals, contains, or resolves to the request | the landed href |
| `stable` | no DOM change for `stableForMs` (default 500) | `the page stopped changing for N ms` |

- **Visible** is Playwright's rule. `display:none`, the `hidden` attribute and a
  zero-sized box all collapse the box, so one check covers them. Whether an
  element can be *acted on* is the stricter question `checkActionability`
  answers; a wait deliberately does not ask it.
- **Enabled** uses `element.matches(":disabled")`, so a control inside a
  disabled `<fieldset>` is correctly not enabled — the `.disabled` property
  alone misses that.
- **Timeout is an outcome, not a throw** (`ok: false` with what the page still
  showed). A request the page could never satisfy — a condition needing a
  selector, asked without one — *does* throw, because that is a malformed
  command rather than a slow page.
- A condition added to the union with no evaluator fails the **build** (a
  `never` parameter), never silently waits forever.

### `content/actions/{wait-for-selector,wait-for-text}.ts`

Both read `action.wait.condition` (defaulting to `present`), call the
capability, and turn `ok: false` into `deps.timedOut(...)` with a **failed**
validation carrying the observed `actual`, so a timeout reports `timed_out`
with Core's `timeout` category and still says what it saw.

Each verb owns its own phrasing table, because an element wait and a text wait
genuinely say different things. The `present` wording is unchanged from what
these verbs shipped with (`Selector found.`, `Timed out waiting for selector:
…`, `no element matched before the timeout`), so `actions.spec.ts` — owned by
`w2-foundation` — keeps passing untouched and a Flow's reports read the same
across the change.

`wait-for-text` passes `text` and never the command's `selector`: a text wait
that silently became an element wait because a selector was also present would
be a trap. `enabled` therefore has no meaning there, and the capability refuses
it by name rather than the verb guessing.

### New `apps/extension/e2e/content/tests/waits.spec.ts` — the T2 proof

Ten specs on `delayed-ui` (late target, `too-slow`, visible, enabled, url,
stable) and `intermediate-state` (absent, visible, text found, text gone), plus
a text timeout. The fixtures are driven with **Playwright's own trusted click
and fill**, so these specs prove the waits and do not depend on the click and
type verbs other workers are rewriting in parallel.

Sharpest assertions: a present-but-`display:none` element satisfies `present`
and **times out** under `visible`; the `stable` wait cannot resolve during 8
mutations 50 ms apart and is asserted to have taken ≥ 400 ms; the `url`
condition is satisfied by a `pushState` that mutates nothing.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`, each exit status captured by redirecting to a
file and echoing `$?`, never through a pipe. Label `EXTENSION_TEST_BUILD_LABEL=w2-waits`.

| Command | Observed |
| --- | --- |
| `… extension test:content waits.spec` | **exit 0 — `10 passed (4.6s)`**, all ten named |
| `… extension test:content` (full) | exit 1 — `82 passed`, `3 failed`, all three `upload-dialog.spec.ts`; mine `ok 76`–`ok 85` |
| `EXTENSION_TEST_BUILD_LABEL=w2-waits … extension test` | **exit 0 — `# tests 80 / # pass 80 / # fail 0`** |
| `… extension check` (run 1) | exit 2 — `file-input.ts(50,34) TS2322`, `scroll.ts(125,9) TS2552 Cannot find name 'atBottom'` |
| `… extension check` (run 2, rerun) | exit 2 — `file-input.ts(50,34)` only; `scroll.ts` fixed by its owner in between |
| `… extension check` (run 3, final) | exit 2 — `describe-element.ts(53,9)` and `(68,9)`, `TS2451 Cannot redeclare block-scoped variable 'role'` (`w2-identity-capture`); `file-input.ts` now fixed |
| `tsc -p tsconfig.test.json` (direct) | exit 2 — `actionability.ts(155,10) TS2304 Cannot find name 'FOCUSABLE'`, `file-input.ts(50,34)`. **Zero errors in any file I own** |
| `tsc -p <scratch>` over `waits.spec.ts` | **exit 0 — 0 errors** (see below) |
| `node scripts/structure-audit.mjs` (scratch index) | **exit 0 — `passed (31 warning(s), 19 baselined)`** |

`check` runs `tsc -p tsconfig.json && tsc -p tsconfig.test.json`, so the `&&`
meant the second project never ran while the first was broken by another
worker; I ran it directly to confirm my files are clean in both projects.

**Structure audit.** Run through a **scratch git index**
(`cp .git/index "$S/w2-waits-index"; export GIT_INDEX_FILE=…; git add -N …`),
verified the new spec was visible to `git ls-files` (count 1) before auditing.
31 warnings is exactly the count `w2-foundation` recorded, so my work added
none; no baseline entry was added, raised, or regenerated, and
`pnpm structure:baseline` was **not** run. The real index is untouched — the
spec still shows as `??`.

**A transient failure worth recording.** My first isolated rerun failed all ten
with `ReferenceError: pageWorldBundleSource is not defined` at `harness.ts:84` —
`w2-upload-dialog` was mid-edit in the shared harness. The rerun minutes later
passed 10/10. Exactly the parallel-edit case the brief warns about.

## Not verified

- **No live browser validation.** `test:content` runs the real content bundle in
  headless Chromium, but in the page's main world, with no background worker, no
  tab or frame routing, and no unpacked extension. Nothing here proves a wait
  behaves the same when dispatched through the background worker.
- **Cross-frame waits.** The harness talks to the top frame only; a wait in an
  iframe is unexercised.
- **`timed_out` still does not survive the domain hop.** `w2-domain-status` owns
  `domain/src/runtime/adapter.ts`, which still flattens it, and
  `gatewayActionResultFromBrowserResult` still drops `result.failure`
  (`w2-browser-actions`). So the `timed_out` + `timeout` record my verbs now
  build is proven **only at the content-harness boundary**; nothing above it has
  been observed to receive it.
- **No Node unit test for the wait modules.** They need a DOM, and
  `w2-foundation` recorded that content modules cannot be imported under
  `pnpm test`. The T2 spec is the proof; the engine's pure parts have no
  separate coverage.
- **`pnpm build`, `pnpm lab`, root `pnpm check`/`test`/`pnpm build`** were not
  run — the first two are forbidden to this wave's parallel workers, the rest
  are outside the brief's gates.
- **Timing assumptions.** `too-slow` relies on the fixture's 75–175 ms reveal
  outlasting a 25 ms timeout, and `stable` on churn outlasting a 200 ms quiet
  window. Both have wide margins here and are ordered so the wait starts before
  the fixture is triggered, but they are wall-clock assertions.
- **`docs/architecture/web-capabilities.md`** describes the waits and is now
  understated; it is not in my owns list, so I left it.

## Open questions or contradictions found

1. **No T2 spec is type-checked, in this wave or any other.**
   `tsconfig.json` includes `src/**/*.ts` (excluding `src/**/tests/**`) and
   `tsconfig.test.json` includes `src/**/*.ts` — **neither covers `e2e/**`**.
   Playwright transpiles without type-checking, so every Wave 2 worker's spec
   is unchecked, and a spec that asserts against a stale result shape would
   compile-and-pass silently. I type-checked mine through a scratch config
   extending the package's (`typeRoots` repointed at
   `apps/extension/node_modules/@types`): **exit 0, 0 errors**. Adding
   `e2e/**/*.ts` to `tsconfig.test.json` would close this, but that file is
   shared, so I did not touch it.
2. **`delayed-ui` has no `too-slow` variant**, though the bench corpus names one
   (`packages/test-runner/src/bench/corpus/week1.ts:42`, W25, expecting
   `category: "timeout"`). The Scenario Lab's control routes are only `health`,
   `final-state`, `reset` and `seed`, and the content harness has no variant
   arming, so I expressed `too-slow` through the command's own `timeoutMs`.
   Either the fixture needs the variant (for the Flow lane, which *can* arm
   one), or the corpus row is naming something that does not exist.
3. **Two modules now judge visibility** — `wait-conditions.isVisible` (layout
   box + `visibility`) and `w2-click`'s `checkActionability`, which was mid-edit
   throughout my work and whose exports I could not depend on. They answer
   different questions, so the duplication is defensible, but at integration the
   wait should probably borrow the actionability capability's predicate rather
   than keep its own.
4. **`deps.waitForElement` and `deps.waitForText` are now dead weight.** Both
   verbs go through `waitForCondition`; nothing else calls them. Removing them
   needs `actions/types.ts` and `action-runtime/execute-action.ts`, which I do
   not own, so I kept them working and exported. A supervisor call.
5. **A malformed wait now fails instead of timing out.** Previously a
   wait-for-selector with no selector rejected inside `waitForElement` and was
   reported as `timed_out`; it now throws and `execute.ts` reports `failed`. A
   timeout should mean the page was slow, not that the command was wrong. No
   test asserted the old behaviour.
