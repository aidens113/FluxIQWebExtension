# Report: w3-sensitivity-consolidation

Worker: `w3-sensitivity-consolidation`. Wave 3 follow-up: the page-selection
leak `w3-redaction-followup` found and could not fix, and the five copies of
the sensitivity rule that make such leaks recur. Both halves are security
fixes, so the failing proof was written and run first in each case.

No captured or fixture value appears anywhere in this report, and no test name
carries one. Values are named by their field; absence is asserted, nothing is
quoted.

## Outcome

**Done.** Both tasks landed.

- The selection leak is closed and proven live: a select-all inside the card
  field on the `sensitive-input` fixture put the card number verbatim into
  `snapshot.selectedText` before this change. Five new spec rows; three failed
  before the fix, all five pass now.
- The rule is now one module in the domain package, and every one of the five
  sites either uses it or is documented as a different question. Comparing the
  five first found **one live leak** and **two silent weaknesses** in the LLM
  evidence packet's copy, all three now proven closed by rows that failed
  against the old code.

The full content harness is green (179 passed, 0 failed). The full domain
runner currently aborts on another worker's test; my own domain tests were run
directly and all pass. Both are described under
[Commands run](#commands-run-and-observed-results).

## What changed and why

### The two proofs, written and failed first

**`apps/extension/e2e/content/tests/selection-redaction.spec.ts`** — new, five
rows on the `sensitive-input` fixture. Run before any fix: **2 failed, 3
passed**. The first failure received the fixture's card value as
`snapshot.selectedText`, which is the record that the leak was live rather than
theoretical.

Two rows require withholding and two require *not* withholding, because a
snapshot that lost every selection would satisfy the security rows while
destroying the evidence item they exist to protect. The fifth row (a recorded
snapshot rather than a direct capture) was rewritten after its first version
turned out to pass vacuously: a scroll does not attach a snapshot
(`content/snapshots.ts` attaches one to `dom.keydown`, not `dom.scroll`), so
the row asserted absence from a message stream that carried no snapshot at all.
It now presses a bare modifier — the one interaction that makes the recorder
attach a snapshot without disturbing the selection under test — and asserts
that a snapshot actually rode along before asserting what is not in it. With
the guard bypassed the rewritten set fails **3 of 5**.

The card value is read off the page rather than restated, so it exists in one
place in the repository.

**`domain/src/runtime/llm-evidence/tests/elements.test.ts`** — new, eight rows.
Run against the old rule (restored for one run): **3 failed**. Those three are
the packet's real defects, described below.

### Task 1 — the selection leak

`apps/extension/src/content/dom-snapshot.ts` copied
`window.getSelection()?.toString()` into the snapshot with no sensitivity test.
It is now `capturedSelectionText()`, which withholds the selection when it came
out of — or reaches into — a control the shared rule protects. Three questions,
because no one of them is sufficient:

1. **The focused control.** This is the live leak, and it is the one the
   anchor/focus nodes cannot see: Chromium reports a text control's *internal*
   selection as selection text while the selection's anchor and focus nodes
   point at the control's **parent** (I observed this — the failing row's
   selection came from a field whose `<label>` was the anchor).
2. **The anchor and focus nodes and their ancestors**, walked up. This catches
   an element marked `data-sensitive` wrapping ordinary document text, which
   the focused-control question cannot see because nothing need be focused.
3. **Any sensitive control the selection's ranges intersect**, which catches a
   selection that begins outside a control and runs into it.

Question 3 is the one with a cost, and it is a deliberate trade rather than an
oversight, recorded in a comment at the code: a select-all across a login form
now yields no `selectedText` at all, even though Chromium would not have put
the password field's contents into that range. Whether a document range's text
includes a form control's value is a per-browser rendering detail, this
extension ships for Chromium/Edge **and** Firefox, and the brief that produced
this fix exists precisely because the previous leak hid behind a Chromium
quirk. A lost selection is a diagnostic inconvenience.

The scan is bounded (`MAX_SELECTION_SCAN`, 2,000 candidate controls) and
withholds rather than proceeds when the bound is exceeded. The sensitivity test
is `isSensitiveFormControl` from `content/element-traits.ts` — the one shared
rule. No second rule was written.

### Task 2 — one rule, one home

**`domain/src/sensitivity/`** — new. `signature.ts` holds the rule over four
named fields; `descriptor.ts` reads those fields off a serialized element
descriptor; `index.ts` is the barrel. It is in the domain package because the
structure audit forbids `domain/src` importing `apps/extension/src` while the
extension already depends on `@fluxiq-web-extension/domain/client` — that
asymmetry is the whole reason four copies existed.

Two shapes are exposed, as the brief anticipated, because the call sites hold
different things: `isSensitiveFieldSignature({inputType, controlType,
autocomplete, dataSensitive})` for a caller that has the fields, and
`isSensitiveElementDescriptor(unknown)` for the three that hold a wire
descriptor. The DOM adapter stays in the extension
(`content/element-traits.ts`, unchanged and not owned here), because this
package must not depend on the browser.

#### What the five implementations actually did

Compared before collapsing, as the brief required. Each difference is called a
distinction or a bug.

| Site | input type | `type` attribute | `autocomplete` | `data-sensitive` | Verdict |
| --- | --- | --- | --- | --- | --- |
| `apps/extension/src/shared/sensitive-field.ts` | `password` | — | token-split | `=== "true"` | The reference. Correct. |
| `domain/src/runtime/llm-evidence/elements.ts` | `password` | — | **whole-string**, cut to 200 chars | `=== "true"` | **Bug, three ways.** |
| `domain/src/runtime/reusable-evidence.ts` | `password`, `hidden`, `file`, `credit-card`, `one-time-code` | same set | — | — | **A different question**, plus a blind spot. |
| `domain/src/recording/reducers.ts` | `password` | — | token-split | `=== "true"` | Equivalent to the reference. Pure duplication. |
| `domain/src/recording/web-state/state-values.ts` | — | — | — | — | **A different concept.** |

**The LLM evidence packet's copy was a live leak.** It compared the whole
`autocomplete` attribute (`autocomplete === "cc-number" || ….startsWith("cc-")`)
instead of its tokens, so `billing cc-number` — the ordinary form a real card
field carries, and the exact form that leaked a card number in Wave 2 — was not
sensitive to it and the control was described in full to the model, with its
selector, name and form. The extension's copy had caught that form since Wave 1.
Two more, found the same way: the copy cut the attribute to 200 characters
before testing it, which is a way past a security predicate; and it never read
the raw `type` attribute, so a descriptor whose `inputType` was never derived
slipped through. All three now have a row that failed against the old code.

**Reusable evidence asks a genuinely different question, and it is now named
for it.** `sensitiveControl` is `unshareableControl`: the shared rule, **plus**
`hidden` and `file`, which are not secrets but must not enter a fingerprint
that is cached and reused — a hidden input is a per-session token rather than a
control, and a file input's identity describes the operator's filesystem. That
half stayed in the module whose reason it is, with the reason written down.
Folding `hidden` and `file` into the shared rule would have *widened* it into
withholding values the recorder must capture: a file input's filename is what
an upload step replays. Its blind spot (no `autocomplete`, no `data-sensitive`)
is a shape constraint — a packet element carries neither — and is closed
upstream by the same rule in `elements.ts`; that is now stated at the code
rather than left to be inferred.

`credit-card` and `one-time-code` are not HTML input *types* at all — they are
`autocomplete` tokens — but this module tested for them as types, so they were
carried into the shared rule rather than dropped. Dropping them would have made
this call site less strict than it is today.

**`state-values.ts` is a different concept and was not collapsed.**
`StateValue.sensitive` is Core's *marking* on a stored value ("handle this
carefully"), set for any element carrying a value at all; the shared rule
decides something stronger, that the value must not be stored. Both survive,
and the file now says so at the top. Two strictly-stricter changes were made
there, neither of which can redact less than before:

- the marking is now `element.value !== undefined || <the rule>`, so a
  secret-bearing control is marked even when it correctly carries no value;
- `elementStatePayload` drops `value` for a secret-bearing control, and the
  presentation label no longer falls back to a control's value when the rule
  protects it. Nothing is dropped today, because the extension already withholds
  it at the reader — but this is the far side of a wire from that guard, web
  state is persisted and replayed, and the reducer next door took exactly this
  second look in the previous brief for exactly this reason.

**The extension's file keeps its name and its exports.**
`apps/extension/src/shared/sensitive-field.ts` is now one re-export line plus
the explanation. `isSensitiveFieldSignature` and `SensitiveFieldSignature` are
unchanged names, so the eight call sites that import them — including
`element-traits.ts` and `runtime-status.ts`, neither of which I own — needed no
edit and did not churn. No extension bundle gains a dependency: `content` and
`background` are the only two bundles that reach the rule, and both already
import `@fluxiq-web-extension/domain/client`.

**`isSensitiveEvidenceElement` was deleted rather than kept as a forwarder.** It
had exactly one caller, in its own file. Leaving an exported alias would have
kept a second name for the one rule, which is how this started.

#### The canonical rule, and why it is never weaker

Union of everything the five caught, with nothing dropped:

- input type **or** the raw `type` attribute in `{password, one-time-code,
  credit-card}`;
- `data-sensitive` equal to `true`, now trimmed and case-insensitive;
- any `autocomplete` **token** in `{current-password, new-password,
  one-time-code}` or starting `cc-`, read from the attribute **in full** — no
  display bound, because truncating the input to a security test is a way past
  it.

Every site therefore gets a rule at least as strict as the strictest copy, and
four of the five get strictly stricter. `hidden` and `file` are deliberately
**not** in it, with a row asserting so, so the widening cannot happen by
accident later.

### Tests

Twelve rows on the rule itself (`domain/src/sensitivity/tests/`), covering both
directions, the malformed-descriptor shapes a page can produce, and the
`hidden`/`file` exclusion. Then one per collapsed call site:

- `domain/src/runtime/llm-evidence/tests/elements.test.ts` — new, eight rows;
  three failed against the old code.
- `domain/src/runtime/tests/reusable-evidence.test.ts` — one row proving every
  control the fingerprint excluded before is still excluded, by whichever half
  of the question catches it.
- `domain/src/recording/tests/reducers.test.ts` — its five existing rows are
  unchanged and still pass, which is the proof that call site's behaviour did
  not move; one row added for the two signals the shared rule adds.
- `domain/src/recording/web-state/tests/state-values.test.ts` — new, six rows,
  pinning both notions of "sensitive" and that the marking is a superset of the
  rule. Every row sends the value the producer is supposed to have withheld, so
  nothing asserted depends on the producer behaving.
- `apps/extension/src/shared/tests/sensitive-field.test.ts` — its three existing
  rows are unchanged and still pass through the re-export, which is the proof
  the extension cannot observe the move; two rows added.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-sensitivity-consolidation` and
`DOMAIN_TEST_BUILD_LABEL=w3-sensitivity-consolidation` were set on every package
command. Exit status was captured by redirecting to a file and echoing it
separately, never through a pipe. No `pnpm build`, no `pnpm lab`, no
`pnpm structure:baseline`.

**The failing proofs, before the fixes**

- `pnpm --filter @fluxiq-web-extension/extension test:content selection-redaction`
  → **exit 1**, `2 failed, 3 passed`. Failure 1 received the fixture's card
  value as `snapshot.selectedText`. Failure 2 was the cross-form range.
- The same command against the rewritten fifth row, with the guard bypassed →
  **exit 1**, `3 failed, 2 passed`. The two passes are the control rows, which
  must not move.
- `pnpm --filter @fluxiq-web-extension/domain test` with the old evidence rule
  restored for one run → **exit 1**, `# tests 219 / # pass 216 / # fail 3`. The
  three: `a multi-token card autocomplete is refused…` (received a fully
  described element where `undefined` was required), `the card autocomplete is
  found however far into the attribute it sits`, and `the raw type attribute is
  enough on its own`.

**After the fixes**

- `pnpm --filter @fluxiq-web-extension/extension test:content selection-redaction`
  → **exit 0**, `5 passed`.
- `pnpm --filter @fluxiq-web-extension/extension test:content` (full harness) →
  **exit 0**, **`179 passed`, 0 failed**. All fifteen redaction rows pass — the
  ten in `redaction.spec.ts` and the five new ones. Two earlier full runs during
  this brief were red with other workers' specs (14 failures, then 10, the
  second an exact subset of the first, in `check-assert`, `resolve-target`,
  `select` and `upload-dialog` — none mine, all in files other briefs were
  editing). They cleared as those workers landed.
- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. Re-run after the last edit: **exit 0**.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 189 / # pass 189 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**. Re-run after
  the last edit: **exit 0**.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 227 / # pass 227 / # fail 0` at 09:53. **Later runs of the same
  command abort at `# tests 10` with exit 1**, and the reason is not mine — see
  the first open question. My own tests were then run directly, through a
  throwaway runner using the same esbuild configuration, over the eight suites
  that touch anything I changed (the two new sensitivity suites, `elements`,
  `sanitize`, `reusable-evidence`, `reducers`, `state-values`, `snapshot`):
  **exit 0, 57 tests, 57 pass, 0 fail**. The runner and its output directory
  were deleted afterwards.
- `node scripts/structure-audit.mjs` through a scratch `GIT_INDEX_FILE` (a copy
  of `.git/index` with my new files added; the real index was never written) →
  **exit 1**, three violations. Run twice against a pristine copy of the index
  with my files unstaged, and the two outputs **diff to nothing — byte
  identical**, so my change moves no audit line, adds no finding and adds no
  warning. Repeated a second time with the whole in-flight tree staged
  (`domain/src/recording/web-state/` and `domain/src/runtime/llm-evidence/`,
  both untracked splits by other workers, in both indexes): again identical. I
  confirmed the audit honours `GIT_INDEX_FILE` rather than assuming it, by
  printing `createContext().trackedFiles` under each index — 6 of my new files
  under the scratch one, 0 under the pristine one. The three violations are
  `result-mapping.test.ts` and `shared/protocol.ts` reaching past
  `content/evidence`'s barrel (w3-evidence's seam) and `docs/working/README.md`
  being out of date (the supervisor's shared index).

## Not verified

- **No live browser validation in a loaded extension.** Everything live here is
  the real content-script bundle in real Chromium on the real fixture through
  the T2 harness: one world, no background worker, no frame routing. The
  selection decision is made entirely inside the content script, so the harness
  exercises the whole decision, but the wire hop to the background worker and
  on to the gateway was not exercised.
- **Firefox was not exercised**, and the third question of the selection guard
  is justified partly by Firefox's differing treatment of form controls inside a
  document range. That justification is reasoning about why not to depend on a
  rendering detail, not a measurement of Firefox.
- **The `data-sensitive` wrapper case has no live row.** No registered fixture
  has an element marked `data-sensitive` wrapping document text, so the second
  of the three questions is proven only by the unit rows on the rule and by the
  type checker. Adding such an element to a fixture would close it; I own no
  fixture.
- **The scan-bound branch is untested.** No fixture has more than 2,000 form
  controls, so `MAX_SELECTION_SCAN` overflowing and withholding is proven by
  reading, not by running.
- **Shadow DOM is out of scope**, as everywhere else in the recorder. A
  selection inside a shadow root is not reachable from `dom-snapshot.ts`.
- **The `state-values.ts` changes have no live row.** They are covered by six
  unit rows and by `snapshot.test.ts` continuing to pass; nothing exercises them
  from a page.
- **Whether Core behaves differently when more state values carry
  `sensitive: true`** was not measured. The marking is now set for a
  secret-bearing control that carries no value, where it was `false` before.
  Marking more is safe by construction — it can only make a consumer more
  careful — but I did not read Core's consumers of the flag.
- **`pnpm check`, `pnpm test` and `pnpm build` at the repository root** were not
  run: the wave forbids the last, and the other two are the supervisor's at
  integration.

## Open questions or contradictions found

1. **The shared domain test runner is being aborted by another worker's test,
   and it takes 217 of 227 tests down with it.** `pnpm --filter
   @fluxiq-web-extension/domain test` exits 1 after `# tests 10`, on an
   uncaught exception from a **module-scope** assertion in
   `domain/src/client/tests/gateway-mapping.test.ts:208` — "the wire target's
   element is a bare selector once Core has prepared it", which now receives the
   full eleven-signal descriptor. Because the assertion is at module scope
   rather than inside a `test()`, node:test reports it as "a resource generated
   asynchronous activity after the test ended" and kills the process, so every
   suite that sorts after `client/` never runs. The count is the only clue, and
   it is easy to miss. **It is not mine**, and I established that rather than
   asserting it: the domain suite passed 227/227 at 09:53:24 with all my source
   changes already in place; `domain/src/output-nodes/targets.ts`, whose
   `outputTargetFromPayload` the assertion calls, was written at 09:56:20; the
   first abort was at 09:58:31. As a direct counterfactual I removed my two
   barrel lines — the only path by which anything of mine reaches that test —
   and re-ran: **the abort is identical**, same message, same `# tests 10`. The
   lines were restored immediately. This belongs to `w3-domain-contracts`; the
   supervisor should also consider whether a module-scope assertion in a
   node:test file is acceptable at all, since one of them can hide an entire
   package's test results.
2. **`content/element-traits.ts` does not pass `controlType`, so one signal of
   the shared rule is unreachable from the live DOM.** `isSensitiveFormControl`
   builds the signature from `HTMLInputElement.type`, `autocomplete` and
   `data-sensitive`, but never the raw `type` attribute. For an `<input>` this
   costs nothing — `.type` already reflects the attribute — but a custom element
   or a non-input carrying `type="password"` would be seen by the descriptor
   path and missed by the DOM path, which is a new asymmetry between the two
   sides of the wire. It is a one-line change (`controlType:
   element.getAttribute("type") ?? undefined`) in a file this brief does not
   own. Worth folding into whichever brief next touches `element-traits.ts`.
3. **`background/connection/runtime-status.ts` still pulls the three fields out
   by hand.** It builds a `SensitiveFieldSignature` from a typed
   `DomElementDescriptor` where `isSensitiveElementDescriptor` would now do it
   in one call, deleting five lines and picking up the `type`-attribute signal.
   Not a defect — it uses the shared rule correctly — but it is the last hand-
   rolled field extraction, and I do not own the file.
4. **A third notion of "sensitive" exists and is fine, recorded so nobody
   re-litigates it.** `domain/src/recording/domain.ts:33` declares
   `forms.*` as `sensitive: true` in the state schema. That is a schema-level
   declaration about a path, not a rule about a control, and it is consistent
   with both notions in `state-values.ts`. I did not touch it.
5. **The selection guard's cost, stated plainly for the supervisor rather than
   buried in a comment.** A select-all that spans a login form no longer yields
   `selectedText`. On pages with no sensitive control — the overwhelming
   majority — nothing changes. If the evidence turns out to matter more than the
   margin, the narrower rule is "withhold only when the selection's anchor,
   focus or focused control is sensitive", which closes the observed leak and
   drops question 3; I judged that the wrong trade for the reason in the code
   comment, but it is a one-line revert if the supervisor disagrees.
6. **A sensitive control's snapshot ranking loses one more signal.**
   `dom-snapshot.ts` scores an element partly on `readElementValue`, which
   already returns nothing for a sensitive control (w3-redaction recorded this).
   `state-values.ts` now drops `value` from the stored blob as well, and
   `web-state/element/` ranks and filters state elements — a file I do not own.
   A sensitive control with no label, no name and no test id could rank lower
   than before in state. Every such control on the fixture still appears,
   because they all carry identity; this is a reasoned risk, not an observed
   one.
