# w2 — Permission requests instead of silent refusals (t018)

Worker report. Core worktree `F:\fxwork\t018\!FluxIQ`, downstream `F:\fxwork\t018\!FluxIQWebExtension`,
branch `task/t018-perm-request` in both. Nothing committed. Downstream source untouched.

## Outcome

**Partial.** The Core contract is built and proven live through Core with the real DeepSeek model:
- a permission set carried with the run;
- the person's own instruction counted as a grant, persisted with the Flow;
- a request payload a person can act on;
- a terminal needs-permission ending on both the authoring path and the recovery path.

Two things are not done:
- **No Lab run shows it yet.** The downstream press does not call the new check, and the files that would call it belong to the sibling task t011.
- **The recovery path is not given the run's permissions.** `AS/runtime/recovery/annotation/` belongs to another unit, so a recovery today runs with no grant, and every action with a lasting consequence asks.

## Consequence classes, and why these five

`move_money`, `delete`, `send_or_publish`, `modify_existing`, `create_new` (`AS/runtime/action-permissions/consequences.ts`).

The earlier proposal was `purchase`, `delete`, `modify_existing`, `send_external`. Three changes, each for a job in the corpus:
- **`purchase` became `move_money`.** A refund is not a purchase, and under the old name it would have been filed as "change an existing order". That hides the fact that money moves.
- **`create_new` was added.** "Raise an escalation" and "schedule a post" were otherwise either not gated at all or mislabelled as editing.
- **`send_external` became `send_or_publish`.** "External" is the one word a person would have to interpret.

The domain may declare several classes for one action. A refund is `move_money` and `modify_existing`, and the run needs every declared class.

Nothing that can be undone by looking away needs permission: navigating, opening, filtering, choosing a row.

## Who decides what

- **Domain.** Before taking an action, it calls `await input.permission({ consequences, control: { name, kind? }, verb })` and acts only when the answer is `permitted: true`.
- **Core.** It answers from `grant.permittedConsequences` plus the classes the instruction asks for. Absent, empty, or unrecognised classes grant nothing. A declaration Core cannot read is rejected, and the action fails.

## Instruction-derived authority (coordinator's addition)

**When the instruction is read.** The first action in a build that declares a lasting consequence triggers one call. The call goes through the build's own grant and harness: an `evidence_tool_decision` with no tools and the completion schema `AUTOMATION_STUDIO_INSTRUCTED_CONSEQUENCES_SCHEMA`. It needs no new task kind and no new grant capability. The provider runs it at temperature 0, which DeepSeek already uses for every call (`deepseek-provider.ts:448`). A read-only build never makes this call.

**What Core keeps.** Core keeps a claimed class only when the model's quote is a verbatim span of one of the person's active instructions (case and spacing ignored). A failed call counts as "nothing instructed", so the run asks.

**How it is stored.** Each entry is `{ consequence, instructionId, instructionDigest: "sha256:…", quote }`. The set is stored on the proposal as `instructedConsequences`. Apply copies it to the Flow's `metadata.bootstrapInstructedConsequences`.

**How a run reads it.** `currentAutomationStudioInstructedConsequences({ stored, activeInstructions })` calls no model. An entry stands only while its instruction is active and its title plus body still hash to the stored digest. An edited instruction lapses, which fails closed.

## The request payload, and what a person can do with it

This is from the live run that asked (the read-only instruction below):

```json
{ "schemaVersion": "automation-studio.action-permission-request.v1",
  "requestId": "permission-request:ca113165-…", "requestedAtMs": 1789766773326,
  "action": { "kind": "exploration_step", "id": "demo.press", "ref": "call.refund.line1", "verb": "press" },
  "control": { "name": "Refund line 1", "kind": "button" },
  "consequences": ["move_money", "modify_existing"], "missing": ["move_money", "modify_existing"],
  "reason": { "stage": "authoring", "instructionIds": ["instruction.refund"] },
  "authority": { "granted": [], "instructed": [] },
  "sentence": "To build the Flow its instruction describes, the run needed to press \"Refund line 1\" (button), which would spend, refund or move money and change something that already exists. Neither its instruction nor a grant allows that, so it stopped to ask." }
```

- **Two kinds of action.** `action.kind` is `exploration_step` (the run wanted to act now, while exploring) or `flow_step` (the finished Flow would act every time it runs).
- **How a person grants.** Issue the next grant with `permittedConsequences: request.missing`, through the existing preflight or issue endpoint. That is the only way an answer reaches the next run.
- **Refusing** is simply not re-running.
- **Parking later.** Nothing in the payload assumes the run has ended, and `requestId` is the key a store would use, so parking can be added without changing it.
- **What the request may carry from the page.** `control.name` is carried only if the model was already shown that exact text. Otherwise it is `null`, and so is a name containing `<` or `>`.
- **Build check.** The whole `action-permissions/` directory is added to `contractSpreadPaths`. I checked that a spread there fails `structure-audit`.

## How the authoring path raises it

`AS/runtime/flow-bootstrap/action-permissions.ts` puts one gate in front of two moments:
1. **Every exploration tool call.** The domain gets `permission` with the call.
2. **Every plan step** in `resolvePlanNodeParameters`, called with `permission`. The resolver may now be async.

The first request ends the build terminally in all three places the loop can stop: the tool throws, the gate's signal aborts the loop before the model is asked again, and the unusable-decision guard reads the request first. The build ends with the diagnostic code `flow_bootstrap.permission_required` and `permissionRequest` (strict parser: the request must be present exactly when that code is).

On the recovery path, `runtime-exploration.ts` returns `user_intervention_required` / `operator_approval_required` with `permissionRequest`, and puts it in the trace detail. Only the gate raises that stop now: a domain classifier that returns it is reported as `destructive_action_refused`.

## Live evidence

**Core probe with the real DeepSeek model.** Real grant, real authoring build, and a stand-in order back office whose press tool and plan-step resolver call the check. The script is `t018-live-permission-probe.mjs` in my scratchpad; total cost about $0.04.

| instruction | grant | result |
|---|---|---|
| "…open it, refund the value of the first line on it, and leave the order showing…" | none | **Proposed with no request.** The instruction was read as `move_money` ("refund the value of the first line on it") and `modify_existing` ("leave the order showing that part of the money has been given back"). Open, Refund line 1 and Confirm refund were pressed. The set was stored on the proposal. |
| "…record the amount the refund confirmation … would give back. Do not change the order." | none | **`flow_bootstrap.permission_required`** with the request above, after 2 tool calls. Nothing was refunded. |
| refund instruction (run before the instruction reading existed) | none | `flow_step` request naming "Refund line 1". |
| same | `move_money`, `modify_existing` | Proposed. |

**Determinism.** `t018-classify-repeat.mjs` read each instruction 3 times through the real call. All 3 answers were identical for each:
- refund: `move_money` + `modify_existing`;
- read-only: `[]`;
- schedule-post: `send_or_publish` ("Schedule a post for Friday…") + `create_new`.

The grounding for the schedule-post `create_new` was weak: the model quoted "record the scheduled time". The quote check proves the words exist in the instruction, not that they justify the class.

**Lab runs of `order-operations-partial-refund`, t018 instance.** This only checks that nothing regressed. The downstream does not call the check, so the gate is never reached.
- Before the change: `run-mu7ed9rj-da5114a6` proposed a Flow after 5 calls, then failed at playback: `preflight-llm-execution (400): LLM execution grant purpose is unsupported`.
- After: `run-mu7f379i-368a329a` hit `web.reveal_safe` → `target_unsafe` (the old downstream rule), and the build ended `flow_bootstrap.evidence_repeat_without_progress` after 12 calls.
- These are single observations each.

**Environment defect for the supervisor.** The t018 Core branch sits at `cf176fe`, two commits behind Core `dev` (`a0f9985`), so it lacks t012's `verify_result`. Any Lab playback in this worktree fails for that reason. A worker hook blocks me from merging.

## What the downstream press must call (for integration with t011)

**In `press.ts` `pressControl`** (sibling-owned), before the click, for a press with a lasting consequence:

```ts
const verdict = await press.request.permission({ consequences: ["move_money", "modify_existing"], control: { name: element.name ?? element.text, kind: "button" }, verb: "press" });
if (!verdict.permitted) return toolRejection("permission_required");
```

`permission` arrives on every `executeTool` input and every `AutomationStudioHarnessOptionExecution`. `control.name` must be the text the packet showed the model, or Core withholds it. The domain chooses the classes from what the control says it does; a "Refund…" opener should declare `move_money`, since the domain cannot know a confirmation follows.

**In `resolvePlanNodeParameters`**, for a resolved node whose action has a lasting consequence:

```ts
if (!(await input.permission(declaration)).permitted) return { status: "refused", issueCodes: ["web.plan.permission_required"] };
```

**In the classifier.** Map `web.action.rejected.permission_required` to nothing, not to `operator_approval_required`: Core already knows about the request.

**Recovery (annotation owner).** Pass `permittedConsequences` into `runAutomationStudioRuntimeExploration`: the grant's set plus the classes from `currentAutomationStudioInstructedConsequences(flow.metadata.bootstrapInstructedConsequences, activeInstructions).current`. Also pass `instructionIds`, and `shownEvidence: [failurePacket]` so that control names from the failure packet can be carried.

## Validation (observed)

- **Typecheck.** `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq` exits 0. The downstream `domain` `npx tsc --noEmit` exits 0.
- **Structure audit.** `node scripts/structure-audit.mjs` → `passed (165 warning(s), 361 baselined)`. The baseline was lowered for `service.ts` (6405 → 6404 lines) with `--update`.
- **New permission tests.** 43 pass: `action-permissions/tests/{gate,instructed}.test.ts`, `recovery/tests/runtime-exploration-permission.test.ts`, `tests/service-bootstrap/tests/permission.test.ts`, `api/handlers/tests/llm-permission.test.ts`. `llm/tests/execution-grant-permissions.test.ts` also passed.
- **Affected directories after the final change** (`runtime/{action-permissions,recovery,llm,flow-bootstrap}`, `tests/service-bootstrap`, `api/handlers`): 921 pass and 2 fail. The 2 were a 15 s timeout and an `EBUSY`; both pass when re-run alone (3 files, 25 tests).
- **Full suite.** `npx vitest run` in `packages/fluxiq` was run before the instruction-authority change: 290 of 302 files passed. All 12 failing files (15 s timeouts, one million-event store test) passed when re-run serially. I did not re-run the full suite after the final change.
- **Mutations, each reverted and confirmed restored:**
  - An absent grant read as all classes: 6 tests fail at the gate site; the parser site had 4 failing earlier.
  - An uncovered action proceeding with no request: 21 tests fail.
  - Removing the throw or signal that makes a request terminal: 1 recovery test fails, and 2 authoring tests fail when both are removed.

## Not verified

- **The Lab shape.** An instructed state-changing job proceeding and an uninstructed one asking, on real fixtures, needs t011 plus the call above.
- **Replays with no model.** Node execution at playback has no permission check, so a replay performs whatever steps the Flow holds. Those steps passed the gate at build time. The stored set and the digest check exist for a future check at that point, but nothing reads them at run time yet.
- **The FluxIQ UI prompt.** Nothing in the web UI shows a request or re-issues a grant from one.
- **The API does not return the instructed set on success.** It is stored only on the proposal and the Flow.
- **One instructed class covers every action of that class in the run.** It is not tied to a particular record.
