# Debug: run-mwblz4aq-0baa810a

Status: Failed as a deterministic series. All 4 answers were right (5 rows each), but attempt 1 saved no Flow, so attempts 2-4 explored again from blank, and no continuation held (`first_saved_nothing`, `second_explored_from_blank`). First live run of this task.
Source: t885 = dev 0871fb237 (extension) / 3766caea6 (Core).
Task: photo-social-priya-tags, unchanged, `--attempts 4`, visible browser. Lab run through `heavy-slot.mjs run t885 --priority`.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Per attempt

| Attempt | Verdict | Path | Flow | Continuation | Calls (interp / judge / decisions) | Time | Saved |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | right, 5 rows | explore | flow.e69501e2 | - | 53 (1/2/50) | 586 s | notes only: `not_assembled` |
| 2 | right | explore | flow.e69501e2 | not held | 17 (0/1/16) | 1068 s | partly_works (steps saved) |
| 3 | right | explore | flow.e69501e2 | not held | 8 (0/1/7) | 121 s | notes only: `not_assembled` |
| 4 | right | explore | flow.e69501e2 | not held | 3 (0/1/2) | 64 s | notes only: `not_assembled` |

Whole run $0.2057 (ledger). There was no S9 decision: no attempt replayed a saved Flow.

## Causes (to be traced)

1. **The draft never assembles** (0107, 0109, 0186): `flow_bootstrap.evidence_completion_plan_invalid`, `flow_draft.repeat_while_never_ends at draft.steps.32`. The model's "load more" repeat (four batches of comments plus replies) is refused as a loop that never ends, so attempt 1 saved notes only. Attempt 2 saved steps (`partly_works`), but attempt 3 found them unassemblable again and repaired them.
2. **The named-columns reader misreads this instruction** (0106, 0108, 0145, 0184, 0185): "the column after "author", "comment" runs on, and none of its leading words is a field this read reads", so the read declares no columns and stores everything.

## Next

Trace both (read-only while live runs continue), fix at the cause, then rerun this task at `--attempts 4`.
