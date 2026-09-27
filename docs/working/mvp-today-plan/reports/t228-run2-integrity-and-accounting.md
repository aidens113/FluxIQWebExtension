# t228 — Run 2 integrity and accounting

## Outcome

- **Integrity/redaction gate: PASS for the permitted artifact set.** The completion marker matches the artifact-index bytes. Each permitted content artifact has exactly one index entry, and its indexed byte count and SHA-256 match the file on disk. Hash values are intentionally not published.
- The index marks all three permitted content artifacts `applied`; `run.json.redactionState` is `verified`.
- The bundle records 21 live-LLM calls in the evaluation roll-up. Build/main observation records 19 calls and repair/verification records 2 calls, but this report does not synthesize token or cost totals across buckets because the permitted schema does not explicitly establish every bucket as disjoint.
- Two calls in the main-observation bucket lack per-call records. The bucket-level accounting includes them, but their individual request ceilings cannot be independently checked.

## Integrity and redaction

| Artifact | Indexed bytes | Unique entry | Bytes match | Hash matches | Index redaction |
| --- | ---: | --- | --- | --- | --- |
| `run.json` | 2,820 | yes | yes | yes | `applied` |
| `evaluation.json` | 3,430 | yes | yes | yes | `applied` |
| `snapshots/live-llm.json` | 32,306 | yes | yes | yes | `applied` |

The completion and index schema versions both report `0.1`. No raw hash, provider text, request id, command, page data, log, event, timeline, screenshot, HTML, or database content is reproduced here.

## Provider-call buckets

Buckets remain separate below. An “observed-record sum” is arithmetic over the typed per-call token/cost fields, not a reconstruction from provider text.

| Typed bucket | Calls | Input tokens | Output tokens | Total tokens | Estimated cost (USD) | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `build` | 19 provider calls; 18 loop calls | 239,801 | 3,705 | 243,506 | 0.03085158 | Aggregate accounting; build outcome `proposed` |
| main `observed.accounting` | 19 | 239,801 | 3,705 | 243,506 | 0.03085158 | Exactly matches the build aggregate on calls, tokens, and cost; do not add to build |
| main observed per-call records | 17 | 238,542 | 3,659 | 242,201 | 0.030644472 | Two further calls are explicitly `unrecordedCalls` |
| main accounting minus its 17 records | 2-call gap | 1,259 | 46 | 1,305 | 0.000207108 | Derived numeric gap only; no per-call attribution is available |
| repair observed records | 2 | 5,930 | 733 | 6,663 | 0.0017178 | `repair.observed.accounting` is null; token totals are sums of its two typed records |
| verification interventions | 2 recorded / 2 calls | 5,930 | 733 | 6,663 | 0.0017178 | Exactly matches the two repair records; treat as overlapping evidence, not additive |
| evaluation LLM roll-up | 21 | unreported | unreported | unreported | unreported | Typed run-level call count only |

`expectedProviderCalls` is null. The main observation reports `unrecordedCalls: 2`, while repair's `unrecordedCalls` is null rather than zero. Verification has no separate unrecorded-call field.

## Configured ceilings and breaches

| Setting | Configured value | Measured result |
| --- | ---: | --- |
| Maximum input tokens per request | 48,000 | Highest recorded main request: 15,811; highest recorded repair request: 2,965; no recorded breach |
| Maximum output tokens per request | 8,000 | Highest recorded main request: 529; highest recorded repair request: 426; no recorded breach |
| Maximum total tokens per request | 56,000 | Highest recorded main request: 16,273; highest recorded repair request: 3,391; no recorded breach |
| Maximum calls per run | 26 | Evaluation roll-up: 21; five below the ceiling |
| Maximum estimated cost | $0.25 | Main aggregate: $0.03085158; repair/verification representation: $0.0017178. No combined cost is asserted because bucket disjointness is not explicit |
| Provider timeout | 30,000 ms | No permitted typed per-call latency aggregate; timeout breach cannot be independently assessed here |
| Maximum retries | 0 | Configuration recorded; no retry accounting field in the permitted aggregate set |

The main accounting record reports `budgetBreaches: 0` and `pendingCalls: 0`. Its two unrecorded per-call entries prevent an independent request-by-request ceiling check for those calls. The high-token confirmation record reports a 560,000-token threshold and authorization value with `sent: false`; this report does not reinterpret that flag as a breach.

## Timing

- Run start: `2026-09-27T00:37:19.822Z`
- Run finish: `2026-09-27T00:41:39.899Z`
- Evaluation/run duration: 260,077 ms
- Build duration: 151,820 ms

The timestamps and evaluation duration agree. The 108,257 ms arithmetic difference between total and build duration is not labelled runtime, repair, or provider latency because the permitted artifacts do not publish a disjoint timing decomposition.

## Evidence limits

- `NO EVIDENCE:` individual accounting for the two main unrecorded calls is absent from `observed.observedCalls`; only the bucket aggregate and `unrecordedCalls: 2` remain.
- `NO EVIDENCE:` a combined token/cost roll-up for all 21 evaluation calls is absent; `evaluation.llm` carries only the call count.
- `NO EVIDENCE:` per-call latency and timeout outcomes are absent from the permitted aggregate fields.
- `NO EVIDENCE:` repair's aggregate accounting object is null; its token totals above are bounded sums of the two typed repair records.

Only `bundle.complete.json`, `artifact-index.json`, `run.json`, `evaluation.json`, `snapshots/live-llm.json`, and the t223 routing report were read. No live/provider/browser action was taken.
