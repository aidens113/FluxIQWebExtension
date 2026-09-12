# Report: w3-target-signal-order

Worker: `w3-target-signal-order`. Wave 3, follow-up: the element-fingerprint
source order in `outputTargetFromPayload`, the defect
[`w3-domain-contract-gaps` raised as its open question 1](./w3-domain-contract-gaps.md).

## Outcome

**Partial.** The fix and its tests are done and measured. One thing is not done
and cannot be done inside my Owns: **the domain suite is red on a single
assertion in a file I do not own**, which asserts the degraded behaviour I was
sent to remove. It is one line, I have proved it is the *only* failure, and the
replacement text is in [The one line I do not own](#the-one-line-i-do-not-own).
Until it lands, `pnpm --filter @fluxiq-web-extension/domain test` aborts early
for every worker on this tree.

| Item | State |
| --- | --- |
| Chain reordered on the rule `w3-domain-contract-gaps` established | Done |
| A test for each of the three states a dispatch can be in | Done, plus four more |
| Measured before/after on the executed path | Done — **1 → 12** signals |
| Drift recovery preserved | Done, measured on both matched shapes |
| Domain `check` | **exit 0**, 0 `error TS` |
| Domain `test` | **exit 1** — one assertion, in an unowned file |
| Structure audit through a scratch `GIT_INDEX_FILE` | 3 violations, **none mine**, none in `domain/` |

## What changed and why

`domain/src/output-nodes/targets.ts`, one expression plus two private helpers.
`domain/src/output-nodes/tests/targets.test.ts`, seven new tests.

The chain was:

```ts
const element = elementFingerprint(adaptedTarget?.element)
  ?? elementFingerprint(selectedCandidate)
  ?? elementFingerprint(adaptedFingerprint)
  ?? elementFingerprint(payload.element);
```

It is now a source list chosen by whether Core matched anything, resolved by a
helper that skips a source normalizing to `{}`:

```ts
const adapted = [adaptedTarget?.element, selectedCandidate, adaptedFingerprint];
return adaptedTarget?.selectedCandidate !== undefined ? [...adapted, payload.element] : [payload.element, ...adapted];
```

This is `w3-domain-contract-gaps`'s rule, unchanged and deliberately restated in
the same words as `gateway-mapping.ts` `elementFingerprintSources`: **an adapted
target's copy wins only when `parameters.target.selectedCandidate` is set;
otherwise `payload.element` wins.** No second policy, and no richness heuristic —
the tie-break is provenance, never signal count, which is what makes the drift
branch below correct.

### Where `adaptedFingerprint` goes, and why it is not a judgement call

The brief asked for this to be decided explicitly. It is gated on the *same*
predicate as `adaptedTarget.element`, and both branches are tested:

- **Core matched a candidate.** The adapted target describes the element the
  page really has. It wins, even though the recording carries four times the
  signals. Test: `Core matched a candidate: the drift-corrected candidate beats
  the recorded identity` — the recorded element has 12 signals and the matched
  candidate 4, and the candidate wins.
- **Core matched, and adapted the fingerprint rather than enumerating
  candidates** — a mapper or operator that rewrote `target.fingerprint`, where
  `selectedTargetCandidate()` resolves nothing from `candidates`. The adaptation
  is still newer than the recording, so it must still win. Test: `Core matched
  but adapted only the fingerprint: the adaptation is still not discarded`.
  Getting this branch backwards is what would have silently broken drift
  recovery; it is measured in probe case 4 below, not only asserted.
- **Core matched nothing.** `normalizeFingerprint` reads only the parameters'
  own top-level keys and never looks inside `parameters.element`, so its
  fingerprint is a *lossy re-derivation of the same recorded element*, not a
  newer one. The recording wins.

### One correction to the brief's description of the defect

The brief said "the `adaptedTarget.element` it leaves behind is impoverished".
Measured, Core leaves behind **no `element` key at all**:

```text
Core normalized target : {"kind":"element","fingerprint":{"selector":"#save-settings",
                          "statePath":"web.elements.save.changes"},"source":"runtime"}
```

`sanitizeElementTarget` emits only `kind`, `fingerprint`, `candidates`,
`selectedCandidate`, `source`, `metadata`. So the link that actually degraded
the wire was **`adaptedTarget.fingerprint`**, third in the old chain, not
`adaptedTarget.element`, first. The fix is the same either way, because the rule
gates both, but it matters for anyone reading the old chain to work out what
happened.

### The emptiness guard, which is not cosmetic

`elementFingerprint` returns `{}`, not `undefined`, for an object it recognizes
nothing in, and `??` accepts `{}`. Moving `payload.element` to the front of the
chain without a guard would therefore let an unrecognizable recorded element
shadow a real adapted fingerprint — a new defect introduced by fixing this one.
The guard is the same one `commandElementFingerprint` already applies, and it is
tested (`a source with no recognized signal does not shadow one that has them`).

### Not changed

`selector` resolution, `explicitVisualTarget`, and the
`if (!selector && !explicitVisualTarget) return undefined` guard are untouched,
and a test pins all three (`the element ordering does not decide the selector or
the emptiness guard`). `element?.selector` sits fifth in the selector chain,
behind four sources that are present in every real shape, so the reorder cannot
reach it; the test asserts that rather than trusting it.

The `implicitRole` hunks visible in `git diff` on this file are
`w3-domain-contract-gaps`'s uncommitted work already in the tree, not mine. My
diff is the first two hunks only.

## The measurement

Executed, not read: the domain source bundled with Core's real
`normalizeAutomationStudioElementTarget`, reproducing the two lines of
`prepareElementTargetAction` that rewrite `parameters.target`, over a recorded
`web.dom.click` on a well-described button. Identical script before and after
the edit.

| Dispatch state | Wire `target.element` **before** | **after** |
| --- | --- | --- |
| Recorded, before any policy step | 12 signals | 12 signals |
| **Core rewrote the target, matched nothing** (every dispatch today) | **1 signal** — `{"selector":"#save-settings"}` | **12 signals** |
| Core matched a candidate (drift correction) | 4 — the candidate | 4 — the candidate |
| Core matched, adapted fingerprint, no candidate list | 3 — the adaptation | 3 — the adaptation |

The twelve are `selector, xpath, id, classNames, visibleText, tagName, text,
implicitRole, testId, accessibleName, label, attributes`. `w3-domain-contract-gaps`
measured eleven; the difference is that `implicitRole` now survives
`elementFingerprint`, which is its own landed change.

Selector on the wire is unchanged in every row (`#save-settings`,
`#settings-save-v2`, `#settings-save-v2`).

## Does any consumer's behaviour change?

**No — not today.** Measured, not inferred.

- **`command.element`, the declared field** (`gateway-mapping.ts`
  `commandElementFingerprint`) is **byte-identical**. Probe case 5 built it from
  the old degraded wire target and from the new one in the same run:
  `12 signals` / `12 signals` / `identical: true`. Its unmatched branch already
  read `parameters.element` first, which is exactly the insulation
  `w3-domain-contract-gaps` added; its matched branch reads `target.element`,
  which this change leaves alone. The two ends of a dispatch now agree in *both*
  branches, where before they disagreed in the unmatched one.
- **`content/action-runtime/resolve-target.ts`** reads `action.options?.element`,
  the raw parameters, so it never saw the degraded copy and does not see the
  repaired one.
- **Core** forwards `command.target` to the client as `command.target.metadata`
  (`client-gateway/bridge.ts:492`) and echoes `result.target`
  (`runtime/contracts.ts`, `client-gateway-transport.ts:171`). Nothing in Core
  reads `result.target` beyond carrying it. `domain/src/runtime/adapter.ts:105`
  attaches the same target to the command result.

So what changes is **fidelity, not behaviour**: the wire target and the run
records now carry the full recorded identity instead of a bare selector.
`elementFingerprint` is the one normalizer at both ends, so nothing new appears
that was not already in `options.element`.

**The one consumer question I cannot answer from the domain**, flagged as the
brief asked: nothing in the content script scores with these extra signals yet.
`w3-resolver` reports Core's matcher cannot be bundled into a content script
until Core publishes a browser-safe `fingerprinting/` subpath, so the richer
wire target is a precondition for the audit finding's fix, not the fix itself.

**Whether this closes the audit finding** — "Core's element matcher never
receives candidates and its top signals are zero for web targets" — it does not,
on its own. The *candidates* half is untouched: `resolveElementTarget` still
returns `unresolved_no_candidates` because nothing populates `target.candidates`
from the page. This change fixes the reference side of the comparison; the
candidate side is `w3-resolver`'s.

## The one line I do not own

`domain/src/client/tests/gateway-mapping.test.ts:208` asserts the defect:

```ts
assert.deepEqual(preparedTarget?.element, { selector: "#save-settings" }, "the wire target's element is a bare selector once Core has prepared it");
```

That is now false by design, and it is the *entire* failure. Suggested
replacement, keeping the intent of the surrounding block:

```ts
assert.equal((preparedTarget?.element as { testId?: string } | undefined)?.testId, "save-changes", "the wire target keeps the recorded identity Core's normalization dropped");
```

Proved, without writing to the file: I read it, rewrote that one line **in
memory**, bundled and ran it — `Web automation gateway mapping tests passed.`
Every other assertion in it holds unchanged, including
`deepEqual(preparedCommand.element, preparedCommand.options?.element)` and the
matched-candidate block at line 231.

I did not make the edit. My Owns is `targets.ts` and the tests beside it, and
the wave's binding rules say to report an under-drawn ownership boundary rather
than widen it. **The file the brief should have included is
`domain/src/client/tests/gateway-mapping.test.ts`** — the test, not
`gateway-mapping.ts` itself, whose rule I matched rather than changed.

This one costs more than usual, so it is worth the supervisor's attention early:
the domain test runner imports every bundle in one process, so this assertion
throws and **the suite stops before most test files run**. Any worker running
domain `test` right now sees `# tests 10` and an abort, and the wave rule "a
failure in a file you do not own is probably a parallel edit, rerun once" will
send them looking in the wrong place. I reran; it is deterministic.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=w3-target-signal-order` throughout. Exit status
captured by redirecting to a file and echoing `$?`, never through a pipe. No
`pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no commit.

- `pnpm --filter @fluxiq-web-extension/domain check` — **exit 0** three times
  (baseline before any edit; after the source edit and the tests; final).
  `grep -c "error TS"` on the final log: **0**.
- `pnpm --filter @fluxiq-web-extension/domain test`
  - Baseline, before any edit: **exit 0**, `# tests 227 / # pass 227 / # fail 0`.
    (`w3-domain-contract-gaps` reported 200; other workers have landed since.)
  - After the change: **exit 1**, aborting at
    `client/tests/gateway-mapping.test.ts` with
    `AssertionError: the wire target's element is a bare selector once Core has
    prepared it`. Rerun once: identical, so not environmental and not a parallel
    edit.
- **Every test entry run in its own process** (a scratchpad script; the real
  runner's one-process import is what hides the rest of the suite behind the
  first throw): **36 entries, 1 failing** — only
  `client/tests/gateway-mapping.test.ts`. `output-nodes/tests/targets.test.ts`
  reported `# tests 12 # pass 12 # fail 0` (5 pre-existing, 7 new).
  `tests/domain.test.ts`, the other bare-assertion script exercising
  `outputTargetFromPayload`'s selector chain, passed.
- **Executed the dispatch path** twice with the identical script, before and
  after the edit — the table under [The measurement](#the-measurement).
- **Ran the unowned test file with its one stale assertion patched in memory**
  (read-only on the repository file): passed to completion.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index`; the real index was never written) — **exit 1**, 3 violations,
  **none in `domain/`, none mine**, all three already reported by
  `w3-domain-contract-gaps`:
  - `apps/extension/src/runtime/tests/result-mapping.test.ts` importing
    `../../content/evidence` past its barrel;
  - `apps/extension/src/shared/protocol.ts`, 2 imports past the same barrel;
  - `docs/working/README.md is out of date with the documents' header blocks`.

  No warning names `targets.ts`. It is 150 lines against the 400-line advisory,
  and gained no export.

Scratch artifacts went to `domain/.test-build-scratch/w3-target-signal-order*/`
(git-ignored, per-label) because a bundle has to sit inside the package for its
external `fluxiq` imports to resolve — the same reason `scripts/test-domain.mjs`
writes there. No source file outside my Owns was written.

## Not verified

- **No live browser validation.** Nothing here can be confirmed by the page yet,
  because nothing on the page scores with the extra signals. **A Lab run is
  worth having** once `w3-resolver`'s scorer is live: that is the first moment
  the richer wire target can change a resolution, and the first moment this
  change could be observed to help or to hurt. Until then the honest claim is
  the measured one — twelve signals on the wire instead of one.
- **The matched branch is tested but not exercised by a real dispatch**, because
  nothing populates `target.candidates` today. Both matched shapes in the probe
  and the tests are hand-built to Core's `resolveElementTarget` output shape,
  read from `runtime/io-policy.ts`.
- **One behaviour change I chose deliberately and cannot rule out entirely.**
  Under the rule, a *hand-authored or mapper-supplied* adapted target that
  carries an `element` (or a rewritten `fingerprint`) but **no
  `selectedCandidate`** now loses to `payload.element`, where before it won. I
  found no producer of that shape in this repository — `payloads.ts` writes
  `element`/`visualTarget` at the top level and never a `target` key, and Core
  never emits `target.element` — but `definitions.ts:108` does declare `target`
  as an authorable "Adapted Target" parameter, so a Flow author could construct
  it. Such a target still controls the wire `selector`, which is untouched. If
  the supervisor wants an explicit override to win without a match, that is a
  change to *both* ends of the rule, here and in `gateway-mapping.ts`, and
  should not be made on one side only.
- **No repository-wide `check`, `test` or `build`**, and no extension commands.
  Four other workers were editing this tree.

## Open questions or contradictions found

1. **The stale assertion above is the whole of the red suite**, and it blocks
   every concurrent worker's domain test run. One line, in
   `domain/src/client/tests/gateway-mapping.test.ts`. Worth landing before the
   next worker reruns.
2. **The brief's account of which chain link degraded the wire is wrong** —
   `adaptedTarget.fingerprint`, not `adaptedTarget.element`; Core emits no
   `element` on a normalized target at all. Same fix, but the plan's targeting
   section should not carry the wrong mechanism.
3. **This does not close the headline audit finding.** It repairs the reference
   fingerprint. "Core's element matcher never receives candidates" stays true
   until something populates `target.candidates` from the page, which is
   `w3-resolver`'s half. The finding should be split in the plan so half of it
   is not marked done by this change.
4. **`domain/src/output-nodes/targets.ts` and `client/gateway-mapping.ts` now
   hold the same rule in two places**, stated in prose in both and tested in
   both. That is deliberate — each end must be correct on its own — but it is a
   pair that can drift. A single exported `elementIdentitySources` helper, or a
   test that asserts the two agree on the same input, would make the drift
   impossible; both files would have to be in one Owns to do it.
