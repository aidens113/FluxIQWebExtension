# t426 — the model never sees fingerprint or address details

## Outcome

Done. Core is the single owner of the model-facing boundary. No extension or domain code changed: the failure
record in traces, run logs and step folders keeps every word the extension writes.

## What changed and why

Owner decision (brief item 2). Core drops the text, the extension keeps its words. A new Core screen,
`runtime/llm/model-facing/failure-text.ts` (`automationStudioModelFacingFailureText`), is applied wherever a failure's
`expected`/`actual` reaches a model:
- `target_not_found` / `target_ambiguous`: neither text is passed on. Those texts describe how the domain looked for
  the saved target, and the model already gets Core's `happened` sentence and the control's words.
- Any other category: each text is passed on only when it contains no locator shape (the existing
  `locator-text.ts` screen: `#id`, `.class`, attribute or XPath forms), none of the words selector, fingerprint,
  address or score (in any inflection), and no match score (a -1..1 number with 2+ decimals that is not a price).
  A text that trips any of these is dropped whole.

Why Core rather than the extension: about 30 extension and domain producers write `expected`/`actual` (wait for
selector, assert, click landing and others). One Core boundary covers them all mechanically, needs no
contract-record change (Core's parser refuses unknown keys, so a separate diagnostic field would mean a contracts
change), and adds no web vocabulary (the shapes are regex data, which the web-vocabulary rule does not count).

Core files:
- `llm/model-facing/{failure-text.ts,index.ts}`: new. Placed in its own directory because `llm/harness/` is at
  the 25-file limit (structure audit `directory-files`).
- `service/candidate-trial/feedback.ts`: `expected`/`actual` go through the screen.
- `service/candidate-trial/target-on-page.ts`, `absorbed.ts`: reworded. `happened` is now "The step could not find
  its control where it was saved, though one like it is on the page." `onPage` is now "Step N ("label") could not
  find its control "words" where it was saved, though one like it is on the page. The step itself is right." The
  advice is now "...test this same revision again, unchanged, without acting on the control yourself." No scores,
  no count of look-alikes, no "address". The measurement still decides `targetOnPage`.
- `flow-bootstrap/candidate/trial-gate.ts`: the test-again instruction is reworded the same way. The
  after-two-trials instruction no longer says "give that one step another way to find its control … take one
  fresh look … put the handle"; it now says to change that step or the steps that lead to it, submit, and test.
- `recovery/context.ts` (the repair context, used by in-run repair and post-run repair through annotate and the
  step-failure brief): the `failure` section's `expected`/`actual` go through the screen. `failed_target` now
  carries only `status` and `candidateCount`. `minimumConfidence`, `confidence`, `normalizedScore`,
  `matchedSignals` and `failedSignals` are dropped.

Other paths checked (brief item 3):
- In-run repair slot (`recovery/in-run-repair/history.ts`): ids, codes and counts only, never failure text. Clean.
  Its recovery context is covered by the `recovery/context.ts` change.
- Judge inputs (`result-verification/`): no failure `expected`/`actual`/message reaches them. Clean.
- Exploration `run_node` tool results: these are built by the domain (`domain/src/runtime/llm-evidence/`), which
  reads failures only into closed refusal words (`action-failure/refusal.ts`; `actual` is only prefix-tested).
  None of its text forwards `expected`/`actual`/message. Not changed.

Mechanical enforcement (tests):
- `service/candidate-trial/tests/no-finding-detail.test.ts` (new, 16 tests). It builds trial feedback and every
  trial-gate answer (3 tests plus completion) from 7 realistic failure shapes: R4a not-found with 0.27/0.02,
  unscored not-found, ambiguous with `label.seat-option … (0.41)`, assertions quoting `"#booking-ref"` and
  `".spinner-overlay"`, "named no selector", and a timeout quoting "scored 0.12". It fails on a `#id` or `.class`
  token, a decimal score, or the words selector/fingerprint/address. The node also carries
  `selector: "#fb1l6ufkg"` and a fingerprint, to prove parameters do not leak. The example site is a theatre seat
  booking, unlike any realistic scenario.
- `llm/model-facing/tests/failure-text.test.ts` (new, 13 tests): unit rules, including that prices, counts and
  dotted codes survive.
- `recovery/tests/context.test.ts`: the same leak shapes over the whole repair context for not-found, ambiguous
  and assertion failures. Also: the failed target carries status and count only, and a plain non-target text is
  still carried.
- Updated pinned wording and behaviour: `target-on-page.test.ts`, `trial-gate.test.ts`,
  `request-locator-shapes.test.ts` (it pinned "refused main scoring -0.29" surviving; it now asserts it does not),
  and `authored-state-screen.test.ts` (its credential case moved to a non-target category, so the section is still
  withheld for the credential rather than emptied by the category rule).
- t422's pinned behaviour is unchanged and still passes: not-found answers `retry_allowed` once, then the revision
  closes (`target-on-page.test.ts`, "the trial's answer is retry_allowed once…").

## Commands run and observed results

- Core vitest, from `packages/fluxiq`, run as `pnpm exec vitest run` over `runtime/service/candidate-trial`,
  `llm/model-facing`, `llm/harness`, `runtime/recovery`, `flow-bootstrap/candidate`, `llm/tests`,
  `runtime/tests/{io-bridge,io-policy,deepseek-recovery-requests}.test.ts`, `runtime/tests/refuted-result`,
  `service/runtime-session` and `service/tests`. Result: "Test Files 156 passed (156)", "Tests 1711 passed | 1
  skipped (1712)". The first run had 1 failure, `request-locator-shapes.test.ts` pinning the old scores, which I
  updated as above.
- Core typecheck: `pnpm run check` in packages/fluxiq exited 0 ("stored in the shared store"). Earlier runs
  failed on test cast types in `context.test.ts`, which I fixed.
- Core `node scripts/structure-audit.mjs`: "structure-audit: passed (322 warning(s), 1160 baselined)". The first
  run failed on `directory-files` (harness at 26 files), fixed by moving the module to `llm/model-facing/`.
- Downstream `pnpm --filter @fluxiq-web-extension/extension exec tsc --noEmit -p .`: exit 0, no output.
- Downstream `node scripts/structure-audit.mjs`: "structure-audit: passed (184 warning(s), 651 baselined)".
- No extension node tests were run, because no extension source changed. A downstream grep for the old wording
  and for `targetOnPage` found no consumer outside Core.

## Not verified

- No live or Lab run, and no provider call.
- Core dist was not rebuilt. The extension compiles against the existing dist, and no exported type it uses
  changed.
- The domain's exploration path (`domain/src/runtime/llm-evidence/`) was checked only by grep for forwarding of
  `expected`/`actual`/message and score fields, not by a full audit of every string it shows the model.
- No authored architecture doc was updated. The Core docs that describe the recovery context's `failed_target`
  fields or the trial feedback wording, if any exist, may now be stale.

## Open questions or contradictions found

- Node and code names still carry the word "selector" where the model can read them. The domain's plan-resolution
  issue code `web.handle.expected.selector.handle_location` reaches the model in submission refusals. The catalog
  node `web.dom.wait_for_selector` and its definition id appear in feedback `definitionId`. Renaming them is a
  cross-repository contract change outside this brief.
- `recovery/context.ts` now drops score fields that an older test comment called "the most informative thing in
  the request". That is deliberate under the 2026-10-10 rule, but it removes signal-name detail from repair
  prompts. The run record keeps it.
- The screen is fail-closed. An assertion text that quotes page words with "address" or a two-decimal number
  (for example "Total 1.50") is dropped whole. The model still gets `happened`, `waitedFor`/`seen` and
  `visibleNear` from `check-step.ts`.
