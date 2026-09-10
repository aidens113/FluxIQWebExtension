# FluxIQ Web Extension — 30-Day MVP Implementation Plan

## 1. MVP Objective

The goal of this 30-day development cycle is to ship a usable MVP of FluxIQ focused specifically on adaptive browser automation through the FluxIQ Web Extension.

The MVP must prove the core FluxIQ product thesis:

> **Use AI to create, understand, and repair automations when intelligence is required. Convert successful intelligence into reusable deterministic automation so ordinary executions do not require repeated LLM usage.**

The primary product loop is:

**Describe / Demonstrate → Generate → Validate → Execute → Detect Failure → AI Takeover → Explore → Repair → Verify → Persist → Deterministic Reuse**

Every task during this development cycle must directly improve this loop, its reliability, or its usability.

---

# WEEK 1 — WEB AUTOMATION RELIABILITY

## Week 1 Objective

Create a reliable browser automation foundation that allows FluxIQ to execute real workflows, understand browser state, identify failures precisely, and provide high-quality evidence to the runtime harness.

Visual polish is secondary during this week.

---

## Phase 1.1 — Audit Existing Web Domain

### Objective

Establish exactly what the current `web-automation` domain can observe, record, and execute.

### Steps

1. Inventory all existing:
   - Inputs
   - Outputs
   - State providers
   - Evidence providers
   - Recording events
   - Recording → output mappings
   - Runtime adapters
   - Browser events

2. Classify every browser capability as:
   - Fully supported
   - Partially supported
   - Unsupported
   - Unreliable

3. Verify that recorded user actions correctly map to executable outputs.

4. Identify functionality duplicated between FluxIQ core and FluxIQWebExtension.

5. Ensure browser-specific behavior remains inside the web domain rather than leaking into FluxIQ core.

6. Identify any old/dead APIs remaining from previous architectural iterations.

### Deliverable

Create a definitive browser capability matrix that can be used by subsequent phases.

### Exit Criteria

- Every browser capability exposed to FluxIQ has a defined purpose.
- Recording mappings are understood.
- Unsupported capabilities are documented.
- Technical debt affecting the MVP loop is identified.

---

## Phase 1.2 — Complete MVP Browser Action Vocabulary

### Objective

Support the interactions required for useful browser workflows.

### Required Capabilities

Verify or implement reliable support for:

- Navigate
- Click
- Type text
- Clear text
- Keyboard input
- Select/dropdown interaction
- Scroll
- Wait
- Extract text
- Extract attributes
- Structured extraction
- Repeating/list elements
- Pagination
- Open tab
- Switch tab
- Close tab
- Downloads
- Basic file uploads
- Form interaction
- Dynamic elements
- Modal/dialog interaction
- URL checks
- Element existence checks
- Element nonexistence checks

### Rules

Do not add obscure browser actions merely for completeness.

Add capabilities because:

1. FluxBench requires them, or
2. A major real-world browser workflow requires them.

### Exit Criteria

For every required capability FluxIQ can:

1. Represent it.
2. Execute it.
3. Observe the resulting browser state.
4. Validate expected outcomes where applicable.

---

## Phase 1.3 — Strengthen Element Identity

### Objective

Prevent minor DOM changes from unnecessarily invoking AI.

A target must not conceptually be represented only as:

`click("#generated-element-39201")`

### Target Evidence

Element identity should support combinations of:

- Stable selector
- DOM ID
- Element role
- Accessible name
- Visible text
- `href`
- Relevant attributes
- Nearby label
- Parent/child relationships
- Structural context
- Form context
- Previously observed evidence
- Historical target identity

### Resolution Pipeline

Implement or improve three resolution levels.

#### Level 1 — Exact Resolution

Use highly reliable deterministic identifiers.

#### Level 2 — Evidence-Based/Fuzzy Resolution

Combine available signals to identify the intended target despite superficial page changes.

#### Level 3 — AI Intervention

Invoke the runtime harness only when deterministic/evidence-based resolution is insufficient or unsafe.

### Important Principle

Do not spend LLM reasoning on problems FluxIQ can resolve cheaply and confidently itself.

### Exit Criteria

Common superficial changes such as:

- Generated class changes
- Small DOM movement
- Additional wrappers
- Minor text variation
- Equivalent accessible-name changes

do not automatically break workflows.

---

## Phase 1.4 — Improve Browser State and Evidence

### Objective

Give FluxIQ enough information to understand the browser without dumping unnecessary full-page DOM data.

### Improve Evidence For

- Interactive elements
- Visible text
- Forms
- Current URL
- Page title
- Navigation state
- Dialogs/modals
- Relevant page regions
- Repeating structures
- Selected elements
- Recently interacted elements
- Changed elements
- Relevant attributes
- Loading state
- Potential blocking overlays
- Expected-state evidence

### Evidence Requirements

Evidence should be:

- Compact
- Semantically meaningful
- Stable where possible
- Easy for deterministic systems to compare
- Easy for LLMs to understand
- Reconstructable enough to explain what FluxIQ currently "sees"

### Exit Criteria

Given current evidence and recent history, the harness can form an accurate conceptual understanding of the browser state without requiring arbitrary raw DOM dumps.

---

## Phase 1.5 — Explicit Failure Taxonomy

### Objective

Replace generic execution failures with actionable diagnoses.

### Minimum Failure Types

Standardize categories equivalent to:

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

### Capture With Failures

Where available:

- Current node
- Current subflow
- Expected state
- Actual state
- Previous state
- Failed action
- Failed target
- Current URL
- Recent events
- Retry history
- Relevant browser evidence
- Timing information
- Previous adaptations involved

### Example

Avoid:

`Execution failed.`

Prefer:

> Expected search-results state after submitting the search form. The click executed successfully, URL did not change, and the expected results container was not observed within the configured timeout.

### Exit Criteria

The runtime harness receives enough structured information to reason about *why* execution stopped progressing.

---

## Phase 1.6 — Build FluxBench Web MVP

### Objective

Create a repeatable benchmark suite that drives engineering decisions for the remainder of the month.

### Target

Approximately 20–30 real browser workflows.

### Workflow Categories

Include examples covering:

- Simple extraction
- Paginated extraction
- Table extraction
- Search
- Multi-page navigation
- Forms
- Dynamic interfaces
- Modals
- Infinite scrolling
- Downloads
- Multiple tabs
- Conditional behavior
- Authentication-compatible workflows
- Changed selectors
- Changed text
- Moved elements
- Unexpected popup
- Unexpected intermediate state

### Record Metrics

Track:

- Flow creation success rate
- Initial execution success rate
- Deterministic replay success rate
- Fuzzy recovery rate
- Harness activation rate
- Harness recovery rate
- False failure rate
- Average AI adaptation cost
- Adaptation validation rate
- Adaptation persistence rate
- Adaptation reuse rate

### Primary MVP Metric

## Adaptation Reuse Rate

Definition:

> **Percentage of problems successfully resolved using AI that FluxIQ subsequently handles without another LLM intervention.**

This metric directly tests FluxIQ's technical and economic thesis.

---

## Week 1 Exit Criteria

Do not consider Week 1 complete until:

- Core browser actions are reliable.
- Browser evidence is useful.
- Target matching has deterministic fallback behavior.
- Failures are meaningfully classified.
- FluxBench exists and produces repeatable measurements.
- Major browser-domain reliability blockers have been identified.

---

# WEEK 2 — COMPLETE THE ADAPTATION LOOP

## Week 2 Objective

Make FluxIQ capable of detecting unexpected situations, understanding them, autonomously exploring solutions, validating successful solutions, and converting those solutions into persistent reusable automation.

This week represents the primary technological differentiator of the MVP.

---

## Phase 2.1 — Standardize Adaptation Context

### Objective

Whenever deterministic execution cannot continue, create a complete but focused context package for the harness.

### Capture

At minimum:

- Current browser state
- Expected state
- Previous browser state
- Current node
- Previous successful nodes
- Current subflow
- Router context
- Current URL
- Recent browser events
- Relevant DOM evidence
- Failed target
- Failed action
- Previous attempts
- Existing adaptations
- Relevant recording context
- Current automation objective

### Requirement

Avoid indiscriminately feeding the entire automation history to the model.

Retrieve the most relevant context first.

### Exit Criteria

The harness receives enough contextual information to reason about the failure without requiring manual developer intervention.

---

## Phase 2.2 — Separate Diagnosis From Exploration

### Objective

Prevent the harness from immediately clicking around before understanding what went wrong.

### Stage A — Diagnose

Determine:

- What was expected?
- What actually happened?
- What appears to have changed?
- Is the original task still achievable?
- Can deterministic recovery solve it?
- Is AI exploration actually necessary?

### Stage B — Plan

Create a bounded recovery strategy.

### Stage C — Explore

Interact with the browser and observe resulting states.

### Exit Criteria

Runtime traces clearly distinguish:

**Diagnosis → Recovery Plan → Exploration → Resolution**

---

## Phase 2.3 — Bounded Harness Exploration

### Objective

Allow autonomous exploration without uncontrolled agent loops.

### Implement Limits For

- Maximum exploration actions
- Maximum LLM turns
- Maximum token/cost budget
- Maximum execution duration
- Allowed domains
- Cross-domain navigation
- Destructive actions
- Retry count
- Repeated unsuccessful action patterns

### Required Completion States

Exploration must terminate cleanly as one of:

- `RECOVERED`
- `FAILED`
- `USER_INTERVENTION_REQUIRED`
- `BUDGET_EXHAUSTED`
- `UNSAFE_ACTION_BLOCKED`

### Exit Criteria

The harness cannot enter indefinite reasoning/execution loops.

---

## Phase 2.4 — Recovery Success Detection

### Objective

Determine whether exploration actually solved the original problem.

### Principle

An action succeeding does **not** mean recovery succeeded.

Recovery succeeds when the original expected state, output, or equivalent valid continuation state has been reached.

### Validate Against

- Expected browser state
- Expected output
- Expected URL/navigation
- Required evidence
- Router continuation requirements

### Exit Criteria

FluxIQ can confidently determine whether normal deterministic execution can resume.

---

## Phase 2.5 — Convert Exploration Into Reusable Automation

### Objective

Do not persist raw agent exploration.

Persist what the agent learned.

### Example

Agent exploration:

`Observe → Scroll → Wrong Click → Back → Inspect → Correct Click → Wait → Success`

Persisted repair:

`Correct Click → Wait for Expected State`

### Steps

1. Analyze the successful exploration trajectory.
2. Identify actions that contributed to success.
3. Remove failed experimentation.
4. Remove redundant observation/actions.
5. Produce the minimum useful deterministic path.
6. Generate appropriate action nodes.
7. Generate input-state expectations.
8. Generate output-state expectations.
9. Modify routing conditions if required.
10. Preserve provenance explaining why the adaptation exists.

### Critical Principle

> **Agent exploration is disposable. Learned automation is the product.**

### Exit Criteria

A successful AI recovery produces a meaningful automation modification rather than merely an execution transcript.

---

## Phase 2.6 — Validate Proposed Adaptations

### Objective

Prevent accidental success from permanently modifying flows.

### Validation Process

Where practical:

1. Reconstruct or restore the relevant input state.
2. Execute the proposed repaired path deterministically.
3. Observe resulting state.
4. Compare against expected outcome.
5. Assign confidence.
6. Decide whether to promote.

### Confidence Model

Support conceptually:

#### High Confidence

- Validation succeeded.
- Persist automatically.

#### Medium Confidence

- Use during current execution.
- Retain provisionally.
- Validate through subsequent executions.

#### Low Confidence

- Do not silently modify permanent behavior.
- Request user approval or retain as proposed adaptation.

### Exit Criteria

Successful exploration is not automatically treated as permanently correct.

---

## Phase 2.7 — Persist Adaptations

### Objective

Update the actual flow/router/subflow structure with validated knowledge.

### Persist

- New deterministic path
- Changed routing requirements
- New state requirements
- Updated target identity
- Relevant evidence
- Adaptation confidence
- Adaptation source/provenance
- Timestamp/version information

### Exit Criteria

The repaired behavior becomes part of normal future execution.

---

## Phase 2.8 — Resume Current Execution

### Objective

An adaptation should not unnecessarily terminate the entire automation.

### Expected Flow

`Failure → Adapt → Validate → Persist → Resume`

Resume from the most appropriate continuation point rather than restarting everything unless restarting is necessary.

### Exit Criteria

Successful adaptations allow the current workflow to continue.

---

## Phase 2.9 — Prove Deterministic Reuse

### Objective

Complete FluxIQ's economic loop.

For every successful adaptation benchmark:

1. Re-run the workflow.
2. Encounter the previously novel situation.
3. Confirm that learned behavior is selected.
4. Confirm that the LLM does not activate unnecessarily.
5. Record the result in FluxBench.

### Critical Question

> Can FluxIQ solve today, using cheap deterministic execution, something it required AI to understand yesterday?

### Week 2 Exit Criteria

Week 2 is complete when FluxIQ reliably demonstrates:

**Fail → Diagnose → Explore → Recover → Generate Repair → Validate → Persist → Resume → Re-run Deterministically**

If this loop is unreliable, improving it remains higher priority than Week 3 feature expansion.

---

# WEEK 3 — SIMPLE UX AND FIRST-CLASS SCRAPING

## Week 3 Objective

Turn the existing technical system into a browser product usable by someone who does not understand FluxIQ architecture.

The existing advanced editor should remain available but become optional.

---

## Phase 3.1 — Establish Simple Mode

### Objective

Simple Mode becomes the default browser-extension experience.

### Primary Screen

Expose:

- Natural-language automation input
- "Show FluxIQ how" recording action
- "Extract data from this page"
- Recent automations
- Run controls
- Automation status

### Do Not Expose By Default

- Policy internals
- Evidence weights
- Fingerprints
- State schemas
- Router internals
- Component definitions
- Raw traces

### Exit Criteria

A new user can create and execute an automation without understanding nodes, routers, policies, state systems, or FluxIQ architecture.

---

## Phase 3.2 — Natural-Language Creation UX

### Objective

Allow users to create useful automations directly from intent.

### Example

> Search this website for laptops under $1,000 and save their names, prices, ratings, and URLs.

### Execution Flow

**Intent → Harness Understanding → Flow Generation → Validation → Runnable Automation**

### UX Requirements

Display useful creation progress without dumping internal LLM reasoning.

Examples:

- Understanding task
- Inspecting page
- Building automation
- Testing
- Ready

### Exit Criteria

Natural-language requests can create runnable browser automations without manual node editing for supported tasks.

---

## Phase 3.3 — Demonstration/Recording UX

### Objective

Turn recording into a polished user-facing teaching mechanism.

### Flow

**Start Recording → Perform Task → Stop Recording → Analyze → Generate → Test → Save**

### Improve

- Clear recording state
- Recording start/stop
- Event feedback
- Notes/narration where supported
- Ability to remove mistaken steps
- Clear analysis state
- Automation preview
- Test generated automation

### Exit Criteria

Recording feels like a product feature rather than an internal development/debug interface.

---

## Phase 3.4 — Runtime Progress UX

### Objective

Make execution understandable without exposing implementation noise.

### Example

`✓ Open website`

`✓ Search products`

`✓ Read results`

`→ Next page`

`18 / 50 products`

### Required Statuses

- Ready
- Running
- Waiting
- Paused
- Adapting
- User action required
- Completed
- Failed
- Stopped

### Exit Criteria

Users can understand what the automation is doing and whether progress is occurring.

---

## Phase 3.5 — Adaptation UX

### Objective

Turn runtime adaptation into a visible differentiating product experience.

### Example

> **Adapting**
>
> This page is different from previous runs.
>
> FluxIQ is finding another way...
>
> ✓ Found the replacement control  
> ✓ Verified the result  
> ✓ Automation updated
>
> Continuing...

After successful persistence:

> **Future runs will use this adaptation automatically.**

### Avoid

Do not expose raw chain-of-thought or overwhelming internal traces.

Provide concise summaries of:

- What changed
- What FluxIQ did
- Whether recovery succeeded
- Whether the automation learned the solution

### Exit Criteria

A normal user understands that:

1. Something unexpected happened.
2. AI temporarily intervened.
3. FluxIQ solved it.
4. The automation learned from it.

---

## Phase 3.6 — Advanced Editor Escape Hatch

### Objective

Maintain FluxIQ's transparency and power-user capabilities.

Add an obvious but secondary:

**Open Advanced Editor**

### Advanced Editor Can Expose

- Routers
- Subflows
- Nodes
- State
- Evidence
- Actions
- Expected outputs
- Recordings
- Previous runs
- Adaptations
- Runtime traces
- Generated structures

### Principle

Simple Mode should be an abstraction over FluxIQ, not a replacement for FluxIQ.

### Exit Criteria

Technical users retain access to the underlying automation system without forcing complexity onto normal users.

---

## Phase 3.7 — First-Class Scraping UX

### Objective

Use web scraping as a major acquisition/use case without limiting FluxIQ's identity to scraping.

### Primary Entry Point

**Extract Data From This Page**

### Support

- Select example element
- Detect repeating structures
- Infer fields
- Add/remove fields
- Rename fields
- Text extraction
- Attribute extraction
- Links
- Pagination
- Infinite scrolling where practical
- Current page
- All pages
- Structured preview
- CSV
- JSON

### Example

**Products detected**

- ✓ Name
- ✓ Price
- ✓ Rating
- ✓ URL
- □ Image
- □ Availability

**Pages**

- Current page
- All pages

**Output**

- CSV
- JSON

### Important Requirement

The resulting scraper should still compile down into normal FluxIQ flows/subflows so runtime adaptation can repair it like any other automation.

### Exit Criteria

A user who only wants a web scraper can install FluxIQ and get useful structured data without entering Advanced Editor.

---

## Phase 3.8 — Human Takeover

### Objective

Keep the user in control when automation cannot safely continue.

### Support

- Pause
- Resume
- Stop
- Take control
- Return control to FluxIQ
- Continue after manual user action
- Approve adaptation
- Reject adaptation

### Example

For authentication/CAPTCHA/manual verification:

> User action required. Complete verification in the browser, then select Continue.

### Exit Criteria

Automations do not become dead-ended merely because a human interaction is required.

---

## Phase 3.9 — Recent Runs and Learned Adaptations

### Objective

Make FluxIQ's learning behavior visible after execution.

### Show

For each run:

- Success/failure
- Runtime
- Whether AI was used
- Adaptations created
- Whether adaptations were validated
- Whether future runs now use them

### Example

> **Run #18**
>
> Completed in 14.2s  
> AI activated once  
> Learned 1 new page variation  
> Future runs updated

### Exit Criteria

Users can understand that their automation becomes more capable over time.

---

## Week 3 Exit Criteria

A nontechnical user can complete:

**Install → Describe/Demonstrate → Generate → Run → Observe → Encounter Change → Watch Adaptation → Re-run Learned Automation**

without using Advanced Editor.

---

# WEEK 4 — HARDEN, PACKAGE, AND RELEASE

## Week 4 Objective

Stop expanding the framework and convert the existing implementation into a trustworthy MVP product.

Feature development should be frozen except for MVP-blocking issues.

---

## Phase 4.1 — Feature Freeze

### Allowed Work

Only:

- Reliability
- Bug fixes
- UX improvements
- Performance
- Onboarding
- Security/privacy
- Diagnostics
- Release requirements
- Benchmark failures

### Explicitly Deferred

Do not implement:

- Generic Slack integration
- Discord integration
- Large integration ecosystem
- n8n-style integration catalog
- Desktop automation
- Mobile automation
- Team collaboration
- Enterprise RBAC
- Marketplace
- Hundreds of new node types
- Major framework redesign
- Unnecessary ML systems
- Complex cloud infrastructure

### Exit Criteria

All engineering effort is concentrated on shipping the browser MVP.

---

## Phase 4.2 — Onboarding

### Objective

Achieve:

## Installation → First Successful Automation < 5 Minutes

### Suggested Flow

1. Install FluxIQ extension.
2. Connect/start FluxIQ runtime.
3. Configure account/model if required.
4. Present three obvious options:
   - Describe an automation
   - Show FluxIQ how
   - Extract data from this page
5. Create automation.
6. Test automation.
7. Save.
8. Run.

### Onboarding Message

Explain the core concept briefly:

> FluxIQ uses AI to build and adapt your automation, then reuses what it learns so routine runs can execute without repeatedly relying on AI.

### Exit Criteria

A new user can successfully create something useful without reading extensive documentation.

---

## Phase 4.3 — Reliability Hardening

### Test

- Extension reconnect
- Runtime reconnect
- Browser restart
- Extension reload
- Tab closure
- Unexpected navigation
- Page reload
- Network failure
- Partial execution
- Interrupted adaptation
- Runtime crash
- Stop behavior
- Pause/resume
- Human takeover
- Saved automation recovery
- Invalid browser state
- LLM/API failure
- LLM timeout
- Missing permissions
- Invalid saved state

### Requirement

Failures should leave the system in a known recoverable state whenever possible.

### Exit Criteria

Common operational failures result in understandable behavior rather than silent corruption.

---

## Phase 4.4 — Credentials and Sensitive Data

### Objective

Ensure browser automation does not unnecessarily expose sensitive information.

### Review

- Password inputs
- Cookies
- Authentication tokens
- API keys
- Recorded text
- Form values
- State snapshots
- LLM context
- Execution logs
- Recordings
- Previous runs
- Adaptation traces
- Exported data

### Rules

Sensitive information should:

- Not be recorded when unnecessary.
- Not be logged in plaintext unnecessarily.
- Not be sent to an LLM without purpose.
- Be redacted from debugging output where appropriate.
- Have explicit handling rules.

### Exit Criteria

FluxIQ has deliberate and documented sensitive-data behavior.

---

## Phase 4.5 — AI Cost and Model Controls

### Objective

Measure and constrain the expensive portion of FluxIQ.

### Track

- LLM calls per flow creation
- LLM calls per run
- LLM calls per adaptation
- Tokens per flow creation
- Tokens per adaptation
- Adaptations per 100 executions
- Creation cost
- Adaptation cost
- Total AI cost per workflow
- AI cost per 100 successful executions

### User Controls

Where appropriate:

- Provider
- Model
- BYOK
- AI adaptation enabled/disabled
- Exploration budget
- Maximum adaptation cost
- Automatic adaptation policy

### Critical Business Metric

## AI Cost per 100 Successful Executions

FluxIQ should demonstrate that marginal intelligence cost decreases as workflows become learned and deterministic.

### Exit Criteria

AI spending is measurable, bounded, and attributable.

---

## Phase 4.6 — Performance Pass

### Objective

Ensure instrumentation does not make FluxIQ feel slower than ordinary deterministic automation.

### Profile

- State snapshot generation
- Evidence processing
- Target resolution
- Extension ↔ runtime communication
- Node execution
- Event recording
- Runtime logging
- Flow loading
- UI rendering
- Adaptation initialization

### Optimize

Prioritize bottlenecks visible to users.

### Exit Criteria

Normal deterministic runs feel fast and do not appear agentic when AI is unnecessary.

---

## Phase 4.7 — FluxBench Release Qualification

### Objective

Use benchmark results rather than intuition to decide whether MVP blockers remain.

### Run Full Suite Repeatedly

Measure:

- Creation success
- First-run success
- Repeated deterministic success
- Target recovery success
- Failure detection accuracy
- Harness recovery success
- Adaptation validation
- Adaptation persistence
- Adaptation reuse
- LLM usage
- Runtime performance

### Prioritize Failures By

1. Frequency
2. User impact
3. Reproducibility
4. Impact on core FluxIQ thesis
5. Difficulty to resolve

### Do Not

Delay release to fix obscure edge cases with minimal practical impact.

---

## Phase 4.8 — Product Diagnostics

### Objective

Make bugs diagnosable after external users begin testing.

### Capture

- FluxIQ version
- Extension version
- Browser/version
- Flow ID
- Run ID
- Failed node
- Failure category
- Non-sensitive relevant state
- Runtime events
- Adaptation state
- Error stack where applicable

### Provide

A simple mechanism for users to:

**Report Problem**

with relevant diagnostics attached after redaction.

### Exit Criteria

External reports contain enough information to reproduce common failures.

---

## Phase 4.9 — Extension Packaging

### Complete

- Production Chrome build
- Chrome Web Store packaging
- Firefox build where practical
- Versioning
- Production configuration
- Permissions review
- Extension icons/assets
- Store screenshots
- Store description
- Privacy policy
- Basic documentation
- Installation documentation
- Update behavior
- Diagnostics/reporting path

### Exit Criteria

A clean production build can be installed by someone outside the development environment.

---

## Phase 4.10 — Release Candidate Testing

### Objective

Simulate actual first-time users.

### Process

Use clean environments with no existing FluxIQ configuration.

Test:

1. Install extension.
2. Install/start FluxIQ runtime.
3. Complete onboarding.
4. Create a natural-language automation.
5. Create a recorded automation.
6. Create a scraper.
7. Execute them repeatedly.
8. Trigger at least one unexpected-state adaptation.
9. Confirm persistence.
10. Re-run and confirm deterministic reuse.
11. Open Advanced Editor.
12. Stop/pause/take over a workflow.
13. Restart browser/runtime and verify recovery.

### Exit Criteria

The full experience can be completed without developer intervention.

---

# FINAL MVP ACCEPTANCE TEST

The MVP is ready when a person unfamiliar with FluxIQ can reasonably accomplish all of the following.

## Creation

1. Install FluxIQ.
2. Understand the basic purpose of the product.
3. Describe a browser automation using natural language.
4. Alternatively demonstrate the automation.
5. Alternatively create a scraping automation.
6. Have FluxIQ generate a runnable automation.
7. Test it.

## Execution

8. Run the automation.
9. Understand execution progress.
10. Pause/stop execution.
11. Re-run it without requiring AI reasoning for every action.

## Adaptation

12. Encounter a reasonable unexpected browser state.
13. Have FluxIQ detect that normal execution cannot continue.
14. Have the harness diagnose the situation.
15. Have the harness explore a solution.
16. Have FluxIQ recognize successful recovery.
17. Convert that recovery into reusable automation.
18. Validate the adaptation.
19. Persist the adaptation.
20. Continue execution.

## Learning

21. Run the automation again.
22. Encounter the previously learned situation.
23. Handle it without unnecessary LLM intervention.

## Transparency

24. Understand from Simple Mode that the automation learned something.
25. Open Advanced Editor if desired.
26. Inspect the underlying automation and adaptation.

If these behaviors work at a reasonably good level:

# Release the MVP.

Do not add another development month solely because additional features would make FluxIQ more complete.

---

# DEVELOPMENT PRIORITY ALLOCATION

Approximate engineering allocation for the month:

### 40% — Runtime Adaptation Loop

The core differentiator.

Focus on:

**Detect → Diagnose → Explore → Repair → Validate → Persist → Reuse**

### 25% — Simple Extension UX

The primary determinant of whether ordinary people can use the system.

### 15% — Web Execution and State Reliability

Ensures FluxIQ appears reliable rather than unpredictably agentic.

### 10% — Scraping Experience

Provides a clear, searchable, immediately understandable use case and acquisition wedge.

### 10% — Hardening, Onboarding, Packaging, Release

Turns the engineering project into a usable product.

---

# GLOBAL DEVELOPMENT PRIORITIES

When multiple tasks compete for engineering time, use this priority order.

## Priority 0 — Broken Core Loop

Anything preventing:

**Create → Run → Adapt → Learn → Reuse**

takes priority over everything else.

## Priority 1 — Reliability

Anything causing otherwise supported workflows to behave unpredictably.

## Priority 2 — Simple UX

Anything preventing normal users from accessing existing capabilities.

## Priority 3 — Benchmark Coverage

Add tests for newly discovered important failure classes.

## Priority 4 — Scraping UX

Improve the strongest initial acquisition use case.

## Priority 5 — Advanced Functionality

Only after higher priorities are healthy.

---

# AI AGENT IMPLEMENTATION RULES

Agents working from this roadmap must follow these rules.

## Rule 1 — Do Not Scope Creep

Do not implement functionality merely because it seems useful.

Every substantial change must answer:

> Which MVP phase, benchmark, acceptance criterion, or core-loop problem does this solve?

If none apply, defer it.

---

## Rule 2 — Preserve Domain Separation

FluxIQ core must remain generalized.

Browser-specific concepts belong in the FluxIQ web automation domain or extension unless a genuinely domain-neutral abstraction is required.

Do not contaminate framework core with browser-specific assumptions for convenience.

---

## Rule 3 — Prefer Existing Architecture

Before introducing a new abstraction:

1. Search the existing codebase.
2. Identify existing related abstractions.
3. Determine whether they can be extended.
4. Avoid parallel systems representing the same concept.

---

## Rule 4 — Deterministic First

Recovery priority should generally be:

**Existing deterministic path → evidence-based deterministic recovery → known learned adaptation → AI intervention**

Do not invoke AI simply because it is convenient.

---

## Rule 5 — AI Must Produce Reusable Knowledge

Successful AI exploration should preferably result in:

- Updated target knowledge
- New routing knowledge
- New subflow
- Modified subflow
- New state requirement
- Modified state requirement
- Other deterministic reusable behavior

Avoid treating successful ephemeral agent execution as sufficient.

---

## Rule 6 — Validate Learned Behavior

Do not permanently modify automation behavior solely because a sequence happened to reach a successful state once.

Validate where practical and retain confidence/provenance.

---

## Rule 7 — Do Not Hide Complexity by Removing It

Simple Mode is a user abstraction.

Advanced Editor should retain underlying transparency and control.

---

## Rule 8 — Instrument Everything Relevant

New MVP behavior should emit sufficient structured information to understand:

- Why it was selected
- Whether it succeeded
- What failed
- Whether AI activated
- What AI changed
- Whether the change was reused

---

## Rule 9 — Benchmark Regressions Matter

Changes affecting execution, evidence, target resolution, generation, or adaptation must be tested against FluxBench.

Do not optimize one demo while substantially degrading broader workflow reliability.

---

## Rule 10 — Prefer Shipping Over Architectural Perfection

This is an MVP cycle.

A sufficiently clean implementation that proves the product is preferable to an elegant generalized architecture that delays validation.

Do not knowingly introduce severe technical debt, but do not redesign working architecture without a concrete MVP reason.

---

# DEFERRED UNTIL AFTER MVP

Unless required to fix an MVP blocker, defer:

- General SaaS integrations
- Slack
- Discord
- Generic webhook ecosystem
- n8n-style application catalog
- Desktop automation
- Android/mobile automation
- Large node marketplace
- Team collaboration
- Organization management
- Enterprise RBAC
- Enterprise audit systems
- Full hosted cloud runner infrastructure
- Large-scale proxy infrastructure
- Complex billing
- Marketplace
- Elaborate sharing/community systems
- Advanced ML rankers
- Unrelated framework refactors

These may become major FluxIQ features later.

They are not required to validate the browser MVP.

---

# POST-MVP DIRECTION

Immediately after MVP release, development priorities should be determined from real usage.

Measure:

- What workflows users attempt
- What workflows fail
- Why they fail
- Which actions are most common
- Adaptation frequency
- Adaptation success
- Adaptation reuse
- AI cost
- User retention
- Most-used creation method
- Scraping usage
- Advanced Editor usage
- Demand for scheduling
- Demand for cloud execution

Potential immediate post-MVP priorities include:

1. Cloud execution
2. Scheduling
3. Hosted accounts/sync
4. Improved scraping
5. Flow sharing/templates
6. Additional browser capabilities
7. Additional integrations
8. Team/business features

Do not determine their ordering before meaningful user data exists.

---

# NORTH STAR

At every stage of development, ask:

> **Does this help FluxIQ turn expensive intelligence into reusable automation?**

The desired long-term behavior is not:

**Run → AI → Run → AI → Run → AI**

It is:

**Encounter novelty → Use intelligence → Learn → Execute cheaply until something genuinely new occurs**

Or, expressed economically:

**AI cost should correlate with new information, not execution count.**

That is the core thesis this MVP must prove.