# Debug: run-mwohvt8n-a57cad8a

## Run

| | |
| --- | --- |
| Status | Lab `passed`; campaign verdict **PARTIAL**. All 4 answers right, all continuations held, and attempt 3 made zero calls. Attempt 2 needed one judge call, and attempt 4's replay broke and re-explored. |
| Campaign | 2026-11-19 evening, lane A (`fxwork/t959`, instance `campaign-a`) |
| Source | dev, extension 6314624df and Core 71d25f484 (t962, t963, t964, t965), plus lane A's F2 Lab fix |
| Site and task | auction-marketplace, `auction-marketplace-lens-hood-seller-shop` |
| Command | `pnpm lab attempt auction-marketplace --task auction-marketplace-lens-hood-seller-shop --authoring-mode answer-first --live-llm --attempts 4 --llm-model claude-haiku-5-5 --llm-max-cost-usd 5` |
| Time | 20:41 to 20:56 local; attempts took 28 s, 10 s, 5 s and 190 s |
| Cost | $0.582 ($0.0136 + $0.1198 + 0 + $0.4487) |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwohvt8n-a57cad8a/steps` |
| Flow | `flow.081ae1a8-5bb3-479b-b249-bc4af5ff1b29` |

## Attempts

| Attempt | Path | Calls (interpretation / judge / decisions) | Cost | Ended | Answer | Replay |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | 12 (1 / 1 / 10) | $0.0136 | achieved | right (8 rows) | n/a |
| 2 | run_flow | 1 (0 / 1 / 0) | $0.1198 | achieved | right | judged: deviated, `flow_not_proven` (0028) |
| 3 | run_flow | 0 | $0 | achieved | right | stood on its record, no judge (0035) |
| 4 | run_flow_then_explore | 18 (0 / 2 / 16) | $0.4487 | achieved | right | stopped at step 5, `web.target.not_found` (0044) |

## Cost by call kind (provider-reported, from the step log)

```text
total $0.5825
  judge: 4 calls, $0.4219, input 421458, cache read 2%, output 3185, models haiku/sonnet
  decide: 26 calls, $0.1601, input 783675, cache read 71%, output 5306, models haiku/sonnet
  chat: 1 calls, $0.0005, input 3160, cache read 0%, output 149, models haiku
  judge 0022 haiku-5-5: input 25160, cache read 0 (0%), fresh 25160, written 22914, $0.0035
  judge 0029 haiku-5-5: input 190670, cache read 3537 (2%), fresh 187133, written 184966, $0.1198
  judge 0057 haiku-5-5: input 92811, cache read 3537 (4%), fresh 89274, written 85412, $0.0114
  judge 0089 sonnet-5-5: input 112817, cache read 0 (0%), fresh 112817, written 110566, $0.2873
  | 0074 | loop_decision | core.loop_decision | ask_person on cycle x2 | - |
  | 0076 | escalate | - | claude-haiku-5-5 -> claude-sonnet-5-5 (repair_failed) | - |
```

## Climbs and loop decisions

- 0074: `core.loop_decision`: the model chose `ask_person` on `cycle` x2. The attempt went on, as in F6.
- 0076: climb from Haiku to Sonnet, on `repair_failed`.

## Judge caching (t965)

- **Base-model judges** (0022, 0029, 0057) stayed on Haiku, as t965 intends. But each read only about 3.5k tokens from
  cache (2-4%) and wrote nearly all of its input as new cache: 0029 wrote 185k tokens and 0057 85k.
- **The judge after the climb** (0089) ran on Sonnet: 112,817 input tokens, 0 read from cache, 110,566 written,
  $0.287.
- **Effect:** no judge here continued the decider's cached conversation. The expected large
  `cache_read_input_tokens` did not appear. This is finding F14.

## Attempt 4's replay failure (not traced to the root)

- At s3, a `dom-click` failed `target_not_found` once (0038), then succeeded (0039).
- At s4, a `dom-click` then failed `target_not_found` four times (0040-0043), and the run stopped at step 5.
- No re-run of the source step shows between the failures. The stale-target rule (re-run the source step after the
  second failed retry) may not have applied here, or s4's target has no source step. Recorded as an observation for
  review.
- The model then explored, the judge said no once (0057, "the request was not met"), and it amended. It ended right
  after climbing to Sonnet.

## UI

Every attempt's answer turn was drawn. No defect was seen in the run log.
