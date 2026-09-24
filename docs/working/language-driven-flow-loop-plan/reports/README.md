# Reports — Language-Driven Flow Loop

Worker reports for [the language-driven Flow loop](../../language-driven-flow-loop-plan.md).
Each is one worker's account of one brief: what it changed, what it validated,
and what it did not verify. A report is a claim the supervisor checks, never a
result on its own.

| Report | Subject |
| --- | --- |
| [scenario-inventory.md](./scenario-inventory.md) | All 134 live tasks classified single-node or multi-node, the action chain each complex one needs, and the verbatim run commands. |
| [run-evidence-audit.md](./run-evidence-audit.md) | Whether one run can be post-mortemed from its own artifacts, demonstrated against a real failed multi-step run, with each gap traced to the line that drops it. |
| [mvp-capability-status.md](./mvp-capability-status.md) | Deterministic replay, automatic repair and self-judgement: what exists, what is wired, what is absent, and what breaks first on a multi-node Flow. |
| [t124-core-e3-e4-e5.md](./t124-core-e3-e4-e5.md) | Core's side: emitting the per-row fields it already kept, and a per-call ledger for builds. |

Reports for the t124 instrumentation briefs are written on the task branch
`task/t124-phase0-debuggable-run` and arrive here when it merges.
