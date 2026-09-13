# p-core-docs — Core's working document brought current

## Outcome

Done. Core's `docs/working/mvp-week1-web-automation-reliability-plan.md` now
records both 2026-09-12 Core changes, the moved published seam, the
cross-repository coupling of `MISSING_STABLE_IDENTIFIER_SIMILARITY`, and the
client-identity question raised downstream. `docs/working/README.md` in Core is
back in step with the header. Core's `pnpm check` and `pnpm docs:check` both
exit 0.

Every claim was checked against Core source before it was written down, not
against the downstream report. Two claims in the brief did not survive that
check and are recorded corrected (below).

## What changed and why

### `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md`

- **Header.** `Last updated` to 2026-09-12. `Status detail` rewritten: the Core
  contracts this plan owes downstream all exist, and the two published-surface
  changes of 2026-09-12 are now on the record with the matcher coupling called
  out. `Scope` extended to name both matcher changes, since the index Scope
  column is generated from this field and was otherwise silent about them.
- **Current State** (+48 lines, now 101 of the ratcheted 150-line budget). Four
  new blocks: what `fafe7c7` and `a575df2` changed; the published-seam move with
  the ladder it crosses and the arithmetic behind it; the coupling that stops
  Core changing the constant alone; and a pointer to the new open question, with
  the instruction not to treat a downstream gate on `clientType` or
  `capabilities` as a security boundary until it is answered. `Next steps` no
  longer says "none in Core": what is left is a decision, not an implementation.
- **Decisions.** Three new entries — the subpath was a packaging change rather
  than a restructure; absence is weaker evidence than contradiction (downstream
  D13) with the accepted cost on the published seam stated; and
  `MISSING_STABLE_IDENTIFIER_SIMILARITY` is a cross-repository constant that
  ships with the downstream spec calibrated against it.
- **Work Ledger.** Three entries dated 2026-09-12: one per commit, recorded
  after the fact and marked as such, plus this documentation change. Each names
  the gate results the commit itself recorded *and*, separately, what I
  re-derived from the tree, so the two are not confused.
- **Open Questions.** Two new entries: the client-declared identity question
  (below), and the version gap found while writing the ledger.

### `F:\!FluxIQ\docs\working\README.md`

The `mvp-week1-web-automation-reliability-plan.md` row: line count 463 -> 631,
and the Scope cell updated to match the document's new `Scope` field. The audit
regenerates this table from the headers and fails when the checked-in copy
differs, so the row had to move with the document. Still under the 800-line
compaction threshold, so no `⚠` and no change to the footer count.

## The three things Core's document now says plainly

1. **The published seam moved.** A candidate matching visible text and
   accessible name exactly but carrying no `id` rises from confidence 0.428 to
   0.577. Core's element-target ladder in `runtime/io-policy.ts` is destructive
   0.9, privileged 0.82, review 0.68, safe 0.45, default 0.5, so the candidate
   now clears `safe` and the default rung while the three higher rungs still
   refuse it.
2. **A downstream spec is coupled to a Core constant.** Flipping
   `MISSING_STABLE_IDENTIFIER_SIMILARITY` back to −0.55 was measured downstream
   to turn the `reworded-aria` case in
   `apps/extension/e2e/content/tests/identity-resolution.spec.ts` red. Core
   cannot change the weight without breaking the downstream repository; the two
   `dev` branches ship it together.
3. **A client's declared identity is not authenticated.** Recorded as Core's
   open question, with no fix designed.

## Verification of each claim against Core source

| Claim | Checked against | Result |
| --- | --- | --- |
| Two named constants, −0.1 and −0.8 | `element-fingerprint.ts:282-288` | Confirmed |
| 0.428 -> 0.577 on the published seam | recomputed from `scoreElementFingerprintCandidate` | Confirmed exactly |
| Ladder rungs and which ones it crosses | `runtime/io-policy.ts:291-300` | Confirmed |
| Exports subpath and its target | `packages/fluxiq/package.json` | Confirmed |
| Browser-safety test exists and enforces the closure | `fingerprinting/tests/index.test.ts` | Confirmed |
| `clientType`/`capabilities` assigned from `hello`, before any token check | `client-gateway/service/lifecycle.ts:70-90` | Confirmed |
| The token binds only `clientId` | `lifecycle.ts:99` | Confirmed |
| The extension-only filter gates on those declared values | `domain/src/io/gateway-output-dispatcher.ts:44-56`, `domain/src/runtime/adapter.ts:136-147` | Confirmed |

**The confidence arithmetic, done from the current source rather than trusted.**
Weights are `visibleText` 24, `accessibleName` 24, `id` 26. An exact text match
contributes its full weight; a missing identifier contributes
`weight × MISSING_STABLE_IDENTIFIER_SIMILARITY`. All three signals count toward
`possibleScore`, so:

- now: (24 + 24 + 26 × −0.1) / 74 = 45.4 / 74 = 0.614 normalized; two strong
  matches give the multiplier 0.82 + 2 × 0.06 = 0.94; 0.614 × 0.94 = **0.577**.
- before: (24 + 24 + 26 × −0.55) / 74 = 33.7 / 74 = 0.455; × 0.94 = **0.428**.

Both figures reproduce the commit's claim to the digit, at the `round()`
precision the module uses (three decimals).

## Two corrections to the brief

1. **The patch bump to 0.2.1 is not part of `a575df2`.** `git show a575df2
   --stat` touches exactly two files — `element-fingerprint.ts` and
   `docs/integrations/automation-studio-importing-repos.md`. The 0.2.0 -> 0.2.1
   bump is in `fafe7c7`, which landed earlier the same day (11:20 against
   16:50). So the matcher's behaviour change ships under a version that was
   already published for something else.
2. **Which follows: the behaviour change carries no version of its own and no
   migration note.** `docs/architecture/package-boundaries.md` says compatible
   changes increment the patch version before 1.0, and its Migration Notes stop
   at 0.2.0. An integrator pinning `fluxiq@0.2.1` cannot distinguish the build
   whose matcher refuses that candidate from the build that accepts it. Recorded
   as Core's open question, owner the senior supervisor agent; whether the answer
   is a 0.2.2 with a note or an explicit statement that scoring weights are
   outside the compatibility promise is a Core release call. **No source or
   manifest was touched** — the brief forbids it, and the decision is not mine.

## Commands run and observed results

All redirected to files in the scratchpad with the exit status echoed; no pipes.

- `node scripts/structure-audit.mjs --rule working-docs` -> `EXIT=0`,
  `structure-audit: passed (0 warning(s), 16 baselined).` This is the rule that
  regenerates and compares `docs/working/README.md`, so it is the direct proof
  the index row now matches the header.
- `pnpm check` (Core root) -> `CHECK_EXIT=0`. Structure audit
  `passed (118 warning(s), 256 baselined)`, then `packages/contracts`,
  `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` each
  `check: Done`.
- `pnpm docs:check` (Core root) -> `DOCS_EXIT=0`.
  `Validated local links in 99 authored/reference Markdown files.`
  `Deterministic framework reference is current.`

Line-count and budget checks: document 631 lines (limit 800, so no `⚠`);
`## Current State` 101 lines against the ratcheted 150-line budget. Both gates
were run twice: once over the first pass, and again unchanged after the final
edit to Current State and the matching README line count.

## Not verified

- **No Core tests were run.** The change is documentation only and touches no
  source, so `pnpm test` was not run — with or without
  `--no-file-parallelism`. The 129-of-129 figures in the two ledger entries are
  quoted as what each commit recorded, and are labelled that way in the
  document; I did not reproduce them.
- **The downstream measurements behind D13** — the 9,720-profile exhaustive
  proof, the drift case at 0.218 -> 0.389, the near-miss at 0.088, the
  separation widening 0.130 -> 0.301, and the two rejected alternatives — were
  not reproduced. Core's document attributes them to the downstream plan and
  `reports/v-core-scoring.md` rather than restating them as Core's own findings.
  The only figures Core's document asserts in its own voice are the two I
  recomputed.
- **The measured redness of the `reworded-aria` case** under a flipped constant
  is taken from the brief and the commit; I read the spec's location to name it
  correctly but did not run Playwright. No `pnpm lab` command was run in the
  downstream repository.
- **Whether the client-identity question has a safe answer.** I established that
  the values are unauthenticated and that the token binds only `clientId`. I did
  not survey every Core or domain read of those fields, so "nothing gating on
  either is an authentication" is proved at the source of the values, not
  enumerated at every consumer.

## Open questions or contradictions found

- **Core's tree carried other uncommitted work while I ran the gates.**
  `git status --porcelain` in `F:\!FluxIQ` shows modifications to `AGENTS.md`,
  `docs/architecture/code-structure.md`, `scripts/structure-audit/config.mjs`,
  and two untracked new files, `scripts/structure-audit/rules/contract-spread.mjs`
  and its test — none of them mine. My `pnpm check` exit 0 therefore covers a
  tree that includes another worker's in-flight structure-audit rule. It passed
  with those present; a supervisor integrating both should re-run the gate after
  the other change settles.
- **The version question above** is the one thing this task surfaced that Core
  owes an answer to and cannot get from downstream.
