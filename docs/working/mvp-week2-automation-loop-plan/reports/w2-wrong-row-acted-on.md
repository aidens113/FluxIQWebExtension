# A recorded Flow acted on a different record and reported success

Worker report. Brief: find the cause of `member-directory` / `member-left`
promoting the wrong member, and stop it.

## Outcome

**Done.** The cause is proven from a run, not inferred, and it is closed. The
same provider-free run that promoted the wrong member now fails at the first
step with the target failure the scenario declares.

The short version: the recorded selector was positional, and **nothing in the
recording said which row it meant**. The resolver's identity veto did its job
and could not help, because the 240 row buttons are identical by design. The
fix gives the recording a record identity -- which row, card or list item the
control sat in -- and refuses any match in a different one, at both acting
paths, failing closed.

**Section 8 is a follow-up and should be read before trusting this end to end.**
The gate was reaching the page on a recorded step and **not** on a step an
applied repair had rewritten -- so it was off for exactly the steps the loop had
touched. That is measured, closed and tested there. It also answers why the
record is not expressed through Core's `entityId`/`entityKind`, with numbers,
and why no Core change is needed.

---

## 1. What happened, with the decision points

### 1.1 The recorded selector was positional. Quoted from the run.

The failure record of `run-mu5vfd6o-d98abd77`
(`snapshots/flow-lane.json`, `failure.expected`) names it:

```
[data-testid="member-rows"] > tr:nth-of-type(171) > td:nth-of-type(7) > button
```

That was inferred before and is now read off a run. It is positional because
`selector/element-anchors.ts:26-44` knows exactly three identifiers -- `id`,
the test-id family, and the form `name` -- and the row action carries none of
them (`apps/scenario-lab/src/scenarios/member-directory/table.ts:77`: a
`<button>` with a generated class, `aria-label="Row actions"` and nothing
else). With no anchor on the button, its cell or its row,
`unique-selector.ts:80` falls to `${selectorFor(parent)} > ${step(...)}` and
`step` appends `:nth-of-type` -- a position. The row's own
`data-member-id` (`table.ts:68`) is invisible to `elementAnchors`.

### 1.2 Which element it resolved to

- Recorded member: **Priya Hollis** (`usr_3c95c2`), baseline row **171**.
- In `member-left` she is gone; row 171 is **Priya Krause** (`usr_b430d2`).
- The "before" screenshot read *"Priya Krause's role is now Admin"*. It lines
  up exactly.

Computed from the fixture: `RECORDED_MEMBER` is `members.ts:49`
(`memberById("usr_" + identifier(91))`), and `rosterFor("member-left")`
renumbers everything below her.

### 1.3 Why the veto accepted it

`resolve-target.ts` tries the selector first, gets **exactly one** match, and
hands it to `identity/veto.ts` (`resolve-target.ts:224`, the `vetoExactMatch`
call). The veto ran and passed, correctly, by its own rules:

- **Its precondition passed.** `recordedDistinguisher` (`veto.ts:255-260`)
  asks whether the recording named anything distinguishing. It did:
  `accessibleName: "Row actions"`.
- **Rule 1 (the score) passed.** The candidate is the recorded control's
  byte-identical twin -- same tag, same role, same generated class, same
  accessible name -- so Core scores it at the top of the scale, nowhere near
  `TARGET_VETO_FLOOR = 0` (`veto.ts:130`).
- **Rule 2 (corroboration) passed.** `corroboratesExactly`
  (`corroboration.ts:63-68`) asks whether a distinguishing signal agrees
  *exactly*. `accessibleName` agrees exactly -- because the design system
  writes the same constant on all 240 rows (`table.ts:17-18` says so in the
  fixture's own words).

The hole was documented in `veto.ts` before this work, at what were lines
95-98: *"An impostor that carries the recorded label exactly passes... Nothing
in a fingerprint can distinguish two controls a page has made identical."*
That is the whole defect. The veto is not weak here; a fingerprint simply
cannot answer the question, because the page made the two controls the same on
purpose.

`candidates.ts:165-188` had already considered and rejected the obvious
alternative -- feeding `tablePosition` into Core's matcher -- and measured it:
two identical row actions separate by 0.037 against a 0.2 margin. That
reasoning still stands, and a position is in any case the wrong signal, since
a departed member is exactly what changes it.

### 1.4 So the step succeeded, six times over

`run-mu4yrwgj-02fe85f7/evaluation.json`, read directly:

```
verdict failed, failureCategory runtime.behavior
oracleVerdict failed, reportedVerdict passed, automationFailureReported null
actions: click, scroll, wait_for_selector, click, select, click   (all succeeded)
```

The Flow ran the whole promotion workflow against another member and reported
success. The oracle caught it; nothing in the runtime did.

---

## 2. The fix

**One new signal, checked as a gate.** The recording now carries which
**record** the control sat in, and a replay refuses a candidate in a different
one.

### 2.1 `apps/extension/src/content/identity/record.ts` (new)

- **What counts as a record**, deliberately narrowly: an ancestor (or the
  element itself) that is record-shaped -- `tr`, `li`, `article`, or the ARIA
  roles that say the same -- **or** that carries a per-instance identifier
  attribute. A `<div>` wrapper is not a record.
- **The key attribute rule** is `/^data-(?:[a-z0-9]+-)*(?:id|key|uid|uuid|guid)$/`:
  `data-id`, `data-member-id`, `data-row-key`, `data-entity-id` match;
  `data-grid`, `data-valid`, `data-sort`, `data-action` do not, and
  `data-testid` / `data-test` / `data-cy` are excluded by construction,
  because a template writes the same test id on every instance it renders.
- **What identifies one**, strongest first: the per-instance key *with the
  attribute it came from*, so a replay asks the candidate's record for that
  same attribute rather than guessing; failing that, the record's own bounded
  text, and only when the page held more than one such record at capture time.
  A keyed record carries no text, so the comparison never degrades to the
  weaker rule while the stronger one exists.
- **The text leaves two things out**: a sensitive control's contents, by the
  one rule `sensitive-text.ts` owns, and the words inside buttons, switches,
  checkboxes and editable regions -- those say what a control is *doing*
  ("Follow" / "Following"), so including them would refuse step two of a Flow
  because step one changed the row it is still working in.
- **Fail closed.** A candidate in no record at all, or in one the recorded
  attribute is missing from, disagrees. "I cannot tell which record this is" is
  not "it is the right one".
- Every lookup is bounded: 12 ancestors, 400 nodes, 160 characters. The key
  path -- the common one on a table worth protecting -- short-circuits before
  any text is read.

### 2.2 Where it is applied

| File | Change |
| --- | --- |
| `content/identity/context.ts` | `elementContext` emits `record`, beside the positions it already emitted |
| `content/identity/veto.ts` | **Rule 0**, asked before the other two and whether or not the recording named a distinguisher; refuses `other-record` |
| `content/identity/score.ts` | Level 2 filters ineligible candidates **before** ranking, so a wrong-row twin cannot win *or* tie |
| `content/action-runtime/resolve-target.ts` | `RecordedTarget` carries `context` |
| `content/identity/index.ts` | barrel |

Rule 0 returns no measurement, and the verdict union says so explicitly: it is
a gate, not a score, and writing a number there would invent one.

Level 2 filtering matters as much as the veto. Without it, refusing at Level 1
would have handed 239 identical twins to the scorer and turned "the recorded
row is gone" into "239 candidates tied" -- a different failure, and a worse one.

### 2.3 The wire

`context` already crossed the wire end to end; `record` rides on it.

- `apps/extension/src/shared/protocol.ts` -- `DomElementContext.record`.
- `domain/src/actions/types.ts` -- `WebAutomationElementContext.record`.
- `domain/src/output-nodes/targets/targets.ts` -- `elementRecord`, read with
  the same closed vocabulary as the context around it. **This one is
  load-bearing**: `context` itself was captured, carried and then silently
  dropped by this exact function for a week (the comment at `targets.ts:184`
  records it), and dropping `record` here would not lose a hint, it would put
  the wrong-record click back.
- `recording/web-state/action-target.ts:134` already passes `context` whole
  into the envelope's metadata, and `background/connection/gateway-payloads.ts:160`
  passes it whole to the gateway. Neither needed a change, and the run proves
  the value arrives: the veto could not have refused without it.

### 2.4 Two files outside the brief's "You own" list

`apps/extension/src/shared/protocol.ts` and `domain/src/actions/types.ts` are
in neither the owned nor the "not yours" list. The fix is unbuildable without
them -- a new `context` field has to be declared at both ends, and both
declarations are enumerated by `ContractFields`/`present`, so a producer cannot
emit a field the type does not carry. Neither file is touched by any other
worker's uncommitted work (`git status`), and both changes are purely additive:
one optional field, documented. Flagged rather than hidden.

---

## 3. Tests added

| File | What it pins |
| --- | --- |
| `content/identity/tests/record.test.ts` (new, 10 rows) | the rule: what is a record, what identifies one, the fail-closed half, `data-testid` is not a key, a lone record records nothing, a button's changing label does not change its row's identity |
| `content/identity/tests/record-veto.test.ts` (new, 3 rows) | the gate at both acting paths. The first row **asserts the defect**: the same twin, with `context` removed, scores above the veto floor and `vetoCandidate` accepts it -- so the row fails if the gate ever stops being the thing that refuses |
| `content/action-runtime/tests/wrong-row-resolution.test.ts` (new, 1 row) | the whole resolution: a positional selector that lands in another record throws `web.target.not_found` and says "in another record"; the same command with its record present still resolves by `selector` |
| `domain/output-nodes/targets/tests/targets.test.ts` (+4 rows) | `record` survives into the fingerprint and the dispatched target, is read as a closed vocabulary, and an empty one is absent rather than `{}` |

The new rows were first appended to `resolve-target.test.ts` and `veto.test.ts`
and then split into files of their own, because they pushed both past the
structure audit's 400-line advisory threshold. The audit is back to the
warning count it had before this change.

---

## 4. Commands run, and what they printed

### Provider-free reproduction, before and after

`pnpm lab run` could not be used: `packages/test-runner` does not compile in
the working tree right now --
`src/run-scenario.ts(646,82): error TS2304: Cannot find name 'coreProbeTargetUsable'`
-- which is another worker's in-flight edit, and `run-lab.mjs` builds
unconditionally. The already-built `packages/test-runner/dist/cli.js` was
driven directly with the same environment the launcher sets
(`FLUXIQ_LAB_EXTENSION_PATH`, `FLUXIQ_LAB_SCENARIO_ENTRYPOINT`,
`FLUXIQ_TEST_ENV_FILES=none`). The extension and domain builds that carry the
fix both succeeded.

**Before** -- `run-mu4yrwgj-02fe85f7` (the earlier worker's run, artifacts read
directly, not taken from their report):

```
verdict failed, failureCategory runtime.behavior
oracle failed, reported passed, automationFailureReported null
6 actions: click, scroll, wait_for_selector, click, select, click -- all succeeded
```

**After** -- `run-mu5vfd6o-d98abd77`:

```
verdict failed, failureCategory action.dispatch
oracle passed, reported failed
automationFailureReported {category: target_not_found, code: web.target.not_found}
automationFailureExpected {category: target_not_found, code: web.target.not_found}
1 action: click -- failed at target_resolution
```

and the failure record, which is the whole story in one line:

```
expected: an element matching selector [data-testid="member-rows"] >
  tr:nth-of-type(171) > td:nth-of-type(7) > button (refused button in another
  record), visual target 1212,9568, element fingerprint (refused button in
  another record)
actual: nothing matched; 60 control(s) of the same family in the first 130
  interactive element(s); the scan was cut short there, so the page may hold more
```

Three strategies, two of them landing on the same wrong button, both refused by
name; then the scored fallback ranking none of the 60 same-family controls,
because none is in the recorded row.

### Regression runs, provider-free

| Run | Scenario | Result |
| --- | --- | --- |
| `run-mu5vkszg-0c61839d` | `member-directory --flow` (baseline) | **passed**, oracle passed, 5 actions |
| `run-mu5vmsir-67765248` | `member-directory --variant restyled --flow` | **passed**, oracle passed, 5 actions |
| `run-mu5vonm5-d3aef36f` | `admin-console --flow` | **passed**, oracle passed, 8 actions |
| `run-mu5vqm2d-4ebdc6b9` | `member-directory --workflow remove-invitations --flow` | **passed**, oracle passed, 8 actions |

`restyled` matters because it changes every generated class on the page and the
gate survives it -- a `data-member-id` is not a class. `admin-console` matters
because it is the other record-heavy scenario and its list is *virtualised*,
which is the case most likely to be broken by a rule that pins a click to a row.
`remove-invitations` matters because its `select-all` step clicks a checkbox in
the table's header row, which the rule must *not* treat as a record.

### Suites

| Command | Result |
| --- | --- |
| `apps/extension`: `tsc -p tsconfig.json --noEmit` | clean |
| `apps/extension`: `node scripts/test-extension.mjs` | `# pass 676  # fail 0` (672 before; +4 files' rows, net of the split) |
| `domain`: `tsc -p tsconfig.json --noEmit` | clean |
| `domain`: `node scripts/test-domain.mjs` | `# tests 657  # pass 650  # fail 7` -- **all seven pre-existing and not mine**, see below |
| `apps/scenario-lab`: `pnpm test` | `# pass 242  # fail 0` |
| `node scripts/structure-audit.mjs` | `passed (62 warning(s), 122 baselined)` -- the same count as before this change |

**The seven domain failures.** All are in
`domain/src/runtime/llm-evidence/tests/` (`recovery-selector-hints.test.ts`,
`tools.test.ts`) and fail on `{"status":"absent","reason":"recorded_target_unknown"}`
out of the repair-resolution path. `git status` shows
`domain/src/runtime/llm-evidence/target-override.ts` modified and
`target-equivalence.ts` untracked -- another worker's uncommitted work, which
the brief names as theirs. Nothing in them touches `context` or `record`. I did
not investigate further and did not touch those files.

---

## 5. Other Lab recordings that could act on the wrong record

Surveyed every `click` / `type` / `select` / `check` step in every scenario
manifest, asking two questions: would `selectorFor` produce a *positional*
selector, and does the target sit in a *repeated record*.

**Both true -- the wrong-record risk, now closed by a key:**

| Scenario | Step | Why positional | Protected by |
| --- | --- | --- | --- |
| `member-directory` | `open-row-menu` (`ROW_MENU`) | button, cell and row all anchorless | `data-member-id` |
| `admin-console` | `open-customer` (`testid:record-row`) | the test id is on **every** row, so it is not a sole match and the selector falls back to a position -- **in a virtual list**, where the row at a position depends on scroll | `data-record-id` |
| `admin-console` | `open-far-customer` (`FAR_ROW`) | same rows, same fallback; the fixture's `[data-record-id]` target is *not* what the recorder writes | `data-record-id` |

Both `admin-console` steps were the same latent defect as the member directory
and are now gated. Its flow lane still passes.

**In a record but uniquely addressable, so never positional -- now additionally
pinned to their record, which is a strengthening:**

- `multi-tab` `open-order-details` / `confirm-order-review`: rows carry
  `data-entity-id`, which the key rule matches, so these are keyed rather than
  text-matched.
- `storefront-checkout` `choose-address` (`testid:address-option-2`): the
  button itself carries `data-address-id`, so the step is now pinned to an
  address id rather than to the second position in the list.

**Not at risk:**

- Every `extract` step with `fields` (`data-table`, `product-catalog`,
  `infinite-feed`, `admin-console read-customer-book`) dispatches
  `web.dom.extract_list`, and `content/actions/extract-list.ts` does **not**
  call `resolveTarget` -- it never reaches the veto. This includes
  `data-table`'s deliberately positional `[data-testid="inventory-row"]:first-child`,
  which was the one target I expected to be a problem and is not.
- `member-directory` `select-all` sits in the `<thead>`'s only `<tr>`, so it is
  not "repeated at capture" and records no identity.
- Everything else (`modal-flows`, `identity-drift`, `llm-target-drift`,
  `failure-surfaces`, `dynamic-list`, `long-document`, `ambiguous-targets`,
  the rest of `storefront-checkout`) targets a unique test id outside any
  record.

---

## 6. Not verified

- **`multi-tab`, `storefront-checkout`, `data-table`, `product-catalog` and
  `infinite-feed` flow lanes were not run.** The reasoning above is read from
  the fixtures and from which verb dispatches, not measured.
  `storefront-checkout` cannot run here anyway: it declares replay secrets and
  no `FLUXIQ_TEST_SECRET_*` is set, which is the refusal §1 of
  `w2-campaign-tasks-start.md` documents.
- **No live provider run**, by instruction. That the repair task
  `member-directory-refuse-departed-member` now reaches the loop and that the
  loop *refuses* is **not shown**. What is shown is the precondition it never
  had: the run now produces the `target_not_found` failure the task needs, at
  the first step, instead of a false success.
- **`pnpm check`, `pnpm test` and `pnpm build` at repository level were not
  run.** `packages/test-runner` does not compile in the working tree (another
  worker's edit), so a repository-level gate cannot pass for reasons unrelated
  to this change. The narrowest suites covering every file I touched were run
  instead, and are listed above.
- **The text fallback has had no live exercise.** Every record the Lab actually
  replays into turned out to be keyed, so the branch is covered by unit rows
  only. Its brittleness is real and named in §7.
- **Single-run outcomes on this machine carry its known RAM fault as an error
  bar.** No run here showed a RAM-fault signature; the four lab runs were run
  one at a time.
- `apps/extension/build/` and `domain/.test-build/` are tracked and were
  regenerated by the extension build and the domain test run. That is how they
  are meant to be updated; they are not hand-edited.

---

## 7. Open questions, and what this costs

1. **A negative variant that reports exactly the failure it declares is still
   `verdict: failed`.** `run-mu5vfd6o-d98abd77` has
   `automationFailureReported == automationFailureExpected` and
   `oracleVerdict: passed`, and the `runner-verdict` invariant still reads
   `expected: passed, actual: failed: action.dispatch`. So the Lab cannot
   currently show "this negative case behaves correctly" as a pass. That is
   `packages/test-runner` (another worker's file) and I changed nothing there,
   but it is worth someone's decision: as it stands, the fix looks like a
   failure on the dashboard.

2. **The text fallback is the weak half, and it fails closed.** A record with
   no key is identified by its own words, so a row whose words change between
   capture and replay -- a timestamp, a counter -- will refuse the step rather
   than act on it. Controls' words are already excluded, which removes the
   common case, but not a "last active 2 minutes ago" column. Nothing in the
   Lab exercises it. The alternative -- comparing loosely -- is the
   partial-agreement mistake `corroboration.ts` was written to undo, so I did
   not take it.

3. **`data-testid` is deliberately not a record key, and sometimes it is one.**
   A page that writes a genuinely per-row `data-testid="row-usr_91"` gets no key
   from it and falls to text. Distinguishing the two cases needs a sibling
   comparison, which I left out because it makes the recorded and replayed
   answers depend on how many siblings each page happens to have -- and a
   filtered table showing one row would then answer differently from the table
   that was recorded.

4. **The candidate sweep's cap can still hide the right record.** The Level 2
   filter runs after `collectTargetCandidates`, which stops at 60 candidates.
   On a page where 60 same-family controls precede the recorded record, the
   correct candidate is never examined and the step fails closed. Scoping the
   enumeration to the located record would fix it, but `collectTargetCandidates`
   takes a `Document`, and an `Element` root would exclude the root itself --
   which is wrong for a recorded click *on* a row, as `admin-console` records.
   Left undone deliberately; it is a refusal, not a wrong action.

5. **A selector that named the row would have prevented this too, and does not
   replace the gate.** If `element-anchors.ts` learned about per-instance data
   attributes, the recorded selector would be `[data-member-id="usr_3c95c2"] ...`
   and would simply miss on `member-left`. But `element-finder.ts`'s xpath
   fallback is *also* positional, and its class-set query answers with
   `querySelector` -- the **first** of 240 matches. Either would have put the
   wrong button back. The two changes are complementary, and the gate is the one
   that holds whichever strategy produced the answer. `element-finder.ts` and
   the three e2e specs are another worker's; nothing here touches them.

---

## 8. Does the record survive an applied repair? (follow-up)

**Question put by the coordinator**: Core normalises an element target through a
fixed whitelist that does not include `context`, and that normaliser runs on
every policy output dispatch and on an applied repair's target. When a repair is
applied to a recorded step inside a list, does the record identity still reach
the veto?

**Answer: it did not. It does now.** Everything below was executed, not
reasoned: the probes ran the domain's real `outputTargetFromPayload` and
`webAutomationActionFromGatewayCommand` against Core's real
`normalizeAutomationStudioElementTarget`, and they are kept in this session's
scratchpad as `probe-a.mjs`, `probe-b.mjs` and `probe-entity-score.mjs`.

### 8.1 Confirmed: Core's whitelist has no `context`

`AS/model/action-element-target.ts` `normalizeFingerprint` (line 131) builds
exactly: `visibleText, accessibleName, label, id, testId, automationId,
entityId, entityKind, tagName, role, selector, xpath, queryPath, statePath,
url, classNames, bounds, attributes, metadata`. No `context`.

### 8.2 Measured: which paths carried the record, and which dropped it

The recorded element carries `context.record = {data-member-id, usr_3c95c2}`.
"Rule 0" means `command.element.context.record` arrived, which is the only thing
the page's gate reads.

| Path | adapted supersedes | record on `command.element` | rule 0 |
| --- | --- | --- | --- |
| recorded, untouched | no | present | on |
| recorded + Core's dispatch rewrite | no | present | on |
| **repair applied, as stored** | **yes** | **null** | **off** |
| **repair applied + Core's rewrite** | **yes** | **null** | **off** |

The renamed-Save-in-a-row case is the third and fourth rows: a repair naming the
control "Save changes" where the recording said "Save" makes
`adaptedTargetSupersedesRecording` true, and the record went with the identity
it replaced. The gate was therefore off for **exactly the steps a repair had
touched** -- which is precisely where a page has been changing underneath the
Flow.

**Why, in two mechanisms that compound.** `elementFingerprintSources`
(`targets.ts`) picks *one* source for the whole identity, and on a repair the
adapted target wins it. That adapted target is normalised by Core from
`parameters.target` **alone**; it never sees `parameters.element`, so it cannot
inherit the recording's context either. The recorded record did survive in the
untyped `options.element` bag, but `recordedTarget()` (`resolve-target.ts`)
reads the declared `action.element` first and falls back only when it is empty,
which it is not.

### 8.3 `entityId` / `entityKind`: they survive Core, and they still cannot do this

The preferred fix was to express a record through Core's generic record
identity. Both signals **do** survive Core's whitelist, and Core's re-derivation
from `parameters.element` propagates them onto its own target -- verified. Three
findings stopped me using them, in increasing order of importance.

1. **The domain strips them today.** `elementFingerprint` writes
   `entityId: undefined, entityKind: undefined` deliberately ("a browser
   recording has no source for any of them"). That is a change here either way,
   and on its own it is not an objection.
2. **They still do not survive the repair path.** With `entityId` on the
   recorded element, the renamed-repair rows above still dispatched
   `entityId: null`, because Core normalises the repair's target in isolation.
   The entity route therefore needs the same carry-across fix as 8.4 *and* a
   scoring change; it does not replace it.
3. **They are scored, and the separation they buy is a tenth of what a decision
   needs.** `entityId` has weight 24 in
   `fingerprinting/element-fingerprint.ts` and counts among the "strong match"
   signals. Measured against Core's own matcher, on a candidate otherwise
   identical to the recording:

   | recorded | candidate | normalized | confidence |
   | --- | --- | --- | --- |
   | no entity | no entity | 1.000 | 0.94 |
   | entity | **cannot answer** | **0.697** | 0.655 |
   | entity | agrees | 1.000 | 1.00 |
   | entity | **different record** | **0.640** | 0.602 |

   Two consequences. Putting an `entityId` on every recorded row control costs
   **0.303** of normalized score against every candidate that cannot answer it,
   and today none can -- Core builds candidates from visual layers and the
   extension puts no entity on them -- so this would move Core's calibrated
   matching for every element the recorder describes, against a
   `TARGET_SCORE_FLOOR` of 0.35. And the right record and the wrong record
   separate by **0.057**, against the **0.2** margin a winner must beat the
   runner-up by; 0.640 for another member's row is also comfortably above the
   veto's floor of 0.

   This is the same finding `candidates.ts` recorded for `tablePosition` (0.037
   against the same 0.2 margin), reached independently: **a record is a gate,
   not a weight.** Carrying it on a scored signal makes it worse at the job --
   it cannot decide, and it disturbs everything that can.

### 8.4 The fix taken, and why no Core diff is needed

`domain/src/output-nodes/targets/targets.ts`, `withRecordedRecord`: the adapted
source keeps the identity it won, and **the record comes from the recording**.

This is not a patch around the rule; it is the rule's own exemption. Its
documentation already says why `selector` and `xpath` are excluded from the
comparison -- "a target that only locates the recorded control somewhere else
keeps the recorded identity". A record is in that category and more strongly.
**A repair says what a control is now called; it has no standing to say which of
240 rows it belongs to.** The shape a repair arrives in proves the point:
`runtime/llm-evidence/target-override.ts` writes `listIndex` and `listTotal`, a
*position* in the list, which is exactly the signal a departed member
invalidates. An adapted source that names a record of its own keeps it, because
then it is describing a record rather than inheriting one.

One change covers both ends: `commandElementFingerprint` reads `target.element`
first, and that is what `outputTargetFromPayload` produced, so
`client/gateway-mapping.ts` needed no edit. Re-measured after the change, the
renamed repair dispatches `accessibleName: "Member actions"` **and**
`record: {data-member-id, usr_3c95c2}`, before and after Core's rewrite.

**No Core diff is required.** Core is not losing anything it was asked to keep;
the hole was entirely in this repo's producer, which chose one identity source.
For the record, Core does also offer a non-scored carrier if one is ever wanted:
`promotedFingerprintMetadataKeys` (line 259) does not list `context`, so
`sanitizeJsonObject(metadata, promoted)` passes `fingerprint.metadata.context`
through **intact** -- verified. I did not write into it, because `targets.ts`
has an explicit decision not to write behind its declared fields into Core's
metadata slot and no consumer needs it today. If the generic expression is still
wanted, its prerequisite is that Core's candidates answer `entityId`, and that
is reachable from **this** repo (the visual-layer metadata Core reads), not from
Core -- but 8.3 says it would still not decide anything.

### 8.5 Tests

| File | Rows |
| --- | --- |
| `domain/output-nodes/targets/tests/targets.test.ts` | a repair inside a list keeps its own name and still carries the recorded record; the same after Core's rewrite, asserting first that Core's fingerprint has no `context`, so the row fails if the loss it compensates for ever goes away; an adapted target naming a record of its own is not overwritten; a recording that named no record still dispatches without one |
| `content/action-runtime/tests/wrong-row-resolution.test.ts` | a repaired step is refused when the control it finds sits in another record; and resolves when it sits in the recorded one |

The extension rows pin the refusal **strategy by strategy** rather than matching
the phrase anywhere in the message. That is not belt and braces: while the row
was being written the stub page still showed the *recorded* name, so the score
refused the match at -0.11 and the row passed while testing nothing about
records. The tightened assertion fails in that state.

### 8.6 Commands and observed results

| Command | Result |
| --- | --- |
| scratchpad `probe-a.mjs` / `probe-b.mjs` (real domain, real Core normaliser) | the 8.2 table; after the fix, the record is present on every row |
| scratchpad `probe-entity-score.mjs` (Core's real matcher) | the 8.3 table |
| `domain`: `tsc -p tsconfig.json --noEmit` | clean |
| `domain`: `node scripts/test-domain.mjs` | `# tests 661  # pass 654  # fail 7` -- the 4 new rows pass; the same seven pre-existing `llm-evidence` failures as section 4, unchanged in name and count |
| `apps/extension`: `tsc -p tsconfig.json --noEmit` | clean |
| `apps/extension`: `node scripts/test-extension.mjs` | `# pass 678  # fail 0` |
| `apps/scenario-lab`: `pnpm test` | `# pass 242  # fail 0` |
| `node scripts/structure-audit.mjs` | `passed (63 warning(s), 122 baselined)` |
| `member-directory --variant member-left --flow`, provider-free, after the domain change | `run-mu5wev6x-fd65956b`: oracle passed, reported failed, `web.target.not_found`, 1 action -- identical to `run-mu5vfd6o-d98abd77`, so the carry-across changed nothing on the unrepaired path |

### 8.7 Not verified, and one warning I added

- **No live repair was run**, by the no-provider instruction. What is shown is
  that a repaired step's dispatched element carries the record, and that the
  page refuses on it -- through the real domain code and Core's real normaliser,
  at unit level. An applied repair replaying against a real page is not shown.
- **The repair shape is read from `runtime/llm-evidence/target-override.ts` as
  it stands in the working tree**, which another worker is editing. If the
  applied-repair shape changes, 8.2's third row is the one to re-measure.
- **I added one advisory warning.**
  `domain/src/output-nodes/targets/targets.ts` is now 420 lines, past the
  400-line advisory threshold (63 warnings, up from 62; the audit still passes).
  The split is already prescribed by that directory's own barrel comment --
  "the fingerprint normalizer, the output-target builder, and the JSON value
  readers are three separate things sharing one file today" -- and the context
  readers are now a fourth. I did not do it here: it is a shared module, other
  workers have the domain open, and it would turn a correctness follow-up into a
  refactor. Flagged for scheduling rather than left silent.
