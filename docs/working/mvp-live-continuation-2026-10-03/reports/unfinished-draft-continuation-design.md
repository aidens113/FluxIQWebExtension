# Normal chat unfinished-draft continuation design

Status: read-only design complete; implementation and live validation not performed.
Worker: resume-cd. Date: 2026-10-03 local. Brief: `unfinished-draft-continuation-design` in the t262 coordinator.

## Finding

Continuation already exists in Core's creation build. The normal chat's `flow.explore` command calls that path for an existing blank Flow. It can continue the saved incomplete draft without creating another Flow. `flow.improve` always saves an additional improvement instruction and calls `extend`, which requires a Router and a Subflow. Those are different subjects: an unfinished creation's steps live in a separate incomplete-draft record, not in the Flow's applied topology.

A3 selected improve and was refused before build-provider invocation. This confirms the dispatch mismatch, not the precise persisted topology: no project store or private browser state was read. The earlier promise that another build carries on is supported by service code, but normal chat guidance does not explain which existing capability does it. The project's Flow names alone also do not establish that a Flow already does the requested job.

There is a second continuation hazard: `flow.explore` saves its optional instruction whenever supplied. `saveFlowGenerationInstruction` reuses the goal's instruction ID but writes a new `updatedAt` even when the normalized body is identical. The dependency digest hashes complete instruction documents. Thus merely supplying the same saved goal again normally invalidates the old draft's digest compatibility. Improve additionally creates an instruction, changing both the digest and active instruction IDs. Selecting create mode after that write would not by itself restore the original continuation.

## Confirmed contracts

- `flow.explore`: existing Flow ID; optional instruction; omitted instruction uses saved instructions; create-mode build; applies successful creation immediately; pending permission prevents application. It does not create a replacement Flow.
- `flow.improve`: existing Flow ID plus change; extend-mode build; returns an explicit apply/decline question. Real existing steps retain their IDs through extend. Keep this behavior.
- Creation eligibility is authoritative service validation under the generation lock: orchestration representation, empty parent graph, no Router, no Subflows. Extend requires orchestration/empty parent graph plus Router and at least one Subflow; extend-subject resolution adds further requirements.
- Incomplete-draft compatibility requires nonempty stored steps, equal execution dependency digest and equal sorted instruction-ID set. These checks cannot be replaced by a Flow name, old transcript statement, or model claim.
- A compatible creation continuation seeds stored steps/revision/outstanding issues, and suppresses the original start-location on live tool calls. It carries on from the current target state. It still performs the build's completion/test/judge process; it is not an accepted Flow or automatic replay.
- The keeper is disabled for extend. Creation success clears the incomplete record once a proposal is made; failed continuation can retain a later revision. The existing incompatible-record behavior starts a fresh draft and can later replace the old record, so an instruction-changing request must not promise to retain or resume its old proof.
- Public conversation command calls preserve actor/domain scope and existing endpoint permissions. Only registry read/authoring classifications are reachable. No new capability or permission is needed for compatible continuation.

## Recommended bounded implementation

Use existing `flow.explore` for “continue/build again/finish that unfinished Flow.” Update its descriptor, phrases and optional-instruction description, and chat prompt guidance, to distinguish unfinished creation from changing a Flow with applied steps. Continuing the same task should omit instruction. A request explicitly changing the goal should supply the new instruction and explain that old draft evidence may not be reusable. An explicit request for another automation still uses createHere. Keep ordinary model capability choice; do not force a Lab command or rewrite any user's selected capability after a refusal.

Make saving an identical existing active generation goal idempotent, returning its existing document without a write when the normalized body and all effective generation fields already match. Do not reactivate or silently normalize a different/inactive instruction under this rule. This protects continuation if the model supplies the unchanged task despite guidance. Do not broaden compatibility to ignore timestamps or changed instructions: execution digest protection remains authoritative.

State the continuation promise conditionally: saved draft can continue while its Flow and instructions are unchanged. The prompt must not infer “already performs this task” from a catalog name. It may use the conversation's explicit unfinished ending to resolve the intended Flow; ambiguity still produces the existing Flow-selection question. Service validation remains the factual eligibility check. Prompt guidance alone cannot guarantee a stochastic model will always select explore; that requires live validation and honest refusal messaging, not a claim of deterministic routing.

Do not turn improve into create as a catch-all. A genuine nonblank improvement remains extend and asks before application. No budget reset, provider default change, permission change, old project deletion or chat reset belongs in this unit. A compatible continuation spends against the same Flow's creation accounting; availability of funds is separate from target eligibility.

## Exact proposed partition

Paths below are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/`. This is a future release request, not authorization to edit.

| Owner | Change |
| --- | --- |
| `conversations/commands/explore.ts` | Existing-capability continuation descriptor/phrases and explicit unchanged-versus-new instruction semantics. Preserve execution/apply behavior. |
| `conversations/instructions/prompt.ts` | Teach existing explore versus improve versus createHere using the request and explicit prior unfinished context; no catalog-name success inference. Only recommend capabilities actually offered. |
| `service.ts` | Narrow idempotent existing generation-instruction save; no build-mode or keeper changes. |
| `conversations/commands/tests/extension-chat.test.ts` | Real registry/service/thread fixture: failed creation then existing explore continuation; unchanged repeated goal; genuine goal change; existing improve apply/decline unchanged. |
| `conversations/instructions/tests/prompt.test.ts` | Continuation guidance and capability-availability regression; no added unavailable capability, no name-only success claim. This owner was identified by filename, not read. |
| `tests/service-bootstrap/tests/incomplete-draft.test.ts` | Service-level identical save preserves digest and resumed revision; changed goal is incompatible; distinct Flow/project isolation. |

Architecture documentation remains supervisor-owned. No downstream contract, browser-specific Core case, or new public wire field is required for this bounded candidate. A richer truthful catalog state projection could improve model choice, but its assembly/API owners were not inspected and it is outside this partition. Do not add a speculative status field with guessed semantics.

## Fail-before fixtures and verification plan

1. Service fixture: stop an evidence-guided creation with nonzero kept draft; record dependency digest and goal document; save the exact same normalized goal again. Assert document/digest unchanged and the next build's first evidence contains `core.resumed` with the original revision and step count. This should fail before idempotent saving because `updatedAt` changes. Use controlled clock advancement so millisecond coincidence cannot mask it.
2. Actual command/registry fixture: keep a failed creation, then continue the same Flow through explore with instruction omitted. Assert one Flow only, no improvement instruction added, resumed evidence present, old step seed retained, whole-flow test/judge precedes application, and no application while permission is pending. Existing service continuation likely already passes; this is a contract protection fixture, not an invented failing-before claim.
3. Repeat that command fixture with the unchanged task supplied explicitly. It must still resume after idempotent saving. Before the fix it should lose compatible draft reuse. Preserve unrelated project and Flow catalogs and their drafts.
4. New goal fixture: save a genuinely different instruction; next build does not claim old proof resumed. Do not change the existing compatibility rule or silently relabel this a continuation. Preserve the old record until ordinary build ownership handles its outcome; no proactive discard/reset in the command.
5. Prompt fixture fails before guidance change: when explore is offered, continuation is described as explore with saved goal; applied-step improvement remains improve; unavailable explore is never added/recommended. This tests exact prompt contract, not model accuracy.
6. Retain the existing real improve fixture's no/yes behavior and original node identities. Add refusal coverage for attempted improve of a blank target without asserting private live flags. No automatic fallback or capability substitution.

Future narrow owning commands through the heavy wrapper: Core vitest for `conversations/commands/tests/extension-chat.test.ts`, `conversations/instructions/tests/prompt.test.ts`, and `tests/service-bootstrap/tests/incomplete-draft.test.ts`, with their full runtime prefix above. Then Core package typecheck/build as supervisor coordinates, paired linked downstream types if needed, and structure audits. None were run for this design.

Live validation should be a supervisor-authorized normal UI conversation in preserved isolated data: cause an unfinished creation, explicitly continue it, then repeat the unchanged task; inspect actual command selection and `core.resumed`, draft identity, accounting and resulting proposal/application. Also verify a real applied Flow improvement still asks before replacing steps. Do not perform a paid automatic retry, force explore in Lab, erase old workspace data, or treat scripted capability fixtures as live model evidence.

## Read ledger and limits

Docs read: relevant coordinator Current State/brief, `persistent-chat-creation-context.md`, A3 full debug `run-mut6b2re-d0e475d1.md`. No new private run artifacts, stores, profiles or source outside Core were read.

Initial eight Core source owners: `conversations/commands/{improve,build,create-here,vocabulary}.ts`, `service/flow-bootstrap-commands/bootstrap-target.ts`, `flow-bootstrap/extend.ts`, `conversations/instructions/prompt.ts`, `service.ts` (matching sections only).

Supervisor-approved expansion six: `conversations/commands/{explore,catalog}.ts`, `conversations/commands/tests/extension-chat.test.ts`, `flow-bootstrap/incomplete-draft/{continuation,keeper}.ts`, `tests/service-bootstrap/tests/incomplete-draft.test.ts` (corrected exact existing path approved).

Supervisor-approved final three: `conversations/instructions/invocation.ts`, `conversations/commands/port.ts`, `conversations/commands/tests/port.test.ts`. Total 17 distinct source/test files; filename-only discovery does not claim content inspection. Only this report written; no source changes, tests, builds, provider/runtime calls, environment changes, commits or shared-document edits.
