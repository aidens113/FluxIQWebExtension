# t730-c1: company-website hooks for the last synthetic content-harness rows

## Outcome

Done. company-website now has two armable modes, `confirm-unsubscribe` and
`reworded-quote-submit`. The four blocked rows run on them, and none of the three
spec files opens a synthetic scenario any more. The default site behaves as before:
every existing company-website unit test passes.

The inert-upload row fails for a real reason, not because the machine was short of
memory. It fails the same way on a quiet single-worker rerun. The cause is below.

## Retargeted rows

| spec | test | new home | headed result |
| --- | --- | --- | --- |
| upload-dialog.spec.ts | dialog: an armed dismiss answers the native confirm, and the arming is consumed by it | company-website `newsletter`, mode `confirm-unsubscribe` (Unsubscribe → `window.confirm`; `newsletter.unsubscribePrompts` reads `{accepted:0, dismissed:2}`, and the address stays) | pass |
| upload-dialog.spec.ts | dialog: an armed accept unsubscribes the address and is reported as evidence afterwards (renamed from "…deletes the draft…") | same page and mode (the row is removed in place, `{accepted:1, dismissed:0}`, and the next `web.dom.dialog` carries `{kind:"confirm", message: UNSUBSCRIBE_CONFIRM_TEXT, response:"accept"}`) | pass |
| evidence/tests/live-page.spec.ts | company-website: the native confirm the page-world override answered is carried as evidence (was "modal-flows: …") | same page and mode (`dialogs.lastNative` is the confirm; no `armPending`; no DOM dialog open) | pass |
| identity-resolution.spec.ts | company-website reworded-quote-submit › reworded: the surviving accessible name resolves Send, and Back is not touched (was identity-drift "reworded-aria") | company-website home, quote drawer step 3, mode `reworded-quote-submit` | pass (after re-pinning, see below) |

## What changed and why

### Scenario (`apps/scenario-lab/src/scenarios/company-website/`)

- **`types.ts`**
  - `siteModes` gains `confirm-unsubscribe` and `reworded-quote-submit`, documented in place.
  - `newsletter` gains `unsubscribePrompts: {accepted, dismissed}`.
- **`state.ts`**
  - New visitors start at `{0,0}`.
  - `subscribe-newsletter` now spreads the existing newsletter state, so the counts survive a sign-up.
  - `unsubscribe-newsletter` counts an accepted prompt only in `confirm-unsubscribe`.
  - New operation `unsubscribe-declined` counts a dismissal. It does so only in that mode, and only for an address on the list. Anywhere else it is a no-op.
- **`client/newsletter-script.ts`**
  - New export `UNSUBSCRIBE_CONFIRM_TEXT`: "Unsubscribe from Kestrel Lane offers and reminders? Your 10% code will stop working."
  - The script takes a `confirmUnsubscribe` flag. When armed:
    - It calls `window.confirm` first.
    - On no, it posts `unsubscribe-declined`.
    - On yes, it posts `unsubscribe-newsletter`, removes the row in place and writes "Unsubscribed. We will not email … again." to a `role=status` line.
  - **Deviation from the B8 proposal: there is no reload.** A reload would wipe the page-world override's record of the answer, which the accept row and `lastNative` read afterwards.
  - The default path is unchanged: post, then reload.
- **`client/index.ts` and the scenario `index.ts`** re-export the text, so the specs assert against the site's own string.
- **`pages/newsletter.ts`**
  - Passes the mode to the script.
  - Renders the empty status line only when the mode is armed.
- **`pages/quote-drawer.ts` and `client/quote-script.ts`**
  - New generated id `restyledSend`.
  - In `reworded-quote-submit`, the footer submit is `<button class="<footerSubmit>" id="<restyledSend>" aria-label="Send request">Send</button>`. It has no test id, and Back still stands beside it.
  - The script shows, hides and binds the button like Send request, so it still starts the human check.
- **`styles.ts`**
  - New class role `footerSubmit`, styled like the primary button.
  - Its hash is new. The other roles' hashes are unchanged, because each role is hashed on its own.
- **`tests/content-hook-modes.test.ts`** (new, 5 tests):
  - state counting in both modes;
  - armed and default newsletter markup;
  - armed and default drawer markup;
  - a headless-browser run of confirm, dismiss and then accept;
  - a headless-browser run in which "Send" submits through the human check and reaches `quote/received`.

**Not manifest variants.** I added these as modes, armed by `set-mode`, and not as
manifest `variants`. So no Lab row, live task, person check or variant list changed,
and the manifest tests (variant lists, task kinds, person-check hand-offs) pass
unchanged. Grep of the consumers: `live-tasks.ts`, `person-check.ts`,
`repair-tasks.ts`, `scenario.test.ts`, `realistic-task-baseline.ts` and
`identity.spec.ts` name only `redesigned-quote-submit` and `winter-notice`.

**Test id: removed, not renamed.** The brief said "test id change". B-2 said "no test
id". I removed it. Core's matcher scores a contradicted stable identifier at −0.8
(`element-fingerprint.ts`, `CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY`) and a missing
one at −0.1. A renamed test id would therefore make this a refusal row, not a "the
surviving accessible name resolves" row.

### Specs (`apps/extension/e2e/content/tests/`)

- **`upload-dialog.spec.ts`**
  - New local helpers `siteMutate` and `openUnsubscribeConfirm`. The latter arms the mode, answers consent and the chat greeting, subscribes `ada.synthetic@example.test`, opens `newsletter` and waits for `contentReady`.
  - The two confirm rows were rewritten on that page. They poll `newsletter.unsubscribePrompts`, because the page's post is asynchronous.
  - The header comment was updated, and the BLOCKED comments were removed.
- **`evidence/tests/live-page.spec.ts`**
  - The `lastNative` row was moved to the same page, with the same assertions.
  - The header and the blocked note were rewritten.
- **`identity-resolution.spec.ts`**
  - The identity-drift `describe` block was replaced. The row records Send request on the default site, arms `reworded-quote-submit` and asserts each of these is gone: the recorded id, the test id, every recorded class and the recorded text.
  - It then replays the recorded descriptor and asserts:
    - success on `button#restyledSend`, with accessibleName "Send request" and visibleText "Send";
    - the drawer's own privacy error;
    - clicks exactly `["main|Send"]`;
    - `quotes: []`, `drafts: 0`.
  - **Re-pinned measurement.** On this page the strategy is `fingerprint` with `candidateCount: 1`, not the synthetic row's `scored-candidate` with 2. The fingerprint's accessible-name scan (`resolve-target.ts` `fingerprintMatches`) finds exactly one element named "Send request", because the recorded text "Send request" is on nothing. The veto's Core measurement is `bestScore 0.602` and `confidence 0.566`, the same numbers the synthetic row pinned.
  - Dropped the imports `DISPLAY_NAME`, `SAVE_BASELINE` and `armMode`.
- **`identity-fixtures.ts`**
  - Removed `SAVE_BASELINE`, `DISPLAY_NAME` (identity-drift's selectors) and `armMode`.
  - After this change no file imports them. I grepped `apps/extension/e2e`: `large-page-resolution.spec.ts` no longer uses them.

## Commands run and observed results

1. `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"` (from `apps/scenario-lab`):
   - First try: failed on two missing `everything-store/client/*-script.js` modules. Those belong to another worker's in-flight files, not mine.
   - Rerun: built clean. Later runs either built or reused the stamp, and I confirmed `dist` held my edits.
2. `node --test dist/scenarios/company-website/tests/content-hook-modes.test.js`: first run gave 4 pass and 1 fail. The baseline "no status" regex also matched the script's `querySelector('[data-unsubscribe-status]')`. I narrowed the assertion to the element markup.
3. `node --test dist/scenarios/company-website/tests/*.test.js dist/scenarios/company-website/qualification/tests/*.test.js`: **tests 54, pass 54, fail 0**. This includes the honest-path, naive-path, breadth and scenario tests and the 5 new ones.
4. `node --test dist/scenarios/tests/*.test.js` (cross-scenario: live instructions, repair tasks, person checks, realistic live tasks): **tests 29, pass 29, fail 0**.
5. `node scripts/structure-audit.mjs`:
   - First run flagged statement packing in my new test, line 81. I fixed it.
   - Final run: no company-website or spec violation of mine. Three remain, none from this brief:
     - `apps/extension/e2e/content/tests/` has 26 files against a limit of 25. I added no file there.
     - `apps/extension/src/content/extraction/tests/` has 28 files.
     - Statement packing in `apps/scenario-lab/e2e/realistic-scenario-guard/tests/install-realistic-scenario-guard.spec.ts`.
6. First headed spec run:
   `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/upload-dialog.spec.ts content/tests/evidence/tests/live-page.spec.ts content/tests/identity-resolution.spec.ts --headed --workers=2 --reporter=list --output=test-results/content/c1-artifacts`
   - Result: **37 passed, 1 failed (9.2m)**.
   - The failure was the reworded row, on `strategy: "fingerprint"` where I had assumed `"scored-candidate"`. Its press itself succeeded.
   - Free physical memory was about 500 MB during this run.
7. Measurement run: `… identity-resolution.spec.ts -g "reworded" --headed --workers=1`. It printed `{"strategy":"fingerprint","candidateCount":1,"bestScore":0.602,"confidence":0.566} Element clicked.` and **1 passed**. I pinned those values and removed the probe log.
8. Inert-upload rerun: `… content/tests/actionability/tests/actionability-gate.spec.ts -g "inert subtree" --headed --workers=1 --output=test-results/content/c1-inert` gave **1 failed**, with the same error as reported: received `web.target.not_actionable` / `unexpected_state`, expected `web.target.not_shown` / `target_not_found`. Message: "Action rejected: the file input is inert".
9. Final headed run of the three specs (same command as 6): see the addendum below.

## Inert-upload row: real, not memory

The row fails deterministically. `apps/extension/src/content/actions/upload.ts`
`uploadAction` refuses every "unusable" target, disabled and inert alike, with the
reason word `"disabled"`:

```ts
const unusable = unusableReason(element, deps);
if (unusable) return deps.rejected(action, startedAt, "disabled", expected, unusable, evidence);
```

`results.ts` `refusalCode` maps the word `disabled` to `TARGET_NOT_ACTIONABLE`. Only
`hidden` maps to `TARGET_NOT_SHOWN`.

ba9fea58 (t193, 2026-10-03) moved the spec's expectation to `not_shown` ("An inert
control is one the gate calls `hidden`") and changed the mapping in `results.ts`. It
did not touch `upload.ts`. The last change to `upload.ts` is af9bd66b (2026-09-22).
So the row has very likely failed since 2026-10-03. I did not bisect to confirm that.

The fix is outside this brief. It belongs to whoever owns `upload.ts` or that spec.
Either:
- (a) refuse the inert case with reason `"hidden"`, which matches the spec's comment and t193's rule that a not-shown control is `target_not_found`; or
- (b) decide that an inert upload is `not_actionable` and change the spec.

Option (a) looks intended.

## Not verified

- No TypeScript typecheck of the specs or of scenario-lab beyond its own build. The scenario-lab build runs `tsc` and passed. Playwright compiles the specs without type-checking them. I did not run `tsc -p apps/extension/tsconfig.test.json`, because it covers every in-flight spec of the other workers. The supervisor should run it.
- The two new modes were exercised only in the content harness and in the scenario's headless browser tests. No Lab run and no real-extension run.
- The other importers of `identity-fixtures.ts` were not rerun. A grep shows none of them used the removed exports, so if one did, Playwright would fail to compile it.
- The B8 proposal's reload-after-accept was deliberately not built (see above).

## Open questions or contradictions found

1. The brief said "test id change". I removed the test id instead, for the scoring reason above. If a renamed test id is wanted, the row turns into a refusal row (−0.8 contradiction).
2. On realistic markup the surviving-accessible-name recovery is the fingerprint's name scan with one candidate. It is not Level 2 scoring between two candidates. A row proving scored selection by name alone would need a second element whose text equals the recorded text. That is a different construct.
3. The inert-upload defect described above: `upload.ts` disagrees with t193's code mapping.

## Addendum: final run

Command 6 rerun after the re-pin (headed, `--workers=2`): **38 passed (6.0m), exit 0**. That covers all four retargeted rows (live-page #2, identity-resolution reworded #17, upload-dialog #35 and #36) and every other row in the three files.
