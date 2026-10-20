# t743-d4: a press the page answered with its own failure counted as succeeded

## Outcome

Done. A press that brings nothing but a notice in one of the page's own notice regions (`role="alert"`,
`role="status"`, `aria-live="assertive"`) is no longer a success. It fails with the new closed code
`web.action.page_reported_failure`, which is retryable, `effect: "unacted"` and `certainNoEffect`. Core makes the
press again under its usual first attempt plus three retries. A step whose attempts all end this way fails with
that code, so it is never counted as a landed act. No Core file changed.

## Trace (tree `fxwork/t743`, before this change)

Fixture behaviour, read only to choose a signal. In `apps/scenario-lab/src/scenarios/job-board/board/client-script.ts`,
lines 102-109 (`toggleSave`) handle the first save after a page load. They add a busy class to the heart, then
500 ms later remove it and call `toast(...)`. Lines 69-71 create the toast as a `div role="status"` appended to
`body`. No request is made, and the heart's own state does not change. The card heart is a plain `<span>` with no
role (`board/card.ts:33`), inside `article[data-jk]`.

What the click verb decided (`apps/extension/src/content/actions/click.ts`, HEAD line numbers):
1. Rate-limit and busy watch, 500 ms window (`RATE_LIMIT_WINDOW_MS`, line 147). It matches closed phrase lists of
   words, which by design do not cover this notice. Its window also closes at about the moment the 500 ms toast
   appears, so it reports nothing.
2. The ignored-press watch sees the busy class appear inside the card. That gives `seen = ["change"]`
   (`changedOnly`, line 348).
3. The settled look (t517) was the one mechanism that could see "came and went". It was gated on
   `expectsAnswer(element)` (line 349, a command control only), and the heart `<span>` is not one, so it was never
   asked. Even for a button it would have returned `false`: `settled-look.ts` (HEAD lines 114-116) set
   `answered = true` on any mutation outside the section, and the toast appended to `body` is one.
4. `first.answer.seen.length > 0` (line 241) therefore returned `success("Element clicked.")`. The trial step was
   reported `succeeded`.

Why it counted as a landed act. In Core `runtime/service/candidate-trial/landed-acts.ts:125`, a step counts when
its final attempt settled `succeeded` and `noEffectSeen` (lines 144-150) is false. `noEffectSeen` is true only for
`effectCheck.result === "not_landed"` or an empty same-document diff. The toast and the class churn made the
traced diff non-empty, so act-10 was kept. Nothing in Core is wrong here. Core reads the domain's verdict, and
that verdict was the error.

Why retry follows once the press fails. Core `executor/defensive/assess.ts:72` ("Confirmed no-effect attempts keep
the ordinary first attempt plus three retries") retries a retryable `unacted` record at stage `execution`, even on
a lasting node (gates 1-3 pass for `unacted`). `executor/step-loop/failed-attempt.ts:159` marks the next attempt
`repress` from `certainNoEffect`.

## What changed and why

The signal is generic and uses page semantics only; no words are read. The settled look leaves notice regions
out of its comparison, and it does not count a mutation inside one, or a childList record that only adds or
removes one, as an answer. When everything else settled exactly as before the press and a notice region now
holds words it did not hold before the press, the look answers `"announced"`. "Everything else" means: no
request, navigation or focus move; the control and its section back as they were; nothing else changed. Words
are compared, never read or sent.

How a success notice is told apart: by what comes with it, never by what it says. A press the page carried out
begins a request, or leaves the control or the page changed (`aria-pressed`, label, class, new content). Any of
those is an answer, exactly as before. Two other cases are also handled:
- A notice that was already showing, with no new words, gives `true` (`NO_EFFECT`), not `"announced"`.
- A control that itself sits in a notice region is looked at as before, with no notice reading.

A bare `aria-live="polite"` is deliberately not a notice region, because pages put it on self-updating content
such as results lists, feeds and totals. An `<output>` with no explicit role is not one either.

Files:
- `apps/extension/src/content/action-runtime/ignored-press/live-region.ts` (new): `isLiveRegion`, the notice-region
  rule.
- `apps/extension/src/content/action-runtime/ignored-press/settled-look.ts`: `settle` now resolves
  `boolean | "announced"`. It strips notice regions from the section state, gives notice records an exemption
  from "elsewhere", and keeps a before/after map of words per notice region. The header explains the rule.
- `apps/extension/src/content/action-runtime/ignored-press/ignored-press-watch.ts`: `settleUnchanged` type and
  doc.
- `apps/extension/src/content/action-runtime/ignored-press/index.ts`: header only. `isLiveRegion` is internal and
  not re-exported.
- `apps/extension/src/content/actions/click.ts`: the look is now asked on any control, not only command controls,
  because a notice can answer either. `true` still fails only a command control (`NO_EFFECT`). `"announced"` fails
  with `PAGE_REPORTED_FAILURE` when the control can still be pressed. Adds a closed phrase `NOTICE_ONLY`,
  `noticeOnlyValidation`, and a header paragraph.
- `apps/extension/src/content/action-runtime/recovery/fault.ts`: fault word `page_reported_failure`, placed in
  `ABSORBED_ELSEWHERE` so the in-page loop never presses again and Core counts every attempt.
- `domain/src/runtime/failure/codes.ts`: `PAGE_REPORTED_FAILURE: "web.action.page_reported_failure"`, row
  `{ action_failed, retryable: true, execution, unacted, certainNoEffect }`.
- `domain/src/runtime/llm-evidence/action-failure/refusal.ts`: maps the code to `refused_by_page`, which quotes the
  lines the page wrote, with reason `page_reported_press_failed`.
- `domain/src/runtime/llm-evidence/tool-rejection.ts`: adds that reason and its doc line (794 lines, under the
  800 limit).
- `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`: a generic `next` sentence for the reason.
- `docs/architecture/failure-taxonomy.md`: a table row and a paragraph, including the known limits.
- Tests:
  - `ignored-press/tests/live-region.test.ts` (new)
  - `ignored-press/tests/settled-look-notice.test.ts` (new): the generic library page, where Reserve's first press
    goes busy, reverts and leaves a status notice, and the second reserves the book.
  - `actions/tests/click.test.ts`: four new rows. One existing row was updated: a plain control is now looked at
    (`unchangedAsked [1500]`), and it still passes.
  - `recovery/tests/fault.test.ts`
  - `failure/tests/codes.test.ts`
  - `action-failure/tests/refusal.test.ts`

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t743-d4 node scripts/test-domain.mjs failure/tests/codes action-failure/tests/refusal rejection-next`
  printed `# tests 40`, `# pass 40`, `# fail 0`, exit 0. This includes
  `ok 21 - a press the page reported failed says the retries finished ... (t743)` and the closed-set and
  Core-parser rows over the new code.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t743-d4 node scripts/test-extension.mjs ignored-press/tests actions/tests/click recovery/tests/fault`
  printed `# tests 142`, `# pass 142`, `# fail 0`, exit 0. This includes these tests:
  - live-region 10-13
  - settled-look-notice 51-59
  - fault 82
  - click 130-134

## Not verified

- No typecheck was run (the brief forbids it). Both runners compiled and ran the changed files, but I do not know
  whether they type-check strictly.
- No browser or Lab run. On the real job-board page I have not confirmed:
  - that nothing else on the page mutates during the roughly 1.5 s look (any such mutation reads as answered);
  - that the command timeout leaves the full 1,500 ms window.
- Exploration (llm-evidence node-run) retries for this code are not verified. Trial and playback go through Core's
  step-loop ladder, read in `assess.ts`, but no Core test was run because no Core file changed.
- Content-harness e2e (`e2e/content`) was not run.

## Open questions or contradictions found

- `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts` is also being edited by another worker right
  now (their `incompleteTextNext` text and its test). My change there is one separate line. Please check the
  merge.
- Known limits, recorded in the taxonomy doc:
  - A press whose whole act happens in the browser and shows only a notice-region message, with no request and no
    lasting change (for example a copy-to-clipboard confirmation), reads as reported failed and is retried. This is
    the same risk class `NO_EFFECT` already accepts.
  - A failure the page decides after a request (a server error, then a notice) still reads as answered, so it is
    still a success. A sound generic signal for that would need the response status from the page-world request
    mark (`request-start-mark.ts`), which is out of this brief.
  - Toasts marked only `aria-live="polite"`, with no role, are not caught. This is deliberately conservative.
- Cost: a first press on a non-command control answered only by a change in its section now waits for the settled
  look. That is about 250-950 ms, at most `NO_EFFECT_SETTLE_MS` (1,500 ms).
- The trace says the Core trial feedback (`feedback.ts`, another worker's) said nothing about the press. With this
  change the step's attempts carry the new code, so whatever that feedback shows for failed attempts now applies.
