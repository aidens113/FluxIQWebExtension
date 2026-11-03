# Debug: run-mw0hzrhs-344f6976

## Result

The everything-store build worked end to end through the real extension chat and its judges accepted it. The finished Flow's own run then failed on its first step.

## Evidence

- Run: `run-mw0hzrhs-344f6976`
- Scenario and task: `everything-store`, `everything-store-kettle-to-cart`, Claude Sonnet 5.5
- Cost: $1.0621, 18 provider calls, no balance error, no build over its ceiling
- Build: every live `core.run_node` step succeeded, including clicks, typing and selects. The dry run replayed 11 steps. The judge answered yes on both calls, and the Flow was applied.
- Failure: `executor.fault.unclassified`, effect `unacted`, 0 ms, on the first node, `web.output.browser-navigate`, with `terminalFailureReason` `recovery.diagnosis_only`, `llm.failure_evidence_invalid` from the repair gate, and `messagePresent: true`.

The failure's message exists but the Lab's report leaves it out, and this isolated install was deleted when the run ended, so the thrown error cannot be read yet.

## What this rules out

- A zero-call replay of the saved t839 company-website Flow on the same pair commits passed, `replay-mw0ihtdq-12f19c63`: same Flow and graph hashes before and after, with a navigate as a first step. So navigate through a Flow's own run works when models are switched off.
- `output.target_preparer_missing` is a different code, so this is not a missing preparer.

## Not established

Whether the difference is this Flow, its click steps or the model-enabled run path, and whether plain `dev` fails the same way. No live run has passed through this path on `dev` since t842.

## Next action

Rerun once on a `persistent-isolated` workspace so the saved Flow survives. Then read the failure's message from its project database, and retest further with zero-call replays, which cost nothing.
