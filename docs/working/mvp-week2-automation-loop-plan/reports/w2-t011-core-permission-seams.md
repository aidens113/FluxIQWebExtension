# w2 t011 — Core permission seams (read-only investigation)

Worker report. Core inspected read-only at `F:\fxwork\!FluxIQ`, HEAD
`143d89e`; downstream t011 worktree at `e71f6cb`. No Core source, build, test,
commit, or push was touched. This report is the only file written.

## Outcome

Two narrow Core seams explain the live failures.

1. The action gate compares the action declaration and instruction authority by
   exact consequence label. That is the right fail-closed final comparison, but
   the instruction model is allowed to omit any class without explicitly
   deciding it. The live schedule instruction therefore retained
   `send_or_publish` while the press declared `create_new`, and exact comparison
   raised a request even though Core's own schema says scheduling a post normally
   means both classes.
2. A generated target reference is reserved only when its keys are `handle` and
   optional `location`. Adding `consequences` makes it an ordinary object, so
   Core finds no handle site and the downstream resolver cannot consume the
   declaration as the reference metadata it was designed to be.

The smallest safe compatibility behavior is **not** to make consequence classes
aliases and not to permit an action when any one class happens to overlap.
Instead, make instruction authority explicitly decide the exact classes the
action declared, then keep the gate's existing exact subset check. Separately,
reserve and validate an optional `consequences` member on a plan handle reference
so the domain can resolve the handle, call the already-provided permission
check, and strip the declaration before node validation.

## Seam 1 — instruction-derived consequence reconciliation

### Existing data flow

- Core creates one instruction-authority runner and one permission wrapper for
  the evidence-guided build in
  `packages/fluxiq/src/programs/automation-studio/runtime/service.ts:1904-1905`.
  Exploration receives the wrapped executor and completed plans receive
  `permissions.planStep` at `service.ts:1910-1919,1947`.
- `automationStudioFlowBootstrapActionPermissions` creates one gate
  (`runtime/flow-bootstrap/action-permissions.ts:52-70`), supplies a check to
  every exploration call (`:72-79`) and every plan step (`:81`), and converts
  the first raised request into the terminal build failure (`:84`).
- The gate parses the domain declaration, derives instruction authority once,
  and computes `missing` only by exact class membership in the grant or the
  derived entries (`runtime/action-permissions/gate.ts:133-160`). A failed
  derivation grants nothing (`:164-183`).
- Instruction authority is one no-tool model call using the fixed completion
  schema (`runtime/service/instruction-authority.ts:33-59`); its output is kept
  only after quote grounding (`:65-67` and
  `runtime/action-permissions/instructed.ts:94-116`).
- The schema says schedule/post belongs to `send_or_publish` and schedule/create
  belongs to `create_new` (`runtime/action-permissions/instructed.ts:47-76`),
  but its result is only an array with `maxItems`; it does not require the model
  to render a decision for any particular class (`:53-81`). Quote grounding
  proves the quoted words occur, not that the model considered every applicable
  class (`:89-116`).
- The live record is the concrete mismatch: `New post` declared `create_new`,
  while the same instruction was retained only as `send_or_publish`, so the run
  stopped without scheduling anything
  (`reports/w2-reveal-not-commit.md:467,472-480`).

### Proposed minimal compatibility behavior

Keep the exact, all-declared-classes-must-be-covered calculation in
`gate.ts:137-139`. Change only how instruction authority answers the classes
being compared:

1. Let `deriveInstructed` accept the declaration's deduplicated consequence set.
   The gate passes `read.consequences` when a class has not previously been
   decided.
2. Give the authority call a request-shaped schema that requires one explicit
   disposition for every requested class: instructed with a verbatim quote, or
   not instructed. The requested classes are candidates to judge, never an
   authority source. The call still sees instructions only — no page text,
   control name, locator, or other domain evidence.
3. Cache decisions per consequence for the run. A later action asking about a
   class not yet decided may derive that class; a failed or malformed answer is
   a negative decision for that check and therefore raises the existing request.
   Positive grounded entries continue to be stored exactly as today.
4. Do not add an implication such as `send_or_publish => create_new`, do not
   authorize all declared classes when one overlaps, and do not weaken quote or
   instruction-digest checks. Those alternatives would let an instruction to
   send an existing item authorize creation of an unrelated item, or let a
   low-stakes declared class carry a higher-stakes one.

This is domain-neutral: Core still knows only its five consequence classes and
the person's instructions. It reconciles two classifications by requiring a
decision on the exact class at issue, rather than inventing web-specific control
semantics or treating different consequences as synonyms.

### Risk and focused live proof

Risks:

- A semantic model decision can still be wrong. Requiring an explicit decision
  removes silent omission, not semantic uncertainty; malformed/failing answers
  must remain fail-closed.
- Per-class lazy decisions can add calls. Bundle all not-yet-decided classes
  from the current declaration into one request and cache them; never retry the
  same class mid-run.
- Stored authority may be partial if the build never encountered other classes.
  That is safe: an unexamined class is not authority. Existing digest-based
  lapse behavior remains unchanged.

Focused live proof: after the downstream prompt makes the opening `New post`
press declare `[]`, run only `social-scheduler-schedule-post` with no explicit
consequence grant. Inspect `snapshots/live-llm.json` call by call. The first
lasting press/step must cause an instruction-authority answer that explicitly
decides every declared class and grounds each positive in the active schedule
instruction. The exact gate must return permitted, the build must not contain a
permission request, and the created Flow must schedule the post and pass the
oracle. Any ungrounded or negative class must instead produce the existing
terminal request before that action.

## Seam 2 — consequence declarations on plan-node handles

### Existing data flow

- A reference is recognised only when the object contains `handle` and every
  key is `handle` or `location`
  (`runtime/llm/harness-options/plan-node-handles.ts:64-97`). The live
  `{ handle, consequences }` shape therefore is not a reference, matching the
  observed `bootstrap.invalid_parameter_value`
  (`reports/w2-reveal-not-commit.md:444-451`).
- Plan parameter resolution scans each node, refuses malformed/unissued handles,
  and invokes the bound domain resolver with the untouched parameters and a
  step-specific permission check
  (`runtime/llm/harness-options/plan-parameter-resolution.ts:52-84,104-128`).
  It validates the resolver's answer and refuses anything that still names a
  handle (`:129-143`).
- The binding contract already says the domain declares lasting consequences
  while resolving the node and calls the supplied permission check
  (`runtime/llm/harness-options/binding.ts:131-169`). Completion already threads
  that check into resolution
  (`runtime/llm/harness-options/bootstrap-completion.ts:72-81,107-115`). No new
  permission route is needed.

### Proposed minimal compatibility behavior

Extend the reserved reference shape to:

```json
{ "handle": "<opaque token>", "location": "<optional bounded location>", "consequences": ["<zero or more Core consequence classes>"] }
```

- Add a single exported key constant for `consequences` next to the existing
  handle/location constants, and allow it in `isReferenceShape`.
- When present, require a bounded array of unique recognised Core consequence
  classes, in Core order; `[]` means the reference itself is read-only. An
  unknown class, duplicate, wrong type, or oversized list makes the reserved
  reference malformed rather than turning it back into an ordinary literal.
- Carry the parsed declaration on `AutomationStudioPlanNodeHandleSite` so a
  resolver need not independently reinterpret the reserved Core metadata. The
  resolver still owns the action meaning, control name/kind, verb, and whether
  to call permission; Core must not infer those from the handle.
- Keep passing the original parameters to the resolver. A successful domain
  resolution returns executable parameters with both the handle and declaration
  stripped. The existing post-resolution handle check and registry validation
  remain the backstops.

This is a wire compatibility expansion: objects with `handle + consequences`
that were formerly ordinary literals become reserved references. That is the
intended meaning of the live shape, but it must be documented and covered as a
reserved-key change. It does not alter plain `{handle}` or
`{handle, location}` consumers.

### Risk and focused live proof

Risks:

- A permissive parser would let misspelled declarations bypass the gate. The
  whole reserved shape must become malformed on an unreadable declaration.
- Core must not call permission merely because metadata is present: only the
  bound domain knows the resolved action's actual consequences and human-facing
  name.
- Build-time permission does not add replay-time gating. The existing design
  assumes a saved Flow was authorized when built; playback still does not read
  stored instruction authority (`reports/w2-permission-request.md:139`). This
  proposal does not silently claim to close that separate gap.

Focused live proof: use one live build whose completed plan contains a
state-changing step as `{handle, consequences}` but whose active instruction
does not authorize that consequence. Inspect the completion call and resulting
diagnostic. Core must recognise the handle (not emit
`bootstrap.invalid_parameter_value`), invoke the domain resolver exactly once,
and end with `flow_bootstrap.permission_required` whose request has
`action.kind: "flow_step"`, the node definition/ref, the domain-supplied shown
control name, and the declared missing classes. No proposal may be persisted and
no playback action may run. A second run with the matching instruction/grant
must resolve and validate the same shape and leave no handle or consequence
metadata in executable node parameters.

## Not verified

- No implementation, build, unit test, or live run was performed by this
  investigation, as required by the brief.
- The proposed request-shaped authority schema has not been tested against the
  real provider; its purpose is to preserve exact permission semantics while
  removing the observed omission ambiguity.
- The downstream resolver's final metadata-removal behavior was not inspected;
  the live t011 report says that half was written, measured, and reverted.
