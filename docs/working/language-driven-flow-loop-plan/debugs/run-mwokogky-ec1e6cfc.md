# Debug: run-mwokogky-ec1e6cfc

| | |
| --- | --- |
| Status | **FAILURE**, stopped by the watchdog at 22:09:34 local: no progress for 5 minutes. Attempt 1 was stuck on the person check again (F16). |
| Campaign | 2026-11-19 evening, lane A (`fxwork/t959`, instance `campaign-a`) |
| Source | dev, extension 6314624df and Core 71d25f484, plus lane A's F2 fix and the F16 diagnostic (the hand-off note on the log line) |
| Site and task | crossborder-marketplace, `crossborder-marketplace-free-hubs-under-ten`, on Haiku with no climbs |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwokogky-ec1e6cfc/steps` |

## Cost

```text
total $0.0408
  decide: 22 calls, $0.0345, input 886490, cache read 72%, output 4289, models haiku
  judge: 1 calls, $0.0059, input 44534, cache read 0%, output 996, models haiku
  chat: 1 calls, $0.0005, input 3158, cache read 0%, output 156, models haiku
```

## What happened

- **Judge at 0024:** no. "The request was not met: the site search for 'usb c hub' was never run, only one unsor...".
  Haiku went on and paged.
- **The next-page press (0048):** it met crossborder's traffic screen, and Core waited for the person.
- **The Lab's person:** it logged "the Lab played the person at a check: traffic-screen, cleared, answered nothing
  (the answer did not reach Core: The side panel showed no enabled "Continue" button to press: the press at (59, 369)
  did not reach the "Continue" button)".

## Cause (F16, narrowed)

- **Where:** `extension-chat-check/view-target-press/`.
- **What the panel saw:** its own hit test (`in-panel-target.ts`) found the Continue button enabled and unobstructed at
  its centre, (59, 369).
- **What failed:** the trusted CDP mouse press there (`Input.dispatchMouseEvent` on the side panel's target) produced
  no click on the button. `press()` retried for 30 s, then gave up.
- **Intermittent:** the scripted run of the same task (run-mwojshmc-57adba2a) pressed the same button with no problem.
- **Suspected, not proven:** after the Lab's person brings the scenario tab to the front to clear the check, the side
  panel's target no longer takes input.
- **Classification:** a Lab driver defect with an unknown cause. It needs a debugging worker, not a quick fix, and is
  recorded for the lead. Crossborder runs are blocked on it, because its traffic screen comes at page 3.

## UI

Not reviewed (stopped mid-attempt).
