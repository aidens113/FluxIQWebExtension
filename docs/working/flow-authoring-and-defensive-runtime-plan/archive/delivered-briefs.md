# Delivered briefs — flow-authoring-and-defensive-runtime-plan

The seven read-only discovery briefs, all delivered on 2026-09-22. Their
findings are distilled in the plan's `## Discovery Findings`; the full reports
are in `../reports/`.

### Brief: d1-exploration-to-flow-seam
Dispatched 2026-09-22. How a model-driven exploration becomes a saved Flow in
Core today, what is discarded between the two, whether a build can revise a node
it already proposed, and what a tool failure tells the model. Report:
`reports/d1-exploration-to-flow-seam.md`.

### Brief: d2-recording-artifact
Dispatched 2026-09-22. The exact shape of a recorded step after t063, where it is
captured and mapped, what expected-state checking exists at replay, and what a
recording cannot express that a model would need. Report:
`reports/d2-recording-artifact.md`.

### Brief: d3-runtime-execution-and-failure
Dispatched 2026-09-22. What happens when a Flow node fails: the execution path,
every retry that exists, what state checking runs, the exact conditions under
which the model is consulted, and what suppresses it. Report:
`reports/d3-runtime-execution-and-failure.md`.

### Brief: d4-target-resolution-defenses
Dispatched 2026-09-22. Every defensive mechanism that already exists for finding
and acting on an element, which are on by default, and whether the runtime keeps
enough evidence to detect an action that reported success and changed nothing.
Report: `reports/d4-target-resolution-defenses.md`.

### Brief: d5-existing-coverage
Dispatched 2026-09-22. Which parts of these designs the existing plans already
cover, already built, or leave absent, and any place where they would contradict
a decision already recorded. Report: `reports/d5-existing-coverage.md`.
