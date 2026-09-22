# fa-flow-permission-gate — a created Flow's steps meet the gate (task t081)

Worktrees `F:\fxwork\t081\!FluxIQ` and `F:\fxwork\t081\!FluxIQWebExtension`, both
on `task/t081-flow-permission-gate`.

## Outcome

**Partial, and the partition is sharper than the brief expected.**

- **Task 1, the gate is reachable: built and proved at the seam.** The web
  domain now declares and calls Core's per-step permission check, and
  `WebPlanNodeResolution` has the needs-permission outcome it lacked. Driven
  through Core's own `resolveAutomationStudioFlowBootstrapPlanParameters` with a
  real gate and no provider: **before**, a `web.dom.click` on "Schedule post"
  resolved under an empty grant with `gate.request === undefined`; **after**, the
  same step declaring `send_or_publish` answers `needs_permission` and the gate
  raises a request naming the class, the control and Core's sentence.
- **Task 1 has one live blocker, found by running it, and it is not in a file I
  own.** The declaration has to travel from the model's Flow script to the node.
  It cannot today: the authoring readers refuse any step key the node's
  definition does not declare, before resolution. `run-mud7fssy-902f877b`
  measured exactly that — the model was refused `web.step.consequences_undeclared`
  (my gate, firing live), wrote a `consequences:` line in answer, was refused
  `bootstrap.unknown_parameter` by the authoring layer, and went back to omitting
  it. **Four small edits under `runtime/flow-bootstrap/` are required for any of
  this to work from a real build**; they are specified below, and until they land
  every build whose Flow presses something fails.
- **Task 2, a non-terminal refusal: not done, and I believe the brief's premise
  is half wrong.** The gate's abort is a deliberate, documented, test-pinned
  design ("the first action ... raises a request, and the caller ends the run on
  it. Nothing is parked."), and the request already reaches the person as
  `flow_bootstrap.permission_required` — proved live this session. What is
  terminal in the wrong way is the plain `throw` in
  `flow-bootstrap/action-permissions.ts:78` and the inability of a build to
  propose a Flow while carrying a request (`service.ts:1928` plus the API
  contract). Both are outside my "Owns" and neither can be fixed from the gate
  alone. Detail and the exact edits below.
- **Task 3, the grammar specification: written**, with the undeclared-step
  question answered and defended, and corrected by what the live run found.
- **One extra defect, found live and fixed inside my ownership.** The
  instruction-authority derivation read "Schedule a post ... saying: Trail
  clean-up on Saturday" as asking for `send_or_publish` only, so the build
  stopped to ask the person for `create_new` — a class the same instruction
  plainly asks for. That is the opposite of capable-by-default. The question the
  model is asked (`action-permissions/instructed.ts`) now says that one act often
  asks for several classes.

## What changed and why

### Core (`F:\fxwork\t081\!FluxIQ`)

**New — `runtime/llm/harness-options/plan-step-consequences.ts`.** Reads what a
step said its own action would lastingly do, off the node's own `consequences`
field, with the node's parameters as a fallback. Accepts the shapes a Flow
script and a nested plan can produce (`send_or_publish, create_new` as one
comma-separated line; an array), reads `none` and an empty value as "nothing
lasting", puts the classes in Core's order, and is fail-closed: anything it
cannot read as Core's own classes is `malformed`, not silence. It also tells
apart **a step that said nothing** from **a step that said it does nothing** —
the whole question the domain then has to answer.

**`runtime/llm/harness-options/plan-parameter-resolution.ts`.** Reads the
declaration off each node before anything else touches it, hands the domain
`declaredConsequences` beside the `permission` check Core already built, and
hands on parameters with the declaration removed, so neither the domain nor the
registry sees a parameter no node declares. Two new issue codes:
`bootstrap.step_consequences_invalid` (unreadable declaration) and
`bootstrap.step_permission_required` (a step nobody permitted, with the classes
and the request id in the message). Resolution **stops at the first step that
needs permission**: the gate keeps only the first request by design, so asking
about later steps would answer each with an id that asks for another step's
classes.

**`runtime/llm/harness-options/binding.ts`.** `AutomationStudioPlanNodeResolution`
gains `needs_permission`; the input gains `declaredConsequences`. Core already
declared `permission` here and already allowed an awaited answer — that half of
the seam was built and simply had nobody on the other end.

**`runtime/action-permissions/instructed.ts`.** The question put to the model
now says, in the field the answer is given in, that one act often asks for more
than one class, with three examples. Motivated by the live measurement above,
and by the module's own stated intent, which the class descriptions alone did
not achieve.

**Not changed: `runtime/action-permissions/gate.ts`, and `runtime/service.ts`.**
Reasons under Task 2 below. `service.ts` is untouched and still 6,275 lines.

### Downstream (`F:\fxwork\t081\!FluxIQWebExtension`)

**New — `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts`.**
Puts a step to Core's check. It adds only what Core cannot know: which control,
in the words the model was shown (`visibleText` then `accessibleName`, read off
the identity the handle resolved to), one plain word for what the control is,
and the verb for the node's own action. It reads no control and holds no word
list — the classes are the model's own statement, as the standing rule requires.

It also decides which steps must declare, and that is the judgement call the
brief asked me to defend: **the actions whose effect the page decides —
`web.dom.click`, `web.dom.keypress`, `web.dom.dialog` — must say what they would
cause, `none` included.** Everything else is a class Core itself says is not a
consequence (typing into a field that has not submitted, choosing, clearing,
navigating, scrolling, waiting, reading), so it is never asked about and never
needs the line.

**`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`.**
`WebPlanNodeResolutionInput` gains `permission` and `declaredConsequences`;
`WebPlanNodeResolution` gains `needs_permission`; the function is now async and,
once a node's parameters are real, puts the step to the gate with them — so the
request names the control rather than a handle. Core's Run Output node is asked
about under the web output its payload names.

**`domain/src/runtime/llm-evidence/tools.ts`.** One line: the binding returns a
promise now.

## Commands run and observed results

### The measured hole, reproduced and closed, with no provider

`domain/src/runtime/llm-evidence/plan-resolution/tests/plan-step-permission.test.ts`
drives Core's real resolution seam with a real `AutomationStudioActionPermissionGate`.

| | Observed |
| --- | --- |
| **Before the change** | `[repro] resolved.ok = true \| gate.request = undefined` — a plan whose second step presses "Schedule post", resolved under an empty grant, **built, with nobody asked**. This is `run-mud4ywy4-45c2002f`'s hole at the exact seam. |
| **After — undeclared** | refused `["web.step.consequences_undeclared", "web.step.expected.consequences_classes_or_none"]` at `plan.subflows.0.nodes.1.parameters` |
| **After — declares `send_or_publish`, empty grant** | issue `bootstrap.step_permission_required`; `gate.request.missing = ["send_or_publish"]`, `action = {kind: "flow_step", ref: "main.post"}`, `control = {name: "Schedule post", kind: "button"}`, and Core's sentence: *"The Flow its instruction describes would press \"Schedule post\" (button) each time it runs, which would send or publish something that others will receive or see. Neither its instruction nor a grant allows that, so the build stopped to ask."* |
| **After — grant holds the class** | builds; nothing raised |
| **After — the instruction asked for it** | builds; nothing raised |
| **After — `consequences: none`** | builds; nothing raised; the declaration is not on the node the Flow runs |
| **After — unreadable declaration** | `bootstrap.step_consequences_invalid`; nothing raised |
| **After — no build behind the resolution** | `bootstrap.step_permission_required`, *"nobody was there to ask"* |

### Live, against the real DeepSeek in `.env.local`

Isolated Lab instance `t081`, `FLUXIQ_TEST_ENV_FILES=none` so the machine's
`FLUXIQ_TEST_TARGET=existing` did not apply; no web panel was started or
managed. No `--llm-permit`, so every grant permitted nothing.

_(run A and run B recorded below)_

### Checks

_(recorded below)_

## Not verified

_(recorded below)_

## Open questions or contradictions found

_(recorded below)_
