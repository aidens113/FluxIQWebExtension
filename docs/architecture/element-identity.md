# Element Identity And Target Resolution

How an action finds the element it acts on, and how sure it is that the
element it found is the one that was recorded. This page is current-state
design, verified against source on 2026-10-31. The action vocabulary itself
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
  one and ask the web domain's element matcher which of them it is.

Level 1 takes precedence, and its answer is gated, counted, and vetoed before
it is acted on.

The shared semantic-place gate (`content/identity/place.ts`) preserves any
recorded record, dialog and landmark. A recorded landmark role and optional
name must match the candidate; a missing or different landmark is not a
fallback target. The gate applies before exact-match counts and vetoes,
scored candidate admission and enumeration caps, and stable-name rescue. It
also supplies the existing read-landmark filter. Missing original landmark
metadata adds no new constraint. Thus changed IDs/classes can still recover
the navigation link while its same-word footer twin is excluded; two real
candidates inside the same recorded place remain ambiguous. Score weights,
floors and margins do not change.

## Level 1: The Exact Strategies

Tried in this order, each only when the ones before it found nothing:

| Order | Strategy | Asked as |
| --- | --- | --- |
| 1 | `selector` | `document.querySelectorAll(action.selector)` |
| 2 | `coordinates` | `document.elementFromPoint` at the command's point |
| 3 | `visual-target` | the same, at the visual target's centre |
| 4 | `fingerprint` | `stableFingerprintMatches`, then the name and exact-text scans |

A visual target's **document** bounds are preferred over its viewport bounds
and corrected for the current scroll: document bounds still say where the
element is after the page has moved, while viewport bounds point at whatever
has since scrolled into that spot.

`stableFingerprintMatches`
([`content/element-finder.ts`](../../apps/extension/src/content/element-finder.ts))
tries, in order: the recorded selector, the xpath, the id, `data-testid`,
`aria-label`/`name`, the drawing, and the class set. Each of those names one
control except the drawing and the class set, which every like control
carries, so they answer with all of their matches and mark them shared.

The **drawing** is a digest of what a wordless control draws
(`content/identity/drawing.ts`: an svg's geometry, a `<use>` symbol, an image
path; never paint). Every save path stores it when the control has one: a
recording carries it across the gateway (`WireElementTarget`,
`background/connection/gateway-payloads.ts`), a model-built step takes it from
the packet binding, and a runtime repair takes it from the same binding
(`domain/.../target/override.ts`). Core keeps it through its element-target
normalizer as an opaque token of at most 64 printable characters and never
scores it. The save-time floor (`domain/src/element-fingerprint/signals.ts`)
counts it as one signal, and counts only what the step actually saves. The
model never sees it. The resolver then runs the name and exact-text
scans as well and adds them to the same pool, and scoring chooses; a fingerprint
whose matches include no element scoring as the recorded control is a miss that
falls through to Level 2, not a tie. Before t436 the class set answered with its
first match alone and the text scan never ran, so a saved option chip ("7-in-1",
"Spain") resolved to the first chip of its group and was vetoed on every later
visit (run-mv4912r9-53b05a51). The words are scanned here, counted, because they
tie: "the button that says Continue" is one target on most pages and two on this
one, and only a count tells those apart.

Level 2's candidates are what a person can act on plus what the page dressed as
interactive, and also elements of the recorded tag the page listens on for
presses or that set their own pointer cursor, so a script-bound `<div>` chip is
scored rather than invisible. What a step saves leaves out the class that sets a
chosen option apart from its like siblings (`evidence/set-apart.ts`), from both
`classNames` and `attributes.class`: it is the control's state, not its identity.

When the command named no target at all, so that no strategy ran, the focused
element resolves as `active-element`. That fallback is reached only when
nothing was attempted, never when everything missed.

**The gate.** A strategy's matches are filtered to those that are visible,
enabled, and of the recorded tag. This is deliberately weaker than the
actionability gate in `content/action-runtime/actionability.ts`: resolution
answers "which element is this?" and must not move the page to do it. When
the gate rejects every match, the matches themselves are the pool — a
strategy that found exactly one element has resolved it, and a hidden or
disabled target is exactly what an assertion asks about. This visibility
fallback never restores a candidate rejected by the semantic-place gate.

**The count.** One survivor resolves. Several survivors are handed to
scoring, and if scoring cannot separate them the resolution fails as
ambiguous rather than taking the first in document order.

## The Level 1 Veto

Level 1's queries are not equally strong. A class set and a line of text
collide constantly, and the floor, the margin and the ambiguity refusal guard
Level 2 only. Unvetoed, a match made on a class set would be acted on with no
score and no floor: on a page whose Save button is replaced by
`<button class="btn btn-primary">Delete workspace</button>`, the class-set
query resolves the impostor, while Level 2 scores the same element below zero
and refuses it. Decision **D14** puts a veto in front of every exact match.

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

## Words That Change As State (t1071, F1)

Verified against source on 2026-11-26. Live run `run-mwyfc9uf-215bbd84`
(bigbox, four attempts on one site) saved a click on the header's cart link by
its words, "🛒 1 $3.97". The next attempt met the same link reading "🛒 2 $5.25".
Playback refused it four times as `web.target.not_found`, because the words were
the only signal the step carried that could corroborate it, and they were the
cart's count and total.

**The build marks the words as a value.** The domain's target store
(`domain/src/runtime/llm-evidence/plan-resolution/self-changing/state-words.ts`,
wired into `target-packets.ts`) remembers each link's wordings. Since t1079 a
link here is what stays the same about it: its frame and shadow hosts, tag, id,
test id, label, class names, region (landmark and dialog) and the whole address
it leads to, never its selector (see the t1079 section below). Beside the wordings it keeps the wordings the control's own act left in
the same document, and every address the control led to: its path and its query,
without its fragment (t1079 F1).

A control's words are state when two conditions hold:
- it was shown in two or more wordings that its own act did not cause;
- it is a link that always led to one address, path and query alike.

Its saved identity then keeps the words, so the save-time guard still counts
them, and gains two fields:
- `readsWords: true`, the mark a read's target already carries. It means the
  words are a value an earlier step may have changed: the page never vetoes on
  them, and they never settle a marked link.
- `href`, set to that destination.

The mark is applied in two places:
- when a handle is resolved (`resolve` and `resolveOn`), so the live act already
  carries it;
- when Core assembles a draft from an act's absolute parameters (`absoluteIntent`,
  then `resolve-plan-node.ts`).

**The `href` path convention.** A kept destination is the link's address from the
site root, written as `/…` with its query and with no origin or fragment (the
query since t1079). For example, the bigbox step is saved with
`href: "/scenarios/bigbox-retail/cart"`. The extension
reads `href` as a kept destination only when two conditions hold:
- the target is marked `readsWords`;
- `href` is such a path: it starts with `/` but not `//` (`identity/destination/recorded.ts`).

A recorded step's `href` is a whole address (`describe-element.ts`), so a
recorded read of a link is not mistaken for one. The origin is left out on
purpose, so a Lab run on another port still matches.

**What does not count as staying the same:**
- An id, test id or label. These are often the template's rather than the
  control's: every product card's title link can carry
  `data-testid="product-link"`, unique on each product page yet naming a
  different product on each. They help tell two controls apart, but they never
  qualify a control's words as state.
- A selector the capture gave to several elements. It names no single control
  and counts for nothing.
- Words the control's own act left in its document, such as "Get coupons" that
  became "Collected", or "Follow" that became "Following". These stay identity,
  and the change is the step's effect (t442, t447), in this attempt and in later
  ones.
- A control with no destination, such as a badge on a button ("Alerts 3"). It
  keeps its words as identity, as before.
- A class that toggles with the state. The link's stable facts, its class names
  among them, must be unchanged for its wordings to be compared at all; such a
  link stays unmarked.

**The page confirms a marked link by where it leads.**
`identity/destination/verdict.ts` reads a candidate's own destination: the path
and query of its `href`, only for an `a` or `area` that leads somewhere on the
same origin and is not an action link (`action-link.ts`). The candidate gets one
of three verdicts:
- `confirms`: it is shown, leads to the kept address, and no other visible link
  in its region leads there;
- `shared`: another visible link in its region also leads there, so the
  destination tells them apart no better than a tie;
- `elsewhere`: anything else, including a hidden link. A closed mini cart's
  "View cart" is no rival and no answer.

Each level uses the verdict differently:
- **The veto.** It judges the target without its words, counts the destination
  as the distinguishing question, and accepts only `confirms` in rule 2.
  Rule 1 still applies: if the page contradicts everything else the recording
  named, the candidate is refused whatever its destination.
- **Level 2** (`score.ts`). The one confirming candidate among the leaders wins.
  A leader scores at or above the floor and within the margin of the best. If no
  candidate confirms, the result is `unmatched`; if a link is `shared`, or two
  leaders each confirm in their own region, it is `ambiguous`.

The destination is never added to a score or subtracted from one. Together with
the words being a value, this keeps the rule that a control is never found by
one attribute alone while others disagree.

The offline proof replays the run's sequence (look, add, look, click the link)
through the domain runtime, the gateway mapping and this resolver
(`apps/extension/src/content/tests/cart-link-replay.test.ts`). On attempt 2's
page the saved step resolves to the header link. The step saved before the mark
is still refused. A link with the same words and place that leads elsewhere is
refused, and so is a second visible link to the cart among the header's own
links. Since t1079 an open mini cart's "View cart" no longer makes it a tie.

### Words And The Whole Address, Rivals Within A Region (t1079)

Verified against source on 2026-11-27. Live run `run-mwytbimp-e0c33977`
(bigbox) saved a click on the results page link "2" with the mark above, and
every later attempt refused it as `web.target.ambiguous` (sixteen candidates,
"2" at 0.51 and the header's `href="#"` links at 0.42).

**F1: words are state only while the whole address stays.** The pagination
slot `main > div > section > nav > a:nth-of-type(2)` is the link "2"
(`...&page=2`) on page 1. On page 2 a "Previous page" arrow shifts the slot, and
it is the link "1" (no `page`). Read by its path alone, both led to `/search`,
so the rule took two links taking turns in one place for one link whose words
changed. The mark then removed the words "2" and the `page=2` query, the two
things that said which link it was. The rule now compares the path and the
query (the fragment aside), in the domain (`state-words.ts`) and in the
extension (`destination/recorded.ts`, `destination/verdict.ts`). Words and
address that change together are two controls; a selector, however
positional, never makes them one. The bigbox cart link keeps its mark: "🛒 1
$3.97" and "🛒 2 $5.25" both lead to `/cart`.

The proofs:
- `self-changing/tests/state-words.test.ts` feeds the run's stored captures of
  the slot ("2" to `...&page=2`, "1" to the first page). The rule as t1071 left
  it marks the slot; it no longer does.
- A scratch Chromium run of the real resolver against the stored page-1 HTML
  (store object `b3069613…`, attempt 2's failure page) with trace row 585's
  command: as sent, the t1071 code gives the run's own `web.target.ambiguous`
  ("2" 0.51 and eleven more); saved without the mark, the step resolves to the
  link "2" (`&page=2`) by its selector, score 0.708.

**F2: a rival is counted only within the candidate's region**
(`destination/region.ts`). A region is the nearest dialog or landmark the link
sits in; a link in none has its whole root, as before. A visible link to the
same address in another region, such as an open mini cart's "View cart" beside
the header's links, is another way to go there, not a second reading of the one
link, so it no longer makes the header link a tie. Two candidates that each
confirm in their own region are `ambiguous` at Level 2: the ranking within the
margin never picks.

**Defect 2: a link keyed by its selector lost its own wordings.** Provider-free
run `run-mwyueo09-ea0204c3` (bigbox, scripted, already on t1071) still failed
the header cart link on attempts 2 to 4 as `web.target.not_found`. Reproduced
as `run-mwyw05h7-46d7d38f` (step 0040, the click by "🛒1$3.97"), the cause was
not a lost mark but a mark never made. The build did see both wordings. On a
results page the shell's support chat `div` follows the page `div`, so the link
is `body > div:nth-of-type(1) > header > div > nav > a:nth-of-type(3)`. On the
cart page there is no chat, so it is `body > div > header > …`. "1 $3.97" was
kept under both selectors and "2 $5.25" under the second only, and the click was
saved at the first, whose key held one wording.

The rule now keys a link by what stays the same, as listed above, and keeps,
per address, which links captures showed there. A step saved by its address
finds the link it named: the one at that address whose own words were shown
there. The fix has two guards:
- A link one capture shows twice by those facts (two links to one place in one
  region, alike in every stable fact) names no one link, and its words are never
  state.
- Hidden links (`hidden: true`) are not counted.

The class names are what keep the header's `href="#"` links apart from the
cart link on the cart page. The evidence spells an empty fragment as the page's
own address (`llm-evidence/location.ts`), so "Sign In" there reads as a second
link to the cart. The proofs:
- `self-changing/tests/state-words.test.ts`, "a link whose selector differs
  between pages is still one link";
- `content/tests/cart-link-replay.test.ts`, "the header link at another
  selector on the cart page". It fails on the t1071 rule and passes now.

That fixture's stub page now describes elements as the content script does: the
class in `attributes`, and the closed mini cart's link left out, since a
snapshot describes rendered elements only.

What F2 does not yet do: the saved identity carries the landmark's role
(`context.landmark`) but not its name. The content script captures it (the
pagination nav arrives as `landmarkName: "Pagination"`), and the domain's
evidence element (`llm-evidence/elements.ts`) and packet fingerprint
(`packet-fingerprint/from-packet.ts`) drop it, so the place gate
(`identity/place.ts`) cannot tell the header's links from a pagination nav.
Carrying it would have kept the header crowd out of run-mwytbimp's ranking.

## A Draft's Absolute Target And Its Act Witnesses (t1071, F3)

A draft keeps the exact parameters an act resolved. At assembly the domain
correlates them with the retained captures to find the control's intent
(`plan-resolution/control-intents/absolute.ts`). When the same identity matches
captures from two or more sources, assembly needs a witness: an act made from
one of those sources whose view names the target exactly. Every witness and
every match must agree on intent, and zero witnesses refuses as
`web.handle.ambiguous`. A source is a location, document (`timeOrigin`), frame
and layer.

The target store is kept per project and Flow, so it outlives an attempt, and
every attempt of a task runs under one Flow. Until t1071 the only witness was
the first act on each handle. In the bigbox run that was attempt 1's press of
"🛒 1 $3.97". Attempt 2 pressed the link as "🛒 2 $5.25", which then read the
same on the search page and the cart page. That act left no witness, so its
repaired draft was refused at `absolute.ts:73-74` (zero witnesses) and no repair
was ever saved.

**Each act is now a witness of its own source**
(`control-intents/witnesses.ts`). A later attempt's act is in a new document,
so it is a new source with a witness of its own. Two copies are kept when they
differ:
- the control as the act's own capture showed it;
- the identity the act ran with on that page, which is the views' agreement and
  is what the draft step carries.

The first act from one source stands, so an undo in the same document never
replaces it (t743). Two things are unchanged:
- The first-act-per-handle record (`acted`) still alone supplies the identity a
  candidate step restores (t442 F1).
- `absolute.ts`'s rules still apply in full. A witness establishes lineage only
  for a target whose identity it names exactly, and the state mark above
  (`readsWords`, `href`) is left out of that comparison.

The offline proof is in `plan-resolution/control-intents/tests/later-attempt.test.ts`.

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

**Scoring** (`identity/score.ts`) delegates to the web domain's browser-safe `createWebElementMatcher`, exported through `@fluxiq-web-extension/domain/client`. The domain owns calibrated signal weights, browser comparisons and browser snapshot projection; Core supplies neutral score aggregation through `fluxiq/runtime/target-matching`. Core's importer/runtime contexts receive the explicitly registered domain matcher. The extension adds these browser constraints:

- **which semantic place is eligible**: record, dialog and recorded landmark
  are browser-side constraints, applied before the web matcher compares descriptive
  signals; another landmark cannot become the winner because it kept old
  words or classes;
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
strategy missed, which means the recorded id and test id are both gone. Core
therefore charges a *missing* stable identifier far less than a
*contradicted* one (`MISSING_STABLE_IDENTIFIER_SIMILARITY` is −0.1,
`CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY` −0.8), so a candidate whose
identifiers were dropped can still clear 0.35. Decision **D13** puts that
difference in Core rather than working around it here. The measurements,
the alternatives rejected, and D13's interaction with D14 are in the
[Week 1 plan](../working/mvp-week1-web-automation-reliability-plan.md).

## What A Resolution Reports

Every result carries `WebAutomationTargetResolution`
([`domain/src/actions/types.ts`](../../domain/src/actions/types.ts)): the
`strategy` (`selector`, `coordinates`, `visual-target`, `fingerprint`,
`active-element`, or `scored-candidate`), the `candidateCount`, and, when the
element was scored, `bestScore` and `confidence`, with `runnerUpScore` for a
scored win that had a runner-up.
`webAutomationActionResultPayload` carries it on the wire. It is safe to carry
unguarded because of what it is: a closed enum and four numbers, with nothing
derived from page content.

An exact resolution reports its strategy, its count, and the veto's
measurement of the match it accepted, as `bestScore` and `confidence`
(`exactResolution` in `resolve-target.ts`). The veto scores every exact match
on the way past and returns that measurement whether it accepts or refuses, so
the number costs no second scoring. There is no runner-up, because only one
element was weighed, and both numbers are absent when the recording named
nothing the veto could weigh the match by.

A failed resolution throws `TargetResolutionError`, which carries both the
failure record and the resolution:

- **`TARGET_AMBIGUOUS`** names the candidates that tied, with their scores
  where scoring ran, so "they tied at 1.00" and "the best of them reached
  0.12" are distinguishable;
- **`TARGET_NOT_FOUND`** names the strategies attempted, how many controls of
  the same family the page did offer, and the best score when scoring ran —
  which is the difference between a near-miss worth widening the target for
  and a control that is gone. When the only control that matched was refused
  for belonging to another row (the record veto's `other-record`), the
  resolution carries `refusedBecause: "other-record"` (t792), and Core never
  calls it a near miss: it tells the builder the step names one row's control,
  and that a step inside a repeat needs each pass's own row's. The same word is
  said of a pass's control when the page in hand is another row's own page, or
  when the answer is a link of another row's shape and this row's is not drawn
  (`action-runtime/pass-row/aim.ts`, t869).

Candidate names in those records are page text, so they are bounded and
filtered by `identity/reportable-text.ts`: a label, never a container's
contents.

## Finding a stale target again (t786)

A step whose target came from an earlier step -- a read list's row handed to a
For Each pass, or a value bound to another step's answer -- can go stale when
the page re-renders between the two: a count goes up, a relative time moves on,
handles are renumbered, positional selectors move. After the step's second
failed retry on a target failure that never acted, FluxIQ Core re-runs the
source step read-only and asks the web host which of its fresh answers is the
same item. Core owns the lineage, the trigger, the re-run and the rebinding
(`fluxiq` `framework/automation-service/executor/target-reacquire/`); the web domain owns the
matching, in `domain/src/runtime/target-reacquire/`. Matching is by identity,
exact after spacing and case are set aside, never fuzzy and never by position.

- **Rows** (`row-match.ts`). Key columns first (`row-key-columns.ts`): the
  read's declared `dedupe.by` -- in its request, at its top level, or in its
  record output's `process` -- compared through Core's
  `automationStudioRecordRowIdentity`, the identity the read's own dedupe uses;
  a dedupe over every column is "list each once" and declares nothing. Without
  one, columns named as an id, URL, link, slug or key, or holding a link
  (picture columns excluded). With no key columns, every word column must be
  equal, while a column that says only a number, count, price or time
  (`volatile-text.ts`: "13 likes", "$12.99", "6 min ago", "Oct 28") may
  differ. A word column one side lacks is a difference, so the same post text
  under another author, or a title one word apart, is another item. Exactly
  one match is `found`; none is `gone`; several are `unmatched`/`ambiguous`; a
  stale row saying fewer than two identifying values is
  `unmatched`/`unidentifiable`.
- **Controls** (`element-match.ts`). The identity signals of
  `domain/src/element-fingerprint/signals.ts`: a candidate matches when every
  signal both carry agrees and at least two agree (the save-time minimum).
  Selector, xpath, list and table position and handle numbers are never
  compared. Words are skipped when the step reads them as its value
  (`readsWords`). A saved record is a gate before even a single descriptive
  match is accepted: stable key and key attribute first, otherwise its recorded
  text. Missing or conflicting record provenance and text drift remain
  unmatched; they cannot select another record or prove the original gone.
  A stable matching key can survive changed record text. Dialog, shadow-host
  chain and any recorded landmark role/name also gate both source-based and
  unbound control refresh. Another landmark cannot become the replacement.
  Missing or withheld place evidence remains unmatched, including when the
  capture is otherwise complete; it cannot prove the original gone. A fresh
  landmark name is used only when actually observed, never copied from stale
  metadata. Multiple eligible matches remain ambiguous; position never breaks
  a tie. Present contradictory ID/class signals keep their existing refusal;
  optional absent signals can still match through the remaining stable identity.
- **Going back first** (`return-to-source-place.ts`). The host remembers the
  `from` location of each attempt's before-action capture (`source-places.ts`,
  last 64 attempts). If the source's attempt recorded a location that differs
  from the current page, the host navigates there with `web.browser.navigate`
  and answers `returned`. It answers `unavailable` when the move fails or the
  page cannot be read, and `same_place` otherwise. Only a location the run
  itself recorded is used.

The host runtime (`domain/src/runtime/host-runtime.ts`) binds both
`reacquireTarget` and `returnToSourcePlace`, which covers playback and build
trials. A build's own runs outside a graph pass a `reacquire` callback to
Core's `automationStudioDispatchWithNodeRetries`
(`llm-evidence/node-run/retries/`):

- A row-bound replay step (`replay-row-reacquire.ts`) re-sends, once, the list
  read its pass's row came from, which is the replayed read remembered with
  that very row in `replayed-reads.ts`. It then matches the row and re-scopes
  the control to the fresh row.
- An exploration step on a looked-up handle (`looked-up-reacquire.ts`) looks
  again under the default retries and matches the control among the fresh
  look's controls in its own frame. It is then dispatched on the fresh
  identity and selector.

`gone` ends the node without spending a retry, under Core's
`executor.target.gone` record, never the page's not-found, which a replay would
read as a step the site remembered. A re-read that fails or answers no rows is
`unavailable`, never `gone`.

### Targets without a source step (Core 0.20)

The optional `reacquireUnboundTarget` hook uses the same trigger and act-safety
predicate, with actual resolved parameters and the failed attempt's captured
state reference. Canonical web output descriptors mark only `selector` and
`element` as `targetRefresh:true`. A successful host answer proposes those two
fields; Core applies them only to this arrival's remaining retries. Scope,
values, consequences, approvals and the stored Flow are not rewritten.

Native execution and authoring share the raw-observation classifier, complete
candidate conversion, record-aware matcher and fresh-target builder under
`domain/src/runtime/target-reacquire/identity/`. Authoring no longer requires
an old handle when a resolved saved fingerprint exists. A bare selector still
carries no stable identity. Source-bound row/output targets keep their original
source path, without a fallback search after that path fails.

Observation is pinned to the original gateway session and explicit frame. A
bounded private memo correlates attempt ID and before-action state reference
with actual session/tab/frame, safe location and document time origin. Child
targets obtain a separate scoped prior observation; a reused top-frame summary
is never relabelled as proof of the child's document. Unknown or changed
provenance returns unavailable without navigation to a guessed context.

Fresh capture must positively report the applied hidden-element option and a
settled, complete intended frame. Hidden matches participate in ambiguity but
are not dispatched. Missing metadata, incomplete or mixed scope, a withheld
identity, or record drift never establishes found or gone. Current DOM absence
does not prove an item absent from paginated or virtualized data.

Private `recordIdentities` and `captureProvenance` binding fields survive handle
restamping. The maps and capture provenance stay outside model packets and
durable traces; a selected screened record identity uses the existing saved
fingerprint contract. Scoped looks add to remembered controls rather than
forgetting other frames. Fresh fingerprints retain only fresh addressing and
context plus the original `readsWords` instruction.

### Private runtime repeat observations (Core 0.21)

`observeRuntimeRepeat` reads only captures already accepted by the native host.
Its 32-entry private memo correlates the exact snapshot ID, state reference and
capture timestamp; previous-reference reuse preserves that entry. Missing,
foreign or evicted references provide no equality evidence. Observation sends
no gateway command. Public snapshot references and summaries are unchanged.

Complete means positive coverage of the relevant shown state: valid consistent
capture totals, a settled document, no truncation or unanswered frames, and no
missing or withheld shown controls. It does not require hidden-element capture.
The initial producer supports positively scoped top-document views only;
merged child views lack each document's incarnation and therefore abstain.
Raw `evidence.frameCoverage` must explicitly report `mode:all_frames`,
`enumeration:complete`, and exactly `[0]` for both enumerated and captured frame
IDs. The browser producer establishes that marker from coherent actual frame
enumeration and replies. Missing/legacy, malformed, duplicate, child or
unavailable coverage abstains; absent normalized child IDs prove nothing.
Actual gateway session, browser source tab/frame, safe location and document
time origin determine the resource. Equal URLs or content alone are insufficient.

Whole-page snapshot reads are explicitly targetless. Supported element reads
and control actions require a unique captured fingerprint matched by the shared
multi-signal, record/dialog/root-aware matcher, correlated with the dispatch
selector. Private subject identity excludes handles, selectors and positions.
Missing, ambiguous, unsupported or withheld identity returns unavailable.
Row-input bindings and visual targets abstain because dispatch transforms or
selects their subject outside this observer's accepted binding.
Other operations need an observable-state contract before becoming eligible.

The view token reuses `webLlmStateDigest` on the exact sanitized binding. Its v7
checksum intentionally ignores handles, capture times, scroll and pure element
reordering; it is an equality heuristic, never authority or effect certainty.
Resource and subject tokens are collision-free private interned identifiers,
with bounded memory; eviction can only discard comparability. No private token
is written to a Flow, trace, model packet or public snapshot summary.

## Limits

- Scoring cannot rescue every drift, and is not meant to. A control whose
  text, id, class and test id have all changed scores below the floor against
  its own page; the resolver refuses rather than clicking the least-wrong
  thing.
- Candidate enumeration is per document. A merged cross-frame view exists for
  evidence ([page evidence](page-evidence.md)) but not for resolution; an
  action addresses one frame.
- Each `resolveTarget` call makes one resolution pass. The browser action's
  recovery ladder waits and retries when a target has not appeared, and Core
  applies its node retry policy while preserving uncertain-effect protection.
  Source-less identity refresh uses the recovery contract described above;
  it never makes a missing target permission to click a different record.
  Recorded late DOM additions can still propose an explicit
  `web.dom.wait_for_selector` before a top-document click
  (`domain/src/recording/proposals/late-target-wait.ts`; see
  [extension client architecture](extension-client.md#a-wait-before-a-late-target)).
  Child-frame recordings do not receive that top-document proposal.


The installed company-website repeat proof uses the canonical policy action
and real web output under required durable receipts. It verifies a pre-third
unchanged-read stop and seven intentional ForEach reads, with no observer
commands. Core owning tests separately cover the NativeNodeRuntime; the
observer does not make direct importer code admissible in required mode.
