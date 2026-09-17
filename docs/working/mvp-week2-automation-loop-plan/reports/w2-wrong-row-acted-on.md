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
