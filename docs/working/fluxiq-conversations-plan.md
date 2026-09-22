# FluxIQ Conversations

Status: Active
Status detail: Directed by the user 2026-09-22 and started the same day; two discovery workers reading Core's primitives and the panel's shell. No implementation dispatched yet.
Created: 2026-09-22
Last updated: 2026-09-22
Owner: Senior supervisor agent
Scope: A real conversation between FluxIQ and the person, with its chat window, as a first-class part of FluxIQ Core and the general channel for anything the model needs from them — permission for a consequential act, a decision between readings of an instruction, approval of a repair, feedback on a Flow. Covers the thread's model and persistence, how the model reads and writes it, how a run or build parks on a question and resumes on the answer, and the panel surface. It deliberately does not remove or replace existing manual controls, does not redesign the panel, and does not own the web domain's own UI.
Paired document: none yet — conversations are generic framework behaviour and land in FluxIQ Core, so a Core-side document is required once the design is accepted.
Related: [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md) (whose permission-gate work is the first caller), [week2-exit-plan.md](./week2-exit-plan.md) (whose UI audit found the journeys with no surface)

---

## Current State

The user directed on 2026-09-22 that FluxIQ gain actual conversations and a UI
for them, immediately, so the model "can actually see what was said & easily take
feedback or prompt the user for permissions or whatever", and that this "should
generally be the primary way to interact with the user & get complex feedback
without having complex UI for every single thing".

**The chat window is a core part of Core** (user, 2026-09-22). The thread model,
its persistence, the model's reading and writing of it, and the window itself are
first-class FluxIQ Core, living in Core's own web application. Not a web-domain
feature, not an extension-panel bolt-on, and not approximated downstream. A
downstream surface may show a conversation; Core owns the capability.

**It is additive.** In the user's words the same day, it is "just an addition and
new central focus, NOT replacing existing or future manual UI controls". Existing
controls keep working and new purpose-built UI is still built where it is the
right way to show something. What changes is that a general channel exists, so a
capability is never blocked on someone first designing a screen for it.

**Why now, and what makes it urgent rather than nice.** The standing product rule
is that FluxIQ is capable by default, that only consequential acts are gated, and
that a blocked action **escalates to the person for permission** rather than
failing — "I need permission to do X" being a first-class outcome that reaches
them. Task t081 has just made a created Flow's steps reachable by the permission
gate and proved the hole was real: before it, a Flow that presses "Schedule post"
built and replayed under an empty grant with nobody asked. But a gate that can
only refuse, with no general way to reach the person, converts a capability
problem into a dead end. The conversation is the missing half.

**What it would cover that has no surface at all.** The Week 2 UI audit recorded
three journeys with no product UI: improving an existing Flow, a permission
request raised by a run or a repair, and a structural repair diff. Each was
scoped as its own screen. A thread serves all three, and the next interaction
nobody has thought of yet.

**What is decided.** Nothing yet beyond the direction and the scope above. Two
read-only discovery workers are reading Core's existing ways of telling a person
something and the panel's shell and conventions. Their reports land in
`reports/`.

**Next:** fold the two reports into a design and a phase table, then dispatch.

**Blockers:** none. Task t082 is rewriting the build loop's vocabulary and t081
is held pending it, so the permission caller this serves is in motion; the
conversation's own model does not depend on either.

---

## Design Sketch

Held loosely until discovery reports; recorded so the reports can argue with it.

### A thread, attached to work

A conversation belongs to something the person recognises — a project, and within
it a Flow, a build, or a run. It holds ordered turns. A turn is from the model or
from the person, carries text, and may carry a structured payload: a permission
request and its classes, a proposed change, a diff, a dataset preview, a
screenshot.

### What the model can do

- **Say something** — progress, a finding, an explanation of what it is about to
  do.
- **Ask something** and park — a permission request, a choice between two
  readings of an instruction, a confirmation. The work waits on an answer rather
  than failing.
- **Read the thread back** — earlier turns are context on later calls, which is
  what makes "take feedback" work at all.

### What the person can do

- Reply in ordinary language.
- Answer a structured ask directly — grant exactly the classes requested, choose
  an option, approve or reject a change — without the reply being parsed out of
  prose.
- Say something unprompted, which the model sees on its next turn.

### The property that matters

A question must **park** the work rather than end it. Today an unpermitted action
throws and the build dies; the request reaches the person only as a failure to
read after the fact. A parked run that resumes on an answer is the difference
between a gate and a dead end.

### What this is not

Not a replacement for manual controls, and not a licence to skip a purpose-built
view where one is genuinely better. A diff, a dataset preview and a Flow graph
are visual things; the rule is that they are rendered in or from the thread so
the exchange stays in one place, not that they stop existing.

---

## Discovery Findings

### From conv-panel-ui (2026-09-22)

1. **Nothing can push to the browser. Verified.** There is no `EventSource` and
   no client `WebSocket` anywhere in `apps/web/src` — the supervisor grepped and
   found only a DOM-event type of a similar name. The gateway websocket serves
   the *extension*, not the panel. The change feed (`sync/project-sync.ts`) is
   **not polled**: it fires on start, on `hasMore`, and on a mutation event the
   same tab dispatches, and pauses when the tab is hidden; its only timer is a
   retry. **A turn written by a server-side run would therefore never arrive.**
   This is the single constraint the design must answer, and it makes delivery —
   not the thread model — the hard part.
   The one working precedent for a server-originated question reaching an
   unattended person is `GlobalClientGatewayPairing`
   (`app/GlobalClientGatewayPairing.tsx:57-97`), an adaptive 1 s to 10 s backoff
   mounted globally in the layout.
2. **The same permission question is already rendered twice, by two features
   that share no code** — `RunPermissionRequest.tsx:36-53` for a run, and a
   separate modal in `authoring/BlankFlowAuthoringPanel.tsx:259-263` for a
   build — although Core already distinguishes them by `reason.stage`. This is
   the strongest concrete argument for a general channel: the second surface was
   built because the first did not generalise. Worse, **the creation-stage dialog
   has never once been observed in a live panel run**, so one of the two
   duplicates is also unproven.
3. **A turn must be able to carry a rendered component, not only text.** The
   structural repair diff genuinely needs a visual surface — the existing
   differ is scalar-only and capped at 50 leaf paths, while a node, edge or
   route change honestly rendered is a graph. The panel already owns
   `FlowGraphCanvas`, `FlowNode` and `FlowEdge` to reuse read-only.
4. **"Improving an existing Flow" is not a rendering gap at all.** The authoring
   model refuses any Flow that is not blank
   (`blank-flow-authoring-model.ts:98-106`). The thread can host the
   conversation, but the capability constraint is the actual blocker and the
   resulting adaptation already has a good home.
5. **A transcript is genuinely new work.** No reusable timestamped-list
   component exists; nothing in the panel does auto-scroll or incremental
   append. Adding a view touches nine places, two of them gate tests that fail
   otherwise, and a view containing `setInterval` is failed by a source-text
   test.
6. Conventions to respect: plain global CSS in numbered sheets with role tokens
   enforced by tests that read the CSS; state through a closed mutation union a
   new kind must be added to; every view split into `XView`/`XViewContent` so
   tests can inject commands. Borrow the adaptation review's data-driven copy
   and its re-authentication step; do not copy burying a decision on a fifth
   tab.

---

## Worker Briefs

### Brief: conv-core-primitives
Dispatched 2026-09-22. Every existing way Core tells a person something or
records something for them; whether any thread concept exists; how a permission
request reaches a person today end to end; the persistence seam a new resource
would use; and how model context is assembled, so prior turns could be included.
Report: `reports/conv-core-primitives.md`.

### Brief: conv-panel-ui
Dispatched 2026-09-22. The panel's shell and navigation; how it learns a run's
state and how live that is; exactly what t060 added for a run's permission
request; the adaptation review UI as the nearest precedent for the model
proposing something a person approves; and the panel's own conventions a new
surface must follow. Report: `reports/conv-panel-ui.md`.

---

## Work Ledger

### 2026-09-22 — Document created; direction recorded; discovery dispatched
- Agent: supervisor
- Changed: this document; `docs/working/README.md`; two briefs dispatched.
- Why: the user directed that conversations and their UI become the general
  channel to the person, immediately, and the permission gate landing in t081
  has no such channel to escalate through.
- Validation: not validated — direction and dispatch only, no code touched.
- Outcome: Partial
- Follow-up: fold both reports into a design and phase table, then dispatch
  implementation; reconcile with t081's held permission work.

---

## Open Questions

- Does a thread belong to a run, a Flow, or a project, when a single instruction
  may produce a build, several runs and a repair? Discovery should say what the
  persistence layer makes natural.
- How does a parked run resume — a held process, or a durable state that a later
  answer revives? The second survives a restart and is almost certainly right,
  but it is a bigger change.
- How much of a thread goes into a model request, given the request is assembled
  fresh each call and has a byte budget that already truncates the node catalog?
