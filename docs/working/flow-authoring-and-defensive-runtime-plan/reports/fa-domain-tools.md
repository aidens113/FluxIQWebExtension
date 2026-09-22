# fa-domain-tools — A8 and A11 (task t079)

Worktree `F:\fxwork\t079-domain-tools`, branch `task/t079-domain-tools`, on the
shared read-only Core at `F:\fxwork\!FluxIQ` (detached HEAD).

## Outcome

**Partial.**

- **A8 is built and proved in code, and did not pay off live.** Rejections now
  carry a closed reason, the handle the call named and, where it applies, the
  keys the tool takes — and three live builds show it does **not** on its own
  stop `evidence_repeat_without_progress`. The measured reason why is below, and
  it is the most useful thing this task found: the remedy the new reasons
  prescribe is a call Core's loop will not let the model make.
- **A11 is half done here and half blocked on Core, and the live runs moved the
  defect.** The domain now reports a refused permission with the classes Core
  said were missing and the id of the request now in front of the person, and
  tells apart "asked and refused" from "nobody to ask". The terminal throw the
  brief names is Core's and my worktree cannot edit Core, so what Core must
  change is written out below. Live testing then found a **larger hole than the
  throw**: no Flow step the build authors is ever put to the permission gate at
  all, so a Flow that publishes a post was authored and replayed under an empty
  grant with nobody asked anything.

## What changed and why

Everything is inside `domain/src/runtime/llm-evidence/**`. Nothing in
`apps/extension/**`, `packages/**`, or Core was touched.

### A8 — a rejection now says why

`tool-rejection.ts` gains `WEB_LLM_TOOL_REJECTION_REASONS` (19 closed reasons),
`WebLlmToolRejectionDetail` and a `detail` field on `WebLlmToolRejection`.
`recoverable(code, detail?)` and `RecoverableToolRejection(code, detail?, page?)`
carry it; `toolRejection(code, page?, detail?)` puts it on the wire; both catch
sites (`tools.ts`, `harness-options/execute.ts`) pass `error.detail` through.

Reasons are wired at every site that refused a call with a bare code:

| Where | Code | Reasons now distinguished |
| --- | --- | --- |
| `press.ts` `currentElementForReturnedTarget` | `target_unobserved` | `handle_not_in_packet`, `page_moved_since_packet`, `handle_no_longer_on_page`, `handle_names_several_now` |
| `harness-options/execute.ts` `shownPacket` | `target_unobserved` | `nothing_observed_yet` |
| `structure/detect.ts` `boundTarget` | `target_unobserved` | the same three that apply to a read-only binding |
| `tools.ts` / `execute.ts` / `detect.ts` input checks | `invalid_input` | `unexpected_input_keys`, `missing_input_keys` (both with `instead`: the tool's own declared keys), `malformed_handle` (with the handle echoed), `not_a_number`, `not_a_url` |
| `enter-field.ts` | `invalid_input` | `value_not_text`, `not_a_text_field` |
| `press.ts`, `execute.ts`, `tools.ts` | `no_progress` | `page_unchanged_after_action`, `already_at_destination`, `nothing_changed_while_waiting` |
| `tools.ts` navigate | `cross_origin` | `another_origin` |
| `press.ts` permission | `permission_required` / `invalid_input` | `consequences_not_granted`, `nobody_to_ask`, `consequences_unreadable` |

The press tool's description gained one sentence telling the model where the
reason for a turned-down call is and never to make the same call twice, pinned by
an assertion in `tools.test.ts`. Nothing was added to the other four
descriptions: they are sent on every call and the rejection object is
self-describing. **The three live runs below predate that sentence** — they
exercised the detail mechanism but not the prompt hint, so a later run is needed
before saying the hint does or does not help.

**What I changed about the deliberate content-free decision, and why the leak
concern still holds.** The old header said the reply carries a code so a refusal
can never be a side channel for the page content it was protecting. That guard
is kept and is now written as a rule with a boundary rather than as an absence.
A detail may contain exactly three kinds of thing:

1. **the model's own input echoed back** — the handle string it sent;
2. **this domain's own closed vocabulary** — one `reason` from the frozen list,
   the input keys a tool declares in its own JSON schema, and Core's consequence
   class names;
3. **an identifier Core minted** — the permission request id.

None of those is page-derived. No page text, no selector, no field value, no
count of what is on the page, and nothing from a capture the model was not
shown. Two things I considered and deliberately did **not** add, because both
would have crossed that line for little gain: the handles the latest packet
carries (they are meaningless to the model without the descriptions it already
has), and, for `handle_names_several_now`, the current handles the stale
selector now matches (those come from a capture the model was never shown, and
telling it to name one would invite a plan the resolver would refuse). The
reason alone carries the routing information in both cases.

A dedicated test holds the boundary: `tool-rejection-detail.test.ts`'s last case
drives four different refusals and asserts none of the page's own words appears
anywhere in the serialized results, while every one of them carries a reason.

### A11 — the domain half

`permission.ts` used to collapse Core's verdict to the string `"refused"`,
throwing away `missing` and `requestId`. It now returns a discriminated result
carrying both, and the two refusals are no longer one word:

- Core answered no → it has already raised a request the person will see, so the
  refusal is `consequences_not_granted` with `missing` and `requestId`;
- there was no check to pass → nothing was raised and nobody can answer, so the
  refusal is `nobody_to_ask`, still naming the classes.

`press.ts` turns each into a `permission_required` rejection carrying that
detail. This is the same product rule the brief cites: a blocked action is put to
a person, and the run is told enough to route around it or to say what it needs.

## Commands run and observed results

All in `F:\fxwork\t079-domain-tools`.

| Command | Observed |
| --- | --- |
| `npx tsc -p domain/tsconfig.json --noEmit` | no output (clean) |
| `npx tsc -p domain/tsconfig.test.json` | no output (clean) |
| `DOMAIN_TEST_BUILD_LABEL=t079 node domain/scripts/test-domain.mjs` | first run `# tests 724 / # pass 715 / # fail 9` — nine existing tests asserting the bare-code shape. After updating them and adding the new file: **`# tests 730 / # pass 730 / # fail 0`** |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (88 warning(s), 122 baselined)` |
| `pnpm check` | **exit 0**, run twice (before and after the last edit) — structure audit, lab tests, task tests, and `check` for all ten workspace projects |

### Live runs (real DeepSeek from `.env.local`, isolated Lab target)

Run with `FLUXIQ_TEST_ENV_FILES=none` so the machine's `.env.local`
`FLUXIQ_TEST_TARGET=existing` did not apply; the Lab therefore brought up its own
isolated FluxIQ and **no web panel was started or managed**. Each run had its own
`FLUXIQ_LAB_INSTANCE`. No `--llm-permit` on any of them, so every grant permitted
nothing.

| Run | Task | Ending | Build calls vs observed |
| --- | --- | --- | --- |
| `run-mud4ywy4-45c2002f` | `social-scheduler-schedule-post` | **passed** — Flow created and replayed, post scheduled | `build.providerCalls` 5 == `observed.calls` 5 |
| `run-mud56nn0-3ebd0cf2` | `everything-store-first-page-plus-earbuds` | failed `flow_bootstrap.evidence_repeat_without_progress` | 18 == 18 |
| `run-mud586eq-020ced97` | `everything-store-buy-kettle` | failed `flow_bootstrap.evidence_repeat_without_progress` | 15 == 15 |

Total reported cost across the three: about **$0.20**.

#### A8 did not stop the stall, and here is the mechanism

`run-mud56nn0-3ebd0cf2`'s eighteen decisions, in order (`build.evidenceLoop.steps`):

```
inspect ok | press ok | navigate ok | press ok | detect ok | inspect ok
inspect ALREADY_ANSWERED | press ok | inspect ok | inspect ALREADY_ANSWERED
detect ok | inspect ALREADY_ANSWERED | inspect ALREADY_ANSWERED
press REJECTED target_unobserved | navigate REJECTED no_progress
press ALREADY_ANSWERED | detect ALREADY_ANSWERED
navigate -> repeat_without_progress (build ends)
```

`run-mud586eq-020ced97` has the same shape: a `no_progress` navigate, the same
navigate repeated, a `target_unobserved` press, two more repeated navigates, end.

Two things follow, and they are why A8 alone is not enough.

1. **Most of the repeats are not rejections at all.** Six of the eighteen
   decisions in the first run are `llm_evidence_loop.already_answered`, four of
   them `web.inspect_current_page`. Those never reach this domain, so no detail
   this task added could have changed them.
2. **The remedy the new reasons prescribe is the call the loop refuses.**
   Every handle reason says some form of *look at the page again*. Core's loop
   answers a repeated request from what it already holds, keyed by
   `canonicalJson([mutationEpoch, toolId, input])`
   (`runtime/llm/evidence-loop.ts:546`), and `mutationEpoch` advances only on a
   mutating tool whose effect was applied (`:585`). A **refused** press applies
   no effect, so the epoch does not move, so the inspect that the refusal just
   told the model to make has the same signature as the last inspect and comes
   back as `already_answered` — which increments `stepsWithoutProgress`
   (`:406`) and walks the build toward `repeat_without_progress` (`:410`).

   So a model that obeys the new reason is punished for obeying it. A8 cannot
   pay off until a refused call either advances the epoch or the loop stops
   treating a post-refusal re-observation as a repeat. That is Core's loop, not
   this domain's, and it is squarely in this plan's A stream (d1 finding 4, the
   missing wait tool, is the same wound seen from another side).

I could not prove from the run artifacts that the detail reached the model: no
Lab artifact retains the evidence packets (by design — `exploration` is `null`,
`core.log` is eight lines, and nothing under the run directory contains
`web-llm-tool-result`). What is proved is that `executeTool` returns the detail
inside the tool result (unit tests drive the real runtime), and that Core's loop
pushes a tool result's evidence verbatim into the model's evidence window
(`evidence-loop.ts:588`). Since the window keeps the newest entry per tool id,
the rejection was the newest entry for its tool when the model repeated the call
— so the likeliest reading is that the model saw the reason and repeated anyway,
which is consistent with (2) above, but I did not observe the packet.

#### A11's live result: the gate never fires on the authoring path

`run-mud4ywy4-45c2002f` passed with **no permit granted**, and its record says:

```
build.outcome            "proposed"
build.permissionRequest  null
build.instructedConsequences  []
flowShape   9 nodes: 2x web.dom.click, 3x web.dom.type, 3x web.dom.select, 1x web.dom.extract_list
oracleVerdict            "passed"   (the scenario's schedule-a-post goal)
```

A nine-node Flow that fills the scheduler's composer and submits it — a
`send_or_publish` act — was authored and then replayed with zero provider calls,
under a grant that permitted nothing, and **nobody was asked anything**.
`instructedConsequences: []` means the build never asked the gate at all rather
than the gate having permitted it.

The cause is a seam that is wired on Core's side and unwired on this one. Core
hands the domain a permission check with **every plan node**
(`runtime/llm/harness-options/plan-parameter-resolution.ts:72` and `:119-125`,
falling back to `automationStudioActionPermissionDenied`). The web domain's
`WebPlanNodeResolutionInput` (`plan-resolution/resolve-plan-node.ts:103-108`)
does not declare that field and `resolveWebPlanNodeParameters` never calls it, so
every Flow step passes ungated. Meanwhile the exploration press tool tells the
model that revealing and opening are `consequences: []`, and the lasting act is
always deferred to the Flow. The result is that the only place a consequence can
be declared is the one place nothing declares one.

I did not close this here, because the domain cannot honestly fill it alone: the
build's completion is a single `flow: string` in a plain-text grammar
(`flow-bootstrap/plan/evidence-schema.ts:31-45`), so the model has nowhere to
declare a step's consequences, and for the domain to infer them from what a
control looks like is exactly the judgement the standing product rule forbids.

## What Core must change

My worktree is flat on the shared Core, which is detached and read-only and is
used by every other task worktree beside it, so I made no Core edit. Three
changes, in order of how much they matter:

**C1 — no Flow step is ever put to the gate (the larger hole, found live).**
Core's Flow-script grammar must let the model declare each action step's
consequence classes, and
`resolveAutomationStudioFlowBootstrapPlanParameters` must pass them into the
check it already builds at `plan-parameter-resolution.ts:72`. Once that exists I
can add `permission` to `WebPlanNodeResolutionInput` and call it per node in one
short change here. Until then the authoring path gates nothing it authors.
Evidence: `run-mud4ywy4-45c2002f` above.

**C2 — the terminal throw the brief names.**
`runtime/flow-bootstrap/action-permissions.ts:72-80` discards the refusal the
domain already produced and throws. Handing it back needs three edits together,
not one:

- `action-permissions.ts:78` — return `execution` instead of throwing, so the
  refusal reaches the model as an ordinary tool result (it now carries `missing`
  and `requestId`, so it is routable);
- `action-permissions/gate.ts:159` — `this.stopped.abort()` on the first raised
  request ends the loop through `signal` regardless of the line above, so for
  `stage: "authoring"` the abort must not fire on the first request; the request
  is already recorded in `this.raised` and read back at the end;
- `service.ts:1928` — `if (askedPermission) throw askedPermission;` runs before
  `loop.ok`, so **any** raised request ends the build as
  `flow_bootstrap.permission_required` even if the model then built a good Flow
  another way. It must end on the request only when no Flow was completed, and
  otherwise propose the Flow **and** carry the request.

That last edit changes what a successful build means: whoever does it must decide
whether a *proposed* build may carry an unanswered request, which today the API
contract forbids — `api/contracts/adaptation.ts:133` says `permissionRequest` is
"present exactly when `code` is `flow_bootstrap.permission_required`".

**C3 — a refused call leaves the model nothing it is allowed to do.** See the
mechanism above: `evidence-loop.ts:546` and `:585`. Either a refused call must
advance the mutation epoch, or a re-observation that follows a refusal must not
count as a repeat. Without this, A8's detail is information the model cannot act
on, and this is the single change most likely to convert the
`repeat_without_progress` endings.

## Not verified

- That the `detail` object reaches the model's prompt in a live build. Proved in
  code and by unit tests through the real runtime; not observable in the Lab's
  artifacts, which retain no evidence packets.
- That any of the new reasons changes a live model's next call. Three live builds
  is far too small a sample, and the two that stalled stalled for the reason in
  C3 rather than for want of a reason.
- The brief's A11 acceptance case — a run ending in a permission request naming
  the classes — was **not produced**, and the live runs say why: no gated action
  on this corpus ever reaches the gate (C1). The permission path itself is
  covered by unit tests driving the real press tool, not by a live run.
- No browser-level validation of the extension; the changes are domain-side and
  the Lab runs exercised them through a real Chromium extension only
  incidentally.
- `reason: "handle_names_several_now"` and `nothing_changed_while_waiting` are
  proved by unit test only; no live run hit either.

## Open questions or contradictions found

1. **The brief's premise for A11 is out of date in one respect and understated
   in another.** It says permission is "terminal on the authoring path... rather
   than handing the refusal back". That is true of the throw, but Core already
   converts a raised request into a first-class `flow_bootstrap.permission_required`
   outcome carrying the request (`generation-failure.ts:344`, `service.ts:1928`),
   and the Lab already reads it into a `permission_required` build outcome with
   the missing classes (`flow-lane/creation/build-proposal.ts:95-104`). So the
   escalation to the person exists. What does **not** exist is anything that
   reaches it from the authoring path, which is C1.
2. **The user's instruction is meant to be an authority, and on this corpus it
   makes the brief's A11 test unreachable by construction.** Core permits a
   consequence that the person's own instruction asks for
   (`action-permissions/gate.ts:137-138`, `instructed.ts`). Every corpus task
   that needs a gated action asks for it in plain words, so even a correctly
   wired gate would permit rather than ask. A live permission request needs a
   task whose instruction does **not** ask for the act the model reaches for —
   the corpus has no such task today, and the plan should add one if A11 is to
   be measured live rather than by unit test.
3. **`everything-store-buy-kettle`'s own documentation is now wrong.** Its
   comment in `apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts`
   says "Unless the run is granted permission to place an order, its correct end
   is a permission request at 'Place your order', never the order." Measured:
   the build never got that far, and had it done so nothing would have asked.
4. **A8 and the plan's A stream are one change, not two.** I would not treat A8
   as landed value until C3 lands, and the step table should say so: the reason
   text and the loop's repeat rule have to agree about what the model is allowed
   to do next, and today they contradict each other.
