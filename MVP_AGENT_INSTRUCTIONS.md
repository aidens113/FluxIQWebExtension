# MVP_AGENT_INSTRUCTIONS.md

## Purpose

This file defines how AI coding agents should work on the FluxIQ browser MVP during the 30-day MVP cycle.

The authoritative product roadmap is:

`FluxIQ Web Extension — 30-Day MVP Implementation Plan`

This file is intentionally shorter and operational.

Its purpose is to answer:

- What should I work on next?
- Which repository should I modify?
- How do I decide whether a change belongs in the MVP?
- How do I validate my work?
- When is a task actually complete?

---

# 1. Repositories

The MVP spans two repositories:

## FluxIQ

Repository:

`https://github.com/aidens113/FluxIQ`

Responsibilities include:

- Generalized automation framework
- Flow/router/subflow behavior
- Runtime execution
- Harness integration
- State/evidence abstractions
- Adaptation lifecycle
- Recording interpretation
- Runtime history
- Generic domain APIs
- Advanced editor

FluxIQ core must remain domain-neutral.

Do not add browser-specific assumptions to core unless a genuinely reusable abstraction requires them.

---

## FluxIQWebExtension

Repository:

`https://github.com/aidens113/FluxIQWebExtension`

Responsibilities include:

- Web automation domain
- Browser observation
- Browser actions
- Browser-side state/evidence
- Recording browser events
- Element identity
- DOM interpretation
- Extension UI
- Simple Mode
- Scraping UX
- Browser interaction/runtime bridge

Browser-specific functionality should normally live here.

---

# 2. Core MVP Loop

All MVP work exists to improve this loop:

**Describe / Demonstrate → Generate → Validate → Execute → Detect Failure → AI Takeover → Explore → Repair → Verify → Persist → Deterministic Reuse**

A task is high priority if it materially improves one or more parts of this loop.

A task is low priority if it does not.

---

# 3. Work Selection Priority

When deciding what to work on next, use this order.

## Priority 0 — Broken Core Loop

Fix anything preventing:

**Create → Run → Adapt → Learn → Reuse**

Examples:

- Flow generation fails.
- Runtime cannot continue.
- Harness cannot access sufficient state.
- Recovery succeeds but cannot be persisted.
- Persisted adaptations are not selected on later runs.
- Learned behavior still invokes AI unnecessarily.

These issues override all other work.

---

## Priority 1 — Reliability

Fix supported behavior that works inconsistently.

Examples:

- Element targeting breaks on minor DOM changes.
- Expected states are detected unreliably.
- Extension/runtime synchronization fails.
- Browser actions execute inconsistently.
- Adaptations work only occasionally.

---

## Priority 2 — Simple UX

Improve access to already-working functionality.

Examples:

- Natural-language flow creation
- Recording flow
- Run progress
- Adaptation status
- Human takeover
- Recent runs
- Learned adaptation summaries

---

## Priority 3 — FluxBench Coverage

Add or improve tests for meaningful workflow/failure classes.

---

## Priority 4 — Scraping UX

Improve extraction, repeating structures, pagination, output, and scraper creation.

---

## Priority 5 — Advanced Features

Only work here after higher priorities are healthy.

---

# 4. Scope Check Before Coding

Before making a substantial change, answer:

1. Which MVP week does this belong to?
2. Which phase does this satisfy?
3. Which acceptance criterion does it improve?
4. Which benchmark or user-visible problem does it address?

If the task cannot answer at least one of these clearly, defer it.

Do not implement features solely because they seem useful.

---

# 5. Current MVP Week Structure

## Week 1

Focus:

**Web automation reliability**

Primary areas:

- Browser action vocabulary
- Element identity
- Browser evidence/state
- Failure taxonomy
- FluxBench

Do not spend significant effort on visual polish.

---

## Week 2

Focus:

**Runtime adaptation loop**

Primary areas:

- Failure capture
- Diagnosis
- Exploration
- Recovery detection
- Adaptation generation
- Validation
- Persistence
- Deterministic reuse

This is the highest-value technical portion of the MVP.

---

## Week 3

Focus:

**Simple Mode and scraping UX**

Primary areas:

- Natural-language creation
- Demonstration/recording
- Runtime progress
- Adaptation UI
- Advanced Editor entry point
- Scraping
- Human takeover

---

## Week 4

Focus:

**Hardening and release**

Primary areas:

- Bugs
- Reliability
- Onboarding
- Security/privacy
- AI cost controls
- Diagnostics
- Packaging
- Release qualification

Major new features should be frozen.

---

# 6. Required Workflow Before Implementation

For each task:

## Step 1 — Inspect Existing Code

Search both repositories when the responsibility is unclear.

Do not assume functionality is missing.

Look for:

- Existing interfaces
- Existing runtime hooks
- Similar node/output types
- Existing recording mappings
- Existing state/evidence systems
- Existing adaptation code
- Existing UI components

Avoid duplicate abstractions.

---

## Step 2 — Identify Correct Ownership

Ask:

> Is this generalized automation behavior or browser-specific behavior?

Generalized behavior belongs in FluxIQ.

Browser-specific behavior belongs in FluxIQWebExtension.

Do not put browser concepts into FluxIQ core simply because doing so is faster.

---

## Step 3 — Understand Current Data Flow

Before modifying a pipeline, trace it end-to-end.

For example:

**Browser Event → Extension Domain Input → Recording → Generated Node → Runtime Output → Browser Action → State Observation**

Or:

**Runtime Failure → Failure Context → Harness → Exploration → Successful Path → Adaptation → Router/Subflow Update → Future Runtime Selection**

Do not patch one layer without understanding adjacent layers.

---

## Step 4 — Make the Smallest Coherent Change

Prefer changes that:

- Reuse existing architecture.
- Solve the target problem completely.
- Avoid creating parallel systems.
- Preserve backward compatibility where reasonable.
- Remain observable/debuggable.

---

## Step 5 — Validate

Run relevant:

- Unit tests
- Integration tests
- Build checks
- Extension builds
- Type checks
- FluxBench workflows

Do not mark work complete solely because code compiles.

---

# 7. FluxBench Rules

FluxBench is the primary MVP regression system.

Changes affecting any of these areas must be benchmarked:

- Flow generation
- Browser execution
- Target resolution
- State/evidence
- Failure detection
- Harness behavior
- Adaptation
- Persistence
- Routing

Track at minimum:

- Creation success
- First-run success
- Deterministic replay success
- Fuzzy recovery success
- Harness activation rate
- Harness recovery rate
- Adaptation validation
- Adaptation persistence
- Adaptation reuse
- AI usage

---

# 8. Primary Metric

The most important MVP metric is:

## Adaptation Reuse Rate

Definition:

> Percentage of successfully AI-resolved problems that FluxIQ later handles without another LLM intervention.

A successful recovery is not sufficient.

The learned solution should become reusable automation.

Whenever an adaptation is implemented or modified:

1. Trigger the failure.
2. Allow FluxIQ to recover.
3. Persist the repair.
4. Run the workflow again.
5. Confirm the repaired situation is handled deterministically.

---

# 9. Deterministic-First Rule

Recovery preference should generally be:

1. Existing deterministic path
2. Known persisted adaptation
3. Evidence-based/fuzzy deterministic recovery
4. AI intervention

Do not invoke an LLM for problems the system can solve cheaply and confidently.

The desired behavior is:

**Use intelligence for novelty.**

Not:

**Use intelligence because execution occurred.**

---

# 10. Harness Rules

The harness must not behave as an unconstrained browser agent.

Runtime adaptation should follow:

**Diagnose → Plan → Explore → Recover → Convert → Validate → Persist**

Do not skip directly from failure to arbitrary action unless absolutely necessary.

Exploration must have bounds.

Support limits for:

- Actions
- LLM turns
- Tokens/cost
- Duration
- Domains
- Retries
- Destructive actions

Exploration must terminate cleanly.

---

# 11. Adaptation Rules

Raw exploration is not the final artifact.

Example:

Bad persisted behavior:

`Inspect → Scroll → Wrong Click → Back → Inspect → Correct Click → Wait`

Preferred persisted behavior:

`Correct Click → Wait`

Successful exploration should be reduced into the smallest useful reusable automation.

Preserve:

- Relevant target evidence
- New state knowledge
- Routing knowledge
- Required action sequence
- Expected outcome
- Adaptation provenance
- Confidence

---

# 12. Validation Rule

Do not permanently modify a flow just because an agent eventually succeeded.

Where practical:

1. Reconstruct the relevant input state.
2. Execute the proposed adaptation deterministically.
3. Verify the expected output.
4. Assign confidence.
5. Promote only when sufficiently validated.

Use conceptual confidence levels:

- High
- Medium
- Low

Low-confidence adaptations should not silently replace stable behavior.

---

# 13. Element Targeting Rule

Do not rely exclusively on fragile selectors.

Target identity should use combinations of:

- Selector
- ID
- Role
- Accessible name
- Text
- Href
- Attributes
- Nearby labels
- Structural relationships
- Form context
- Historical evidence

Minor DOM changes should preferably be resolved before AI intervention.

---

# 14. State/Evidence Rule

Prefer compact semantic evidence over enormous raw DOM dumps.

Evidence should help answer:

- What page are we on?
- What interactive elements are available?
- What changed?
- What action just happened?
- What state was expected?
- What state currently exists?
- What is blocking progress?

Only expose additional raw data when needed.

---

# 15. Failure Rule

Avoid generic failures such as:

`NODE_FAILED`

Use structured failure information.

Common categories include:

- `TARGET_NOT_FOUND`
- `TARGET_AMBIGUOUS`
- `STATE_MISMATCH`
- `NAVIGATION_UNEXPECTED`
- `OUTPUT_NOT_OBSERVED`
- `ACTION_REJECTED`
- `TIMEOUT`
- `PAGE_CHANGED`
- `AUTH_REQUIRED`
- `USER_INTERVENTION_REQUIRED`
- `UNKNOWN`

Failure context should help the harness reason without rediscovering everything.

---

# 16. UI Rule

Simple Mode and Advanced Editor serve different audiences.

## Simple Mode

Optimize for users who want:

> Automate this.

Do not require them to understand:

- Nodes
- Routers
- Evidence
- Policies
- State schemas
- Runtime internals

---

## Advanced Editor

Preserve transparency for power users.

Allow inspection/editing of:

- Routers
- Subflows
- Nodes
- State
- Evidence
- Actions
- Expected outputs
- Recordings
- Runs
- Adaptations
- Runtime traces

Do not remove advanced functionality merely to simplify Simple Mode.

---

# 17. User-Visible Adaptation Rule

When AI intervention occurs, the UI should clearly distinguish it from normal execution.

Users should understand:

1. Something unexpected happened.
2. FluxIQ temporarily used AI.
3. FluxIQ found a solution or failed cleanly.
4. If successful, FluxIQ learned the solution.
5. Future runs may now handle it without AI.

Do not expose hidden chain-of-thought.

Provide concise summaries instead.

---

# 18. Instrumentation Rule

Important behavior should be observable.

Capture enough structured information to answer:

- Why was this path selected?
- Which target was resolved?
- Why did execution fail?
- Why did AI activate?
- What actions occurred during exploration?
- What repair was created?
- Was the repair validated?
- Was it selected on the next run?
- Did the next run avoid AI?

Instrumentation is part of the MVP.

---

# 19. Do Not Scope Creep

Unless required by an MVP blocker, do not prioritize:

- Slack
- Discord
- Large SaaS integration ecosystem
- n8n-style application catalog
- Desktop automation
- Mobile automation
- Marketplace
- Team collaboration
- Enterprise RBAC
- Complex hosted infrastructure
- Large proxy systems
- Advanced ML rankers
- Major unrelated framework refactors

These are post-MVP concerns.

---

# 20. Cloud Execution

Cloud execution is not required for the initial 30-day MVP unless explicitly reprioritized.

Do not allow cloud infrastructure work to displace:

- Core adaptation reliability
- Local execution
- Simple Mode
- Scraping
- Release hardening

Local execution is sufficient to validate the MVP thesis.

---

# 21. Definition of Done for a Coding Task

A task is complete only when:

1. The intended behavior is implemented.
2. Existing related architecture was reused where appropriate.
3. Ownership between FluxIQ and FluxIQWebExtension is correct.
4. Relevant tests pass.
5. Builds/type checks pass.
6. Relevant real workflow is tested.
7. FluxBench is updated when necessary.
8. Observability/logging is sufficient.
9. No obvious regression is introduced.
10. Acceptance criteria for the associated MVP phase are satisfied.

"Code written" is not equivalent to "done."

---

# 22. Definition of Done for an Adaptation Feature

An adaptation feature is complete only when the following sequence has been demonstrated:

**Normal Execution**

→ unexpected state

→ failure correctly identified

→ harness activates

→ relevant context supplied

→ diagnosis performed

→ bounded exploration performed

→ valid recovery discovered

→ exploration converted into reusable behavior

→ repair validated

→ repair persisted

→ current run continues when possible

→ subsequent run encounters same condition

→ learned behavior executes

→ no unnecessary LLM call occurs

Anything short of this does not prove the complete FluxIQ loop.

---

# 23. Decision Rule for Refactors

Refactor existing systems only when at least one is true:

1. Current architecture prevents an MVP requirement.
2. Current architecture causes serious reliability problems.
3. Existing duplication is producing active bugs.
4. Required functionality cannot reasonably be added without the refactor.

Do not refactor solely because another design appears cleaner.

During the MVP cycle:

> **Working and understandable beats theoretically perfect.**

---

# 24. Agent Handoff Requirements

Before ending a meaningful implementation session, leave enough information for the next agent to continue.

Document:

- What was changed
- Why it was changed
- Files/modules affected
- Tests performed
- FluxBench scenarios performed
- Known failures
- Remaining work
- Recommended next task

Do not leave partially implemented behavior undocumented.

---

# 25. Release Rule

The MVP should be released when the core experience works at a reasonably good level.

Do not delay release because FluxIQ could support more features.

The MVP needs to prove:

**Create → Run → Encounter Novelty → Adapt → Learn → Reuse**

If that loop works well enough for external users, ship it.

---

# 26. North Star

When uncertain about a technical or product decision, ask:

> **Does this help FluxIQ convert expensive intelligence into reusable automation?**

The desired runtime pattern is:

**Novel situation → AI reasoning → Learned automation → Cheap deterministic reuse**

Not:

**Execution → AI → Execution → AI → Execution → AI**

The cost of intelligence should correlate primarily with encountering new information, not with the number of times an automation executes.