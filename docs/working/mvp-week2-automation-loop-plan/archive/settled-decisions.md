# Archived decisions from the Week 2 automation loop plan

Moved out of `mvp-week2-automation-loop-plan.md` on 2026-09-16 under the
800-line compaction rule. These are settled: the user's direction is recorded
as L12-L16, and the earlier request that he approve L6 and L9 was withdrawn
because L13 supersedes both. Kept because they record what was decided and why.

## Decisions (recommended, for the user's review)

- **L1. The loop comes first in Week 2.** If capacity runs short, extraction
  beyond X4 and Core's Data window move to Week 3 rather than delay 2.1-2.9;
  Core's credential hardening continues.
- **L2. One repair-target contract for the loop and extraction (E2, X6).**
  Core carries an opaque, domain-owned target object instead of `{selector}`.
  The web domain fills it fingerprint-first, with the selector as a hint, and
  evidence names elements by opaque `target.N` handles. List item and field
  selectors become domain-declared repairable parameters, so an `extract_list`
  repair uses the same contract.
- **L3. E54, option 3.** A candidate missing only an identifier clears the
  `destructive` rung only with a second agreeing signal, and exploration's
  destructive refusal is semantic (submit, delete-like, control role and type),
  never a similarity score.
- **L4. Names.** The harness context contract is `recoveryContext`, in a new
  Core `AS/runtime/recovery/` directory; the existing
  `AutomationStudioRuntimeAdaptationContext` (policy and budget) is untouched.
- **L5. Deterministic first is enforced.** The classifier gates the LLM: no
  provider call when a deterministic path or a known adaptation applies, or the
  failure is policy, auth, user intervention, or graph; no patch request unless
  the diagnosis says a patch or exploration is needed.
- **L6. A distinct grant purpose for runtime recovery,** explicit grant only,
  with its own call count and wall-clock budget, documented as an
  authorization boundary in Core's `automation-studio.md`.
- **L7. Confidence tiers.** An executed in-run success is Medium (used now,
  kept provisional); High only after a zero-LLM replay passes; a structural,
  never-executed validation never counts as success; Low asks a person.
- **L8. Resume, not restart.** Continue from the failed node, or the patch's
  start node, with accumulated values, after a host check that the node's input
  state still holds; restart only when no side-effecting node has run.
- **L9. In-run use on the explicit-grant lane.** A target override the domain
  validator matched or resolved against sanitized evidence may execute once in
  the current run without persisting, never for submit-like actions.
- **L10. Lab.** A provider-free scripted provider (Core test-only, loopback and
  a grant required) drives loop cells; loop lanes are their own lane class so
  deliberate harness activations do not read as Week 1 regressions; a `week2`
  corpus; a new A/B baseline after the loop phases, plus one live DeepSeek
  checkpoint through the existing demo lane.
- **L11. Recent browser events** are captured only if the W13 and W24
  dry-run diagnoses show the state diff is not enough; 2.1's Lab proof decides.

### Decisions the user gave on 2026-09-15, which reshape the plan

These are the user's instructions, not recommendations, and they supersede parts
of L5, L6, and L9 above.

- **L12. One improvement loop, three entry points.** This is not a recovery
  loop. The same machinery runs when a user asks for a **new** flow, when a run
  fails, and when an existing flow meets an edge case. The entry points differ
  only in what seeds the context and in what counts as done; they must not fork
  into separate systems. Everything below that says "recovery" is the failure
  entry point of this one loop.
- **L13. The model's action surface is the whole flow-authoring surface.**
  Anything a person can do to a flow — add and remove nodes, wire them, set
  parameter values, create subflows and routers, attach instructions, declare
  expected state — the loop may propose. FluxIQ should use the model **freely**
  to improve a flow in real time, first build or later failure alike.
  **Approval mode gates applying a proposal, never producing one:** in approval
  mode the loop still explores, iterates, and presents a complete proposed
  solution, and only the final application waits for a person. This replaces
  L6's restrictive separate grant as the default posture, and widens L9.
- **L14. Exploration is a Core framework capability, not a web one.** Core owns
  the exploration loop, its budget, its outcomes, and a **registry of harness
  options** — the actions the loop may take to gather information. Core ships
  the domain-neutral ones. An **imported domain package registers additional
  harness options that extend the core set rather than replacing it**, so a
  non-browser domain gets the same loop. No DOM, selector, tab, or browser
  concept may appear in Core to serve this.
- **L15. A fixed order of work, with domain-extensible instructions.** The loop
  follows an explicit protocol — gather information and explore, plan,
  implement, iterate, verify — and the model is instructed in that order rather
  than left to choose one. An importing domain may **add** instructions to any
  stage or **completely override** that stage's instructions, through Core's
  existing instruction system. The ordering itself is Core's and is not
  overridable; what happens inside a stage is the domain's to extend.
- **L16. The PIN guards destruction, not authorship.** The user's decision:
  **remove the PIN from most writes; only deleting and genuinely destructive
  actions keep it.** This resolves the conflict `w2-b` surfaced, where every
  flow-write endpoint required a PIN that an automatic loop cannot supply, which
  would otherwise have forced the loop to wait for a person even with approval
  mode off. Two things keep this a bounded loosening rather than an open one:
  1. **Destructive is an explicit, exhaustive classification of every write
     endpoint**, decided in one place rather than judged at each call site.
     Deleting a flow, project, recording or dataset, anything that removes
     persisted user data, and anything taking an irreversible external action
     keep the PIN. Creating and editing flow content does not.
  2. **A test fails the build when any write endpoint has no classification**, so
     the default can never quietly become "no PIN" as endpoints are added. Per
     the standing rule, this is enforced by a check rather than by a note.
  The first step of this work is an inventory of every write endpoint; the plan
  must name the PIN-keeping set explicitly rather than describing it.
