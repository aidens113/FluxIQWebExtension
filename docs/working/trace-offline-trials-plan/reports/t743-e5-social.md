# t743-e5-social: disclosure required only of kept rows, proved provider-free on the realistic feed

## Outcome

Done. The new content spec passes twice in a row, headed, with no model. No product defect was found.

## What changed and why

One new file: `apps/extension/e2e/content/tests/extraction/tests/social-kept-row-disclosure.spec.ts`.
- `extraction/tests/` had 21 files, so the spec goes beside `social-read-completion.spec.ts`. No subfolder was needed.
- It copies that spec's pattern: `openHarness("social-network-feed")`, then the Lab's consent, notifications and chat endpoints, then a reload and a wait for `fluxiq.contentReady`.
- It reads the home feed with item `[role="article"]:has(a[href*="/posts/"])` and three fields:
  - `position`: the `aria-posinset` attribute;
  - `post`: the first post link;
  - `description`: the message text.
- The rows a condition keeps are chosen from the live page, so the spec names no fixture post, author or text.

What the spec proves:
1. **Rejected collapsed rows do not refuse the read.** The condition keeps two short posts by feed position and so rejects every collapsed long post. The read succeeds with validation `passed`. It returns exactly the two kept rows, and each `description` equals the element's whole text. Every post that was collapsed at the start is still collapsed afterwards, so the read did not expand the rows it dropped. This is checked for both condition shapes: `field: "position"` (a kept column) and `read: {attribute aria-posinset}` (a value the record does not carry).
2. **A kept collapsed row is still refused.** The same read, with the condition also keeping a collapsed long post, fails `web.validation.output_not_observed`. Its actual matches `incomplete_text: field description contains unexpanded text`, it returns no rows, and the page is unchanged.
3. **Pressing the row's own "See more" fixes it.** The spec presses that post's own disclosure control through `web.dom.click`. The control disappears, and the other initially collapsed posts stay collapsed. The same read then succeeds with 3 rows, and the long row's `description` is longer than its cut text and equals its whole text.

A design point found while writing it, and why the condition uses feed position rather than post link:
- The first version kept rows by post link (`contains "/posts/<id>/"`). In that version, read 3 was refused (`incomplete_text`, after 3 attempts).
- A diagnostic showed why. The feed had loaded more units by then, including a second rendering of the same long post (position 15, a recap), which was still collapsed. The link condition kept it, so the refusal was correct: a kept row with collapsed text.
- This is the product behaving as specified, not a defect. The spec now keys on feed position, which is unique per row. The header comment records why.

## Commands run and observed results

All runs used `cd apps/extension && node scripts/test-content.mjs --workers=1 --headed e2e/content/tests/extraction/tests/social-kept-row-disclosure.spec.ts --output <scratchpad>/e5-social-<N>`.
- That is `scripts/test-content.mjs`, the documented wrapper around `playwright test -c e2e/playwright.content.config.ts`, which turns off Node's type stripping.
- Its global setup bundles into a per-run `.harness-build/run-*` directory. No extension, Core or test-contracts build was run.

| Run | Spec version | Result |
| --- | --- | --- |
| 1 | page-wide "See more" count | Failed at the assertion after read 1: expected 1, received 5. Read 1 itself succeeded. The feed loads more units while it is read, so a page-wide count is the wrong check. Changed it to follow the initially collapsed posts by position. |
| 2 and 3 | post-link condition | Reads 1 and 2 passed. Read 3 failed `incomplete_text`, explained above. |
| diag | temporary diagnostic | Rows matching the kept ids before read 3: positions 1, 3 (expanded) and 4, plus position 15, the same post as 3, still collapsed. The diagnostic was then removed. |
| 4 | final | `ok 1 ... (21.1s)`, `1 passed (33.5s)`. Logged `{"rows":4,"collapsedAtStart":1,"kept":2,"refusedThenRead":3}`. |
| 5 | final | `ok 1 ... (21.1s)`, `1 passed (31.2s)`. Same log line. |

## Not verified

- At the start of the test the initial feed shows only 4 article rows, and 1 of them is collapsed. More rows, including other collapsed ones, load during the reads. Step 1 therefore proves the rule on at least one rejected collapsed row, not on the four long posts of the live run all at once.
- One shape is not exercised in a browser: a rejected row whose rejecting condition itself read collapsed text, which should still be refused. That case is covered only by the s5a unit tests (`item-record/tests/assert-disclosed.test.ts`).
- The live run's actual shape, a group-column condition over the full feed, is not reproduced.
- No typecheck. The brief forbids builds and typechecks; Playwright's transform compiled and ran the spec.
- No full suites. No structure audit was run; the new file is the 22nd in its directory.
- The run left the HTML report in `apps/extension/e2e/test-results/content/report`, as every harness run does.

## Open questions or contradictions found

- None about the product. One note for Flow authors and hints: a post-link identity is not unique on this feed, because recaps render the same post again. A read that keeps rows by post link can keep a second, collapsed rendering.
