# Report: v-validation-leak

Worker: `v-validation-leak`. The join G11 predicted and nobody closed: one Wave 3
change widened what `validation` carries to the domain, another narrowed what it
may contain, and no test covered the pair.

No captured or fixture value appears anywhere in this report, in a test name, or
in a test body. Values are named by their field. The one string a test needed as
a stand-in is a sentinel that is not a secret and carries no shape of one, and
every live assertion reads the fixture's value off the page at run time rather
than restating it.

## Outcome

**Done. There is no sixth leak here — the producer's redaction holds — and the
domain no longer depends on it.**

| Task | Answer |
| --- | --- |
| 1. Prove the current behaviour | **No leak.** Driven live on `sensitive-input`, a `web.dom.type` on the card control produces a result whose validation and whose failure record are both secret-free, and stay secret-free through the wire mapping and the domain's runtime adapter. The missing regression test now exists. |
| 2. Defence in depth on the domain side | **Landed at both exits**, using `isSensitiveElementDescriptor` from `domain/src/sensitivity/`. The domain *can* judge, because the result carries the target's element descriptor. It costs the producer's phrasing; the report says what the payload would need to carry to buy it back. |
| 3. The neighbours | `resolution` carries no page-derived text and is still dropped. The evidence packet is guarded for elements and unguarded for `selectedText` and `title`. A third carrier nobody has named — the candidate labels on a `TARGET_AMBIGUOUS` record — is real page text and my guard cannot reach it. |

---

## 1. What the current behaviour actually is

**The observable.** `apps/extension/e2e/content/tests/redaction.spec.ts`, row
"a sensitive control's post-condition is secret-free after the hop to the
domain, on both paths it takes". It opens `sensitive-input` in real Chromium
with the real content bundle, reads the card field's own value off the page,
installs a real page behaviour (an `input` handler on the card field that
rewrites whatever is typed into it), runs `web.dom.type` at that field, and then
takes the *live* `BrowserActionResult` and pushes it through:

1. `webAutomationActionResultPayload` — the domain function `w3-domain-contract-gaps`
   widened, which is what puts `validation` on the wire; then
2. the gateway result shape `apps/extension/src/runtime/result-mapping.ts`
   builds; then
3. `createWebAutomationRuntimeAdapter(...).execute(...)` — the real domain
   runtime adapter, with the FluxIQ instance faked down to the single call it
   makes.

What comes back is what Core receives. The row serializes the adapter's whole
payload, failure record, metadata, message and error, and asserts that none of
the three page-derived strings appears anywhere in it — not one named field.

**The result: nothing leaked.** Every assertion passed on the first run, before
any guard of mine existed. The producer redaction `w3-redaction-followup` landed
in `content/actions/{type,clear,select}.ts` is in place and it holds under the
widened passthrough. G11's prediction was a real hole in the *coverage*, not in
the behaviour.

Two things the row also establishes, which no test said before:

- **The join is live, not merely safe.** `validation` does reach the domain
  (status `failed` arrives), and the failure record arrives carrying
  `web.validation.output_not_observed`. The widening works.
- **B3 from the inventory is closed as a side effect.** `type.ts`'s mismatch
  branch — reached only when a page rewrites a field's value in its own `input`
  handler — is now exercised live. It was listed as unproven. That is the branch
  that puts *both* sides of a comparison onto a failure record, which is why it
  was the branch worth reaching.

**The G11 sub-question the inventory could not resolve from the reports.** It
asked whether `w3-failure-producers`/`w3-host-runtime` ("`gateway-mapping.ts`
drops `validation` and `resolution`") and `w3-domain-contract-gaps` ("I carried
`validation` through the result mapping") describe the same path. **They
describe the same function at two moments in time.** There is one
`webAutomationActionResultPayload`; it dropped both fields, and Task 2 of
`w3-domain-contract-gaps` added `validation` to it and deliberately left
`resolution` out. There is no second path still dropping it.

---

## 2. The gap the proof exposed, and the guard

The proof passes, but the reason it passes is entirely a rule in another
package. Three things make that worse than it sounds:

- **The failure record's `expected` and `actual` never pass through
  `webAutomationActionResultPayload` at all.**
  `result-mapping.ts` puts `result.failure` on the gateway result directly. So
  the field `w3-domain-contract-gaps` guarded by passing through verbatim is not
  even the only copy: `results.ts` `success()` builds the record's comparison
  from the same bounded validation, and that copy takes a different road.
- The domain-side seam that re-establishes the record —
  `adapter.ts` `clientReportedFailure` — says in its own docstring that its
  reason for existing is that "Core's own contract is to validate what crossed a
  process boundary." It validated the `code` and carried `expected`/`actual`
  "across untouched".
- `webAutomationActionResultPayload`'s comment said the redaction "belongs at
  that producer … and a second rule here would be a second rule to keep in
  step". That reasoning is right about the *rule* and wrong about the
  *decision*: asking `domain/src/sensitivity/` is not a second rule.

### What landed

**`domain/src/client/gateway-mapping.ts`** — two new exports and one changed
line:

- `WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT`, the one marker, shared so a grep
  for a leak finds both exits.
- `webAutomationSecretSafeValidation(validation, element)` — returns the
  validation unchanged unless `isSensitiveElementDescriptor(element)` says the
  target holds a secret, in which case both comparison strings become the
  marker. `status` is kept, because `status` is what says whether the
  post-condition held.
- `webAutomationActionResultPayload` calls it.

**`domain/src/runtime/adapter.ts`** — the same question asked once, of the
descriptor the client sent with its own result, and used at both exits the
comparison takes from there:

- `clientReportedFailure` now withholds `expected` and `actual` for a sensitive
  target. Category, code, retryable flag, stage and evidence digest are
  untouched, so a Flow still routes on the failure it was given, and the record
  still survives Core's parser (asserted).
- The dispatch payload's nested `result.validation` is withheld too, so a client
  that is not this extension, or is a version behind, gets the same answer. The
  rebuild is conditional, so an ordinary result is passed through by identity
  and the existing `deepEqual` assertions on it still hold.

**The rule is `domain/src/sensitivity/`, unmodified.** Same call the recording
reducer and the LLM evidence sanitizer make, on the same descriptor shape.

### The answer to "can the domain judge this at all?"

**Yes, and this is the load-bearing finding.** The brief allowed for the
possibility that the domain sees text without knowing which control produced it.
It does not: `WebAutomationActionResult.element` is the wire element descriptor,
and `describe-element.ts`'s attribute allowlist already carries `type`,
`autocomplete` and `data-sensitive` — exactly the three signals the rule reads.
No predicate over text was written, and none should be.

**What it cannot judge is whether a string is already redacted**, and that is
what the withholding costs. Once the answer is "sensitive", both strings go,
including the producer's careful `the field holds the text that was sent` and
its character count. In a healthy tree the guard therefore *always* fires on a
sensitive-control failure and always destroys good phrasing.

**What the payload would need to carry instead**: a producer-set boolean on the
validation — `redacted: true`, or a `withheld` marker the producer stamps — so
this layer could keep the text when the producer declares it already withheld,
and withhold when it does not. That is a contract rather than a heuristic, and
it fails safe in both directions: an absent flag means withhold. It does not
exist, and adding it touches `domain/src/actions/types.ts` (nobody's Owns, twice
noted in Wave 3) and the three verbs in `content/actions/`, which this brief
forbids. Until then, `status` plus a marker is the honest maximum.

### The guard's reach, pinned rather than assumed

It is exactly as long as the descriptor. A result with a text-bearing validation
and **no** `element` cannot be judged and passes through as the producer wrote
it. Every verb that redacts today attaches one; a new verb that does not would
land outside the guard silently. Both test files carry a row that asserts the
sentinel *does* survive in that case, so the limit is visible in the suite
rather than buried in a comment.

---

## 3. The neighbours

### `resolution` — clean, and still dropped

`WebAutomationTargetResolution` is `strategy` (a closed six-value union) plus
`candidateCount`, `bestScore`, `runnerUpScore`, `confidence` — four numbers. **No
page-derived text, so it needs no guard if someone carries it.** It is still
dropped by `webAutomationActionResultPayload`; a new assertion pins that, with a
comment telling whoever adds it to re-check the shape first.

### A third carrier of page text nobody has named: `TARGET_AMBIGUOUS` candidate labels

`content/action-runtime/resolve-target.ts` builds the record's `actual` from
`candidateLabel(element)` (`identity/candidates.ts:124`), which is
`tagName` + id/test-id + **`element.textContent`, bounded to 40 characters**, for
up to N tied candidates. That is real page text reaching the domain on the
failure record, and `candidateLabel` asks no sensitivity question.

Today it cannot carry a *control's value*: `textContent` is empty for an
`<input>`, and the selector builder never embeds a value. The exposure is text
rendered in the document — a displayed one-time code, or anything a host marks
`data-sensitive` — inside a tied candidate.

**My guard cannot reach it**, and this is worth stating plainly: a resolution
failure throws before the verb has an element, so the result carries no
descriptor and `secretTarget` is false. Neither `resolve-target.ts` nor
`candidates.ts` is mine. The fix is one sensitivity question inside
`candidateLabel` before it takes `textContent`.

### The evidence packet on a failed result

`adapter.ts` `failureDiagnostics` produces four things. Checked one at a time:

| Field | Page-derived? | Guarded? |
| --- | --- | --- |
| `url` | origin + path only, non-HTTP refused, credentials refused | yes, and tested |
| `selector` | id / `data-testid` / `name` / structural path, bounded 500 | never a value, by construction of `selectorFor` |
| `title` | **the page title, bounded to 300** | **no guard anywhere** |
| `failureEvidence` | the sanitized `web-llm-evidence.v1` packet | partly |

- **`failureEvidence.elements`**: `llm-evidence/elements.ts:85` drops a sensitive
  element outright, by the same shared rule. Already tested.
- **`failureEvidence.selectedText`**: passed straight through by
  `llm-evidence/page-evidence.ts:65`, bounded and never asked about. **Its only
  guard is `capturedSelectionText` in the content script's `dom-snapshot.ts`** —
  a producer-side rule in another package, which is precisely the shape of
  defect this brief was written about, one field along. The domain *could* judge
  it (withhold `selectedText` when any element in the same snapshot is
  sensitive), and `llm-evidence/**` is explicitly not mine. **This is the item I
  would hand to the next brief.**
- **`title`**: low value to an attacker and high value to an operator; worth a
  decision, not a guard.

### `message`, the carrier a guard cannot help with

`results.ts` `actionRejected` builds `Action rejected: ${observed}` from the
validation's `actual`, so the message is a third copy of the same text. It is
not a comparison — replacing it destroys the operator's only human-readable
reason — and free prose cannot be judged at this layer without exactly the text
predicate the brief rules out. Today it carries no control value on the three
redacting verbs (`type.ts`'s messages are constants, `select.ts`'s
`describeRequest` is redacted, and the rejection detail describes actionability,
not content), and the live row's whole-payload search would have caught it if it
did. The producer-set flag above is what would settle it.

---

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=v-validation-leak` and
`EXTENSION_TEST_BUILD_LABEL=v-validation-leak` on every package command. Exit
status captured by redirecting to a file and echoing `$?`, never through a pipe.
No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no commit.

- `pnpm --filter @fluxiq-web-extension/domain test`, **baseline before any edit**
  — **exit 0**, `# tests 262 / # pass 262 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` — **exit 0**, `grep -c
  "error TS"` = 0. One intermediate run was **exit 2** with two `TS2304` errors
  in `runtime/failure/tests/classify.test.ts`; that file was modified 18 seconds
  before the run by the worker extracting `runtime/failure/carrier.ts`, and the
  rerun was **exit 0**.
- `pnpm --filter @fluxiq-web-extension/domain test`, **final** — **exit 0**,
  `# tests 282 / # pass 282 / # fail 0`, with
  `Web automation gateway mapping tests passed.` printed (that file is a bare
  assertion script and prints only when every assertion in it has held).
- `pnpm --filter @fluxiq-web-extension/extension check` — **exit 0**, 0
  `error TS`, three times.
- `pnpm --filter @fluxiq-web-extension/extension test:content redaction
  --workers=4` — **exit 0**, `18 passed` (13 redaction rows including my two, and
  the 5 selection-redaction rows).
- `pnpm --filter @fluxiq-web-extension/extension test:content --workers=4`, whole
  harness — **exit 1**, `184 passed / 5 failed`. **None of the failures is mine**;
  see "A moving tree" below. All 13 `redaction.spec.ts` rows and all 5
  `selection-redaction.spec.ts` rows are green in every run.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with my new test file added by `git add -N`; the real index was
  never written) — **exit 0**, `structure-audit: passed (29 warning(s), 19
  baselined)`. Diffed against the same audit run on a pristine copy of the index:
  **byte-identical**, so staging my new file moves nothing. No warning names a
  file I own.

### The mutation proofs

Both mutations were made, run, and reverted; `grep -c MUTATION` over `domain/src`
and `apps/extension/e2e` is 0, and `git diff --stat` shows
`domain/src/runtime/tests/adapter.test.ts` byte-identical to `HEAD`.

- **Guard A disabled** (`webAutomationSecretSafeValidation` returns the
  validation unchanged): domain suite **exit 1**, failing on
  `the effective control type: nothing the producer failed to withhold reaches
  the wire payload / true !== false`.
- **Guard B disabled** (`secretSafeComparisonText` returns the text unchanged):
  domain suite **exit 1**, `not ok` on two of the five adapter-redaction rows —
  the client-record row and the UNKNOWN-branch row. The dispatch-payload row
  stayed green, correctly: it exercises the other half of the adapter guard,
  which that mutation did not touch.

**The producer half was not mutated, deliberately.** Removing the redaction in
`content/actions/type.ts` would demonstrate it directly, but that path is in my
"Must not touch" list, another worker owns a file in that directory, and G10
records the supervisor committing over two workers' mutation windows in this very
wave. It is proven two other ways instead, neither of which depends on the other
layer:

1. **The pre-existing rows in the same spec** assert the producer's own phrasing
   on `result.validation` before the domain sees it, so they go red if the
   producer's redaction is removed.
2. **The counterfactual is staged from the live page instead of from a source
   edit.** The second new spec row takes the real result, substitutes into its
   validation the value the card field really holds — read off the page a moment
   earlier, never written in the spec — and pushes *that* through both domain
   exits. It is exactly what would arrive if the producer stopped withholding,
   built from the real descriptor and the real secret, and the domain's answer
   does not change. Both domain unit test files do the same with a sentinel.

So each layer is falsifiable on its own, and neither proof rests on the other.

### A moving tree

The domain suite went 262/262 green at my baseline and then reported, on
successive runs while I changed nothing relevant: 8 failures in
`runtime/llm-evidence/tests/`, then 5, then 1 in `recording/tests/`, then 3 in
`runtime/failure/tests/`, then 1, then 0. Each set is in a directory my brief
forbids me to touch, each was attributable by file mtime to an edit seconds
before the run (`page-evidence.ts` at 12:56:08, `recording/domain.ts` at
12:59:31, `failure/classify.ts` at 12:59:54, a new untracked `failure/carrier.ts`
at 12:59:04), and each cleared on rerun. To settle it independently I ran my three
test bundles directly: `client/tests/gateway-mapping.test.mjs` **1/1**,
`runtime/tests/adapter.test.mjs` **19/19**, `runtime/tests/adapter-redaction.test.mjs`
**5/5**, all **exit 0**.

The five content-harness failures are all `identity-resolution.spec.ts` rows on
the `ambiguous-targets` fixture, which a worker is splitting into new files right
now (`modes.ts` 13:00:20, `render.ts` 13:00:39, `manifest.ts` 13:01:05,
`scenario.ts` 13:01:13, `index.ts` 13:01:20, a new `tests/` directory at
13:04:19). The failure is the fixture's state gaining a `mode: "baseline"` field
the spec does not expect. `apps/scenario-lab/` is in my "Must not touch" list.
Reran three times; the failing set drifted (5 → 4 → 5) as the fixture changed,
which is itself the attribution.

**One caveat on the gateway-mapping file, worth carrying to Wave 4.** My new
assertions there are at module scope in a bare `node:test` script, which is that
file's existing shape. Under mutation the suite did fail (exit 1), but it failed
by *aborting*: the run reported `# tests 10 / # pass 10 / # fail 0` and the real
error appeared only as "a resource generated asynchronous activity after the
test ended". That is exactly the mechanism G3 recorded, and it means a red
gateway-mapping suite still prints a green-looking count. The gate catches it;
a human skimming the tail of the log would not.

---

## Not verified

- **No live browser validation in a loaded extension.** Everything is the T2
  content harness: the real content bundle in real Chromium on the real fixture,
  one world, no background worker, no tab or frame routing. The wire hop from
  content script to background worker to gateway was not exercised, so the A4
  sweep in the inventory is still open. What *is* new is that the two domain
  functions on the far side of that hop are now driven with a live result rather
  than a hand-written one.
- **No Flow, no Core.** `parseAutomationStudioFailureRecord` is asserted over the
  withheld record, so Core will keep it whole, but no Flow has read a withheld
  comparison and nobody has seen what an operator makes of it. The diagnostic
  cost of withholding is reasoned, not observed.
- **The `select` and `clear` verbs' withheld branches** still have no live proof
  (inventory B2 and part of B3): no fixture has a sensitive `<select>`, and I do
  not own a fixture. My new rows cover `type` only. The domain-side guard is verb-
  agnostic — it reads the descriptor, not the verb — so it covers all three, but
  only `type` is proven end to end.
- **`title` and `selectedText` in the failure-evidence packet are described, not
  fixed, and not proven by a failing test.** Both are in files this brief does
  not own.
- **The candidate-label finding is a reading, not a measurement.** I traced
  `candidateLabel` to `element.textContent` and reasoned that an `<input>`'s
  `textContent` is empty; I did not run a `TARGET_AMBIGUOUS` failure over a
  sensitive candidate to watch what the record carries.
- **No `pnpm check`, `pnpm test` or `pnpm build` at the repository root.** The
  wave forbids the last and the other two are the supervisor's; ten packages'
  worth of other workers were editing this tree throughout.
- **No Firefox build was loaded.**

---

## Open questions or contradictions found

1. **Ownership drawn around a file rather than around the change, again — and
   this time it put a dependency in the wrong direction.** The marker has to be
   one string shared by two exits. Its right home is
   `domain/src/sensitivity/redaction.ts`, beside the rule it depends on; the
   brief forbids that directory. So it lives in `gateway-mapping.ts` and
   `adapter.ts` imports it from `../client`, which gives `domain/src/runtime` a
   **new dependency on `domain/src/client`** — a server-side module importing the
   browser-facing barrel. Nothing else in `runtime/` does that. It compiles, it
   creates no cycle (`client/index.ts` reaches only `runtime/capabilities` and
   `runtime/failure`, neither of which reaches the adapter), and the audit does
   not object, but it is backwards and it should be a three-line move once
   `sensitivity/` has an owner. **The brief should have granted
   `domain/src/sensitivity/` for one new file rather than forbidding the
   directory outright.**
2. **I created one file the brief did not name**, and am reporting it rather than
   letting it pass: `domain/src/runtime/tests/adapter-redaction.test.ts`. My five
   new rows took `adapter.test.ts` from 305 to 417 lines, past the 400-line
   advisory, and the audit named it. The file is within "tests beside each" and
   the split is the right structure anyway — what a failure is *classified as* and
   what it is *allowed to say* are different subjects — but it is a new file and
   the supervisor should know. `adapter.test.ts` is now byte-identical to `HEAD`.
3. **The producer-set redaction flag is the fix that buys back the diagnostics,
   and it needs an owner.** One optional field on
   `WebAutomationActionValidation` in `domain/src/actions/types.ts`, set by
   `describeFieldValue`'s three callers. `actions/types.ts` being in nobody's Owns
   was raised by `w3-domain-contracts` and again by `w3-domain-contract-gaps`;
   this is the third change that wants it.
4. **`selectedText` in the LLM evidence packet is the same defect one field
   along, and it is still open.** A producer-side guard in `dom-snapshot.ts` and
   nothing on the domain side, on a path that reaches both durable web state and
   the sanitized packet. `w3-redaction-followup` found the leak, `w3-sensitivity-consolidation`
   fixed the producer, and — exactly as here — nobody joined the two ends up.
   `domain/src/runtime/llm-evidence/**` is a running worker's this wave.
5. **`candidateLabel` should ask the sensitivity rule before it takes
   `textContent`.** One line in `content/identity/candidates.ts`. It is the only
   remaining path by which page-rendered text reaches an attempt trace with no
   question asked, and unlike the validation it is unreachable from the domain
   because a resolution failure carries no descriptor to key on.
6. **The bare-assertion-script shape of `client/tests/gateway-mapping.test.ts`
   hides a red suite behind a green-looking count** (G3's mechanism, reproduced
   here under mutation). Converting it to `node:test` subtests is mechanical and
   would make its failures readable. Not mine to do unasked, and it did not
   change the exit code either way.
