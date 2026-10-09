# Consultant proposal: state-aware subflows, scoped handlers, recovery ladder

Received from the user on 2026-10-09 ("I've had a chat with my consultant. Here is the plan we've come up with").
The text is the consultant's, kept as the user pasted it, with its tables restored. It is the source of
[the state-aware recovery plan](../state-aware-recovery-plan.md); the adjustments made to fit the code are listed
there under "Adjustments to the consultant plan". Do not plan from this file directly.

---

Yes. I would make this the next structural change: state-aware subflows, scoped event handlers, and a deterministic
recovery ladder that escalates to the smallest necessary repair.

Your key insight is that deterministic execution does not have to mean "always execute the same steps from the
beginning." It can mean "given this state and event, take this known, repeatable action."

The important constraint is not to replace the current straight-line assumption with an equally difficult system
where every node competes to run at every moment.

I would preserve three distinct concepts:

| Concept | Responsibility |
| --- | --- |
| Normal flow | Perform the intended task through connected nodes, branches, loops, and subflow calls. |
| State-based entry | Choose an appropriate, explicitly permitted starting or recovery point. |
| Scoped event handler | Deal with an interruption or lifecycle event without embedding that behavior throughout the normal flow. |

This resembles the hierarchical event-handling pattern used in statecharts: evaluate eligible behavior within the
active state, with more general handling available at parent levels. We can borrow those semantics without making a
wholesale runtime or library migration part of the MVP. (Stately)

## 1. Keep one execution system, but introduce first-class handlers

Handlers should execute ordinary FluxIQ nodes and subflows. They should not have their own separate execution
language.

A disconnected event node becomes a registered entry point:

```text
On Before
Scope: all subflows in this automation
Condition: known newsletter dialog is visible

    → Close that specific dialog
    → Verify the dialog is gone
    → Resume interrupted execution
```

The normal flow does not connect to this node. The runtime invokes it when its event, scope, and condition match.

Internally, the handler needs a small definition:

| Field | Meaning |
| --- | --- |
| Event | When the runtime considers the handler. |
| Scope | Which active subflows or nodes it applies to. |
| Condition | Observable facts required before it may run. |
| Body | Ordinary nodes or a subflow call. |
| Completion check | Evidence that its intended recovery actually worked. |
| Continuation | Whether to resume, route elsewhere, return replacement output, or leave the problem unresolved. |
| Order and limits | Deterministic precedence and bounded execution. |

"Disconnected" should mean disconnected from the normal execution path—not implicitly executable because it has no
incoming edge. An unregistered orphan node should remain an authoring error.

### Local output ports and disconnected handlers should share one implementation

Your proposed node outputs make sense, but I would distinguish the normal next connection from lifecycle hooks.

A local connection from a node's onRetry port should compile into the same handler representation as a disconnected
On Retry node scoped to that node.

That gives you two useful editing styles without two runtime mechanisms:

- Attach a small, highly local recovery directly to the node.
- Define shared recovery separately and select its scope.

The same handler should never run twice because it is represented through both mechanisms.

## 2. Define the lifecycle events precisely

I would support the following initial vocabulary.

| Hook | Exact proposed meaning |
| --- | --- |
| On Start | A new subflow invocation has begun, before choosing its starting point. |
| On Before | Immediately before executing a node attempt, including a permitted retry. |
| On Before Next | The node has produced verified output, but its normal outgoing transition has not yet been taken. |
| On Retry | Another attempt has been permitted; run recovery immediately before that attempt. |
| On Fail | The node's ordinary retry policy cannot resolve the problem, or the failure is not eligible for ordinary retry. |

`next` remains the ordinary success output, not another independently dispatched event.

Several details matter.

- On Start does not run on every retry. It runs once per new subflow invocation. Resuming an interrupted invocation is
  not automatically a new start.
- On Retry does not decide whether retrying is safe. Core makes that decision. A handler cannot grant itself another
  attempt by emitting the right label.
- On Fail does not mean the entire automation has failed. It means the current execution boundary needs a fallback,
  local recovery, or escalation.
- On Before Next must preserve the already completed action. A handler at that point should not cause the original
  action to execute again merely because execution was interrupted.

For your startup idea, there is one important refinement:

> On startup, evaluate applicable On Start handlers and state-entry rules—not every On-X handler whose condition
> happens to match.

A login-related condition might legitimately appear in handlers for several events. But an On Fail handler should not
run at startup when nothing has failed.

### Check at controlled execution boundaries

For the MVP, I would evaluate handlers at these lifecycle boundaries, not launch them asynchronously on every DOM
mutation.

The extension can mark relevant observations as stale or signal that a blocker appeared. The runtime then handles
that at the next safe boundary, or during an explicitly interruptible wait.

There is a useful precedent in Playwright: its overlay handlers are checked around actions and retries, run one at a
time, and verify that the triggering overlay disappears. Its documentation also warns that handlers can change focus
and mouse state. (Playwright)

For FluxIQ, that means one execution owner per controlled browser resource, with self-contained actions that
reacquire their targets after recovery. No background handler clicking while the main node is also clicking.

## 3. Make state-based entry explicit—and safe

I agree that every subflow should have a default starting point, plus state-aware alternatives.

But I would not allow:

> "Find any node whose expected state resembles the current page and jump there."

That can skip required data preparation or repeat an earlier side effect.

Instead, introduce declared entry points and recovery checkpoints.

### A subflow contract

Each subflow should declare:

| Contract element | Purpose |
| --- | --- |
| Inputs and outputs | What it receives and what it must return. |
| Default entry | Where it starts when no alternative entry is eligible. |
| Alternative entries | Explicitly permitted starting points with state and data requirements. |
| Recovery checkpoints | Places an interrupted invocation may safely resume or restart from. |
| Success conditions | What establishes that the subflow fulfilled its purpose. |
| Replay restrictions | Which operations may be repeated, require reconciliation, or require approval. |

An entry point can also be a recovery checkpoint. They do not need different execution engines.

### Example: exporting invoices

Suppose the normal path is:

```text
Ensure session
→ Open invoice list
→ Apply requested date range
→ Export
→ Verify exported result
```

Possible entry rules:

| Observed state | Eligible entry |
| --- | --- |
| Correct invoice list is already open for the requested account. | Apply the date range. |
| Correct list and exact requested filters are already established. | Export. |
| Neither condition is established. | Default entry. |

However, "Export" is eligible only when its required inputs are available.

If an earlier step normally captures an account identifier or export configuration, the alternative entry must either
already have those values or explicitly reconstruct them.

A matching screen does not prove that skipped nodes' outputs exist.

For a new invocation, previous-run output should not be silently reused. For a resumed invocation, previously captured
output can be retained only where it is still valid for the current task, account, item, and environment.

### Proposed startup procedure

The runtime should bind the subflow inputs and obtain the observations required by its active rules. It then runs
applicable startup handlers, refreshing observations after any change.

Next, it evaluates the explicitly ordered entry rules. The first fully eligible entry wins; otherwise, execution uses
the default entry.

The chosen node still goes through its ordinary readiness checks and On Before handling. The default is not permission
to execute blindly.

For the MVP, route selection should happen at invocation and explicit recovery points—not automatically after every
successful node. Normal edges should continue to govern ordinary progress.

### Use facts, not page similarity, as the foundation

Examples of useful facts include:

```text
currentAccount == requestedAccount
invoiceList.visible == true
dateRange.value == requestedRange
newsletterDialog.visible == true
exportButton.enabled == true
```

Core should understand generic predicates and evidence references. The web adapter should own browser-specific
observation and target resolution.

Keep observed facts separate from model claims and ordinary variables. A model assigning `loggedIn = true` must not
establish that the browser is authenticated.

Predicates should be side-effect-free evaluations over observations. This is also the guard model documented by
Stately, where guards are pure functions rather than actions. (Stately)

For FluxIQ, I would additionally preserve `unknown`: unavailable or stale evidence is not the same as false, and
certainly not permission to choose a shortcut.

## 4. Give scopes deterministic inheritance and precedence

Your three proposed scope levels are enough for the MVP:

| Scope | Applies to |
| --- | --- |
| Automation-wide | All active subflows within this automation invocation. |
| Selected subflows | One or more named subflows, with descendant behavior explicitly defined. |
| Selected nodes | Specific nodes within a particular subflow. |

I would use "automation-wide" internally, even if the editor calls it "global."

Global must not mean all running automations, every open tab, or every user session. Shared handler definitions can
be reusable assets, but each run should instantiate its own registrations.

For subflow scope, I would support inheritance to active descendants. That allows an authentication handler on a
parent business process to cover its nested work.

Node scope should be exact by default. Scoping a handler to a Call Subflow node does not silently mean every node
inside that child.

### Resolution order

My proposed precedence is:

> Specific node → nearest active subflow → active ancestor subflows → automation-wide.

Within a level, use an explicit ordered list. Do not use model confidence, number of matched conditions, or opaque
ranking.

Only the active invocation stack participates. A handler belonging to an unrelated, inactive subflow should not run
because the page coincidentally satisfies its condition.

Execute one selected handler at a time. After it finishes, refresh the relevant observations before choosing another.

For example, closing one overlay may reveal a second blocker. The second handler can then run, but it should not
execute based on a stale snapshot captured before the first handler changed the page.

### Prevent handlers from becoming a new loop problem

I would bake in three restrictions:

- No automatic handler nesting in the MVP. A handler can call ordinary subflows, but ambient handler dispatch does not
  recursively interrupt that handler. Its failure returns to the original dispatcher.
- Do not repeatedly run the same handler against the same unresolved occurrence. If "close dialog" did not close the
  dialog, that is a failed recovery—not an invitation to restart it indefinitely.
- Share a recovery budget across retries, handlers, fallback subflows, and checkpoint routes. Moving into another
  subflow must not reset the total allowance.

Carry the original failure incident through escalation so a shared handler is not executed again merely because a
child failure became a failure of its parent call node.

Finally, avoid generic rules such as "close any modal." A task confirmation, warning, and newsletter popup are not
interchangeable. Scope and conditions must identify the interruption the handler is actually authorized to handle.

## 5. Preserve an explicit continuation when a handler runs

This is the part I would treat as non-negotiable.

Before invoking a handler, the runtime must preserve exactly what it was about to do.

That continuation needs the active subflow invocation, node, execution phase, inputs, completed outputs, attempt
information, and relevant side-effect status.

The distinction between these situations is essential:

```text
About to execute a node
About to retry a node
Action completed; about to follow next
Current node failed; no success continuation exists
```

Without that distinction, "resume" becomes another ambiguous label.

### Four handler dispositions are sufficient

| Disposition | Meaning |
| --- | --- |
| Resume | Continue the suspended operation at its saved phase. |
| Route | Move to a named, permitted checkpoint after validating its requirements. |
| Resolve with output | An alternative implementation produced the required output; validate it against the original contract. |
| Unhandled | This handler did not resolve the problem; continue the recovery process. |

At an On Retry boundary, Resume continues the already permitted retry.

At an On Before Next boundary, it continues toward the next node—not back through the completed action.

At an On Fail boundary, Resume cannot manufacture success. There is no implicit success continuation. The handler
needs to resolve the failed operation, route safely, or leave it unresolved.

After a handler changes the environment, the runtime should revalidate facts needed by the continuation. A login
recovery may have navigated away from the report page; returning to the saved node without checking that would be
incorrect.

Pause, cancellation, permissions, and terminal failure should remain Core policies and execution outcomes, not
capabilities that a handler can override.

## 6. Replace whole-flow repair with an explicit recovery ladder

I would make the recovery order:

> Safe local retry → scoped deterministic recovery → known alternative implementation → safe checkpoint recovery →
> local AI repair → broader repair or user intervention.

This is an ordered policy, not a requirement to wastefully attempt every level. Eligibility depends on the observed
failure and side-effect status.

Local retry and fallback are established workflow concepts: AWS Step Functions, for example, attaches retry policies
and ordered fallback handling to individual workflow states rather than requiring a complete workflow rewrite. (AWS
Documentation)

### Separate three different kinds of failure

1. The environment temporarily blocks a valid procedure. A popup appears, a list is loading, or the session expires.
   Use a handler or bounded wait.
2. The normal procedure is unavailable, but another known procedure can achieve the same result. An export menu is
   unavailable, but another already supported export route exists. Call the alternative subflow.
3. The saved automation no longer describes a workable procedure. The application changed materially. Request a
   local candidate repair.

The first two should not automatically invoke the third.

### Alternatives must preserve the original contract

A fallback is not successful merely because it returns something.

For example, "Export the same requested invoice set through another supported control." is an alternative
implementation. "Export all invoices because the date filter failed." is a different task.

Both the primary method and its fallback should satisfy the same inputs, outputs, permissions, and result checks.

### An uncertain action outcome is not ordinary failure

A timeout after sending a message or creating a record does not establish that the operation failed.

AWS's guidance on retry safety emphasizes this distinction: retrying side-effecting operations requires a suitable
idempotency contract or other handling that prevents duplicate effects. (Amazon Web Services, Inc.)

For FluxIQ, I would require action definitions to distinguish operations that are safe to repeat from those that need
reconciliation first.

When the outcome is uncertain, inspect the result before retrying or switching to an alternative method. Changing
methods does not remove the risk that the original operation already succeeded.

A checkpoint route also cannot bypass this rule. Restarting a subflow must not repeat a completed submission because
its navigation steps are easy to replay.

### AI repair should target the smallest failing unit

The repair request should identify the failed node, handler, or subflow; its contract; current evidence; attempted
recoveries; and known completed effects.

The model should first be able to propose one local candidate: a corrected node, a new handler, an alternative
subflow, or a revised checkpoint.

Only escalate to the enclosing flow when evidence shows the problem crosses that boundary.

The accepted version stays unchanged until the candidate is tested. Shared handlers should not automatically be
promoted from a narrow scope to global scope after succeeding once.

## 7. Teach the model to design subflows and classify exceptional behavior

Adding runtime features will not be enough unless the authoring process produces the right structure.

I would change generation from "Produce the sequence of nodes that completes this task." to "Decompose the task into
reusable outcomes, define valid entry and completion conditions, then author the normal procedure and evidenced
recovery behavior."

### Split subflows around outcomes and recovery boundaries

Good candidates include `EnsureSession`, `OpenInvoiceList`, `ApplyInvoiceFilters`, `ExportInvoiceReport`. Each has a
meaningful completion condition and can potentially be tested or recovered independently.

Avoid both extremes: one subflow per click, and one enormous subflow containing the entire task.

A practical decomposition question is:

> Could this unit be invoked, verified, or repaired independently without needing the model to understand every
> surrounding step?

If yes, it is a plausible subflow boundary.

Use explicit inputs and outputs rather than reaching into unrelated nodes' local variables. This is what makes
alternative entry and local repair manageable.

### Clarify which behavior belongs off the normal path

I would refine your rule slightly:

> Use disconnected handlers for lifecycle behavior and interruptions that can occur at multiple execution positions.
> Keep task decisions in the connected flow.

Something being optional does not automatically make it a handler.

| Situation | Representation |
| --- | --- |
| Choose shipping versus pickup according to the instruction. | Ordinary branch. |
| A confirmation dialog predictably appears after the task's submit action. | Ordinary connected steps. |
| A newsletter popup may appear during unrelated actions. | Scoped handler. |
| Authentication expires while working. | Scoped handler calling session recovery. |
| The required page is already open when a subflow begins. | Alternative entry. |
| The primary export method fails, but an equivalent method is known. | Failure handler invoking an alternative subflow. |

Playwright makes a similar distinction: predictable overlays belong in the normal test procedure, while its handler
mechanism is intended for overlays appearing unpredictably. (Playwright)

The model should not invent a catalogue of speculative recoveries. Generate handlers for observed conditions,
explicitly requested behavior, or tested reusable patterns.

### Keep the authoring interface small

The model should submit a candidate bundle containing subflow definitions, entry rules, and handler registrations.
Local repair can submit a replacement for one named unit through the same mechanism.

It should not manage the runtime's continuation stack, retry counters, active scopes, or handler-consumption records.

Give it three short worked examples: state-aware entry, interruption recovery, and a verified alternative
implementation. Then test those interaction patterns directly.

## 8. Divide responsibilities cleanly between Core, the extension, and the editor

| Component | Responsibility |
| --- | --- |
| Core runtime | Invocation frames, lifecycle events, scope resolution, continuations, recovery budgets, routing, and acceptance gates. |
| Domain adapter / extension | Current observations, durable target resolution, action execution, effect information, and evidence. |
| Authoring layer | Candidate subflows, handlers, entries, and local repairs. |
| Editor and trace UI | Display definitions and explain what actually ran. |

Core should not learn special rules for newsletter dialogs, browser selectors, or particular websites. Those belong in
domain observations and authored behavior.

### Persist execution position, not just the selected node

This needs to survive extension reconnection.

Chrome documents that service-worker globals are lost when the worker shuts down, so keeping the continuation only in
memory is insufficient. (Chrome Developers)

Persist the active invocation stack, pending phase, accepted Flow version, completed outputs, recovery incident, and
outstanding action identity.

After reconnection, reconcile an outstanding action before issuing it again. A missing acknowledgement is not proof
that nothing happened.

### Keep the editor readable

The main canvas should still show the normal procedure.

Expose advanced hooks on demand. Put shared disconnected handlers in a clearly labelled area with visible scope,
event, condition, and continuation. Mark the default entry and alternative entry points explicitly.

A node inspector should show its effective handlers, including inherited ones. Otherwise, a global rule will appear to
change behavior mysteriously.

The execution trace should explain:

> Export was blocked by the newsletter dialog. The automation-wide dismissal handler ran and verified removal.
> Execution resumed before the export attempt.

That trace should come directly from runtime events, not from a later model explanation.

## 9. Implement this through five gated phases

I would avoid a broad "redesign all nodes" project. Keep existing action implementations and add these semantics
around them.

**Phase 1 — Freeze the contracts and build the testable controller.** Define lifecycle events, handler registration,
scope matching, entry rules, dispositions, execution frames, and action-outcome categories. Extract the transition
decision logic behind a narrow interface: given execution state and an event, produce the next state and commands.
Use a fake domain adapter to test it without a model or browser. Add versioned capability support so an older
extension cannot silently accept a Flow requiring the new semantics. Completion gate: scripted tests prove ordering,
continuation behavior, budget handling, and rejection of invalid routes. Existing flows still execute under their
existing semantics.

**Phase 2 — Deliver one deterministic interruption-recovery slice.** Implement On Before, On Retry, and On Fail,
using the common dispatcher. Add the remaining lifecycle events through that same mechanism. Connect targeted browser
observations and one known popup handler. Support all three scope levels, with single-handler execution and no
ambient handler nesting. Hand-author the test flows. Do not make model generation a dependency yet. Completion gate:
a popup injected at different positions is handled, the correct operation resumes, completed actions are not
duplicated, and no LLM call occurs.

**Phase 3 — Add state-aware subflow entry and local alternatives.** Implement input/output contracts, default and
guarded entry, named recovery checkpoints, completion checks, and known alternative subflow calls. Validate that entry
targets have their required data. Preserve valid prior output, invalidate stale dependencies, and enforce replay
restrictions. Completion gate: the same task succeeds from several valid starting states and through a known
alternative procedure without restarting the entire automation.

**Phase 4 — Update generation and local repair.** Teach the model the new decomposition and handler rules. Add the
short worked examples and candidate-submission schema. Constrain repair to an identified unit first. Test generated
candidates against both normal and perturbed starting conditions before promotion. Keep discovery history separate
from saved handlers and subflows. An exploration click should not become permanent recovery behavior merely because
it occurred during a successful session. Completion gate: the model authors a task with reusable subflows and an
interruption handler, then repairs one deliberately changed unit without rewriting unaffected subflows.

**Phase 5 — Complete editor support and harden the release path.** Expose scope selection, hook ports, entry
markers, effective handlers, and recovery traces. Test restart/reconnection, ambiguous outcomes, competing handlers,
budget exhaustion, and incompatible Core/extension builds. Preserve those scenarios as provider-free replay tests
wherever possible. Completion gate: known perturbations use deterministic recovery; genuinely unknown changes trigger
bounded local learning; unresolved cases stop honestly instead of being saved as successful.

For parallel development, assign one owner to the contracts and controller. Separate adapter work, authoring work,
and editor/testing work behind those contracts instead of having every agent modify the central service loop.

## 10. Use a focused acceptance matrix

I would make these scenarios release gates rather than relying on a single successful demonstration.

| Scenario | Required behavior |
| --- | --- |
| Cold start | Use the default entry and complete normally. |
| Correct page already open | Choose an eligible alternative entry without missing input bindings. |
| Similar page, wrong account or filters | Reject the shortcut. |
| Popup before the first action or midway through execution | Handle it and preserve the correct continuation. |
| Popup removal fails | Do not repeat indefinitely or claim recovery succeeded. |
| Local and global handlers both match | Apply the documented precedence and show the decision in the trace. |
| An unrelated subflow's handler matches the page | Do not execute that inactive handler. |
| Primary method fails; equivalent fallback exists | Run the fallback and verify the original contract. |
| Submission outcome is uncertain | Reconcile before retrying, rerouting, or changing methods. |
| Recovery returns to an earlier checkpoint | Do not duplicate completed side effects. |
| Extension reconnects during an operation | Recover persisted execution state and reconcile the pending action. |
| Application changes beyond known recovery | Request the smallest appropriate candidate repair. |

Track deterministic recovery rate, unnecessary AI escalation, incorrect routing, duplicate effects, false success,
and total learning cost per accepted Flow. Handler-check overhead also matters: observe the facts needed by active
rules rather than capturing the entire page at every boundary.

## The MVP boundary I would hold

I would not include unrestricted event subscriptions, arbitrary jumps to any matching node, concurrent handlers
controlling one page, automatic handler nesting, or self-promotion of learned recovery to global scope.

Those are separate expansions—not prerequisites for your idea.

The smallest convincing version is:

> A task composed of a few subflows can begin from different valid states, survive a known interruption, try a known
> alternative, and resume locally—all without calling the model. When a genuinely new problem appears, the model
> repairs only the relevant unit, and that repair becomes reusable after validation.

That would directly strengthen FluxIQ's central proposition: use intelligence to learn workable behavior, then retain
enough structure to execute and recover without buying that intelligence again on every run.
