# Debug: run-mwoiywne-2385504a

## Run

| | |
| --- | --- |
| Status | **FAILURE**, stopped by the watchdog at 21:21:19 local: no decision, judge or Flow step for 5 minutes. Attempt 1 was stuck on a person check the Lab cleared but never answered. |
| Campaign | 2026-11-19 evening, lane A (`fxwork/t959`, instance `campaign-a`) |
| Source | dev, extension 6314624df and Core 71d25f484, plus lane A's F2 Lab fix |
| Site and task | crossborder-marketplace, `crossborder-marketplace-free-hubs-under-ten` (multi-page filtered scrape) |
| Model | Haiku throughout, with no climbs |
| Time | 21:14 to 21:21 local |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwoiywne-2385504a/steps` |

## Cost by call kind

```text
total $0.0171
  decide: 10 calls, $0.0166, input 360241, cache read 67%, output 2496, models haiku
  chat: 1 calls, $0.0005, input 3158, cache read 0%, output 151, models haiku
```

## What happened

1. **Pages 1 and 2:** Haiku read both. Two `act_on_a_read` amendment refusals came on the way (0014, 0016; F9 again).
2. **Page 3 (0021):** the model said "Page 2 of USB C hub results extracted; next, check page 3 for more rows before
   completing". Its call was `core.run_node web.output.dom-next_page {nextPage: {list: extraction.2}}` (`call.next.page3`).
3. **The traffic screen:** the press met crossborder's "I'm not a robot" traffic screen. Core asked the person
   (`waiting_for_person for person_only_check`) and waited inside the tool call, step 0022, which started at
   21:16:05 and never finished.
4. **The Lab's person:** it logged "the Lab played the person at a check: traffic-screen, cleared, answered nothing" at
   21:16:38. In `person-simulation/simulation.ts` (`handOffOne`), `answer` becomes null only when sending the
   answer throws ("the answer did not reach Core: ..."). Here the answer is pressed in the chat
   (`attempt-person.ts`, `chatAnswerer`, with a 30 s press), and the 33 s gap fits that press timing out.
5. **The stall:** Core went on waiting for the person until the watchdog stopped the run.

## Cause

- **Known:** the Lab cleared the check on the page, but its Continue answer never reached Core.
- **Not yet known:** why the chat press failed. The note with the error is held only in the hand-off snapshot, which
  was not written because the run was stopped.
- **Next step:** a provider-free scripted run of this task in lane A, to reproduce it and read the note.
- **Classification:** pending that cause. A Lab driver defect is SIMPLE; a chat that does not show the person-check
  question is a UI defect.

## UI

Not inspected (stopped mid-attempt).
