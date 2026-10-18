# Debug: run-mvd9554h-42cdf9b7

- Instance: bf-slot-2, task `crossborder-marketplace-free-hubs-under-ten`, authoring mode `project`, on the integrated
  round-1 tree (downstream `48cdbfee`, Core `c1ed1bdd`: all four lanes plus t707), lane tree `fxwork/t565`. Steps: 62.
  LLM calls: 31.
- Verdict: **failed**, no Flow created. Billed $0.0251 of $0.25 (supervisor $0.0037, builder $0.0212). The supervisor
  ended honestly: "the builder is blocked by a security check on page 3".
- How far it got (further than r4):
  - Plan first try.
  - Covered cookie press sent and the modal cleared (fix 4).
  - Search, detection and read. The price condition now kept rows: the first trial's read saw 40 rows over 2 pages
    and kept 7, so fix 8's sample led the builder to the sale-price column.
  - **`next_page` moved from page 1 to page 2 (fix 7 live).** The move to page 3 failed.
  - Two briefs, four trials, all `execution_failed` on the same step.
- Cause: **a robot check met by `next_page` in a trial is retried as a missing list instead of handed to the person.**
  The site replaces its third results load with a traffic screen, by design. The task declares
  `personCheck: { person: "completes", required: false }`: a person clears it, and the run goes on. After the move
  to `search?q=usb+c+hub&page=3`, the page's title was "Security check" with one control, "I'm not a robot" (decision
  0024's request, `state.page`). The trial's step 14 (`web.output.dom-next_page`) failed
  `web.validation.output_not_observed` ("The step reported success, but its effect was never seen") after 4
  attempts. No person hand-off was asked. The builder correctly refused to touch the check (its instructions: "Never
  solve a robot check"). It then tried capping paging at 3 pages (rev 2, same failure), and ended the brief blocked.
  - Not verified in source this session, but likely: a press (`click.ts` -> `deps.needsPerson`, from a challenge
    sighting) is turned into the person hand-off (`USER_INTERVENTION_REQUIRED` -> Core
    `AS/runtime/parking/person-needed-ask.ts`). The next-page move's arrival (`apps/extension/src/content/extraction/
    page-advance/arrival.ts` `arriveAfterMove`, `list-change.ts`) waits for the list and does not look for a
    challenge on the page that replaced it, so it reports the list as not observed.
- UI review (chat): not reviewed this run (session wrap-up).
- Fix (next agent, general): when a next-page move (and a paged read's own move) lands on a page holding a robot
  check (`action-runtime/challenge-evidence.ts`) instead of the list, answer needs-person like a press does, so Core
  parks the run and asks the person to clear it and press Continue. Then confirm the trial and the judged run resume
  on the list. Test it beside `page-advance/` with a fake challenge page.
- Next: that fix, then rerun this task. The other tracked cause (paging loop with no progress) is lane 3 fix 3, now
  on dev.
