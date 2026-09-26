# t157 — A shrinking draft is still a draft

## Outcome

Done. It is a real defect in `entry.ts`, not a stale test: the test asserted the
contract the module's own header comment promises and the code stopped honouring
it at commit `b2fab59`. Fixed, with the boundary pinned by new tests.

**It did not affect `run-muhubegx-9469de5e`.** The live profile's draft budget is
4,000 bytes and that run's draft needed roughly 900 of them, so the model saw its
draft on every call. The nine amendments and seven no-ops have another cause. The
defect is a latent hazard for any smaller context budget, described below.

## What it actually is

`automationStudioFlowDraftEntry` shrinks a draft to fit `maxBytes` by dropping
arguments oldest-first, then dropping the oldest steps. It never shrinks the one
thing that does not depend on how long the exploration ran: `DRAFT_INSTRUCTION`,
a fixed block of guidance. That instruction is a floor under every entry, and
when the floor is above `maxBytes` no rung of the ladder can fit, so the function
fell out of its loop and returned `undefined` — the same value it returns for "no
actions taken yet". The caller cannot tell those two apart.

Measured floors, on committed `dev` before this change:

| Figure | Bytes |
| --- | --- |
| Instruction only, entry with zero steps | 1,109 |
| Least possible entry: one step, no argument | 1,206 |
| One bare step line | 83 |

The test passes `maxBytes: 900`. 900 < 1,109, so the entry could never be
produced at any number of steps, and `trimmed.steps` threw on `undefined`.

It broke at a datable commit. The instruction has grown three times; the
empty-entry floor with it:

| Commit | Instruction chars | Empty-entry bytes | Fits 900? |
| --- | --- | --- | --- |
| `6bb47f8` | 491 | 553 | yes |
| `0607038` | 678 | 740 | yes |
| `3c878f4` | 678 | 740 | yes |
| `20d008e` | 678 | 740 | yes |
| `b2fab59` "Reaching the page is the work…" | 1,047 | 1,109 | **no** |

`b2fab59` added four sentences about not marking navigation exploratory. Those
sentences are right and are why the loop's last few tasks work; nothing told the
author that the same paragraph is a fixed tax on a budget shared with the record
of what the build ran.

This is the same failure shape as the others fixed today: a computed answer
discarded at a boundary. Twelve real steps were thrown away so a 1,047-character
paragraph could be kept whole, and the discard was reported as "nothing to show".

## What changed and why

`flow-draft/entry.ts`

1. **The instruction now has three lengths, and shortening it comes before
   dropping a step.** `DRAFT_INSTRUCTION` (1,047 chars) is unchanged and is still
   used whenever it fits. `DRAFT_INSTRUCTION_BRIEF` (561) keeps every rule and
   drops the elaboration; `DRAFT_INSTRUCTION_MINIMAL` (154) keeps only the two
   things the model cannot act without — that the list is the Flow in order, and
   that `amend_draft` is how it is corrected. No rung drops the instruction
   entirely: an entry the model does not know it may amend is barely better than
   no entry. The record outranks the prose because the `amend_draft` schema states
   the grammar again and nothing else states what the build ran.
2. **The ladder is: all arguments → fewer arguments oldest-first → a shorter
   telling (arguments offered again at each length) → fewer steps oldest-first.**
   A step's own argument is worth more than prose the schema repeats, so once the
   telling is shorter the arguments get another chance at the room it freed.
3. **A draft with steps in it always produces an entry.** When no rung fits, the
   least entry — newest step, no argument, shortest telling, 402 bytes — is
   returned over budget rather than `undefined`. `undefined` now means only
   "this build has taken no action a Flow could be made of", which is what the
   caller reads it as.
4. **The entry names what it left out.** New `omitted`, a short list beside the
   existing `unlisted` count: "the argument each step ran with" / "the argument of
   the N oldest steps", and "most of the guidance on amending a draft". The notes
   are deliberately terse — they are paid for by exactly the entries that could
   least afford a sentence, and a first draft of them cost 175 bytes, two steps'
   worth, which the sweep test caught.
5. **A per-step `inputTooLarge: true`** where an argument was held back by the
   512-byte per-step cap, so a blank `input` does not read as a step that ran
   without one.

`flow-draft/tests/entry.test.ts` — three new tests and one widened:

- "tells the instruction shorter before it drops a step": at 1,600 bytes all
  twelve steps are still listed with a shorter telling, plus a sweep from 2,500
  down to 400 in 50-byte steps asserting the invariant directly — there is always
  at least one step, and no step is dropped while a shorter telling exists.
- "counts the oldest steps it could not list once the telling is as short as it
  goes": 40 steps at 900 bytes lists the newest 6, `unlisted: 34`, contiguous.
- "is still a draft when the budget cannot hold one": `maxBytes: 1` yields the
  newest step, `unlisted: 11`, an instruction containing `amend_draft`, and
  `omitted` naming both the arguments and the guidance.
- the over-large-argument test now also asserts `inputTooLarge`.

The pre-existing failing test is unchanged and now passes. `amendment.ts` was not
touched, so its refusal-reason union is untouched.

### How the entry now behaves (measured, 12 steps of `{target, note}`)

| `maxBytes` | Result bytes | Steps listed | With argument | Instruction chars | `unlisted` |
| --- | --- | --- | --- | --- | --- |
| 8,000 | 2,469 | 12 | 12 | 1,047 | 0 |
| 2,000 | 1,999 | 12 | 9 | 575 | 0 |
| 1,600 | 1,578 | 12 | 9 | 154 | 0 |
| 1,400 | 1,398 | 12 | 3 | 154 | 0 |
| 1,300 | 1,233 | 11 | 0 | 154 | 1 |
| 900 | 818 | 6 | 0 | 154 | 6 |
| 300 | 402 | 1 | 0 | 154 | 11 |
| 1 | 402 | 1 | 0 | 154 | 11 |

The full telling survives to about 34 listed steps at the live 4,000-byte budget,
so a typical build sees exactly what it saw before. Past that the telling
shortens instead of the record being cut, which is the intended trade.

## Blast radius: every caller of the entry

There is exactly one production caller.

1. **`runtime/llm/evidence-loop.ts:412`** —
   `const draftEntry = drafting ? automationStudioFlowDraftEntry({ steps: draftSteps, maxBytes: limits.draftBytes }) : undefined;`
   then `const beside = [draftEntry, budgetEntry].filter((entry) => entry !== undefined);`
   **What it did when the entry yielded nothing: nothing at all.** The draft was
   silently absent from `beside`, the window was given the bytes the draft did
   not use, and the model was asked to decide — including to amend — with no
   record of what it had run. No refusal, no trace entry, no log line. This is the
   whole exposure, and it is why the failure could sit on `dev` visible only as a
   unit test.
2. **`runtime/llm/evidence-loop.ts:80`** re-exports
   `AUTOMATION_STUDIO_FLOW_DRAFT_TOOL_ID` only. No behaviour.
3. **Tests**: `flow-draft/tests/accrual.test.ts` (reads the entry out of the
   evidence shown to a stubbed `decide`, and at line 158 asserts its absence when
   `draft: false`, which is unaffected — `drafting` is false there) and
   `flow-draft/tests/entry.test.ts`.

**Nothing anywhere parses the entry back.** Grepped `core.flow_draft`,
`llm_evidence_loop.draft` and `AUTOMATION_STUDIO_FLOW_DRAFT_TOOL_ID` across
`packages/fluxiq/src` and across the extension repo's `apps`, `domain` and
`packages`: the extension repo has no reference at all. So adding `omitted` and
`inputTooLarge` cannot break a consumer; the entry is model-facing only.

### Which configurations were showing the model no draft

`draftBytes = draft?.maxBytes ?? Math.min(4_000, floor(maxEvidenceContextBytes / 4))`
(`llm/loop-configuration.ts:282`), and `resolveLimits` only requires
`maxEvidenceContextBytes >= 1_024`.

- Pre-fix, the entry was **impossible** whenever `draftBytes < 1,206`, i.e.
  whenever `maxEvidenceContextBytes < 4,824`. Any profile in the legal range
  1,024–4,823 had the draft silently switched off on every call of every build.
- The live build profile sets `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES = 24_000`
  (`runtime/loop-limits/flow-bootstrap-evidence-loop.ts:91`) → `draftBytes` 4,000,
  well clear of the floor. Live runs were not affected.
- `flow-draft/tests/accrual.test.ts` uses `maxEvidenceContextBytes: 6_000` →
  `draftBytes` 1,500, of which the instruction was taking 1,109 (74%), leaving
  ~390 bytes — about four bare steps — for the record. That test passes today by
  roughly ten bytes. Post-fix the same budget carries about fifteen.

## Did it cause the nine amendments in `run-muhubegx-9469de5e`? No.

Evidence from `test-runs/run-muhubegx-9469de5e/snapshots/flow-lane.json`:

- 33 provider calls, 32 loop decisions, 19 tool calls; `draftBytes` for that
  profile was 4,000 and the pre-fix floor 1,109, leaving 2,891 bytes — room for
  34 bare steps.
- Only steps with `effect: "mutate"` (or `proposes`) are listed
  (`flow-draft/step.ts:200`). The run's mutating node runs are iterations
  0, 2, 3, 4, 5, 6, 7, 20 — eight, plus the rerun at 26. Nine step lines cost
  about 750 bytes bare, comfortably inside 2,891 even with arguments. The entry
  was produced on every call.
- Direct confirmation that the model could read it: iterations 13 and 17 recorded
  `llm_evidence_loop.draft_amended` and iteration 26 recorded
  `llm_evidence_loop.draft_rerun`. An amendment that names a step and changes the
  draft is not available to a model that was shown no draft.
- The five consecutive `llm_evidence_loop.draft_unchanged` decisions at iterations
  27–31 all report `inputTokens: 15463`, identical — the request was byte-stable
  across them. The draft was present and unchanged, and the model kept sending an
  amendment that did nothing. That is a different defect, in what a no-op
  amendment is answered with, not in what the model was shown.

So the honest answer to the brief's hypothesis is no. The draft-entry boundary was
broken, and it was not what broke that run.

## Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq`:

- `npx vitest run src/programs/automation-studio/runtime/flow-draft` **before**
  the change: `Test Files 1 failed | 4 passed (5)`, `Tests 1 failed | 37 passed
  (38)`, the failure being `entry.test.ts > drops arguments before it drops steps
  … → Cannot read properties of undefined (reading 'steps')` at line 46.
- Same command **after**: `Test Files 5 passed (5)`, `Tests 41 passed (41)`.
- `npx tsc --noEmit` → exit 0, no output (run again after the final edit).
- `npx vitest run src/…/runtime/llm src/…/runtime/flow-bootstrap` →
  `Test Files 76 passed (76)`, `Tests 1071 passed (1071)`.
- `npx vitest run src/…/runtime/tests/service-bootstrap` →
  `Test Files 13 passed (13)`, `Tests 81 passed (81)`.

From `F:\!FluxIQ`:

- `node scripts/structure-audit.mjs` → `structure-audit: passed (182 warning(s),
  358 baselined)`, exit 0. The only `flow-draft` line is a pre-existing advisory
  on `dry-run.ts` (12 exported values), which I did not touch. It also reports
  "2 baseline entries can be lowered"; I did **not** run `pnpm structure:baseline`.

`flow-bootstrap/tests/t152-scratch-projection.test.ts` is not present.

## Not verified

- No live run. Whether a shortened telling changes how the model amends is a
  provider-behaviour question a unit test cannot answer, and at the live 4,000-byte
  budget a typical build never reaches the shortened telling anyway.
- The over-budget floor entry. `maxBytes` would have to be under ~400 for it to
  fire, which needs an explicit `draft: { maxBytes: … }` below that; no caller
  sets one. I read `context-window.ts` and its `choose()` compares
  `used + added > maxBytes`, so a window handed a smaller or negative budget
  selects nothing rather than misbehaving — but I did not exercise that path.
- `pnpm check` / `pnpm test` / `pnpm build` for the whole package were not run:
  four other workers are editing Core concurrently and the result would not be
  attributable. I did not build Core, per the brief.

## Open questions for the supervisor

1. **`draftBytes` should have a floor of its own.** The resolver happily produces
   a budget smaller than the smallest useful entry; post-fix that no longer loses
   the draft, but it does silently drop to the 154-character telling. A validation
   line in `resolveLimits` (owned by `runtime/llm/`, which I must not touch)
   rejecting `draftBytes` below, say, 1,200 would make the configuration mistake
   loud instead of quiet. Worth a task.
2. **The caller cannot see that the draft shrank.** `evidence-loop.ts` reserves
   `limits.draftBytes` and never learns whether the entry fitted. The run record
   consequently cannot answer "was the model shown its whole draft?" without
   reconstructing the steps, which is what I had to do here. One number in the
   trace — draft entry bytes, and the count it left unlisted — would make the
   next debug a lookup.
3. **The instruction is unversioned prose on a shared budget.** It has grown from
   491 to 1,047 characters in five commits with nothing measuring the cost. The
   three lengths absorb the next growth, but a test asserting that the full
   telling still fits the live budget at N steps would catch the growth that
   silently shortens every entry.
