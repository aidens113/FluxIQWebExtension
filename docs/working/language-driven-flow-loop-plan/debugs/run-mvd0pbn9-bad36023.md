# Debug: run-mvd0pbn9-bad36023

- Instance: bf-slot-2, task `crossborder-marketplace-free-hubs-under-ten`, authoring mode `project` (breadth round,
  2026-10-17), lane tree `fxwork/t565`, with lane 2 fixes 1-5 built in (fix 6 landed after this launch). Steps: 88.
  LLM calls: 47.
- Verdict: **failed**, no Flow created. The build reached its 30-minute limit (`project-build-duration.ts`) "before a
  whole test of the Flow passed". Billed $0.0779 of $0.25 (supervisor $0.0381, builder $0.0396).
- How far it got: much further than r1-r3.
  - **Fix 4 worked live.** The builder's first press (0010-0011), the cookie bar's decline under the welcome modal,
    was sent. The runtime closed the modal and pressed. The trial recorded it: "A dialog was over the page, and the
    run closed it by pressing its way out".
  - Fix 3 also held: the plan was taken at the first try (0005-0006).
  - The builder searched, detected the list, read it, and submitted 9 revisions with 6 trials. Trials: rev 1
    `execution_failed`; rev 2, 3 and 5 `trial_no`; rev 6 `execution_failed`; rev 9's trial was cut off by the time
    limit while still paging.
- Causes (three, all general):
  1. **`next_page` could not read this pager, so it pressed a Next that does nothing.** The site's Next is a script
     `<div>` whose handler throws, as on the live site (`client/search-script.ts`). A person pages with the
     numbers. `followNext` (`apps/extension/src/content/extraction/page-advance/follow-next.ts`) is built for exactly
     this: a Next with no address is swapped for the pager's following number. But `readPager`
     (`extraction/pager-reading/pager-reading.ts`) finds the current page only by `aria-current`, or as the one number
     that is not a link. This pager draws every number as a link, the current one marked only by a class. So
     `readPager` returned nothing, the dead Next was pressed, and the list never changed: rev 1 trial step 10
     `web.action.failed` after 4 attempts. The sibling `currentPageNumber` in the same file also accepts a numbered
     link to the document already showing. That would not have been enough either: the search lands on
     `search?cat=&q=usb+c+hub`, and link "1" is `search?q=usb+c+hub`, so they differ by one empty parameter.
  2. **The real price column was offered with no sample.** `web.detect_repeating_structure` (0015) offered two money
     columns. `div.css-0a5kivv (currency amount)` is the sale price, drawn as spans "9" ",87" "€", and it carried no
     sample. `span.css-0rsmp28 (currency amount)` carried sample "21,48 €", the struck-through original. A column's
     sample is the element's own words (`domain/src/runtime/llm-evidence/structure/field-sample.ts` `sampleOf`). A
     container whose words all sit in its children has none. The builder chose the column it could see, so
     `price atMost 10` rejected 18 of 20 rows (rev 1). It then spent revisions 2-8 and 20 decisions trying to fix the
     price (four `candidate.unchanged_after_no`). Number parsing is not at fault: Core's `read-number.ts` reads
     "8,20 €" as 8.2.
  3. **A loop of Click plus Read ran on with no progress.** After the `next_page` failure, the builder paged with a
     plain Click on "Next ›". The extension reports a press on a non-command element that changes nothing as clicked
     (`apps/extension/src/content/actions/click.ts` 269-272: only a control that "expects an answer" fails when
     ignored twice). Every pass read page 1's same 20 rows, and nothing in the executor noticed: the only progress
     guard is for state-routing returns (`executor/state-routing/progress-guard.ts`). With a bound of 60 pages, rev
     9's trial was on pass 48 (UI review shot 48, "page 48", site still on page 1) when the time limit hit. The
     user's rule is that a loop without progress fails.
- UI review (chat): every step posted ("Click: go to the next page of results, Done" about 48 times, honest but
  misleading: each was "Done" with no effect). The ending posted three messages that overlap: the time-limit card,
  "It was never test-run from the start, so nothing was put into the Flow. I kept what I wrote as a draft." and
  "Saved candidate draft. Verification pending; the Flow's steps are unchanged." The last is wrong: nothing is
  pending.
- Fixes (lane 2): 7 the pager reader (extension), 8 a composite column's sample (domain), 9 a repeat loop that
  read the same rows twice stops as failed, naming its move step (Core).
- Next: rerun on the changed source.
