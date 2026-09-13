# Element Identity And Target Resolution

How an action finds the element it acts on, and how sure it is that the
element it found is the one that was recorded. This page is current-state
design, verified against source on 2026-09-13. The action vocabulary itself
is in [web capabilities](web-capabilities.md); what a failed resolution
reports is in [the failure taxonomy](failure-taxonomy.md).

Resolution runs on the critical path of every action that touches the page,
so every lookup here is bounded.

## Two Levels

`resolveTarget`
([`content/action-runtime/resolve-target.ts`](../../apps/extension/src/content/action-runtime/resolve-target.ts))
returns the element **and** the measurement that chose it, and throws
`TargetResolutionError` when nothing can be chosen. It works in two levels:

- **Level 1 — exact lookup.** Ask the page for the thing that was recorded:
  a selector, a point, the element fingerprint. Fast, and right whenever the
  page has not changed.
- **Level 2 — scoring.** When no exact strategy answers, or when one answers
  several times, enumerate the controls that could plausibly be the recorded
  one and ask Core's element matcher which of them it is.

Level 1 keeps its precedence. What changed in Week 1 Phase 1.3 is that its
answer is now gated, counted, and vetoed before it is acted on.

## Level 1: The Exact Strategies

Tried in this order, each only when the ones before it found nothing:

| Order | Strategy | Asked as |
| --- | --- | --- |
| 1 | `selector` | `document.querySelectorAll(action.selector)` |
| 2 | `coordinates` | `document.elementFromPoint` at the command's point |
| 3 | `visual-target` | the same, at the visual target's centre |
| 4 | `fingerprint` | `findClosestFingerprint`, then an exact-text scan |

A visual target's **document** bounds are preferred over its viewport bounds
and corrected for the current scroll: document bounds still say where the
element is after the page has moved, while viewport bounds point at whatever
has since scrolled into that spot.

`findClosestFingerprint`
([`content/element-finder.ts`](../../apps/extension/src/content/element-finder.ts))
tries, in order: the recorded selector, the xpath, the id, `data-testid`,
`aria-label`/`name`, the class set, and finally exact visible text. It
answers with at most one element. The resolver repeats the text half itself,
because that is the half that ties — "the button that says Continue" is one
target on most pages and two on this one, and only a count tells those apart.

When the command named no target at all, so that no strategy ran, the focused
element resolves as `active-element`. That fallback is reached only when
nothing was attempted, never when everything missed.

**The gate.** A strategy's matches are filtered to those that are visible,
enabled, and of the recorded tag. This is deliberately weaker than the
actionability gate in `content/action-runtime/actionability.ts`: resolution
answers "which element is this?" and must not move the page to do it. When
the gate rejects every match, the matches themselves are the pool — a
strategy that found exactly one element has resolved it, and a hidden or
disabled target is exactly what an assertion asks about.

**The count.** One survivor resolves. Several survivors are handed to
scoring, and if scoring cannot separate them the resolution fails as
ambiguous rather than taking the first in document order.

## The Level 1 Veto

Level 1's queries are not equally strong. A class set and a line of text
collide constantly, and until decision **D14** a match made on one was acted
on with no score and no floor: a page whose Save button had been replaced by
`<button class="btn btn-primary">Delete workspace</button>` was resolved by
the class-set query and clicked, while Level 2 scored the same element below
zero and refused it. Every safety property the resolver had guarded the
cautious path only.

`identity/veto.ts` scores an exact match against the recording with the same
matcher Level 2 uses, and refuses it on either of two rules:

- **`contradicted`** — Core's `normalizedScore` is below `TARGET_VETO_FLOOR`,
  which is **0**. That is a statement rather than a fitted value:
  `normalizedScore` is agreeing weight minus disagreeing weight, so below zero
  the page contradicts more of the recording than it confirms.
- **`uncorroborated`** — nothing the recording named agrees. At least one of
  `visibleText`, `accessibleName`, `label`, `id` or `testId` must appear among
  Core's positive contributions. The selector and the class names are
  deliberately excluded, because they are what a weak query already matched
  on; counting them would let the strategy corroborate itself.

Both rules are skipped when the recording carries none of those five signals:
it asked no distinguishing question, so there is nothing for a candidate to
answer. That case is unprotected, and D14 names it rather than closing it.

The veto threshold is **not** the Level 2 floor, and the two answer different
questions: the floor asks "is this good enough to choose among several", the
veto asks "is this so wrong that acting is dangerous". A veto set at the floor
would refuse the drift recoveries this resolver exists to provide.

**A veto is a miss, not an abort.** The refused strategy is recorded as a miss
and the strategies after it, and then scoring, still run — which is how a
control that merely moved into another slot is recovered rather than only not
clicked.

An impostor carrying the recorded label passes, by construction: nothing in a
fingerprint can distinguish two controls a page has made identical.

## Level 2: Candidates And Scoring

**Enumeration** (`identity/candidates.ts`) collects, from the current
document only, the elements that share the recorded target's tag or role
family. "Family" is loose on purpose — a `<button>` that became a
`<div role="button">` is the same control to a person. The pool is drawn from
an interactive-element selector (`a[href]`, `button`, `input`, `select`,
`textarea`, `summary`, `label`, `[role]`, `[tabindex]`, `[onclick]`,
`[contenteditable]`), bounded to 5,000 interactive elements examined and 60
candidates kept. The pool reports how many elements it `examined` and whether
either bound `truncated` it (`TargetCandidatePool`), because "no such control"
and "stopped looking" call for different fixes: a `TARGET_NOT_FOUND` from a
cut-short scan says the page may hold more rather than that it holds none.
Each candidate is described as Core's `ElementFingerprintCandidate` by the
same `identity/` modules `describe-element.ts` uses, so a candidate and a
recorded descriptor are built from one set of rules.

**Scoring** (`identity/score.ts`) delegates to Core's element matcher,
imported from the `fluxiq/automation-studio/fingerprinting` subpath Core
publishes for browser bundles. Core owns the signal weights, the per-signal
comparisons and the confidence formula. This side contributes three things
Core cannot know about a browser:

- **which recorded signals are comparable** — only the ones a live candidate
  can also produce. An xpath, an attribute map and capture-time bounds are
  withheld, because a signal no candidate can answer penalises every candidate
  equally and drags the whole pool under the floor;
- **`TARGET_SCORE_FLOOR`, 0.35** — below it a candidate is not the recorded
  control but the least-wrong thing on the page;
- **`TARGET_SCORE_MARGIN`, 0.2** — how far ahead of the runner-up a winner
  must be before the result is an answer rather than a tie.

Scoring refuses outright when the recording offers no signal saying *which*
control it was: a tag and a role are the family, not the member, and every
candidate in the pool was chosen for sharing them.

The confidence a resolution reports is Core's own measurement of the winning
candidate, never a constant.

**Why the floor is reachable at all.** Level 2 runs only when every exact
strategy missed, which means the recorded id and test id are both gone — and
Core used to charge a *missing* stable identifier nearly as heavily as a
*contradicted* one, so no candidate could clear 0.35. Decision **D13** changed
that constant in Core rather than working around it here. The measurements,
the alternatives rejected, and D13's interaction with D14 are in the
[Week 1 plan](../working/mvp-week1-web-automation-reliability-plan.md).

## What A Resolution Reports

Every result carries `WebAutomationTargetResolution`
([`domain/src/actions/types.ts`](../../domain/src/actions/types.ts)): the
`strategy` (`selector`, `coordinates`, `visual-target`, `fingerprint`,
`active-element`, or `scored-candidate`), the `candidateCount`, and — for a
scored win — `bestScore`, `runnerUpScore` and `confidence`.
`webAutomationActionResultPayload` carries it on the wire. It is safe to carry
unguarded because of what it is: a closed enum and four numbers, with nothing
derived from page content.

An exact resolution reports its strategy and its count and no scores. The veto
does score every exact match, but it returns a measurement only when it
refuses; reporting an accepted match's score would mean either scoring twice
on the critical path or changing what `vetoCandidate` returns. That is the
last piece of decision D1 still open.

A failed resolution throws `TargetResolutionError`, which carries both the
failure record and the resolution:

- **`TARGET_AMBIGUOUS`** names the candidates that tied, with their scores
  where scoring ran, so "they tied at 1.00" and "the best of them reached
  0.12" are distinguishable;
- **`TARGET_NOT_FOUND`** names the strategies attempted, how many controls of
  the same family the page did offer, and the best score when scoring ran —
  which is the difference between a near-miss worth widening the target for
  and a control that is gone.

Candidate names in those records are page text, so they are bounded and
filtered by `identity/reportable-text.ts`: a label, never a container's
contents.

## Limits

- Scoring cannot rescue every drift, and is not meant to. A control whose
  text, id, class and test id have all changed scores below the floor against
  its own page; the resolver refuses rather than clicking the least-wrong
  thing.
- Candidate enumeration is per document. A merged cross-frame view exists for
  evidence ([page evidence](page-evidence.md)) but not for resolution; an
  action addresses one frame.
- No acting verb waits before resolving. `resolveTarget` runs its strategies
  and then scoring once and throws; nothing retries and nothing polls. A page
  that renders late is covered by a wait step before the action, and a
  recording proposes one: when the page added nodes and the first executable
  entry after that is a click on a selector in the same top document, with no
  evidence in between naming another URL, the recording mapper proposes
  `web.dom.wait_for_selector` for that selector to be present, ahead of the
  click (`domain/src/recording/proposals/late-target-wait.ts`; the recording
  side is in [extension client architecture](extension-client.md#a-wait-before-a-late-target)).
  A click recorded in a child frame proposes no wait, and a Flow without a
  recorded addition must author the wait itself.
