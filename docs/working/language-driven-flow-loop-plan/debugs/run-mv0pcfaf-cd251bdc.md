# Debug: run-mv0pcfaf-cd251bdc (lane D round 2, social-network-feed-confirm-requests, candidate mode)

Written 2026-10-12 by the lane D round 3 lead from the round 2 evidence: worker reports
`mvp-final-month-plan/reports/lane-d-r2-w3-exploration.md` (steps, cost, identities) and `lane-d-r2-w1-ui.md` (14
pictures), and the lead's own read of `steps/0034-tool-core.submit_candidate/{call,result}.json` in
`test-runs/instances/t275-slot-4/run-mv0pcfaf-cd251bdc`. The round 2 lead was stopped mid-debug (2026-10-09 08:30).

## What happened

- Launched 2026-10-09 08:26 UTC; build 08:30:20-08:31:45; **failed, no Flow**. 23 calls (1 chat, 22 decisions, 0
  judges), **$0.060504** (all at DeepSeek's weekday peak rate; the same tokens off-peak would be $0.0303). No ceiling
  or call limit reached; no balance failure. All four running identities `verified: true`.
- Exploration 0002-0032: navigate, decline cookies, a refused `/friends/` address (the model dropped the scenario
  root; the guard was right), a covered Friends link (a new "Turn on notifications?" modal; the refusal named its
  close buttons and the model followed), Not now, Friends, Close chat, three detects (`extraction.3` = the eight cards
  on `~/friends/requests/`), two list reads. No Confirm, Delete or Add friend pressed; the "going too fast" notice never
  appeared (no Confirm was pressed).
- 0033 submission 1, refused `flow_bootstrap.evidence_completion_parameters_unresolved`. The listing read was right
  (`extractList.where: [{"field": "mutual", "matches": "([5-9]|[1-9][0-9]+) mutual friend"}]`, Confirm `repeat over:
  requests`). The after-read, line 27 "read the accepted requests", filtered `where: [{"field": "confirm", "is":
  "absent"}]` while its own `fields` declared only `name` and `mutualFriends`. Issues:
  `web.handle.unknown_field`, `web.handle.expected.extract_list.handle_fields`,
  `web.handle.unknown_field:extractList.where.0`, all on line 27.
- 0037, 0041, 0043, 0045: the same script resent unchanged four times, each refused as a repeat; 0039 a repeated
  detect (`already_answered`). The repeat guard ended the build (`flow_bootstrap.evidence_repeat_without_progress`).

## Causes (each with the file and line at the time, and its state now)

| # | Cause | Where (Core dcaf8f9f / downstream 0064c9bf) | Fixed on dev by |
| --- | --- | --- | --- |
| 1 | Every `web.handle.*` issue got the "a handle is refused when it is not one the evidence printed" advice, so the model reread the evidence for a handle that was right and resent | Core `runtime/flow-bootstrap/candidate/submission-refusal.ts:51` (`HANDLE_ISSUE` matched all `web.handle.*`), advice :138-142 | t383 `397e461f` (advice chosen by the reason after `.handle.`; `unknown_field` now says the list's handle is right and a column the step names is neither printed nor kept, `submission-refusal.ts:112`) |
| 2 | The domain issue did not name the bad field or the step's own columns | domain `runtime/llm-evidence/plan-resolution/extraction/conditions.ts` ~216, `columns.ts:265` | t383 `c631ce65` (the path ends at the condition's field, `conditions.ts:168`, :228) |
| 3 | The instruction text says "keep every other line exactly as it is", so with advice that pointed nowhere the model resent the script verbatim | Core `submission-refusal.ts` `instruction` | Unchanged; harmless once the advice names the field |
| 4 | Exploration never saw an accepted card, so the after-read's accepted condition rests on a state never observed | design: candidate format, exploration | Open risk for round 3 (the trial is the first time an accepted card is seen) |

UI (W1, pictures read): the start shows "Loading the conversation..." while the build runs (F1); no Take over / Hand
back on screen (F2); exploration cards say a bare "Click" (F3); "Open page · friends · the step wasn't accepted" gives
no reason (F4); internal read names "extract requests 1" and raw keys "name, mutual and confirm" on cards (F8, F9);
resends titled "Saving the Flow's steps" / "Change the Flow" (F10); the ending says "points at something that wasn't
seen on the page" instead of naming the field (F11, same root as cause 1). The overlay flickered with 1000 ms probe
timeouts (F7). Passed: record button neutral, Stop build present, Chat tab, resend card wording.

## What changes next

Causes 1-2 are fixed on dev (t383). Round 3 runs on downstream `3e5e7187` / Core `01621c94` and watches: the
after-read's accepted condition (cause 4), the trial meeting the rate limit on the fourth Confirm, and whether a
passing trial carries a learned pace into the saved Flow.
