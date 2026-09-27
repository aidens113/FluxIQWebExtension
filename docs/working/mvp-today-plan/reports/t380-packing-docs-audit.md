# t380 — draft-packing authored-doc audit

## Verdict

**GO for one Core authored-document update.** The supervisor reports that t381
independently returned GO on the t377 production fixes. The minimal authored-doc surface is
`F:/!FluxIQ/docs/architecture/automation-studio/llm-flow-bootstrap.md`. No
downstream architecture document, separate draft/evidence architecture page,
or generated reference needs a matching edit.

The Core architecture file is already dirty from another in-flight unit. Its
current diff adds the convergence-fact paragraph under evidence-guided
generation. Integrate the wording below with that change; do not replace or
discard the existing permission-boundary edits.

## Exact locations and proposed wording

### 1. Describe the internal provider-facing draft projection

Location: `llm-flow-bootstrap.md`, under **Blank-Flow authoring UI →
Evidence-guided generation**, immediately after the paragraph ending “A
completion the check accepts is persisted as it was checked.” (currently lines
499–513), and before “These diagnostics retain only …”.

Proposed wording:

> Each provider decision also receives a bounded Flow-draft beside entry. Its
> live reservation remains 4,000 UTF-8 bytes: one quarter of the configured
> evidence-context window, capped at 4,000. A complete draft that fits
> keeps the existing object-per-step representation byte-for-byte. When that
> representation would otherwise omit an eligible bounded input, Core may
> encode the same values as the self-describing `step_rows_v1` projection. Its
> exact columns are `step`, `actionId`, `input`, `resultCode`, `changed`,
> `disposition`, `inResult`, `replayed`, `runs`, and `settings`; each row has the
> seven required cells and only the trailing optional cells it needs. The
> candidate order preserves all listed steps and all eligible inputs before
> trading instruction detail for content, then withholds oldest inputs and
> finally unlists oldest steps only when no lossless candidate fits. An input
> rejected by the existing 512-byte input bound remains in the object form as
> `inputTooLarge: true`, distinct from budget withholding.

Why this is the minimum useful statement:

- It identifies `step_rows_v1` as an internal provider projection rather than a
  public contract.
- It states legacy-shape compatibility for ordinary fitting drafts.
- It states the lossless-first invariant and the existing oversized-input
  distinction without documenting implementation helpers.
- It does not claim that packing itself changes answerability or convergence.

### 2. Make measurement strict and the public boundary explicit

Location: the immediately following diagnostics paragraph, specifically after
the existing sentence beginning “A trace row also carries bounded,
content-free convergence facts: the measured draft shape …” (currently lines
515–525 in the dirty working copy).

Proposed wording:

> Draft-shape measurement accepts either the legacy object steps or the exact
> `step_rows_v1` format and ten-column declaration. Packed rows must contain
> seven through ten cells; a `null` input cell is measured as withheld. An
> unknown format, a missing or reordered field declaration, or a malformed row
> fails closed instead of being reported as zero omissions. The trace retains
> only the existing counts, booleans, and serialized-byte measurement; it does
> not retain the draft entry or its step inputs.

This preserves the current public diagnostic shape. It avoids implying that the
format discriminator, field catalog, rows, or input values are persisted or
added to a wire DTO.

### 3. Correct the nearby stale limits and pin the evidence level

Location: replace the stale limit sentence in the paragraph beginning “The
coordinator distinguishes cumulative audit evidence from model-visible
context.” It currently says “The production Bootstrap lane uses an 8,000-byte
context window and a 64,000-byte cumulative ceiling” (currently lines 652–658).
The 4,000-byte draft allocation sentence belongs in the new draft-projection
paragraph above so the three values remain distinct.

Proposed wording:

> The production Bootstrap lane uses a 24,000-byte context window and a
> 1,048,576-byte cumulative evidence ceiling; domain adapters may impose a
> smaller result cap. The draft is a beside entry inside that context, so its
> serialized bytes reduce the room available to ordinary evidence records for
> that decision; packing changes neither that allocation rule nor the
> 4,000-byte draft cap. The packing correction does not change provider-call,
> token, cost, timeout, decision, or retry ceilings. Provider-free deterministic
> fixtures establish exact measurement and input retention under those limits;
> they do not establish provider convergence or a live product outcome.

The stale 8,000/64,000 values **must be corrected now**, not deferred as
unrelated cleanup. They are in the exact evidence-context paragraph adjacent to
the new draft-budget statement, and leaving them would make the architecture
contradict both current production configuration and the “unchanged ceilings”
claim. The packing change did not raise these limits; they changed earlier and
the authored documentation failed to follow them.

Current-source basis:

- `runtime/loop-limits/flow-bootstrap-evidence-loop.ts` exports
  `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES = 24_000` and passes it as
  `maxEvidenceContextBytes`. Its history comment explicitly identifies 8,000 as
  the old value.
- `runtime/loop-limits/evidence-loop.ts` exports the hard cumulative
  `maxEvidenceBytes: 1_048_576`. The Flow Bootstrap limit resolver passes that
  ceiling through; its history comment explicitly identifies 64,000 as the old
  value.
- `runtime/llm/loop-configuration.ts` derives `draftBytes` as one quarter of
  `maxEvidenceContextBytes`, capped at 4,000. It selects ordinary evidence with
  `maxEvidenceContextBytes - besideBytes`, so wording that the projection leaves
  an identical byte remainder would be too strong: the allocation rule is
  unchanged, while a denser serialized draft can leave more actual room.
- `runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts` pins the
  default 26-call Flow Bootstrap to `maxEvidenceContextBytes: 24_000` and the
  shared 1,048,576-byte cumulative ceiling.
- `runtime/llm/tests/evidence-loop.test.ts` proves the loop can gather beyond
  the old 64,000-byte limit while every decision remains within 24,000 bytes,
  and that each tool is offered 23,488 bytes (the context less 512).
- `runtime/llm/tests/evidence-loop-draft-shown.test.ts` pins the live context to
  `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES` and the derived draft budget to
  4,000 bytes.

The evidence sentence is deliberately narrow. From the assigned reports, the
provider-free facts available to cite are:

- the corrected observer rejects malformed packed catalogs/rows rather than
  producing a false zero;
- the exhaustion fixture pins decisions 11–26 to 7–22 steps, zero unlisted,
  zero withheld, zero oversized, and at most 4,000 bytes;
- the same-prefix convergence branch remains complete at decision 11 with
  seven steps and the same 4,000-byte ceiling; and
- no provider or live run was invoked for t372/t375/t377/t378.

Do not turn these into a claim that a model now converges. A separately
authorized live measurement is the only evidence that can support that claim.

## Compatibility and privacy claims safe to publish

- Ordinary drafts retain the old object shape when the complete object fits.
- `step_rows_v1` removes repeated field names; it does not add semantic values.
- It carries only existing Core bookkeeping plus the same bounded model-written
  action input, with only the static `format` and `fields` literals added.
- It adds no provider output, page/result value, selector recovered from
  evidence, digest, prompt, user-instruction quote, or raw artifact.
- The packed entry is not persisted. Public diagnostics remain content-free
  counts, booleans, and byte measurement, so no stored-record migration or
  downstream wire/parser change is required.
- The strict observer must fail closed on unknown/malformed packed data; it must
  never infer zero omission from an unrecognized representation.

## Stale, incomplete, or unsafe statements

1. **Architecture omission:** the current document describes the evidence
   window and content-free `draft shape` diagnostics but never describes the
   provider-facing Flow-draft projection or its 4,000-byte reservation. After
   this substantial runtime-architecture change, that omission is stale.
2. **Ambiguous diagnostic wording:** “the measured draft shape shown to the
   decision” can be read as retaining draft content. It should explicitly say
   that only counts/booleans/bytes persist and that `step_rows_v1` is not a
   public trace member.
3. **Nearby limit values are stale and must change:** 8,000 bytes was the old
   Flow Bootstrap evidence-context window and 64,000 bytes was the old
   cumulative total. Current production values are 24,000 and 1,048,576 bytes.
   Correct only those evidence-byte values; the 8,000/4,000/12,000 exploration
   token profile, 26-call default, USD and timeout bounds, and retry statements
   are separate and remain unchanged by draft packing.
4. **t377 caveat is closed by t381:** t377's mixed bounded/oversized and
   least-entry findings previously made unconditional lossless-first wording
   premature. The supervisor reports that t381 independently returned GO on
   their fixes, so the proposed wording is now publishable; t378 alone would
   not have been enough because it changed only the fixture observer.
5. **No live-success claim:** the current downstream `Current State` still says
   the correction has not been measured by a newly authorized live run. Any
   claim that packing fixed creation reliability, caused convergence, or
   improved provider behavior would be stale/unsupported.

## Linked-document check

The relevant Core file has no direct Markdown link to a separate Flow-draft or
evidence-packing architecture document. Its only nearby authored-doc link is to
`docs/architecture/automation-studio.md#repair-targets-and-their-refusals`,
which is unrelated to draft packing. `docs/reference/framework-reference.md` is
generated inventory and must not be hand-edited. Therefore the single authored
architecture edit above is sufficient.

## Scope and verification

Read the downstream `AGENTS.md` documentation rules and MVP `Current State`,
the assigned t372/t375/t377/t378 reports, Core's repository-boundary and
documentation rules, the relevant sections and current diff of
`llm-flow-bootstrap.md`, and the owning evidence-loop limit, configuration, and
focused test sources named above. I did not edit Core source or shared authored
docs, run tests, invoke a provider/live path, inspect private artifacts, commit,
or push. This report is the only file I changed.
