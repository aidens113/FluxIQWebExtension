# Report: t741-c4-icons-sort (worker)

## Outcome

Done. Part 1 is changed and tested. For part 2, the extension's sort already orders rows by a date
written inside prose, using the first full date. I added a test that pins this. No code change was
needed.

## What changed and why

1. `domain/src/runtime/llm-evidence/page-find/search.ts`. Before, a search that found nothing only
   pointed the model at the site's search field or a link. That steered it away from controls that
   are a bare icon. The job run's model searched ten times for one. Now, when the page view holds
   wordless icon controls, the empty answer adds one sentence after the existing site-search
   sentence:
   `Some controls here show no words, only an icon: t3, t5, t7 and 1 more. What one does is written nowhere, so describe one (web.describe_element) or watch what it changes.`
   - The handles come from the page view's own line choice (`chosenWebLlmLines`). Only control
     lines whose icon hints contain `icon` count, which are the same controls the view prints as
     `clickable icon class="..."`.
   - It names at most three handles (`ICONS_NAMED`) and adds "and N more" for the rest. Two read as
     "t1 and t3".
   - A wordless link over a card holds no picture and is not counted. A page with no wordless icon
     reads exactly as before.
   - The header comment records why.
2. `domain/src/runtime/llm-evidence/page-find/tests/search.test.ts`. Three new tests, all with
   generic recipe-site fixtures:
   - four star icons, where three are named plus "and 1 more", and the site-search sentence stays;
   - a page whose only wordless control is a card link with no picture reads as before;
   - two icons, a button holding an `<i>` glyph and a span holding an `<img>`, are named as a pair.
3. `apps/extension/src/content/extraction/tests/order-rows.test.ts`. One new test sorts four rows
   `as: "date"`, descending. Each date sits inside alt-text prose, for example
   "Picture by A. Baker on October 2, 2026. May show a bowl.":
   - one row holds two dates, and only its first date must count;
   - one row is an ISO date inside a sentence;
   - expected order oct9, oct2, iso, sep14, with `unsortable` 0.

   This passed with no change to `order-rows.ts`. Core's date reading
   (`sortAutomationStudioRecordRows`) already uses the first full date inside prose.

## Commands run and observed results

- Before the fix, `cd domain && DOMAIN_TEST_BUILD_LABEL=t741-c4 node scripts/test-domain.mjs page-find/tests/search`
  printed `# tests 13 # pass 12 # fail 1`. The failing test was the new icon test: the actual
  answer had no icon sentence.
- After the fix, `DOMAIN_TEST_BUILD_LABEL=t741-c4 node scripts/test-domain.mjs page-find/tests`
  printed `# tests 26 # pass 26 # fail 0`, with the pair test included.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t741-c4 node scripts/test-extension.mjs extraction/tests/order-rows`
  printed `ok 1` to `ok 8`, including
  `ok 8 - a date inside prose is read by its first full date, as an image's alt text states one`.
- A search outside build output found the zero-match sentence "Nothing on this page holds" only in
  `search.ts`, its test and old reports. No other test pins it.

## Not verified

- No typecheck, build or wider suite was run (the shared rules leave those to the lead).
- No live run checked whether the new sentence actually stops the repeated searches.
- I did not read the job and photo evidence notes. I worked from the brief's summary of them.

## Open questions or contradictions found

- The brief offered "watch what it changes" as the second way to learn what an icon does, and I
  kept that wording. Pressing an unknown icon may make a lasting change. The sentence names
  `web.describe_element` first, and I left permission gating to the existing action guards.
