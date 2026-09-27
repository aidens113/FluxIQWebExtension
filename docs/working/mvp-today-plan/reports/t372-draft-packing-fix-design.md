# t372 — measured draft-packing correction

## Selection

Change Core's draft entry from an instruction-first lossy ladder to a
lossless-first, bounded packing ladder. Keep the resolved draft budget at 4,000
bytes and keep every provider-call, token, cost, timeout, evidence-context, and
run ceiling unchanged.

The measured defect is local to `runtime/flow-draft/entry.ts`. Its comments say
that a step's input is worth more than repeated amendment prose, but
`trimmings()` nests `withInput` inside `instruction`. Consequently it accepts a
full-instruction candidate after dropping inputs without first trying a shorter
instruction or a denser lossless representation. The discriminator measured the
result: decisions 23–26 still list every retained step but withhold 4, 10, 15,
and 21 inputs respectively at 3,990–3,995 of 4,000 bytes. Feedback, decision
grammar, catalog visibility, step count, and the successful decision-11 branch
all remained correct.

## Exact production algorithm

Implement the following candidate order in
`packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts`.
Return the first serialized candidate no larger than `maxBytes`.

1. Preserve the current object-per-step representation with every bounded input
   and the full instruction. This keeps short and ordinary drafts byte- and
   shape-compatible.
2. If that does not fit and every listed input passes the existing 512-byte
   `boundedInput` rule, try a lossless packed representation, first with the full
   instruction, then the brief instruction, then the minimal instruction.
3. Only after all lossless candidates fail may inputs be withheld, oldest first.
   Use the packed representation with the minimal instruction while decreasing
   the number of inputs retained.
4. Only after no all-step candidate fits may oldest steps be unlisted, retaining
   the newest contiguous suffix and the current `unlisted` count.
5. Preserve the current least-entry over-budget fallback. A non-empty action
   draft must never become absence.

The packed value remains self-describing JSON:

```ts
{
  code: "llm_evidence_loop.draft",
  format: "step_rows_v1",
  fields: [
    "step", "actionId", "input", "resultCode", "changed",
    "disposition", "inResult", "replayed", "runs", "settings"
  ],
  steps: [
    [1, "<action id>", { /* the same bounded model-written input */ }, null,
      "yes", "kept", true]
  ],
  instruction: "..."
}
```

Every row contains the first seven positions. Optional trailing values are
included through the last present optional field, with `null` placeholders when
needed. No value is inferred from omission: the packed form removes repeated
field names, not semantics. Routing continues to be rendered by the existing
`routingLine`; settings and replay state are copied under the same conditions as
today. Do not pack a draft containing an input rejected by `boundedInput`; keep
the current object line with `inputTooLarge: true` so that distinction cannot be
mistaken for budget withholding.

Candidate comparison is lexicographic and deterministic:

1. all listed steps;
2. all eligible inputs;
3. more retained inputs;
4. longer instruction;
5. more listed steps.

This ordering is the invariant the present generator violates. It also avoids a
global shape change: decisions whose existing full object entry fits continue to
receive exactly that entry, while only entries that would otherwise lose input
switch to the named packed format.

## Files

Production:

- `runtime/flow-draft/entry.ts` — add the packed row builder and replace the
  trimming order with the lossless-first candidate ladder.
- `runtime/llm/evidence-loop/draft-shown.ts` — measure both the existing object
  lines and exact `step_rows_v1` rows. Rejecting or not recognizing the exact
  format must not silently report zero withheld inputs.

Tests:

- `runtime/flow-draft/tests/entry.test.ts`
- `runtime/flow-draft/tests/entry-budget.test.ts`
- `runtime/llm/evidence-loop/tests/draft-shown.test.ts`
- `runtime/tests/deepseek-bootstrap-exploration.test.ts`

No change is selected for `llm/loop-configuration.ts` or
`llm/context-window.ts`. The draft remains a beside entry with a 4,000-byte
reservation; the evidence window receives exactly the same remainder. No public
trace shape or downstream parser change is required because `draftShown`
continues publishing the existing counts and byte measurement rather than the
entry's internal encoding.

## Deterministic assertions

Before the correction, retain the discriminator's measured regression as the
red assertion:

```text
decision 23: 19 steps, 3,990/4,000 bytes, withoutInput 4
decision 24: 20 steps, 3,978/4,000 bytes, withoutInput 10
decision 25: 21 steps, 3,995/4,000 bytes, withoutInput 15
decision 26: 22 steps, 3,991/4,000 bytes, withoutInput 21
```

After the correction, the exhaustion branch must assert for every decision
11–26:

- `steps === iteration - 4` (7 through 22);
- `unlisted === 0`, `withoutInput === 0`, and `inputTooLarge === 0`;
- `bytes <= 4_000` and `overBudget === false`;
- completion feedback, offered decision kinds, and registered/visible producer
  counts remain exactly as pinned by t365/t368.

The companion convergence branch at decision 11 must remain seven complete
steps within 4,000 bytes and otherwise byte-for-byte equivalent in its
provider-visible draft entry. Unit tests must additionally prove:

- an ordinary fitting entry stays in the existing object representation;
- the first overflowing bounded-input entry selects `step_rows_v1`, retains all
  inputs, and is within budget;
- two calls with the same steps and budget serialize identically;
- packed rows preserve non-default result, change, disposition, result-membership,
  replay, routing, and settings values;
- a greater-than-512-byte input still produces the existing
  `inputTooLarge: true` object line;
- when even packed minimal cannot fit, input withholding remains oldest-first,
  step removal remains oldest-first/contiguous, and the measurement exactly
  reports both; and
- the least-entry fallback still returns a draft and reports over-budget.

## Privacy and compatibility

The packed entry carries only fields already sent today: Core bookkeeping and
the model-written action input. It adds two closed static literals (`format` and
`fields`) and adds no provider output, page/result value, selector recovered
from evidence, digest, prompt, instruction quote from the user, or raw artifact.
The public diagnostic remains counts, booleans, and byte measurements only.

Provider-visible compatibility is explicit rather than implicit: the format
names every column, preserves every value, and is used only when the old shape
would already hide an input. Existing short drafts are untouched. Stored traces
do not persist the packed entry, so no stored-record migration or downstream
wire change is needed.

## Validation order

1. Run the three focused entry/measurement test files.
2. Run the deterministic `reproduces|converges` service fixture. Both tests must
   pass, including zero withheld inputs through decision 26.
3. Run the full Automation Studio runtime-focused suite and Core `pnpm check`.
4. Re-run the established Core root suite and downstream propagation/privacy/
   accounting closure before any new no-hindsight live authorization.

This correction does not claim provider convergence. It removes the one
measured provider-visible information loss while holding every live ceiling
constant; only the next separately authorized live measurement can establish
whether preserving those inputs changes convergence.

## Scope

I read the assigned reports, MVP Current State, Core instructions and structure
rules, and only the bounded draft/config/context-window source and tests. I did
not invoke a provider, inspect raw/live artifacts, edit shared working documents,
commit, or push.

## Implementation and focused validation

Implemented the selected seam in the three authorized Core files:

- `runtime/flow-draft/entry.ts` now returns the existing object entry unchanged
  whenever its complete form fits. When it would otherwise lose information and
  every input passes the existing 512-byte bound, it tries deterministic
  `step_rows_v1` candidates with input count outermost and instruction length
  innermost. Input withholding remains oldest-first, step removal remains the
  final trade, and oversized inputs stay in the existing object form with
  `inputTooLarge: true`.
- `runtime/flow-draft/tests/entry.test.ts` now proves representation stability,
  self-description, deterministic serialization, lossless input retention,
  preservation of result/change/disposition/membership/replay/routing/settings,
  oversized-input compatibility, contiguous trimming, and the least-entry
  fallback.
- `runtime/flow-draft/tests/entry-budget.test.ts` now proves a 20-step live-budget
  draft retains all 20 bounded inputs under 4,000 bytes rather than withholding
  some of them.

Observed validation:

```text
pnpm --filter fluxiq exec vitest run
  src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts
  src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts
PASS — 2 files, 15 tests

pnpm --filter fluxiq check
PASS — tsc --noEmit
```

The first package check exposed test-only typing errors in the new assertions;
those were corrected, then both focused tests and the package check were rerun
and observed passing. Per the implementation brief, `draft-shown.ts` and the
service fixture were not edited or run; their packed-row support and exact
decision-23-through-26 proof remain the next serial integration step.
