# Run debug — run-mv0fuotv-805294d7 (lane C, first candidate-mode probe, t274-slot-1)

Written as `run-pending-t274-slot-1-c-cand1.md` before launch; renamed to the run id when the Lab assigned it.
Everything in "Expectations" was written before launch (2026-10-09 ~03:25 UTC; DeepSeek peak until 04:00, launch at
or after 04:00, no paid launch after 05:45).

## Header

Lane C, task `everything-store-plus-earbuds-under-50`, first run in candidate mode. Tree `fxwork/t274` at downstream
`1d04a11a` (dev `128d907e` is one documentation-only commit ahead) and Core `52d7ac3a` (= Core dev), both clean.
Core `pnpm build` and downstream `pnpm build` exit 0 at 03:06-03:14 UTC. No `STOP-balance`, no override files.

Previous run on this instance: round 4 `run-muxky0df-c9839389` (legacy, 2026-10-07): failed, no Flow, because the
persistent profile ran a stale extension service worker that did not know Next page (R4-1, since fixed by
`guarded-browser/forget-cached-service-workers.ts`). Since then lane C has never run; the build path changed to
candidate mode (t339-t373).

## Expectations (written before launch)

Instruction (415 characters, sha256 `d4f7835b...`): every Plus-eligible pair of wireless earbuds rated 4.0 or higher
and priced under $50, through every page, no sponsored placements or accessories, each pair once, in result order,
columns name, price, rating, url.

Oracle: 13 ordered records, 52 fields (`workflows/plus-under-fifty.ts`), plus final state not challenged and cart
count still 2.

A correct candidate, per the fixture's description:

1. navigate to the store; Decline (cookies) and Not now as optional steps;
2. type "wireless earbuds" into the search and submit;
3. a one-page read with `where` conditions: not sponsored, Plus present, rating at least 4.0 as printed (not the 4-star
   filter, which admits 3.8/3.9), price strictly under 50 (not the $25-$50 band), accessories out (ear tips, charging
   case); scroll-loaded results must be in the read;
4. Next page;
5. a repeat of the read through Next page while it moves on, ending when Next is absent (page 5);
6. run-end whole-row dedupe removes each page's repeat of the previous page's last result.

The expected rows must come from the read, never be written into the candidate.

Traps to watch in each trial:

- page 2's Next links to page 2 again; the extension's page advance should move on by the following page
  (`page-advance/move-page.ts`, `by: "following"`);
- more than five results pages in 8 s is a 429; three refusals flag the session behind the robot check; the advance's
  load pace (`page-advance/load-pace.ts`) should keep under it;
- the trial must start from a reset store (`start: "reset"`), not the exploration's last page.

To check:

- running identities verified before the first call;
- exploration: what the model looked at, and whether it saw all five pages or only page 1;
- every submission: revision, accepted or refused, and the refusal words;
- every trial: start reset, each step with its attempts, rows read per page, Next page outcomes per page, the
  repeat's passes, the run-end processing, the rows stored;
- the judge pair's verdicts against the oracle (13 rows, exact fields);
- promotion, chat apply, the "ready" words;
- the Lab's reset, own-tab playback and private oracle (matched records against 13);
- cost and calls by stage, against $0.10 and 48;
- UI: chat cards (read cards "Done: N rows from M pages", Next page and Repeat cards, trial cards), the overlay,
  Automations.

On a Lab oracle pass with product acceptance: one zero-call `lab replay`. No second paid run in this round.

## Result (written by the lane C lead, 2026-10-09 ~04:20 UTC)

**Failed before any trial: the one script the model wrote was refused for a misplaced `repeat most:` line, and the
model resent it unchanged three times until the repeat guard ended the build. $0.033140, 21 calls, no Flow.**

- Guard `admitted` 04:01:16 (fingerprint `sha256:58dcb4e0...`, no override); run `run-mv0fuotv-805294d7` started
  04:01:28. The Lab then built the Core panel for this run (`next build`, `coreWeb` not cached) until about 04:06:45.
- Identities: `running-{core,host,server-adapter,build}-identity.json` all `verified: true`, written 04:06:49.985-
  04:06:52.469, before the first call (0001 chat at 04:06:57.143).
- Mode: `coreAuthoringMode: candidate` (`snapshots/live-llm.json`), `flow-lane.json` `authoringMode: candidate`.
- Lab verdict `failed`, `runtime.behavior`, `lab.chat_build_failed`, issues `flow_bootstrap.evidence_repeat_without_progress`,
  `llm_evidence_loop.repeat_refused`. `flowCreated: false`, oracle not measured. Candidate
  `candidate.843835f7...`: `verdict: not_tested`, `trialCount: 0`, no revision, no promotion.
- Calls and cost: 21 calls, $0.033140 (build $0.032948 of the $0.10 ceiling; 21 of 48 calls):
  - chat 1, $0.000192;
  - exploration decisions 16, $0.027664, of which 3 unreadable replies $0.004666 and 3 refused repeated looks
    $0.002906;
  - submission decisions 4, $0.005284, of which 3 identical resubmissions $0.004000.
  - About a third ($0.0116) went on decisions that could not change anything.
- Campaign exit 1 at 04:08:33. No Lab process left (checked by command line). Not relaunched.

### Sequence

1. 0002-0006: home page, Decline (`t121`), typed "wireless earbuds" with submit; the store's browser check cleared on
   its own after 9 s.
2. 0007/0008: `detect_repeating_structure` on `t168`: `extraction.1`, list "Results", 15 items.
3. 0009-0014: the same detect, same callId `detect-list-2`, three times; each refused
   `llm_evidence_loop.already_answered`.
4. 0015/0016: first read with the wrong shape (`target: {handle: extraction.1}` plus a `fields` array of CSS
   selectors): `target_unobserved`, `handle_in_wrong_parameter`, with the right shape in `instead`.
5. 0017: unreadable reply (`content_unclosed`); 0019/0020 the corrected read: "20 records from 1 page", scrolled to
   y=2604, so the scroll-loaded results were read.
6. 0021/0022: Next page: "moved by next to page 2". 0023/0024 detect on page 2 (`extraction.3`). 0025 unreadable
   reply. 0027/0028 read page 2: 21 records.
7. 0029/0030: Next page from page 2: **"moved by following to page 3"**: the page-two trap (Next links back to page 2)
   was handled by the extension's page advance.
8. 0031/0032 detect on page 3 (`extraction.4`). 0033 unreadable reply.
9. 0035/0036: submission `submit-1` (revision 1), refused `flow_bootstrap.completion_refused` /
   `flow_bootstrap.evidence_completion_plan_invalid`:
   - `flow_script.repeat_body_is_routed` (`flow.line.22`): "The step at line 23 says repeat inside the span that starts
     at line 10. A repeat inside a repeat is not supported: say repeat once, on the first step of the span."
   - `flow_script.repeat_invalid` (`flow.line.27`): "The step at line 23 says repeat, but not what repeats it. Write
     `repeat over: ...` ... or `repeat while: ...`".
10. 0037, 0039, 0041: the model resent the byte-identical script ("Resubmitting the corrected Flow: the repeat now sits
    on the read step with repeat while: next, and the next-page step follows it"). Each was refused by the repeat
    guard (0038, 0040, 0042: `llm_evidence_loop.repeat_refused`, `sameAsCall: submit-1`). The third ended the build.

### The candidate (never tested)

```text
step: open the wireless earbuds search      web.browser-navigate  url .../s?k=wireless+earbuds
step: close the cookie banner if it shows   web.dom-click  target: t37  optional: yes
step page: read this page of results        web.dom-extract_list  extraction.1, fields name/price/rating/url/sponsored/plus
  recordOutput.columns: name, price, rating, url
  recordOutput.process: where sponsored absent, plus present, rating atLeast 4.0, price lessThan 50,
                        name not containing "ear tips"/"charging case"/"eartips"; dedupe "name"
  repeat while: next
step next: go to the next page              web.dom-next_page  nextPage: extraction.1
  repeat most: 10
```

Against the oracle: the rating and price conditions are right (no 4-star filter, no price band, strict under 50), and no
expected row is written in. Three latent faults a trial would have met:

- **The accessory filter drops a real answer row.** `contains` folds case (Core
  `contracts/src/record-sets/process/condition-holds.ts:45`; domain `actions/extraction/condition-match.ts:141`), so
  "charging case" removes the ChargeMate case (rank 22), but also rank 41: "Aurelle Pods Fit Wireless Earbuds, ...
  Ivory with Wireless Charging Case". That listing is Plus, rated 4.4, $39.99, organic, and one of the 13. "Wireless
  Charging Case" is also one of the generated titles' feature words (`catalog/earbuds/earbuds.ts:22`).
  - Checked against the built fixture (`apps/scenario-lab/dist/.../workflows/plus-under-fifty.js`, a scratch script
    that applies the candidate's three case-folded words to the 13 expected names): it drops **3 of the 13**. They are
    answer rows 8 (Lumo Audio Drift Pro, $26.99), 9 (Aurelle Pods Fit, $39.99, rank 41) and 11 (Trevio T5, $39.99).
    This candidate would have stored 10 rows.
  - A judge reading the trial would have to notice rows that are absent, so this is the false-acceptance case the
    private oracle exists for. It is also the instruction's own trap: accessories must be told apart by what they are,
    not by words a real pair's title also uses.
- `t37` is the home page's promotional carousel text ("Kitchen upgrades: up to 25% off Tidewell"), not the Decline
  button (`t121`).
- There is no "Not now" step (it is optional in the fixture's description).

### Causes, reproduction and the file to change

- **C1 (decisive): where `repeat most:` goes is not said, and its misplacement is reported as a nested repeat.**
  - The prompt (`!FluxIQ/.../runtime/flow-bootstrap/plan/flow-script-format.ts:264`) says a `repeat while` loop ends
    "after `repeat most: <passes>`; a last step that cannot answer ended needs repeat most", which reads as "put it on
    the last step". It never says the line goes beside `repeat while` on the span's first step.
  - The parser (`authoring/parse.ts:182-189`) attaches `repeat most:` to the step it is written under, so the `next`
    step gets a repeat with only `most`. Routing (`authoring/draft-routing.ts:316`, then `:302`) refuses it as "says
    repeat inside the span" and "says repeat, but not what repeats it". Neither message quotes `repeat most: 10` or
    says to move it, and both point at the step header line (23), not line 27.
  - The model read it as a complaint about `repeat while` (already correct) and changed nothing.
  - `repeat most` was not even needed: Next page answers `ended`.
  - Reproduction (free): submit the script in `steps/0036-tool-core.submit_candidate/call.json`; unit form: in
    `authoring/tests/candidate-loops.test.ts` ("refuses an unbounded repeat while ..."), write `  repeat most: 5` under
    the span's last step instead of under `repeat while`; expect the same two codes. (Not run: no file was added to the
    synced lane tree.)
  - Fix: take a lone `repeat most:` written inside a `repeat while` span as that span's bound (nesting is refused, so
    there is exactly one span it can bound), or refuse it naming the line and the move; and say in the prompt where it
    goes and that a last step that answers ended needs none.
- **C2 (made C1 fatal): an identical resubmission gets the generic repeat note, not the refusal again.**
  - `runtime/llm/repeat-guard/feedback.ts:22-26` (`INSTRUCTION`) told the model to "amend the draft (rerun a step ...)"
    and that "the Flow so far is then tested and judged". Both are legacy-mode words and false in candidate mode, and
    the note does not restate the two issues.
  - Three refusals in a row ended the build with $0.067 and 27 calls unused.
  - Fix: a candidate note for `core.submit_candidate` that repeats the refusal's issues, quotes the lines they name,
    and says the build ends with nothing tested.
- **C3 (waste): DeepSeek flash dropped the final `}` on all three extract-list `run_node` replies (0017, 0025, 0033).**
  - `finish reason: stop`, `content_unclosed`. Each reply was otherwise complete, one closing brace short at the
    root.
  - Core already repairs the mirror case, a surplus `}` (`runtime/llm/deepseek/response-envelope.ts:116-129`), but
    not a missing one.
  - Cost: 3 decisions, $0.004666. Fix: on `finish_reason: stop`, append only the missing closers when the result then
    parses, and validate as usual.
- **C4 (waste, model): the same `detect_repeating_structure` on `t168` three times after it was answered (0009-0014).**
  - Core's note was clear.
  - Cost: 3 decisions, $0.002906.

### Judge versus oracle

No trial, no judge and no oracle measurement, so there is nothing to compare.

### UI (worker review, verified in part by the lead)

Report: `docs/working/mvp-final-month-plan/reports/lane-c-candidate-ui.md` (24 pictures). The lead confirmed the
ending text in `flow-lane.json` and the "Decided the next step" heading in Lab view 7.

- The ending says no cause: ""Create an automation here" stopped because the build failed: it kept trying without
  getting any further, so it was stopped. ... has no steps yet, but it keeps your instruction, so you can build it
  again." It is honest that nothing was made, but circular, and it quotes the internal command name.
- The model's untrue "Resubmitting the corrected Flow ..." narration is shown three times under cards labelled "Change
  the Flow · run the step again".
- The live line said "that didn't work, trying another way" before an identical resend.
- "Action · Dom next page" (card and overlay) is still there from round 4.
- Each unusable reply is headed "Decided the next step".
- The 0036 refusal itself was never on screen at a capture moment.

### Not run, not verified

Trial, judges, promotion, chat apply, the Lab's playback and oracle, and the zero-call replay (no Flow). The unit-form
reproduction of C1. The 3-row loss is computed from the fixture's expected names and the condition code's case
folding, not run through the product's read.
