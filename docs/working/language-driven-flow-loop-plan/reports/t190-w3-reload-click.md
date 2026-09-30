# t190-w3: a click that reloads the page is reported applied, with the page after the reload

## Outcome

Done, with one finding that changes the premise. The code path and run 6's own trace show
that the domain **already** returned `pick-millbrook` as applied (`effectApplied: true`,
`draft.proposes: true`), most likely with the post-reload page. So the domain did not cause
the step to be missing from both dry runs; that happened in Core (draft recording or the
amendment at iteration 21, which is t189's area). I still fixed the real window where a
reload does turn a successful click into `page_unreadable` / `effectApplied: false`, in both
the domain and the extension, and wrote tests for it. They failed before the fix and pass
after it.

## Task 1: what the domain returned for `pick-millbrook` in run 6

| Field | Value | Evidence |
| --- | --- | --- |
| `resultCode` | `web.action.succeeded` | `logs/core.log:48`, `tool end ... ms=1526 resultCode=web.action.succeeded` |
| `effectApplied` | `true` (**established from code**) | In `node-run/run.ts`, `WEB_LLM_ACTION_RESULT_CODE` is emitted in exactly one place, the success return, and that return passes `effectApplied: true`. Every refusal path emits `web.action.rejected.<code>` with `false`. A post-action `page_unreadable` would have been traced as `web.action.rejected.page_unreadable`. |
| `draft.proposes` | `true` (established from code) | `catalog.ts:94`: `proposes: actionType !== capture_snapshot`, so the click proposes. The success return writes `proposes: node.proposes`. |
| `pageChanged` | `true` (inferred) | The page before the click had the flyout open with an enabled "Set as my store" button. Any later capture differs from it: the old document shows the button as "Updating…" and disabled, and the new document has the flyout closed. |
| Document the post-action capture read | **The post-reload page** (inferred, not proven) | See the chain below. The bundle keeps no evidence packets, so the packet itself cannot be shown. |

Why the capture most likely read the post-reload page. This is the extension's order of
operations, from code:

1. The click reply comes back straight after the gesture (`content/actions/click.ts`, hit-test
   validation for a non-link).
2. `runtime/click-landing.ts` then waits up to 300 ms for a top-frame `onBeforeNavigate`.
   The handler's `await mutate('set-store')` is a local fetch (`scenario-lab/src/html.ts`),
   so `location.reload()` normally starts inside that grace. The watch then waits for the
   commit, and `servedStatus` injects into the committed document, which waits for
   `document_idle`.
3. The domain's post-action `web.dom.capture_snapshot` goes through `runBrowserActionCommand`.
   The snapshot-readiness proof was consumed by the click, so `waitForTabReady` runs. It
   waits for tab status `complete` and one second of URL stability, and a reload's
   `status: loading` keeps it waiting.
4. The timings fit this chain. `pick-millbrook` took 1526 ms, `-2` 1699 ms and `-3` 1536 ms.
   The non-navigating chip clicks took 1664 to 2003 ms. Both are about 1 s of readiness wait
   plus the grace plus two roughly 130 ms captures. A capture that failed would have produced a
   rejected result code, and none was traced.

The model's behaviour also fits a packet from the new page: it reopened the chip. It would not
have needed to reopen it if the packet had shown the flyout still open. Whether that packet
contained the chip's text ("Millbrook Crossing Supercenter") at all, for example after budget
trimming, has no evidence.

**Windows where a reload did defeat the domain before this change.** Any of these made the
post-action look fail, and `run.ts` then raised the look's `page_unreadable` as the call's
refusal (`effectApplied: false`, `ranWith: undefined`):

- The reload starts while the capture message is inside the old document ("message port
  closed").
- The reload starts between `waitForTabReady` resolving and the send ("Receiving end does not
  exist").
- The new document is not listening yet.

These races are narrow on a local fixture and wider on a slow site.

## What changed and why

- `domain/src/runtime/llm-evidence/capture.ts`
  - New `captureAfterAction(gateway, sessionId, request, signal?, expectedOrigin?, timing?)`
    and the type `WebLlmAfterActionTiming`. It takes the look after an action. On
    `page_unreadable` only, it waits 250 ms and looks again, and it starts no new look once
    5 s have passed since the first one. Every other error is rethrown unchanged (for
    example the origin assertion). Cancellation rejects the wait at once with
    `signal.reason`, and `assertActive` runs after each wait. It returns `undefined` when no
    look succeeded inside the window.
  - `actAndCapture` now uses it, which covers `press.ts`, `enter-field.ts` and the harness
    navigate. When nothing was readable it still refuses `page_unreadable`, as before.
    `press.ts` itself needed no edit.
- `domain/src/runtime/llm-evidence/node-run/run.ts` (post-action region only;
  `currentPage`/`notThereYet` are untouched)
  - The post-action look is `captureAfterAction`.
  - If no page could be read, the call still returns the success result:
    - evidence is the `WebNodeOutcome` alone, with `pageUnreadable: true`, no page packet
      and `pageChanged` absent;
    - `effectApplied: true`, `web.action.succeeded`, `ranWith` and `replay` are kept.
  - `WebNodeOutcome` gained `pageUnreadable?: true`, and the look and `bounded` sites pass it.
  - The replay location moved into a `foundAt` helper. The value is unchanged.
- `domain/src/runtime/llm-evidence/state-digest.ts`: no change was needed. The digest already
  omits `loading` and `navigation`, and Core's `after` digest is taken after `executeTool`
  returns. Because of that ordering it now describes the new document.
- `apps/extension/src/runtime/action-runner.ts`: `sendAction` resends a
  `web.dom.capture_snapshot` once, after `waitForTabReady`, when the first send met a
  navigating page. Until now only `web.dom.assert` was resent. The set is
  `RESENT_ACROSS_NAVIGATION`, and it holds reads only, so nothing can be sent twice.
- Tests:
  - `domain/.../node-run/tests/reload-click.test.ts` (new): run 6's shapes through
    `executeTool`.
  - `domain/.../llm-evidence/tests/capture-after-action.test.ts` (new): the bound and
    cancellation, on a clock the test controls.
  - `apps/extension/src/runtime/tests/action-runner.test.ts`: 3 rows, a snapshot resent across
    each of Chrome's three navigating-page errors.

## Contract for t189

For a `core.run_node` call whose node succeeded and whose action starts a navigation or reload
of the page it acted on (the domain does not need to know it did):

- **Execution result, new document readable within the window**:
  - `kind: "llm_evidence_tool_execution"`, `effectApplied: true`,
    `resultCode: "web.action.succeeded"` (or `web.inspect.succeeded` for an observe-effect
    node).
  - `draft = { actionId: <node id>, effect, input, ranWith: <resolved parameters>,
    proposes: <node.proposes>, replay: { from: { location: <page the step acted on> } } }`.
    The draft is identical to the one for a non-navigating click.
  - `evidence` is the sanitized packet of the **new** document, with `pageChanged` set
    (`true` unless the new document's sanitized packet is byte-identical to the one before)
    and no `pageUnreadable`.
  - Nothing about "a navigation happened" is on the wire. Core must not look for such a field.
- **Timing**: `executeTool` returns only after one look has read a document. Looks start
  every 250 ms (plus each look's own duration) until 5 s after the first look after the
  action; no look starts after that. In the extension each look first waits for tab status
  `complete` plus 1 s of URL stability (`waitForTabReady`, itself capped at 20 s). So a
  normal reload is read on the first or second look, about 1 to 2 s after the click.
- **`stateAfter`**: Core's `captureStateDigest({phase:"after"})` runs after `executeTool`
  returns. It therefore digests the loaded new document, with the same projection as always
  (`loading`, `navigation`, focus and recency omitted).
- **New document never readable within the window**: the result is still
  `effectApplied: true`, `web.action.succeeded`, with the same `draft` (so the step is
  proposable). The evidence is `{ ok: true, node, status: "succeeded", pageUnreadable: true,
  control?, read?, inFlow }`, with no page packet and no `pageChanged`. **Caveat, not mine
  to change:** `tools.ts` `captureStateDigest` does one plain capture. Without a start
  location it then throws `page_unreadable`, which Core treats as a failed step. With a
  start location it returns `undefined`.
- **Cancellation**: an abort during the wait rejects `executeTool` with `signal.reason` at
  once. That is thrown, not returned as a result.
- **Not covered**: a navigation that starts **after** the post-action look has already read
  the old document, which needs more than about 1.3 s after the click in the extension. The
  step is still applied and proposable, but the evidence and `stateAfter` describe the old
  document. The domain cannot detect this without a navigation or document-identity signal on
  the result (see open questions).

## Commands run and observed results

- Before-fix check: I restored `capture.ts`/`run.ts` from `HEAD` into the worktree, ran a
  focused esbuild+`node:test` runner over `reload-click.test.ts`, then restored my versions
  (the `git diff --stat` afterwards showed my changes intact). Result: `# pass 1  # fail 3`:
  - the reload-under-look row: `expected 'web.action.succeeded'`,
    `actual 'web.action.rejected.page_unreadable'`;
  - the never-loads row: the same;
  - the cancel row: `Missing expected rejection`;
  - the characterisation row (reload over before the look) passed, as expected.
- The same runner, after the fix, over both new domain files: `# tests 10 # pass 10 # fail 0`.
- Extension before and after, a focused run of `action-runner.test.ts`:
  - with `HEAD` `action-runner.ts`: `# pass 33 # fail 3` (the 3 new snapshot rows);
  - with the fix: `# pass 36 # fail 0`.
- `bash build-slots/heavy.sh ... pnpm --filter @fluxiq-web-extension/domain check`: exit 0,
  no tsc output. It ran again after the final test edits, together with the test suite:
  exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t190-w3 pnpm --filter @fluxiq-web-extension/domain test` (via
  heavy.sh, twice; the second run was after the final edits): `# tests 892 # pass 892 # fail 0
  # cancelled 0`.
- `EXTENSION_TEST_BUILD_LABEL=t190-w3 pnpm --filter @fluxiq-web-extension/extension test &&
  ... extension check` (via heavy.sh): `# tests 1156 # pass 1156 # fail 0`, and the check
  exited 0.
- `node scripts/structure-audit.mjs`:
  - The first run gave FAIL `contract-spread` in both new test files, for spread calls and
    conditionals. I rewrote those lines.
  - The re-run exited 0. The only new advisory is `capture.ts: 9 exported values` (the warn
    threshold is 8).
- Build slots were claimed and released by `C:/Users/osrs_/FluxStuff/build-slots/heavy.sh`,
  which writes the owner line and removes the slot on exit. Scratch bundles under
  `domain/.test-build-scratch/t190-w3-*` and `apps/extension/.test-build-scratch/t190-w3-*`
  were deleted, except the `t190-w3` label directories the suites write.

## Not verified

- **No live or browser run**, as the brief says. It is unproven in a real Chrome that:
  - a mid-reload capture meets exactly these error strings;
  - the resend lands on the new document's content script.
- What the packet after `pick-millbrook` actually contained, including whether the chip text
  was in it. The bundle stores no packets and no `effectApplied` (`progress-trace.ts` logs
  only `resultCode`).
- Firefox behaviour of the resend path. It uses the same code but was not run.
- `pnpm check` at the repository root, and `pnpm build`, were not run. Only the package checks
  above and the structure audit were run.

## Open questions or contradictions found

1. **Contradiction with the brief's premise.** Run 6's `pick-millbrook` was already applied and
   proposable on the domain side (see Task 1). Why it was never in either dry run is therefore
   Core's to answer (t189): draft recording, or the amendment at iteration 21.
2. **A late-starting navigation is undetectable here.** Detecting it needs `click-landing.ts`
   to report on the result that a top-frame navigation started or committed, or a document id
   on the snapshot. Either one is a wire change across `domain/src/client` (gateway mapping),
   the shared protocol and the capability docs, which is outside this brief.
3. **`tools.ts` `captureStateDigest` does not settle.** In the never-loads case without a start
   location it throws, and Core fails the step. The fix is to use `captureAfterAction` there,
   in a file I do not own.
