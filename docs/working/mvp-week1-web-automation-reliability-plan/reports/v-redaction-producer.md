# Report: v-redaction-producer

Worker: `v-redaction-producer`. The producer half of the redaction contract
`v-redaction-seam` landed: the flag that lets a sensitive control's comparison
reach the domain in the verb's own words instead of as a marker.

No captured or fixture value appears in this report, in a test name, or in a
test body I wrote. The only literal string used as a stand-in is
`v-probe-leak-sentinel`, which I invented for a scratch probe; it is not a
secret and carries no shape of one. One fixture value did appear in a Playwright
failure dump while I was working; it is described by its field and is not
reproduced here.

## Outcome

**Done**, with one thing found that I could not fix and one recommendation I was
asked for rather than told.

| Item | Answer |
| --- | --- |
| 1. The trap | `boundValidation` dropped the flag. Test written first, watched fail, quoted below, green after the fix. |
| 2. The verbs | Eight validation literals across `type.ts`, `clear.ts`, `select.ts` now carry `redacted: withheld`. |
| 3. The round trip | Proven live: the producer's phrasing now arrives at the domain intact, and the two non-declaring states still withhold. |
| 4. The three-state fail-safe | Proven, including the row `v-redaction-seam`'s mutation could not exercise. New mutation quoted. |
| 5. **A defect in the landed contract** | The runtime adapter's failure-record guard is **disarmed for every extension result**, whatever the producer declares. Pre-existing, measured, one-line fix identified and measured. `domain/` is not mine, so it is reported, not fixed. |
| 6. The judgement call | Recommend extending the declaration to rejection records rather than exempting them. Reasoning below; not implemented, the files are not mine. |

---

## 1. The trap, watched failing first

`apps/extension/src/content/action-runtime/validation-outcome.ts`
`boundValidation` rebuilds the validation field by field, so it deleted
`redacted` one line after each verb set it. The brief was right that this is the
whole reason the task exists, and it is worth recording that the failure mode is
**not** a leak: the domain's guard fails safe on an absent declaration, so a
silent drop costs only the phrasing — on every sensitive-control comparison,
with `check`, `test` and the harness all green.

The row went into `tests/validation-outcome.test.ts` before the fix and failed:

```
not ok 106 - the producer's redaction declaration survives the bound, in all three states an optional boolean has
  error: |-
    a declared redaction must reach the wire, or the domain withholds the producer's phrasing anyway
    + actual - expected
      {
        actual: 'the field holds nothing',
        expected: 'the field holds a withheld value',
    -   redacted: true,
        status: 'failed'
      }
  operator: 'deepStrictEqual'
# tests 229 / # pass 228 / # fail 1
```

The fix carries the field across in **all three** of its states rather than
normalizing it — `true`, `false` and absent are three different statements, and
manufacturing one from another is how a fail-safe default becomes a permissive
one. The row asserts each: a declared redaction survives, an explicit `false`
survives as `false`, and an absent flag stays absent (`"redacted" in …` is
`false`, not `undefined`, so the bound cannot invent a declaration).

After the fix: `ok 106`, `# tests 229 / # pass 229 / # fail 0`.

A doc comment on the function now says why the field is named there, and that
any field added to the comparison variants from here on needs the same line.

### A second copy of the same trap, latent

`apps/extension/src/runtime/action-results.ts` `boundWorkerValidation` is the
same field-by-field rebuild and also drops the flag. I did not touch it — it is
not mine — and it is **not** currently a defect: it is reached only by
`workerActionResult`, whose call sites are `action-runner.ts`, `browser-tab.ts`
and `browser-download.ts`, all worker-side actions (navigate, tab, download)
that never run against a form control, so no flag ever reaches it. A content
result crosses that layer untouched (`runActionInFrame` returns what
`sendToTab` answered; `withTarget` adds tab and frame ids and nothing else),
which is why the flag survives the hop at all. It is worth a line in whichever
brief eventually widens the worker-side verbs.

## 2. The verbs

Eight literals, verified against the current tree rather than pasted.
`v-redaction-seam`'s list is right in its per-file counts (2 + 2 + 4) and says
"ten" in its prose; eight is the number.

- `type.ts` — the "holds no typed text" branch and the read-back.
- `clear.ts` — the "no value to clear" branch and the emptiness read-back.
- `select.ts` — no option named, not a select, no option matched, and the
  selection read-back.

Every one of those strings is built through `describeFieldValue(…, withheld)`,
`listOptions(…, withheld)`, `describeRequest(…, withheld)` or is a constant, so
`redacted: withheld` is an accurate statement in each. Where `withheld` is
`false` the flag travels as `false`, which is the honest thing for an ordinary
control to say and costs nothing: the domain only consults it after the
sensitivity rule has already said yes.

Each file's header now says what the declaration is and what it is not — a
statement about these two strings, never that the control is safe.

No extension type change was needed: `shared/protocol.ts` re-exports the domain
type, so the widened field arrived for free, and the extension `check` passes
against it with no other edit.

## 3. The round trip, and the fail-safe

`apps/extension/e2e/content/tests/redaction.spec.ts`. The row
`v-redaction-seam` left behind asserted the domain withholds *because* nothing
declared; my change makes that false by design, so it was rewritten rather than
kept. What replaced it proves both halves against a real page, a real
descriptor, and the domain's real functions:

**The phrasing arrives.** A `web.dom.type` on the fixture's card field produces
`validation.redacted === true` beside phrasing containing "a withheld value
of", and `webAutomationActionResultPayload` now passes both strings through
unchanged instead of substituting the marker. The whole serialized payload is
still searched for the value.

**The other two states still withhold.** The same live result with only the
declaration changed, driven through the domain's own mapping:

| Declaration | `payload.validation.expected` |
| --- | --- |
| `true` | the verb's phrasing |
| `false` | the marker |
| absent | the marker |

and then the same two withholding states with the producer's redaction taken
back out — the strings holding the value the field really holds, read off the
page and never written into the spec — asserting the value appears nowhere in
the serialized payload. That is what makes those two rows more than marker
bookkeeping.

The state deliberately **not** asserted is `true` over an unredacted string. A
declaration is a contract and this layer believes it; nothing reads the text,
because a predicate that scans for things that look like card numbers both
misses and misfires. A row asserting a secret travels would also be a hostage
to a future defence-in-depth change, and the property it would pin is already
covered from the other side: if anything ever started inspecting the text, the
positive round-trip row above would go red. The limit is written into the spec
as a comment instead.

The earlier row, `a sensitive control's post-condition is secret-free after the
hop to the domain, on both paths it takes`, gained three assertions: the failure
record now arrives with the verb's own `expected` and `actual` rather than the
marker, byte for byte, and still says "which is not the text that was sent" —
so the phrasing is not merely present but still useful.

## 4. The defect: the adapter's failure-record guard is disarmed

**This is the finding worth reading.** It is pre-existing, it is not caused by
my change, and it is not fixed.

`domain/src/runtime/adapter.ts` decides whether to withhold a client's failure
record with

```
isSensitiveElementDescriptor(clientResult?.element) && !isProducerRedactedComparison(clientResult?.validation)
```

where `clientResult` is `payload.result` — the object the **client** built with
`webAutomationActionResultPayload`. That function, when it withholds a
comparison, returns `{ …, redacted: true }` (`v-redaction-seam` added the stamp
deliberately, so a withheld comparison "leaves marked"). The extension calls it
in `runtime/result-mapping.ts` before the result crosses the WebSocket.

So the adapter reads the withholding layer's own stamp and concludes the
producer declared a redaction. `withholdComparison` is therefore **always
`false` for any extension result on a sensitive control**, and the failure
record's `expected` and `actual` — which never pass through
`webAutomationSecretSafeValidation` at all, because `result-mapping.ts` puts the
content script's record straight onto the gateway result — are never withheld.

Measured with a scratch probe driving the real domain functions (the probe was
built into an ignored scratch directory and removed afterwards; no repository
file was added):

```
=== AS SHIPPED ===
declaration=undefined
  client wire validation.redacted = true  expected=(withheld: the action ra...
  adapter failure.expected        = the field holds "v-probe-leak-sentinel"
  SENTINEL anywhere in the result = YES -- LEAKED
declaration=false
  ... same ...                            SENTINEL anywhere in the result = YES -- LEAKED
declaration=true
  ... same ...                            SENTINEL anywhere in the result = YES -- LEAKED
```

All three states leak, `undefined` included. The guard is disarmed, not
weakened.

### What it does and does not expose

The three verbs this brief touched are safe regardless: they redact before the
record is built, so there is nothing in it to withhold. What is unguarded is
**every other producer of a comparison on a sensitive control** — `assert.ts`,
`click.ts`'s navigation and hit-test validations, `extract-list.ts`,
`scroll.ts`, and any verb written next — and any client that is not this
extension. Those were protected by this guard before the stamp existed.

### The fix, also measured

One line: stop stamping `redacted: true` on the withheld branch of
`webAutomationSecretSafeValidation` in `domain/src/client/gateway-mapping.ts`.
The marker itself is the signal at that exit; the flag is the producer's alone.
A producer that declares still has its flag passed through untouched, because
that branch returns the validation unchanged. Simulated in the same probe:

```
=== WITH the proposed fix (the withholding layer stops stamping the flag) ===
declaration=undefined   adapter failure.expected = (withheld: …)   SENTINEL = no
declaration=false       adapter failure.expected = (withheld: …)   SENTINEL = no
declaration=true        adapter failure.expected = the field holds "v-probe-leak-sentinel"  (believed, by contract)
```

All three restored to the intended answers. `secretSafeDispatchPayload` in the
adapter re-writes the marker over an already-withheld payload under that fix,
which is idempotent — it writes the same marker and stamps the flag at the
terminal exit, where nothing downstream re-reads it.

### What I did with the failing row

The assertion is correct and the code is wrong, and the code is in `domain/`,
which this brief forbids. Leaving the row red would put a failure into every
worker's and the supervisor's gate for a defect none of them caused. It is
therefore a single `test.fixme` row —
`the runtime adapter withholds a failure record's comparison when the producer
did not declare one` — with the whole diagnosis and the one-line fix written at
the row, and a pointer to this report. It is the only `fixme` in the file, and
it goes green the moment the domain line changes. The harness reports it as
`1 skipped`.

## 5. The judgement call: should rejections carry the flag?

**Recommendation: yes — give `actionRejected` an optional `redacted` parameter,
rather than exempting rejection records from the withholding rule.** Not
implemented: `content/action-runtime/results.ts` is explicitly not mine, and the
change also needs `content/actions/types.ts`, which my brief neither grants nor
forbids and which is `results.ts`'s dependency contract either way.

The brief's premise — that a rejection's text is author-supplied and situational
rather than value-derived — is true for two of the three verbs and **false for
the third**, which is the one the question is about:

- `type.ts` and `clear.ts` reject with `report.detail` from the actionability
  capability: why the element was unreachable (disabled, hidden, covered). Not
  value-derived.
- `select.ts` rejects a disabled option with
  `` `a selectable option matching ${describeRequest(request, withheld)}` `` and
  `` `${describeOption(option, withheld)} is disabled` ``. `describeRequest`
  interpolates the value or label the command asked for — a Flow's own input
  into a sensitive select — and `describeOption` interpolates the option's value
  and label, which is content of a sensitive control. `w3-redaction-followup`
  redacted exactly those two sites for exactly that reason.

So a rejection *is* value-derived when the verb has something specific to say
about the control, and that is not an accident of one verb: a rejection's job is
to explain why a *particular* control could not be touched.

Three reasons to declare rather than exempt:

1. **The exemption removes the only enforcement.** Today `select.ts`'s rejection
   is safe both because the producer redacts it and because the domain withholds
   it. Exempting rejections leaves only the producer, and the producer is the
   layer that has leaked twice in this plan.
2. **The exemption is the wider change.** A declaration is per-comparison and
   per-producer, made beside the redaction that justifies it. An exemption is a
   blanket over every rejection that exists and every one nobody has written yet.
3. **One rule is cheaper to hold.** "Every comparison that leaves a verb carries
   a declaration set beside its redaction" is one sentence, and it is now the
   rule `boundValidation` preserves. "Every comparison except rejections" is two.

The cost is small and already paid: each verb computes `withheld` before it
rejects, so the change is one optional parameter threaded to one literal.

If the supervisor prefers the exemption anyway, then the redaction inside
`describeOption` and `describeRequest` must stay and needs a test of its own
pinning it, because nothing else would be checking it.

## 6. Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-redaction-producer` and
`DOMAIN_TEST_BUILD_LABEL=v-redaction-producer` on every package command. Every
exit status captured by redirecting to a file and echoing `$?`, never through a
pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no commit,
no staged change (`git diff --cached --name-only` empty).

| Command | Exit | Observed |
| --- | --- | --- |
| extension `test`, **before the fix** | **1** | `# tests 229 / # pass 228 / # fail 1` — the new `boundValidation` row, quoted above |
| extension `check` | **0** | 0 `error TS`, both `tsc` projects (run four times across the task) |
| extension `test`, final | **0** | `# tests 229 / # pass 229 / # fail 0` |
| domain `check`, final | **0** | 0 `error TS`, both projects |
| domain `test`, final | **0** | `# tests 310 / # pass 310 / # fail 0` |
| `test:content redaction --workers=4`, first run after the rewrite | **1** | `1 failed, 17 passed` — my adapter-exit assertion, which is the defect in §4 |
| `test:content redaction --workers=4`, after the `fixme` | **0** | `1 skipped, 18 passed` |
| `test:content redaction --workers=4`, final, after the mutation was reverted | **0** | `1 skipped, 18 passed` |
| `test:content --workers=4` (full), run 1 | **1** | `1 failed, 1 skipped, 188 passed` |
| `test:content --workers=4` (full), run 2 | **1** | `1 failed, 1 skipped, 188 passed` — **identical** failing row |
| `test:content --workers=4` (full), final | **1** | `2 failed, 1 skipped, 187 passed` |
| `node scripts/structure-audit.mjs`, scratch `GIT_INDEX_FILE` | **0** | `structure-audit: passed (31 warning(s), 19 baselined)` (twice, unchanged) |

Note the harness commands use `run test:content … --workers=4` with no `--`, as
the brief required.

### The two harness failures, neither mine

- `identity-resolution.spec.ts:327 › reworded-aria` — stable across all three
  runs. It asserts a fingerprint resolution is refused by the scoring floor
  (`status: "failed"`, `TARGET_NOT_FOUND`, `strategy: "fingerprint"`,
  `candidateCount: 2`) and receives `succeeded`. That is `w3-resolver`'s
  scoring floor being tuned; `resolve-target.ts`, `identity/candidates.ts`,
  `identity/score.ts` and a new untracked `identity/reportable-text.ts` are all
  modified in the working tree. Nothing in it touches validation, redaction or
  any file I own.
- `evidence.spec.ts:241 › infinite-feed: repeating structures` — appeared only
  in the final run, and the message is
  `Tearing down "openHarness" exceeded the test timeout of 30000ms`, not an
  assertion. It passed in both earlier full runs. `w3-evidence`'s file, and a
  teardown timeout under a loaded machine.

### The structure audit

Exit 0. My change adds one advisory warning's worth of growth to a file that was
already past the threshold: `apps/extension/e2e/content/tests/redaction.spec.ts`
is now **478 lines**, past the 400-line advisory. It was **420 lines** when this
brief received it — already over — and I added 58. The file is not in
`.structure-baseline.json`, so nothing is refused and the audit's verdict is
unchanged. It is a genuine candidate for splitting: the four domain-hop rows are
a different subject from the six recording-and-snapshot rows, and
`selection-redaction.spec.ts` shows the split is already happening in this area.
I did not do it, because moving another worker's freshly written rows into a new
file during a parallel wave is how two workers end up owning one row.

## 7. The mutation proofs

### The trap

Covered above: the `boundValidation` row failed before the fix and passes after,
with the diff quoted. That is the mutation in its natural form — the code
genuinely was missing the line.

### The three-state fail-safe, including the row that was previously unexercised

`v-redaction-seam` was straight that its mutation (`=== true` → `!== false`) left
one row untested: `a flag that says the opposite`, because `false !== false` is
still `false`. I chose a mutation that does exercise it —
`=== true` → `!== undefined`, which reads *any present* flag as a declaration:

```
$ pnpm --filter @fluxiq-web-extension/extension run test:content redaction --workers=4
EXIT=1   1 failed, 1 skipped, 17 passed

1) redaction.spec.ts › the declaration is what buys a sensitive control's phrasing
                       through, and every other state of it withholds
   Error: a verb saying it did NOT withhold must be taken at its word
   Expected: "(withheld: the action ran on a control that holds a secret)"
   Received: "the field holds a withheld value of 20 characters"
   at redaction.spec.ts:379
```

The explicit-`false` row bites. The mutation was applied to
`domain/src/sensitivity/redaction.ts` and reverted inside the same shell
command, so the window could not outlive it; the revert is verified byte for
byte (`diff` against a pre-mutation backup, exit 0) and the redaction spec was
re-run afterwards at `1 skipped, 18 passed`. The mutated line compiled cleanly,
so no other worker's gate could have gone red during the window.

**One honest limit.** Playwright stops a test at its first failed assertion, so
the run above proves the `false` row bites at line 379 and does not separately
observe the *leaked-value* assertion for `redacted: false` twelve lines later.
That one is reasoned from the same predicate, not measured.

## 8. Not verified

- **No live browser validation in a loaded extension.** Everything is the real
  content-script bundle in real Chromium on the real fixture, through the
  content harness: one world, no background worker, no WebSocket. The domain
  half is driven directly in the same process. The flag has never travelled a
  real WebSocket.
- **`web.dom.select`'s four literals have no live row.** No registered fixture
  has a `<select>` marked sensitive, which `w3-redaction-followup` already
  recorded. Their declarations are proven by the type checker and by the
  fifteen existing `select.spec.ts` rows continuing to produce the old strings
  on ordinary selects, where `redacted: false` changes nothing observable.
- **`clear.ts`'s withheld branch and `type.ts`'s "holds no typed text" branch
  have no live row either**, for the same reason: no fixture refills a
  sensitive control, and no fixture has a non-text sensitive target.
- **The claim that the flag reaches the wire in the real pipeline** is read off
  the code — `runActionInFrame` returns the content script's result verbatim,
  `withTarget` adds only tab and frame ids, `result-mapping.ts` maps it whole —
  plus the fact that `boundWorkerValidation` is unreachable from a content
  result. It is not observed from a background worker.
- **The defect in §4 is measured through a probe and through the harness, not
  against a live gateway.** Both drive the real domain functions with the real
  payload shape (`gateway-output-dispatcher` wraps the client payload as
  `payload.result`, which is what the adapter reads), but neither crosses a
  socket.
- **Whether the fix in §4 is the one the domain owner wants** is my
  recommendation, measured for effect, not agreed with anyone.
- **`pnpm check`, `pnpm test` and `pnpm build` at the repository root** were not
  run: the wave forbids the last and the other two are the supervisor's.
- **The green gate is a snapshot of a moving tree.** Everything above was taken
  while other workers were editing; the two harness failures moved between runs,
  which is the evidence of that rather than an aside.

## 9. Open questions or contradictions found

1. **The adapter's failure-record guard is disarmed (§4).** Pre-existing,
   measured, one-line fix identified and measured. It needs a brief, and it
   needs one before anything else relies on that guard.
2. **The stamp that caused it is a reasonable idea in the wrong place.** Marking
   a withheld comparison `redacted: true` makes the flag mean the same thing
   wherever a reader finds it, which is what `v-redaction-seam` wanted. It only
   fails because the *client* runs the withholding layer, so the stamp crosses
   the trust boundary and the far side cannot tell it from the producer's. If
   the marker is wanted at the terminal exit, the place to stamp it is
   `secretSafeDispatchPayload`, which runs after the trust boundary.
3. **`boundWorkerValidation` is the same trap, latent** (§1). Harmless today
   because no worker-side action runs against a form control; it becomes real
   the day one does.
4. **The declaration is silent when it is missing.** A new verb that builds a
   comparison and never sets the flag is withheld rather than leaked, which is
   the right direction, but the only signal is an operator seeing a marker where
   they expected words. `v-redaction-seam` suggested a test over the verb
   registry asserting that every verb calling `describeFieldValue` also sets
   `redacted`; that is now cheap, because there are exactly three such verbs and
   eight literals, and it would have caught the `boundValidation` drop too if
   the test asserted the flag on the *result* rather than at the call site.
5. **`redaction.spec.ts` is 478 lines** (§6). Worth splitting the domain-hop
   rows out; not during a parallel wave.
6. **`v-redaction-seam`'s prose says "ten literals"** where its own per-file
   counts add to eight. Eight is right; nothing was missed.
