# Run debug — `run-muqc07fh-eeffbc86`

## Header

- Lane A run 42, `crossborder-marketplace-hub-to-cart`, slot-1, headed, started from the extension chat, default model (deepseek-flash).
- Tree: downstream `8bc8a54e`, Core `b369ca14`, with t232 (page view), t228 (step logs), lane B's observation-only repeat guard, and the $0.10 build ceiling.
- Verdict **failed** at stage 1: `lab.chat_build_failed`, no Flow. The build stopped at its $0.10 spending limit with 4 of 5 acts stepped. Still to do: "Space Grey". Add to cart was never pressed.
- Spend (ledger): **$0.0774**, over 25 decisions plus 1 chat call. Input about 17k-27k per decision, output about 100.
- Evidence: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqc07fh-eeffbc86/steps/` (request.txt, response.json, result.json, and screenshots per step).

## Stage 1 — exploration, step by step

| Steps | What happened | Cost |
| --- | --- | --- |
| 0002 | Core's free first look (`initial.core.run_node`, dom-capture) is refused `not_at_start_location` / `start_location_not_reached`. The tab already stood on the start location. | free |
| 0003-0004 | The first paid decision (17.2k tokens) navigates to the start location; the page reloads (`ARRIVED reload`). | $0.0051 |
| 0005-0016 | Seven `web.find_on_page` calls for "Voltbay", "Voltbay Official Store" and "Voltbay USB-C hub" on the home page, all `0 matches`. Lane B's guard refused the 3rd and 5th repeats (0011 and 0014 have no tool step). | about $0.015 |
| 0017-0018 | Types "Voltbay USB-C hub" into `t489 field[search]`, which is refused `target_covered`: popup `t476` covers 55 elements, including the field (`instead: [t476]`). | $0.0024 |
| 0019-0020 | Presses the popup's `t478 "×"`, and the field is uncovered. | $0.0036 |
| 0021-0027 | Back to `find_on_page` "Voltbay" three times, then the guard. | about $0.010 |
| 0028-0029 | Types the search and submits it: results load. | $0.0026 |
| 0030-0041 | Opens the Voltbay card, then 7-in-1 (a1.version) and Spain (labelled a1). Presses quantity `+` once. Collects the coupon: refused `action_failed` once (the busy refusal, F17), then succeeds. | about $0.023 |
| 0042-0051 | `amend_draft` ×3 and `complete` ×1 while trying to make the quantity 3 (`rerun` of the `+` press, then a type of "3" into `t993`). The budget ran out. | about $0.014 |

The page view held what the task needs: the search field line, the popup and its `×` / `No thanks` (t232 held).

## Causes

1. **The opening look is refused for where the build is.** This is not a wrong tab and not late state. It is the arrival rule, by design: until a navigation node succeeds in the build, the domain withholds the page (`node-run/arrival.ts`, `currentPage`). Core's `startLocationNote` told the model "nothing was opened for you". The model's first paid decision was the navigation the Flow needs as its first step anyway.
2. **find_on_page read as the site's search.** Its description opened "Search the page you are on…". An empty answer was a bare `0 matches for "…"`, with nothing saying that only this page was read or that the site's search field `t489` exists. Twelve decisions (about $0.027, a third of the spend) went to it. After the popup was dismissed the model went back to it, so the search was not retried until 0028.
3. **Not finished within $0.10.** That followed from 1 and 2, plus three amendments spent getting quantity to 3. The Add to cart press and the Space Grey choice were never reached.

## What changes next

- **F31** (Core + domain, Ready to commit): a build with a start location opens by running the domain's declared arrival (navigate to the start location) as the Flow's first kept step, with no paid decision. A look reads the page before arrival; only an unreadable page answers `not_at_start_location`.
- **F32** (domain, Ready to commit): an empty find_on_page says it read only this page and names the site's `field[search]` handles. The descriptions open with "Reads only the page you are on, and is not the site's search".
- Both are now on dev (`fef43a29` / Core `b17c2bfa`), together with t235 (names-only node catalog), t237 (web system instructions) and t234 (one $0.10 purse per Flow). Next: run 43 on the same task. First check the step-0003 request (system instructions present, catalog names only, about 27k chars), then whether the model searches with `t489` and handles the popup.
