# p-core-version — the matcher behaviour change given a version and a note

## Outcome

Done. `fluxiq` is at **0.3.0**, not 0.2.2, and
`F:\!FluxIQ\docs\architecture\package-boundaries.md` carries a `0.3.0`
Migration Notes entry plus the cross-repository coupling of the two matcher
constants. Core's working document records the decision, closes the open
question p-core-docs raised, and carries a ledger entry.

Every figure was re-measured against the compiled matcher rather than copied.
p-core-docs' arithmetic reproduces exactly. Three facts the commit did not
claim came out of that measurement, and one of them contradicts a sentence in
the commit message; they are in the migration note and flagged below.

Core `pnpm check`, `pnpm package:lint` and `pnpm build` each exit 0.
`pnpm docs:check` exited 0 twice over these edits and is red on the current
tree because another worker's 18:28 edit to `nodes/parameter-bindings.ts`
staled the generated framework reference. `pnpm test` is not green, and every
red belongs to another worker's in-flight source. Detail under *Commands run*.

## The version decision, and why not 0.2.2

`package-boundaries.md` says: "Before 1.0, compatible changes increment the
patch version and intentional API breaks increment the minor version with a
note under Migration Notes." Three things put this change on the minor rung.

1. **The policy attaches migration notes to the minor rung.** A change that
   needs a note — and this one does, or an integrator cannot tell what their
   build does — has no home at the patch rung as the policy is written.
2. **Core's own precedent is a behaviour change under a minor bump.** The
   closing paragraph of the existing 0.2.0 note is exactly that: "One behaviour
   changes without any host opt-in: Core now names the failures its own
   structured signals prove instead of leaving them to message matching." No
   type broke there either. This change is the same kind.
3. **It moves a number Core's own safety gates read.** `confidence` is a
   published output on the element-target resolution, and
   `elementTargetMinConfidence` / the destructive-privileged-review-safe ladder
   in `runtime/io-policy.ts` are Core's own thresholds. Under a caret or tilde
   range a patch would move a **destructive** gate with no host code changing.
   Measured, not asserted — see the destructive crossing below.

**The alternative I rejected**, which the open question offered: declare
scoring weights outside the compatibility promise. That would leave the
published ladder meaningless as a contract, because the thresholds are Core's
and the number they read would be unversioned. If the owner prefers that
answer it is a coherent position, but it has to be stated in
`package-boundaries.md` as an exclusion, not left implicit.

**0.2.2 would also have implied that 0.2.1 is one thing.** It is not: two
builds shipped under `0.2.1`, one refusing the seam candidate and one accepting
it. The note says so explicitly rather than papering over it.

I also clarified the policy sentence itself, because otherwise the next agent
re-litigates this: `package-boundaries.md` now reads that "compatible" is
judged on what a consumer observes, not on the type surface. **That is a policy
clarification and the supervisor should confirm it** — I believe it documents
the practice the 0.2.0 note already set rather than inventing a rule, but it is
the owner's call.

Downstream is unaffected by the bump: `apps/extension`, `domain` and
`packages/test-runner` all declare `"fluxiq": "link:../../../!FluxIQ/packages/fluxiq"`,
and `apps/web` in Core uses `workspace:*`. No range pins a version.

## The migration note

Quoted in full as written into `docs/architecture/package-boundaries.md`:

> ### 0.3.0: a missing stable identifier costs less (`fluxiq`)
>
> No type or export changed. One published number moves. An element candidate
> that does not carry a stable identifier the recording captured is now charged
> −0.1 of that identifier's weight where it was charged −0.55. A candidate
> carrying a *different* identifier is untouched and still costs −0.8. The two
> branches of `compareExactSignal` in `fluxiq/automation-studio/fingerprinting`
> are now the named constants `MISSING_STABLE_IDENTIFIER_SIMILARITY` and
> `CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY`.
>
> **Who is affected.** Only candidates missing an identifier the fingerprint
> recorded. For those, `totalScore` rises by `0.45 × w` for each recorded
> identifier the candidate lacks — at the default weights `id` 26, `testId` 28,
> `automationId` 28, `entityId` 24, `statePath` 22 — over an unchanged
> `possibleScore`. So `confidence` only ever rises or stays equal; it never
> falls. `matchedSignals` and `failedSignals` are identical before and after,
> because an absent identifier is still a negative contribution and still a
> failed signal, so a diagnostic reading those lists sees nothing change.
>
> **Measured, on the case this was weighed against.** A candidate matching
> `visibleText` and `accessibleName` exactly and carrying no `id`, scored
> against a fingerprint that recorded one: `(24 + 24 − 2.6) / 74 = 0.614`
> normalized, times the two-strong-match multiplier `0.94`, so **confidence
> 0.577** — from `33.7 / 74 = 0.455`, `× 0.94 = 0.428`.
>
> **Which rungs of the element-target ladder that crosses.** The runtime's
> default minimum confidence for an element target is destructive `0.9`,
> privileged `0.82`, review `0.68`, safe `0.45`, and `0.5` for an output
> declaring no safety level. The candidate above newly clears **`safe` and the
> default rung**; `review`, `privileged` and `destructive` still refuse it.
>
> That is a statement about that candidate, not about every candidate, and the
> difference decides whether you are exposed. Across the 1,024 combinations of
> which of five recorded identifiers, three text signals and two loose signals
> a candidate carries (matching exactly wherever present), 170 profiles newly
> clear `safe`, 145 the default rung, 44 `review`, and 7 `privileged`. Those
> reaching `review` already matched three of the five identifiers exactly and
> all three text signals; those reaching `privileged` matched four of five. And
> a candidate agreeing exactly on everything else a recording captured — all
> three text signals, role, tag name, entity kind, all three structural paths,
> URL, class names, attributes, bounds, and visibility — while missing one
> recorded identifier crosses **`destructive`** as well: missing `statePath`
> goes `0.883 → 0.917`, missing `entityId` `0.873 → 0.910`, missing `id`
> `0.862 → 0.902`. No rung is categorically out of reach; what still protects
> the high ones is that clearing them takes near-total agreement on every other
> signal.
>
> **The selected candidate can change, not only its score.** Candidates rank by
> `totalScore` and only candidates missing an identifier gain, so a ranking can
> invert. Against a fingerprint recording `id`, `testId`, `visibleText` and
> `accessibleName`: a candidate with exact text and neither identifier scores
> `18.3` before and `42.6` after, while a candidate carrying both identifiers
> exactly and contradicting the text stays at `27.6` throughout.
> `bestElementFingerprintCandidate` returns the second before this release and
> the first after it.
>
> **What to check.** If you gate on `confidence` — your own floor, an output's
> `elementTargetMinConfidence` metadata, or the default ladder — re-measure
> against your own recordings rather than reasoning from these figures: the
> delta depends on which identifiers your fingerprints capture and how you
> weight them. Nothing needs to change where your candidates carry the
> identifiers they recorded, since that path is untouched. A host that filled
> an absent identifier with a placeholder to dodge the old penalty should stop
> doing so — a wrong value now costs far more than an absent one, as the
> importing-repos guide in FluxIQ Core (`docs/integrations/automation-studio-importing-repos.md`)
> now explains.
>
> **Why a minor increment, and why `0.2.1` is ambiguous.** This behaviour
> shipped in `a575df2` on 2026-09-12 under `0.2.1`, a version `fafe7c7` had
> already published earlier the same day for an unrelated additive export, and
> it took no increment of its own. Two builds therefore bear `0.2.1`, one
> refusing the candidate above and one accepting it, and no version string
> tells them apart; treat `fluxiq@0.2.1` as unspecified on this behaviour and
> read the commit. `0.3.0` is the first version that names it. Minor rather
> than patch because the change is not opt-out-able and moves a number the
> runtime's own safety gates read — the same reason the 0.2.0 note's closing
> paragraph carries a behaviour change under a minor increment.

## What I measured, and the one correction it forces

I did not take the arithmetic from the brief or from `p-core-docs`. I imported
`scoreElementFingerprintCandidate` from Core's compiled
`dist/programs/automation-studio/fingerprinting/element-fingerprint.js`, and
built an "old weight" module by substituting `-0.55` for `-0.1` in a copy of
that same compiled file, so both behaviours run from the same code path.

**The seam figure reproduces exactly.** New: `totalScore 45.4`,
`normalizedScore 0.614`, `confidence 0.577`, `matchedSignals
[visibleText, accessibleName]`, `failedSignals [id]`, the `id` contribution
`-2.6` of weight `26`. Old: `totalScore 33.7`, `normalizedScore 0.455`,
`confidence 0.428`, `id` contribution `-14.3`. So `0.428 → 0.577`, to the digit.

**Three things the commit message did not claim.**

1. **`failedSignals` and `matchedSignals` never change.** Both weights are
   negative, so the identifier stays a failed signal either way; `possibleScore`
   is unchanged; the strong-match count and therefore the multiplier are
   unchanged. Over a 1,024-profile sweep, zero profiles differed in either list,
   and the minimum confidence delta was exactly `0`. So the change is invisible
   to a diagnostic that reads the signal lists — it only moves numbers.
2. **The winning candidate can change.** Against a fingerprint recording `id`,
   `testId`, `visibleText`, `accessibleName`:
   `bestElementFingerprintCandidate` returns `B-both-identifiers-wrong-text`
   (27.6) before and `A-no-identifiers-exact-text` (18.3 → 42.6) after. This is
   a different element, not a different confidence on the same one.
3. **The correction.** The commit says "Review, privileged and destructive
   still refuse it." That is true of the one seam candidate and **false as a
   general statement**. A candidate agreeing exactly on every other recorded
   signal while missing one recorded identifier crosses `destructive`:
   `statePath` missing `0.883 → 0.917`, `entityId` missing `0.873 → 0.910`,
   `id` missing `0.862 → 0.902`. (`testId` and `automationId` missing reach
   `0.895` and do not cross.) In the narrower 1,024-profile sweep, 44 profiles
   newly clear `review` and 7 clear `privileged`, all of them already matching
   three or four of the five identifiers exactly.

Point 3 is why the version is `0.3.0` rather than `0.2.2`: a patch increment on
a change that can move a **destructive** gate is not defensible. Core's working
document said the ladder claim in a form scoped to that candidate, so it was
already correct; I added the qualification anyway so the next reader cannot
generalize it.

The delta is exact, not approximate: `round(w × −0.1) − round(w × −0.55)`
equals `0.45 × w` for all five default identifier weights (26 → 11.7,
28 → 12.6, 24 → 10.8, 22 → 9.9).

## What changed and why

### `F:\!FluxIQ\packages\fluxiq\package.json`

`"version": "0.2.1"` → `"0.3.0"`. Nothing else.

### `F:\!FluxIQ\docs\architecture\package-boundaries.md`

- The version line now reads `fluxiq` at `0.3.0`.
- The release-policy sentence gained the "compatible is judged on what a
  consumer observes, not on the type surface" clarification (flagged above as
  needing supervisor confirmation).
- **The coupling, recorded in Core.** A new paragraph in *Exports And Builds*,
  directly after the fingerprinting-subpath paragraph, says the two constants
  are calibrated against `apps/extension/e2e/content/tests/identity-resolution.spec.ts`
  downstream, that returning `MISSING_STABLE_IDENTIFIER_SIMILARITY` to −0.55
  turns the `reworded-aria` case red, and that changing either weight means
  re-measuring that spec, pushing both `dev` branches together, and taking a
  minor version with a note. It is placed where someone about to edit the
  matcher's published surface will read it, not only in the changelog.
- The `0.3.0` Migration Notes entry, newest-first above `0.2.0`.

### `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md`

- **Current State**: the seam paragraph now says the rung claim is about that
  candidate and names the `destructive` crossing; a new paragraph records that
  the behaviour change has a version and a note and that `0.2.1` stays
  ambiguous; `Next steps` drops the version question, leaving only the
  client-identity decision. `## Current State` is 111 lines against the
  ratcheted 150-line budget.
- **Decisions**: one new entry giving the three reasons for minor-over-patch
  and naming the rejected alternative.
- **Work Ledger**: one entry, `2026-09-12 — The matcher behaviour change given
  a version and a note`.
- **Open Questions**: p-core-docs' version question removed, since it is
  answered. The client-identity question and the four others are untouched.

### `F:\!FluxIQ\docs\working\README.md`

The plan's line-count cell only, 631 → 682, so the generated index matches the
document. I hand-edited it rather than running `pnpm structure:baseline`,
because `--update` writes the whole baseline and would have frozen another
worker's in-flight `contract-spread` findings.

## Commands run and observed results

Every exit status captured by `; echo "NAME_EXIT=$?"` after redirecting to a
file in the scratchpad. No pipes.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm check` (final run) | **0** | `structure-audit: passed (119 warning(s), 256 baselined).`, then `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` each `check: Done`. Run four times over the edits, 0 each time. |
| `pnpm package:lint` | **0** | Ran twice, 0 both times; the report body reads `fluxiq v0.3.0`, so the bump is what publint and attw checked. |
| `pnpm build` | **0** | Final run green through `@fluxiq/contracts`, `fluxiq@0.3.0`, `@fluxiq/client-gateway-websocket` and `@fluxiq/web`, ending in the Next route table. See the caveat below. |
| `pnpm docs:check` | 0, 0, then **1** | Two clean runs over these edits: `Validated local links in 99 authored/reference Markdown files.` / `Deterministic framework reference is current.` The third and fourth runs fail with `docs/reference/framework-reference.md is stale`. Not mine — see below. |
| `pnpm -r test -- --no-file-parallelism` | 1 | `packages/contracts` 1/1, `packages/client-gateway-websocket` 1/1, `packages/fluxiq` **128 of 129 files, 843 of 844 tests**, one failure: `global-docs.test.ts > generates a TypeDoc-backed framework reference`, `Test timed out in 15000ms`. |
| `vitest run --no-file-parallelism src/programs/tests/global-docs.test.ts` | **0** | `Test Files 1 passed (1)`, `Duration 12.30s`. Exactly the behaviour Core's recorded open question predicts for that case. |
| `pnpm --filter fluxiq test -- --no-file-parallelism` (later) | 1 | **129 of 130 files**; the TypeDoc case passed this time, and six cases in `nodes/parameter-bindings.test.ts` failed instead. Both that file and its subject `nodes/parameter-bindings.ts` are modified in the working tree by another worker. |
| `pnpm --filter @fluxiq/web test -- --no-file-parallelism` | 1, then **0** | 227/228 with two failures in the untracked `live/tests/gateway-context-publication.test.ts`, then **228 of 228 passed** once that worker moved on. |
| `pnpm --filter fluxiq check` / `pnpm --filter @fluxiq/web check` | **0**, **0** | Used to prove a `next build` type error was spurious (below). |

### The `pnpm build` caveat, resolved

The first three `pnpm build` runs failed, and it is worth recording why, because
none of it was this change:

- Run 1 failed in `@fluxiq/web`'s Next type-check with
  `Property 'rememberClosedRecording' does not exist on type
  'AutomationStudioClientGatewayBridge'` at `bridge.ts:178`. The method exists at
  `bridge.ts:405`, inside the same class (84–643), and both
  `pnpm --filter fluxiq check` and `pnpm --filter @fluxiq/web check` exit 0.
  `bridge.ts` is modified in the tree by another worker; the build caught it
  half-written.
- Runs 2–4 failed with `ENOENT ... .next\static\<hash>\_buildManifest.js.tmp.*`,
  alongside Next's `Slow filesystem detected` warning. Deleting `apps/web/.next`
  did not help at the time.
- **Isolation test.** I set `packages/fluxiq/package.json` back to `0.2.1`, ran
  `pnpm --filter @fluxiq/web build`, and got the same `ENOENT`, then restored
  `0.3.0`. So the failure reproduced without my change.
- The final `pnpm build` exits 0.

### The `pnpm docs:check` red, which I did not fix

`docs/reference/framework-reference.md` is a generated TypeDoc-backed file. It
was `current` at 18:14 and 18:20, both after the version bump. Another worker
modified `packages/fluxiq/src/programs/automation-studio/nodes/parameter-bindings.ts`
at 18:28:56, which staled it. The generated file contains no package version
string, and I changed no TypeScript, so my edits cannot stale it. Regenerating
it with `pnpm docs:reference` would fold that worker's in-flight API changes
into a committed artifact, so I left it. **Whoever finishes `parameter-bindings.ts`
owes the regeneration.**

## Not verified

- **`pnpm test` never observed fully green.** Two sequential full runs of
  `packages/fluxiq`, ~8.5 minutes each, each with one red file — a different
  file each time, both traceable to other agents' work. I did not run a third.
- **The tree moved under every gate I ran.** At the start of my task
  `git status` showed 5 modified and 2 untracked files; at the end, 24 modified
  and 6 untracked, including `bridge.ts`, `client-gateway/service.ts`,
  `runtime/service.ts`, `nodes/parameter-bindings.ts`, `automation-studio-context.ts`
  and both generated framework references. Every exit-0 I report covers a tree
  containing that work. A supervisor integrating this should re-run `pnpm test`
  and `pnpm docs:check` once the other workers land.
- **The downstream `reworded-aria` measurement** behind the coupling paragraph
  is taken from `a575df2` and from p-core-docs. I did not run Playwright and ran
  no `pnpm lab` or `pnpm build` command in `F:\!FluxIQWebExtension`. I read the
  three downstream `package.json` files to confirm they use `link:` rather than
  a version range, and wrote only this report there.
- **No registry state was checked.** Whether `fluxiq@0.2.1` was actually
  published to a registry is unknown to me; `package-boundaries.md` says
  publication is a separate owner action and there is no publish workflow in
  `.github/workflows`. The note's argument does not depend on it — the two
  builds are distinguishable by commit and not by version either way — but if
  `0.2.1` was never published, "two published builds" overstates it slightly.
- **The 1,024-profile sweep is synthetic**, not a population statistic. It
  enumerates which of five recorded identifiers, three text signals and two
  loose signals a candidate carries, matching exactly wherever present. The note
  describes that construction so the counts are not read as field data. The
  `destructive` crossings were found separately, with the full signal set.
- **I did not run `pnpm package:smoke` or `pnpm package:validate`**; the brief
  named `package:lint`, and `package:validate` re-runs the build plus a clean
  consumer install, which on this tree would have re-hit the other workers' work.

## Open questions or contradictions found

1. **The commit message overstates its own safety claim.** "Review, privileged
   and destructive still refuse it" is true of the seam candidate and false
   generally; a candidate missing one identifier and agreeing on everything else
   crosses `destructive`. The commit is history and I did not touch it, but the
   migration note and Core's `Current State` now both carry the qualification.
2. **The policy clarification is mine and wants confirmation.** Adding
   "compatible is judged on what a consumer observes, not on the type surface"
   to `package-boundaries.md` settles the question the open question asked, but
   it is a release-policy statement and the owner may want different words — or
   may prefer the excluded-from-the-promise answer instead, which would mean
   reverting to `0.2.2` and saying so explicitly in the document.
3. **`0.3.0` is a decision another repository can see.** Nothing pins a range
   today, so nothing breaks. If Core ever publishes to a registry, the jump from
   `0.2.1` to `0.3.0` will read as skipping `0.2.2`; that is intentional and the
   note explains it, but the supervisor may want it mentioned when pushing.
4. **Core's tree had at least three agents writing to it concurrently** while I
   ran the gates. I touched nothing outside my owned paths and reverted nothing.
   The `contract-spread` rule the brief warned about caused no failure; the
   structure audit passes with 119 warnings against 118 before, the extra
   warning being another worker's new file.
