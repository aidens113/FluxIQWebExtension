# Report: L-doc-truth

Worker: `L-doc-truth`. Correcting comments on load-bearing code that claimed
things the code does not do, and answering the two design questions the false
claims were hiding.

## Outcome

**Done.** Seven comment blocks changed across four files, every replacement
verified against the tree today. Domain and extension `check` and `test` are
all green on the final bytes. No production behaviour, no type, and no test
assertion was touched — the diff is comments only, which `git diff` confirms.

Two items in the brief turned out differently than expected, both in the
tree's favour:

- **Item 3 (`gateway-mapping.ts`) had already landed.** `v-error-seam`'s edit 1
  is in the tree: `UNSUPPORTED_ACTION_TYPE_FAILURE` at
  `domain/src/client/gateway-mapping.ts:302` is now
  `Object.freeze(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE))`,
  and its docstring already explains the change. Nothing to do; I did not edit
  the file.
- **`resolve-target.ts` carried three false claims, not one.** The brief named
  the header. Two docstrings below it repeat the same false implication about
  the measurement, and one adds a second false claim of its own. All three are
  fixed and quoted below.

I also found and fixed a fourth reference to the deleted
`WebAutomationRuntimeError` class, in `adapter.ts` itself — the twin of the
`adapter.test.ts` sentence the brief sent me to fix.

**The brief's build label is rejected by the harness.**
`domain/scripts/test-domain.mjs:16` validates against
`/^[a-z0-9][a-z0-9-]{0,63}$/`, so `DOMAIN_TEST_BUILD_LABEL=L-doc-truth` throws
"must be lowercase kebab-case" and the suite never runs. I used
`l-doc-truth` — same slug, still a private `.test-build-scratch/l-doc-truth`
directory, so the isolation the label exists for is intact. Worth fixing in
future briefs.

---

## Item 1 — the redaction guard's threat-model sentence

### The comment

`domain/src/runtime/adapter.ts`, `secretSafeDispatchPayload` docstring.

**Old:**

> here. The same argument covers the payload the record came with. A client one
> version behind, **or one that is not this extension at all, gets the same
> answer.**

**New:**

> here. The same argument covers the payload the record came with. A client one
> version behind, or a verb nobody taught the flag, is withheld exactly as it
> was before the flag existed, because an absent declaration means withhold.
>
> A \*false\* declaration is another matter, and this guard does not survive one.
> `withholdComparison` at the caller is `isSensitiveElementDescriptor(element)`
> and `!isProducerRedactedComparison(validation)`, and both halves read what the
> client sent: one boolean disarms this payload withholding and
> `clientReportedFailure`'s record withholding together, and omitting `element`
> disarms them just as completely -- a limit the sibling guard's row in
> `client/tests/gateway-mapping.test.ts` already pins. Honouring the flag is
> deliberate, because only the producer knows whether it wrote a length or a
> value, and refusing it costs that phrasing on every sensitive-control failure
> (`sensitivity/redaction.ts` argues the trade). What follows is that this is
> defence in depth against \*our own\* producers -- a verb that forgets to redact
> and so also forgets to declare -- and not a boundary against a client that
> lies. Nothing reachable here would make it one: the dispatcher only sends to
> a session whose `clientType` is `"extension"` and which advertises
> `web.actions` (`io/gateway-output-dispatcher.ts`), but Core takes both of
> those from the client's own `client.hello`, so gating the flag on either
> would gate a client-supplied claim on another. The operator's pairing
> approval is what stands behind it, not a check this domain can make.

Every clause is checked below.

### Recommendation: do not gate the flag on a capability. It cannot work.

**This is the part of the brief I most want the supervisor to read.** The brief
offered "trust the flag only from a client that declared a capability" as the
middle path. I went to look at what a capability declaration is worth here, and
it is worth nothing for this purpose.

`packages/fluxiq/src/client-gateway/service/lifecycle.ts`, `applyHello`:

```ts
private applyHello(session: InternalSession, hello: ClientGatewayClientHello): void {
  session.clientId = hello.clientId ?? session.clientId;
  session.clientType = hello.clientType;
  ...
  session.capabilities = hello.capabilities ?? session.capabilities;
```

`clientType` and `capabilities` are copied verbatim out of the client's own
`client.hello` message, unconditionally, **before** `resumeTrustedSession`
validates any token — and the token, when it is validated, is checked against
`trustedClient.clientId`, not against the type or the capability list. So:

- `session.clientType === "extension"` is a client-supplied string.
- `capability.id === "web.actions"` is a client-supplied string.
- `validation.redacted === true` is a client-supplied boolean.

All three have exactly the same provenance. Gating the third on the first two
requires a lying client to send two more fields it already controls. It would
add ceremony and a false sense of a boundary, which on a security guard is
worse than the honest sentence.

This also means the existing filter in
`domain/src/io/gateway-output-dispatcher.ts:48` — which is what makes "a client
that is not this extension at all" hard to reach in the first place — is not an
authentication of client type either. It is useful (it stops a *co-operating*
non-extension client from being handed browser actions by accident) but it is
not a check.

### And a second, equally open door the flag discussion overlooks

`withholdComparison` is a conjunction:

```ts
const withholdComparison = isSensitiveElementDescriptor(clientResult?.element) && !isProducerRedactedComparison(clientResult?.validation);
```

Both operands read the client's JSON. A client that omits `element` entirely
gets the comparison through untouched, no flag required — the first operand is
false and the guard never arms. That is not speculation: the sibling guard's
own test row at `domain/src/client/tests/gateway-mapping.test.ts:392-398`
pins it as a known limit, with the words *"with no element descriptor the wire
payload is only as safe as the producer -- the limit is real, not a claim"*.

So refusing to honour `redacted` (the brief's other option) would pay the full
diagnostic cost — the producer's *"the field holds a withheld value of 12
characters"* replaced by the marker on every sensitive-control failure, argued
carefully in `domain/src/sensitivity/redaction.ts:16-28` — to close one of two
equally open doors against an adversary who can walk through the other.

### What I actually recommend

1. **Adopt the honest description** (done, in the comment). The guard is
   defence in depth against our own producers: a future verb that forgets to
   redact will also have forgotten to declare, and *that* is the case it
   catches, loudly and by construction. That is a real and valuable property,
   and it is the one this plan's five leaks were about — every one of them was
   our layer wrongly assuming our other layer had redacted.
2. **Do not gate on a capability.** Argued above. If the supervisor wants it
   anyway, it must first be established in Core that `clientType` and
   `capabilities` survive a token check, which they currently do not — that is
   a Core change and a cross-repository decision.
3. **If a boundary against a foreign producer is genuinely wanted, it belongs
   at pairing time, not at result-parse time.** The enforceable question is
   "may this operator-approved client execute actions against controls the
   sensitivity rule marks at all?", asked once when a human approves the
   client, where a human is available to answer it. At result-parse time every
   input is the client's word and no arrangement of predicates changes that.
4. **The only version that would survive a lying client** is for the
   withholding decision to stop depending on client-supplied fields — the
   domain deciding sensitivity from the *recorded* descriptor it owns, keyed by
   `commandId`, rather than from the descriptor the client echoes back. That is
   a real design change (the domain does not hold the recorded descriptor at
   the result hop today) and well beyond a comment. I raise it only so the
   option is on the record; I am not recommending it for Week 1.

I implemented none of this. The comment describes the trust model that exists;
if the supervisor picks option 2, 3 or 4, the comment needs another pass.

### One more stale sentence in the same file

Not in the brief; found while reading. `adapter.ts`, `clientReportedFailure`
docstring, referring to a class deleted by `v-error-seam`:

**Old:** `That is what` **`classifyWebAutomationFailure` already does with a
runtime error's** `unrecognized code`

**New:** `That is what` **`carriedWebAutomationFailure` already does with a
thrown record's** `unrecognized code`

Verified: `carriedWebAutomationFailure` (`domain/src/runtime/failure/carrier.ts:84-89`)
maps an out-of-set code to `UNKNOWN` with
`unrecognized web automation failure code: <code>` appended to `actual` — field
for field what `clientReportedFailure` does. The two docstrings now point at
each other correctly; `carrier.ts:62-64` already names `clientReportedFailure`
from the other side.

---

## Item 2 — the measurement that does not arrive

### Comment 2a — the file header

`apps/extension/src/content/action-runtime/resolve-target.ts:29-52`.

**Old:**

> never from a string written here, and `results.ts` lifts the record and the
> measurement off the thrown error **onto the result the Flow receives**. A
> resolution that \*succeeded\* carries the same measurement, but only as far as
> `resolveTargetWithDiagnostics`: the verbs take `resolveTarget`, whose
> contract is the element alone, so nothing puts `resolution` on a successful
> result yet.

**New:**

> never from a string written here, and `results.ts` lifts both the record and
> the measurement off the thrown error onto the `BrowserActionResult`.
>
> There the two part company, and only the record leaves the browser. The
> measurement stops inside the extension process: `webAutomationActionResult
> Payload` (`domain/src/client/gateway-mapping.ts`) does not carry
> `resolution`, `gatewayActionResultFromBrowserResult` does not add it, and the
> last row of `domain/src/client/tests/gateway-mapping.test.ts` pins the drop
> with the reason the field would be safe to carry if anyone wanted it. What a
> Flow reads instead is the same numbers in the record's own prose: `notFound`
> appends `; best scored ` and the winner's score to `actual`, and
> `scoredAmbiguous` names each tied candidate with its own. So a near-miss
> stays distinguishable from a hopeless page, but as a sentence rather than as
> fields.
>
> A resolution that \*succeeded\* reports nothing at all. It is measured, and the
> measurement is on `resolveTargetWithDiagnostics`'s return, but the verbs take
> `resolveTarget` -- this build's only production caller of it -- whose
> contract is the element alone, so it is discarded one call below where the
> failure path's copy is kept. A Flow can therefore tell why a target was
> refused, but not whether an accepted one was a confident match or a lucky
> one.

Each claim, and how I checked it:

| Claim | Check |
| --- | --- |
| `webAutomationActionResultPayload` does not carry `resolution` | Read the whole object literal at `gateway-mapping.ts:217-232`. Twelve keys; `resolution` is not one. |
| `gatewayActionResultFromBrowserResult` does not add it | Read `apps/extension/src/runtime/result-mapping.ts:48-80`. It spreads the payload and adds only `visualTarget` inside `payload`, plus top-level `commandId`/`status`/`startedAt`/`completedAt`/`message`/`target`/`error`/`failure`. |
| Nothing outside the content script reads it | `grep` for `\.resolution\b` and `resolution:` over `apps/extension/src`, `domain/src`, `packages/*/src`, `apps/scenario-lab/src`. Every hit is `resolve-target.ts`, `results.ts`, their own tests, the pinning test row, or `domain.test.ts`'s unrelated *flow bootstrap* `resolution`. |
| The pinning row is the last one | `gateway-mapping.test.ts:400-415`, immediately followed by the file's closing `console.log`. |
| `notFound` writes the score into `actual` | `resolve-target.ts:373-375`: ``actual: `nothing matched; ${nearbyCount} control(s)...${best ? `; best scored ${best.score.normalizedScore.toFixed(2)}` : ""}` ``. I deliberately did **not** quote a literal `0.42` in the comment — the number varies, and a reader who greps for it would find nothing. |
| `scoredAmbiguous` names each candidate with its score | `resolve-target.ts:337-341`. |
| `resolveTarget` is the only production caller of `resolveTargetWithDiagnostics` | `grep`: `resolve-target.ts:128` (now `:146`) plus four rows in `tests/resolve-target.test.ts`. |

### Comment 2b — `TargetResolutionError`'s docstring, same file

The brief named only the header. This docstring repeats the false implication
*and* adds a false claim about the strategy.

**Old:**

> Both ride onto the result: `results.ts` reads `failure` and `resolution` off
> a thrown value structurally, so **a Flow receives TARGET_AMBIGUOUS or
> TARGET_NOT_FOUND with the strategy that was tried rather than a sentence it
> would have to parse.** The record is built from the closed code set, so it
> cannot contradict a Core consistency rule and be dropped by its parser.

That is backwards. `resolution.strategy` is the one field that does **not**
reach a Flow; the strategies reach it only through `expected`'s prose
(`an element matching ${misses.join(", ")}`) — which is precisely "a sentence it
would have to parse".

**New:**

> Both ride onto the `BrowserActionResult`: `results.ts` reads `failure` and
> `resolution` off a thrown value structurally, so the result names
> TARGET_AMBIGUOUS or TARGET_NOT_FOUND as a code rather than as a sentence a
> reader would have to parse. Only the record travels further -- the gateway
> drops `resolution`, see this file's header -- so what reaches a Flow is the
> code, plus whatever the record's own text says about the strategies tried and
> the scores they got. The record is built from the closed code set, so it
> cannot contradict a Core consistency rule and be dropped by its parser.

### Comment 2c — `resolveTargetWithDiagnostics`'s docstring, same file

**Old:**

> The element an action acts on, with how it was found. Verbs take the element
> alone through `resolveTarget`; **a caller that reports a result wants the
> measurement too, and passes it on as the result's `resolution`.**

No such caller exists. The only production caller is `resolveTarget`, which
discards it. The `resolution` that does reach a result comes off the *thrown
error*, not off this function's return.

**New:**

> The element an action acts on, with how it was found. Verbs take the element
> alone through `resolveTarget`, which is this build's only production caller
> of this function and discards the measurement -- so a \*successful\*
> resolution's `resolution` reaches nothing today and is read only by this
> directory's tests. The `resolution` that does reach a result is the failure
> path's, carried on `TargetResolutionError` and lifted by `results.ts`.

### Recommendation: the gateway drop is right; the success-path discard is the broken promise

The brief asked whether the drop is right and framed it as one question. It is
two, at two different places, and they have opposite answers.

**The gateway drop is correct and should stay.** It is deliberate, documented,
and pinned with its reasoning by `gateway-mapping.test.ts:400-415`. Carrying a
field across the wire that nothing on the far side reads is exactly the class
of thing this plan has been removing — `L-review`'s own finding 6 flags a
second, unread copy of `automationFailureExpected` as a defect on identical
grounds. Adding `resolution` to the payload before something reads it would be
the same defect with better intentions.

**The success-path discard is the broken promise, and nobody decided it.** D1
promised "structured resolution diagnostics in every action result". A failed
resolution produces them (and they stop at the process edge). A successful one
produces them and throws them away one call later, because `resolveTarget`'s
return type is `Element`. That is not a narrowing anyone wrote down — it fell
out of a signature — and it is the half that matters, because it is what makes
a confident match and a lucky one indistinguishable. `v-matcher-calibration`
and two other reports each noticed it independently, which is usually the sign
that a real gap is being rediscovered rather than a preference restated.

**What it would cost to close, measured rather than guessed.** The receiving
end is already built and unused:

- `ActionResultEvidence.resolution` already exists (`results.ts:58`);
- `success(action, startedAt, message, validation, evidence)` already takes it
  (`results.ts:122-127`);
- `buildResult` already writes it: `if (evidence.resolution) result.resolution = evidence.resolution;`
  (`results.ts:271`).

So the whole missing piece is the producing end:

1. **One signature.** `apps/extension/src/content/actions/types.ts:39` declares
   the injected `resolveTarget(action: BrowserActionCommand): Element`. Widen
   it to return `ResolvedTarget`.
2. **Ten verb call sites**, each currently `const element = deps.resolveTarget(action)`:
   `assert.ts:112`, `check.ts:20`, `clear.ts:32`, `click.ts:29`,
   `extract.ts:11`, `keypress.ts:28`, `scroll.ts:89`, `select.ts:60`,
   `type.ts:41`, `upload.ts:17`. Nine become a destructure; `keypress.ts` is
   the awkward one, because it resolves only when the command names a target
   and otherwise uses `document.activeElement`, so it has no measurement to
   report on that branch. Each verb then threads `resolution` into the
   `evidence` argument it already passes to `success`.
3. **The wire hop, only once step 2 has a consumer.** One key in
   `webAutomationActionResultPayload`, and flipping the pinned test row — which
   that row explicitly invites, on the condition that the shape has not grown a
   string. **I checked the condition and it still holds:**
   `WebAutomationTargetResolution` (`domain/src/actions/types.ts:267-274`) is a
   closed `strategy` enum plus `candidateCount`, `bestScore`, `runnerUpScore`
   and `confidence` — four numbers, no page-derived text, so it needs no
   redaction guard.

My read: steps 1 and 2 are worth doing and are mechanical; step 3 should follow
in the same unit, because doing 1 and 2 alone would create exactly the unread
field the current drop correctly avoids. If it is not being done in Week 1,
D1's wording should be narrowed to "in every action result that failed to
resolve", so the plan stops promising something no code is heading towards.

---

## Items 3–5 — documentation that outran the code

### Item 3 — `domain/src/client/gateway-mapping.ts`: already landed

`v-error-seam`'s edit 1 is in the tree at `gateway-mapping.ts:302`, exactly as
proposed, with an accompanying docstring that already explains it. Verified by
reading; no edit made. This is the case the brief warned about ("several
workers landed after that text was drafted").

### Item 4 — `apps/extension/src/content/action-runtime/results.ts`

**Old:**

> record and the resolution that produced it, and both ride onto the result
> rather than being flattened into a sentence -- which is what happened before
> this seam existed, and why a Flow could not tell an ambiguous target from a
> missing one. The record is read structurally rather than by class, because
> the code is what has to be trusted and the class may be a bundled copy; a
> code outside the closed set is not trusted at all. **Failing that, the
> domain's classifier honours a `WebAutomationRuntimeError`, and anything else
> is an action that ran and failed for a reason no code names.**

**New:**

> record and the resolution that produced it, and both ride onto the result
> this function returns rather than being flattened into a sentence -- which is
> what happened before this seam existed, and why a Flow could not tell an
> ambiguous target from a missing one. Of the two, only the record goes on to
> leave the browser: `webAutomationActionResultPayload` drops `resolution` at
> the gateway, so what a Flow reads of the measurement is what the record's own
> `expected` and `actual` spell out. The record is read structurally rather
> than by class, because the code is what has to be trusted and the class may
> be a bundled copy; a code outside the closed set is not trusted at all.
> Failing that, the domain's classifier reads the same attachment itself, so
> this lift is a shortcut rather than a second mechanism; anything else is an
> action that ran and failed for a reason no code names.

Two changes, not one. The last sentence is `v-error-seam`'s replacement text,
verified rather than pasted: `classifyWebAutomationFailure`
(`classify.ts:73-79`) now calls
`carriedWebAutomationFailure(error, withActual(...))`, which reads `failure`
off the thrown value structurally — the same attachment `reportedFailure` reads
twenty lines above. "A shortcut rather than a second mechanism" is accurate.

The earlier change is mine: "both ride onto the result" sitting next to "why a
Flow could not tell" carried the same false implication this brief exists to
remove, so I made the destination explicit and said where the measurement
stops. `results.ts` is where a reader looking for `resolution`'s fate will
land.

### Item 5 — `domain/src/runtime/tests/adapter.test.ts`

Comment only. No assertion touched; the `assert.equal` calls beneath are
byte-identical.

**Old:**

> answer `classifyWebAutomationFailure` gives a **runtime error** whose code is
> outside the set, because it is the same drift arriving another way.

**New:**

> answer `carriedWebAutomationFailure` gives a **thrown record** whose code is
> outside the set, because it is the same drift arriving another way.

`v-error-seam`'s text, verified against `carrier.ts:84-89` as described under
Item 1.

---

## Not applied, and why: `L-review` finding 4

`L-review` finding 4 says `carrier.ts:20-22` and `:40-41` document a compiler
guard no production class has. I confirmed it and did **not** fix it.

`carrier.ts:40-41` names a specific class as its example:

> Declare it on the error class -- `class TargetResolutionError extends Error
> implements WebAutomationFailureCarrier` -- so the compiler holds the field to
> the closed set at the throw.

`resolve-target.ts:133-134` (post-edit line numbers):

```ts
export class TargetResolutionError extends Error {
  readonly failure: AutomationStudioFailureRecord;
```

No `implements`, and `AutomationStudioFailureRecord["code"]` is Core's bare
`string`. So `carrier.ts` cites as its worked example the one class that does
not do the thing.

I left it because it is a **type change, not a comment change**, it is not in
my five items, and `carrier.ts` is not mine to edit — so I could not fix the
claim at its source either. The fix is small and I verified its ingredients:
both `WebAutomationFailureCarrier` and `WebAutomationFailureRecord` are
re-exported through `domain/src/client/index.ts:8` → `runtime/failure/index.ts:9`,
which `resolve-target.ts` already imports from, and all three record builders in
that file (`ambiguous`, `scoredAmbiguous`, `notFound`) go through
`webAutomationFailureRecord`, so the narrowed field type would already be
satisfied. It is a two-line change: widen the existing import, then

```ts
export class TargetResolutionError extends Error implements WebAutomationFailureCarrier {
  readonly failure: WebAutomationFailureRecord;
```

I did not compile it. Whoever takes it should re-run `v-error-seam`'s mutation
proof afterwards, since the point of the change is that the proof would then
cover a production carrier rather than only a class declared inside
`carrier.test.ts`.

---

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=l-doc-truth` and `EXTENSION_TEST_BUILD_LABEL=l-doc-truth`
(see the Outcome section on why not `L-doc-truth`). Every exit status captured
by redirecting the command's output to a file and echoing `$?` on the next
statement — never through a pipe. No `pnpm lab`, no `pnpm build`, no browser.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | 0 | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/domain test` | 1 | **before the label fix**: `Error: DOMAIN_TEST_BUILD_LABEL must be lowercase kebab-case, at most 64 characters` |
| `pnpm --filter @fluxiq-web-extension/domain test` | 0 | `# tests 310 / # pass 310 / # fail 0 / # cancelled 0 / # skipped 0`; `grep -c "^not ok"` → 0 |
| `pnpm --filter @fluxiq-web-extension/extension check` | 0 | both `tsc` projects, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/extension test` | 0 | `# tests 249 / # pass 249 / # fail 0`; `grep -c "^not ok"` → 0 |
| `pnpm --filter @fluxiq-web-extension/extension check` (re-run after the final wording tweak) | 0 | no diagnostics |
| `pnpm --filter @fluxiq-web-extension/extension test` (re-run after the final wording tweak) | 0 | `# tests 249 / # pass 249 / # fail 0` |

The extension gates were re-run after the last edit so the quoted results
describe the exact bytes now in the tree; the domain files were not touched
after their gates ran.

Rows bearing directly on the comments I changed, both observed passing in the
final domain run:

```
ok 248 - a client record naming a code this domain does not own becomes UNKNOWN, carrying the code it used
Web automation gateway mapping tests passed.
```

The second line is the assert-script that contains the
`"resolution is still dropped by the result mapping"` row — it is a plain
assertion file rather than a `node:test` subtest, so it reports by completing
rather than by a `ok N` line.

`git diff` over the four changed files shows only comment lines. No changed
line is longer than 81 characters; every over-100 line the length scan reported
in `adapter.ts` is pre-existing code, not comment. `git status --porcelain`
shows no `.test-build-scratch` or `.test-build` entry, so the per-label build
output is ignored as intended.

## Files touched

Four, all comments only:

- `domain/src/runtime/adapter.ts` — Item 1, plus the `clientReportedFailure`
  reference to the deleted class.
- `apps/extension/src/content/action-runtime/resolve-target.ts` — Item 2, three
  blocks.
- `apps/extension/src/content/action-runtime/results.ts` — Item 4.
- `domain/src/runtime/tests/adapter.test.ts` — Item 5. Comment only; no
  assertion changed.

Not touched: `domain/src/client/gateway-mapping.ts` (owned, but its edit had
already landed), `apps/extension/src/content/identity/**`,
`domain/src/sensitivity/**`, and every test assertion.

## Not verified

- **No browser, no build, no Lab.** These are comment changes, so nothing here
  can alter runtime behaviour — but that also means nothing here is evidence
  about runtime behaviour.
- **The Core claims are read, not run.** `applyHello` and the token check in
  `packages/fluxiq/src/client-gateway/service/lifecycle.ts` were read in the
  sibling checkout. I did not run Core's suite, did not trace every path that
  can mutate `session.capabilities` after the hello, and did not check whether
  any Core-side policy re-validates `clientType` later. My claim is narrow: at
  `applyHello`, both fields come from the client's message and the token binds
  only `clientId`. If some later Core hook re-derives them, the capability
  recommendation weakens — worth one Core-side confirmation before acting on
  recommendation 2.
- **`L-review` finding 4's fix is unattempted and uncompiled.** The ingredients
  are verified (exports reachable, all builders route through
  `webAutomationFailureRecord`); the change itself is not written and `tsc` has
  not seen it.
- **The cost estimate for closing the success-path measurement** is a count of
  call sites and a read of the receiving plumbing, not an implementation. I did
  not attempt the change, so I cannot say what the ten verbs' tests would
  require.
- **`packages/test-runner` and `apps/scenario-lab` suites were not run.** I
  touched no file in either, and the `resolution` grep found no consumer there.
- **Whether `resolution` should exist on the wire at all** is downstream of the
  D1 question and not something I decided; I only established that its current
  shape carries no text and so needs no guard if it is ever added.

## Open questions or contradictions found

1. **A capability gate cannot authenticate anything the client sends, because
   the capability list is also something the client sends.** This generalizes
   past the redaction flag. Any future rule of the form "trust field X only
   from a client that declared capability Y" is, as the gateway is built today,
   trusting one self-declaration on the strength of another. If capability
   declarations are ever meant to carry weight, Core must bind them to the
   trusted-client record at pairing rather than copying them out of every
   `client.hello`. That is a Core question and a cross-repository decision.
2. **`withholdComparison`'s two operands have unequal documentation.** The
   `redacted` half is argued at length in three places; the
   `isSensitiveElementDescriptor(element)` half — equally client-supplied, and
   fully bypassable by omission — is documented only as a limit inside one test
   row in `gateway-mapping.test.ts`, and not at all on the adapter side. My new
   comment names it, but the asymmetry in how the two are discussed is probably
   why finding 2 was written as a question about the flag alone.
3. **D1's "structured resolution diagnostics in every action result" is
   currently false in two independent ways**, and only one of them was ever
   decided. Recommendation under Item 2. The plan text should either narrow the
   promise or schedule the ten verb call sites.
4. **`carrier.ts` names `TargetResolutionError` as the worked example of a
   class that declares `WebAutomationFailureCarrier`, and it does not declare
   it.** `L-review` finding 4, confirmed and left unfixed for the reasons
   above. Of everything in this report this is the one that most fits the
   brief's own standard — a confidently wrong comment on the exact mechanism
   the seam exists to enforce — and it needs an owner who holds both
   `carrier.ts` and `resolve-target.ts`.
