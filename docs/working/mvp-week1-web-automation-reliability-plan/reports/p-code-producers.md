# p-code-producers — the two unproduced failure codes, and a stale fixture comment

Worker report. No `pnpm lab` command and no `pnpm build` was run. Nothing was
committed.

## Outcome

**Done.** Both codes now have real producers, both producers are proved by a
test that failed before the change, and the fixture comment is corrected against
measurements I verified rather than pasted.

| Finding | Verdict | Where the producer now is |
| --- | --- | --- |
| `web.page.changed` — no producer at all | **Give it a real producer.** The condition occurs, it is detectable from the content script, and it was never wired. | `apps/extension/src/content/actions/page-identity.ts`, called from `actions/execute.ts` |
| `web.intervention.required` — one producer, not the documented meaning | **Give it its real producer, and correct the documentation.** The existing producer is right under Core's definition; the *set's own gloss* was narrower than Core's and narrower than the code needed, and the page-side condition the code was named for had never been wired. | `apps/extension/src/content/action-runtime/results.ts` (`blockedByModal`) |

Neither was documented-as-dead. `PAGE_CHANGED` went from 0 producers to 1;
`USER_INTERVENTION_REQUIRED` from 1 (a domain-side pairing refusal) to 2, the
new one being the page-side case.

**A third member is unproduced**: `web.action.not_implemented`. Details and the
evidence are in [The third dead member](#the-third-dead-member); I did not
change it, because retiring it crosses into a file I do not own.

## What changed and why

### 1. `PAGE_CHANGED` — a missing safety check, not a naming problem

**The condition.** Core defines `page_changed` as "the surface the action
targeted was replaced between resolving the target and executing the action".
Every verb resolves a target and then acts, and several wait in between —
`assert` polls its claim until it holds or its window closes, `scroll` polls for
growth, `extract_list` follows pagination. A same-document route change, or a
`document.open()` that replaces the tree, during any of those leaves the verb
measuring a page nobody asked about.

**What it protects, concretely.** The result the verb then reports is not vague,
it is confidently wrong, and each wrong answer sends a Flow somewhere different:
`TARGET_NOT_FOUND` says widen the target, `OUTPUT_NOT_OBSERVED` says retry the
same action, `TIMEOUT` says wait longer. This is the same class the rest of the
week guarded from the other side — the resolver refuses a candidate the
recording contradicts, the veto refuses a fast Level 1 answer the page
disagrees with, the actionability gate refuses a target that cannot be hit — and
**none of them asks whether the page is still the page.**

**New: `apps/extension/src/content/actions/page-identity.ts`** (135 lines).
`observePageIdentity()` reads `location.href` and `document.documentElement`;
`reportPageChange(result, before)` substitutes PAGE_CHANGED into a non-succeeded
result when they moved.

**Wired in `actions/execute.ts`**, the one point that sees an action begin *and*
end. The routing body moved into a private `routeContentAction` so the identity
read brackets it; every branch is still `await`ed inside the same try block, so
the guarantee `tests/execute.test.ts` exists to hold is untouched.

Four decisions worth not re-making silently:

- **Only a non-succeeded result is rewritten.** A click on a link *is* a
  navigation and is the most common action in any recording. Rewriting successes
  would make PAGE_CHANGED the commonest failure in the corpus and mean nothing.
- **It never overwrites a code the page moving does not explain**:
  AUTH_REQUIRED (sign in — not retry), USER_INTERVENTION_REQUIRED (a person must
  act), UNSUPPORTED_TYPE and NOT_IMPLEMENTED (decided at dispatch, before the
  page mattered), NAVIGATION_UNEXPECTED, and itself. Everything else it
  supersedes, and nothing is lost: the superseded code and its sentence ride in
  the new record's `actual`.
- **No URL text in the record.** A query string is where a session token rides;
  `domain/src/runtime/adapter.ts` strips them from evidence for the same reason.
  The record says *that* the page navigated, never where. The result's own `url`
  field still says where, under the rules that field already has.
- **The window is narrower than the plan's.** The plan says "between dispatch
  and execution", which needs a document identity stamped on
  `BrowserActionCommand` by `action-runner.ts` and compared in
  `message-handler.ts` — three files, none of them mine, and the reason
  `w3-failure-producers` left this undone. What is shipped is the half the
  content script can answer alone. A **cross-document** navigation destroys the
  content script with the command unanswered, so what this catches is the case
  that leaves the script alive: a same-document navigation (`pushState`, a hash
  route, a `replaceState` redirect) or a swapped document root. Cost: two
  property reads per action.

### 2. `USER_INTERVENTION_REQUIRED` — what its producer actually emits it for

**Established, as asked.** The one producer is
`domain/src/runtime/adapter.ts:122`:

```ts
if (!session) return rejected(command, "A single paired web-automation client must be selected before capturing state.", WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
```

It fires when `captureWebAutomationSnapshot` can find no single connected,
`web.actions`-capable extension session — no client paired, or several and none
named.

**My verdict: the producer is right and the set's own comment was wrong.** Core
defines the category, in `packages/contracts/src/failure/adaptive-class.ts`, as
exactly one line: *"A person must act before the run can continue."* An unpaired
extension is precisely that — nobody but the operator can pair a browser
extension, and no retry will do it. What did not match was the gloss the closed
set had written beside the code — "a captcha, or a native dialog waiting for an
answer" — which was an *illustration* read as a definition. It described neither
the adapter's use nor anything else in the tree, because the page-side condition
it illustrated had never been wired at all.

So the honest resolution is both halves, and neither is documentation-only:

**(a) The page-side producer now exists.** `blockedByModal` in
`action-runtime/results.ts` reports USER_INTERVENTION_REQUIRED when an
actionability refusal is met by a modal dialog standing over the page. It sits
beside `authGateFailure`, follows the same two-signal shape, and is the second
code in the file decided from the page rather than from the verb.

The rule, and why each half is there:

- **The refusal must be `covered` or `hidden`.** `covered` is the
  overlay-and-backdrop shape. `hidden` is the **`inert`** shape — and that is
  the one a *correct* modal actually produces: both `dialog.showModal()` and the
  ARIA pattern mark the rest of the document inert, and `actionability.ts`
  reports an inert target as hidden. A rule written only for backdrops would
  have missed the real case, which is what the `modal-flows` fixture does
  (`shell.inert = true`). `disabled` is excluded, and so is every verb's own
  word (`upload_rejected`, `unsupported_key`, `not_checkable`): those describe
  the target, and a dialog elsewhere on the page does not make them untrue.
- **A modal must be rendered.** Taken from the page's own declaration, never
  guessed from geometry: `[aria-modal="true"]`, or `:modal` (a `<dialog>` opened
  with `showModal()` and nothing else), and it must have a box on screen.
  `modal-flows` keeps its invite dialog in the markup behind `hidden` at all
  times, so without the rendered check every refusal on that fixture would have
  become an intervention.
- **Both, because either alone is ordinary** — the rule `authGateFailure`
  already follows. `modal-flows`' cookie banner covers the primary action and
  declares no modality, so a refusal there stays ACTION_REJECTED. That is the
  discriminating case and it has a spec row of its own.

Why it matters beyond tidiness: ACTION_REJECTED carries
`blocked_by_capability_or_policy` — "a capability, policy, or authorization gate
refused the action" — which tells an orchestrator the recorded *step* is wrong
and no retry can help, when the truth is that one dismissal unblocks the run.
The plan's own corpus says the same from the other side:
`packages/test-runner/src/bench/tests/week1-corpus.test.ts` requires
`"W14 modal-flows/interstitial/armed": "user_intervention_required"`, and
**before this hook no producer in the browser path could have satisfied it.**

**(b) The set's comment is corrected to Core's meaning**
(`domain/src/runtime/failure/codes.ts`), naming both producers and saying why
the old gloss made both look wrong.

**What it deliberately does not claim**, written into the source comment: it does
not check that the modal is the thing covering *this* target — the refusal
arrives at `actionRejected` as a reason and a sentence, not as an element and a
hit point — so a target inside the modal that is itself covered by something
else would be reported as an intervention. And no captcha detection: no fixture
ships one, and a vendor-iframe heuristic proved against nothing is a guess with
a code attached. `w3-failure-producers` declined it for the same reason and I
agree.

### 3. The stale comment in `identity-drift/modes.ts`

Verified before rewriting, from four independent places:

| Claim | Verified where |
| --- | --- |
| D13 shipped: `MISSING_STABLE_IDENTIFIER_SIMILARITY` is `-0.1` against `CONTRADICTED_…` at `-0.8` | `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\fingerprinting\element-fingerprint.ts:282-283` |
| The floor is 0.35 | `apps/extension/src/content/identity/score.ts:116` |
| `reworded-aria` scores **0.389**, confidence **0.366**, runner-up (Discard) **−0.360**, and **resolves** | plan D13; `reports/v-core-scoring.md:231`; `reports/L-resolution-diagnostics.md:40` |
| The harness row expects a *resolution*, pinned at 0.389/0.366 | `apps/extension/e2e/content/tests/identity-resolution.spec.ts:207-249` — `expect(reply.status).toBe("succeeded")`, `toBeCloseTo(0.389, 3)`, `toBeCloseTo(0.366, 3)` |
| Flipping the Core constant back turns the row red | `reports/v-core-scoring.md:353` — `1 failed / 19 passed`, `Expected: "succeeded" / Received: "failed"` |

The old comment ("ranked first by a wide margin and refused anyway, because the
score floor sits above anything this page can reach") was true of the **pre-D13**
numbers, 0.218 against 0.35. The new comment states the current measurement,
says it clears the floor by 0.039 and leads by 0.749, names D13 as the reason it
resolves, records that the variant and the Core constant ship together, and
points at the pre-D13 report, the post-D13 report and the spec row that pins it.

## The third dead member

**`web.action.not_implemented` has no producer.** The builder
`actionNotImplemented` exists in `results.ts:226`, is wired into the dependency
contract in `execute-action.ts:46` as `deps.notImplemented`, and **no verb calls
it** — `grep -rn "\.notImplemented(" apps/extension/src apps/extension/e2e`
(excluding the type declaration) returns nothing.

Applying the brief's own three-way test:

- **Does the condition occur?** No. `WEB_AUTOMATION_ACTION_TYPES` lists 18
  types; `actions/execute.ts` routes the 15 DOM verbs and `action-runner.ts`
  runs the three `web.browser.*` ones. Nothing registered is unbuilt.
- **Is it being reported as the wrong member?** No.
- **Can it arise?** Only if someone adds a registry entry without a verb — a
  future state, not a current one.

I did **not** wire the three `web.browser.*` types to it. They reach the content
script only through a routing bug, and they are *built* (elsewhere), so
"registered but not built yet" would be a second false statement rather than a
producer.

By the brief's standard that is a removal, and removing it means deleting
`actionNotImplemented` (mine), the `notImplemented` member of
`ContentActionDependencies` (mine), **and its wiring in
`action-runtime/execute-action.ts`, which I do not own.** Left for the
supervisor; it is a three-line change once that file has an owner.

Also worth correcting: `reports/w3-failure-codes.md` says
`web.action.not_implemented` "is produced today by
`content/action-runtime/validation-outcome.ts`". That was true when written and
is not now — `validation-outcome.ts` deleted all four of its record builders
when `results.ts` moved to the closed set, and its own header says so.

**Every other member has at least one live producer.** Full census, non-test
call sites only, taken after my change:

| Code | Producers |
| --- | --- |
| `ACTION_REJECTED` | 5 (`results.ts`, `action-runner.ts`, `browser-download.ts`, `browser-tab.ts` ×2) |
| `TARGET_NOT_FOUND` | 4 (`resolve-target.ts`, `action-runner.ts` ×2, `browser-tab.ts`) |
| `TARGET_AMBIGUOUS` | 2 (`resolve-target.ts`) |
| `OUTPUT_NOT_OBSERVED` | 2 (`results.ts`, `failure/classify.ts`) |
| `STATE_MISMATCH` | 4 (`results.ts`, `expectation/evaluate.ts` ×2, `classify.ts`) |
| `NAVIGATION_UNEXPECTED` | 1 builder, 2 call sites (`action-runner.ts:148`, `browser-tab.ts:126`) |
| `PAGE_CHANGED` | **1 (new: `page-identity.ts:96`)** |
| `TIMEOUT` | 4 |
| `AUTH_REQUIRED` | 1 (`results.ts` `authGateFailure`, live in `buildResult`) |
| `USER_INTERVENTION_REQUIRED` | **2 (new: `results.ts:192`; `adapter.ts:122`)** |
| `UNSUPPORTED_TYPE` | 3 |
| `NOT_IMPLEMENTED` | **0 reachable** — builder wired, no caller |
| `ACTION_FAILED` | 5 |
| `UNKNOWN` | 4 |

## Files changed

| File | Change |
| --- | --- |
| `apps/extension/src/content/actions/page-identity.ts` | **New.** The PAGE_CHANGED producer. |
| `apps/extension/src/content/actions/execute.ts` | Brackets the routing with the page-identity read; routing body split into a private `routeContentAction`. |
| `apps/extension/src/content/actions/tests/page-identity.test.ts` | **New.** Six rows. |
| `apps/extension/src/content/action-runtime/results.ts` | `blockedByModal` + `renderedModalPresent`; `actionRejected` chooses between the two codes; header and `authGateFailure` comment updated for the second page-decided code. 290 → 395 lines. |
| `domain/src/runtime/failure/codes.ts` | Doc comments for `PAGE_CHANGED` and `USER_INTERVENTION_REQUIRED`. No table row, category, flag or stage changed. |
| `apps/scenario-lab/src/scenarios/identity-drift/modes.ts` | The `reworded-aria` comment, corrected against D13/D14. |
| `apps/extension/e2e/content/tests/modal-intervention.spec.ts` | **New.** Three harness rows. |

`apps/extension/src/runtime/action-results.ts` is in my Owns and needed no
change: nothing on the background side can observe a document identity today.

**One file is outside the literal Owns list**, and deliberately:
`apps/extension/e2e/content/tests/modal-intervention.spec.ts`. The modal rule
reads the live DOM, and `results.ts` cannot be imported into a Node test at all
— its import graph reaches `content/frame-geometry.ts`, which evaluates
`window.top === window` at module load (proved: a bundled probe threw
`ReferenceError: window is not defined`). The repository's own answer for
DOM-dependent content behaviour is the Playwright harness, and the brief's
definition of done requires a test that fails before the change. It is a **new
file**: no existing spec was touched, so it cannot collide with the workers
editing six of them.

## Commands run and observed results

Both labels set to `p-code-producers`, lowercase. `FLUXIQ_TEST_ENV_FILES=none`
on every command. Exit status captured by redirecting to a file and echoing
`$?`, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. Re-run at the end: **0**. |
| `pnpm --filter @fluxiq-web-extension/domain test` | **0** | `# tests 331 / # pass 331 / # fail 0`. Re-run at the end: same. |
| `pnpm --filter @fluxiq-web-extension/extension check` | **0** | Clean. Two earlier runs failed in files I do not own — see below. |
| `pnpm --filter @fluxiq-web-extension/extension test` | **0** | `# tests 283 / # pass 283 / # fail 0` (281 earlier in the session; a concurrent worker added two). |
| `pnpm --filter @fluxiq-web-extension/extension run test:content --workers=4` | **0** | `198 passed`, `1 skipped`, 29.9s — including `ok 128/129/130`, the three `modal-intervention.spec.ts` rows. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` | **0** | `structure-audit: passed (31 warning(s), 17 baselined)`. No finding names any file I changed. `apps/extension/src/content/actions/` moved 19 → 20 files, which is the non-ratcheted 15-file advisory warning; the limit is 25. |

### The failing-before proofs

**PAGE_CHANGED.** With the guard in `execute.ts` neutralised (`void startedOn;`
and a bare `return await routeContentAction(...)`), then restored from a
scratchpad copy:

```
extension test exit (producer disabled): 1
# tests 281 / # pass 280 / # fail 1
not ok 144 - a verb that fails while the page navigates under it reports PAGE_CHANGED, not its own code
  expected: 'web.page.changed'
  actual:   'web.action.failed'
```

**USER_INTERVENTION_REQUIRED.** With `blockedByModal` short-circuited to
`undefined`, then restored:

```
modal spec exit (rule disabled): 1
2 failed / 1 passed
-  "category": "user_intervention_required"   -  "code": "web.intervention.required"
+  "category": "blocked_by_capability_or_policy"   +  "code": "web.action.rejected"
```

Both intervention rows fail; the third row — the non-modal consent banner —
passes either way, which is what it is for.

### Two failures that were not mine, and one that was transient

1. **`gateway-payloads.ts(121,37): TS2345 … 'implicitRole' is missing`** on an
   extension check. Not my file; `ls` showed it written 5 seconds earlier by a
   concurrent worker. Gone on a later run.
2. **`resolve-target.ts(453,60): TS2552: Cannot find name 'TargetCandidatePool'`**
   on the next extension check. Also mid-edit by another worker, also gone.
3. **The first full content-harness run was `5 failed / 193 passed`** — all five
   asserting a missing `resolution` field on a `TARGET_NOT_FOUND` reply, in
   `failures.spec.ts`, `identity-resolution.spec.ts` ×2 and `identity-veto.spec.ts`
   ×2. None of them touches anything I changed, and the same three spec files
   re-run immediately at **28 passed, exit 0**; the full suite then ran **198
   passed, exit 0**. Same cause as 1 and 2: the harness rebuilds the content
   bundle from `src/` at global setup, and it caught `resolve-target.ts`
   mid-write. Recorded here rather than dismissed, because it is a claim about
   someone else's file.
4. **`pnpm --filter @fluxiq-web-extension/scenario-lab check` exits 2**, twice,
   on `src/scenarios/member-directory/tests/scenario.test.ts(77,32)`. That is one
   of the three scenario directories being created right now, which my brief
   forbids me to touch. Zero errors name `identity-drift`, so my comment-only
   edit there compiles.

## Not verified

- **No live browser beyond the content harness.** The harness is real Chromium
  on a real fixture with the real content bundle, but with a `chrome.runtime`
  stub, no background worker, and messages to the top frame only. Nothing here
  ran through a paired extension against a real site.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run at repository
  scope.** The build is forbidden by the brief; the repository-scope gates would
  have measured other workers' in-flight edits, as the four incidents above
  show. Scoped to the packages I touched, all gates are green.
- **The W14 corpus row is not proved end to end.** I proved the *content
  script* now emits `user_intervention_required` on
  `modal-flows/interstitial/armed`, with the fixture stopping at one section and
  the offer still up. Whether the Lab's Flow lane then records that category on
  the run manifest needs `pnpm lab`, which the brief forbids.
- **PAGE_CHANGED has no live-page proof.** Its rows are Node tests with stubbed
  `location`/`document`. Arranging a real same-document navigation *during* an
  action needs a fixture that routes on a timer, and no fixture does; the three
  scenario directories being created might be the place to add one.
- **The `hidden` half of the modal rule is proved only on the `inert` shape.**
  A `<dialog>` opened with `showModal()` would take the `:modal` branch of
  `renderedModalPresent()`, and no fixture in the tree renders a native
  `<dialog>` at all (`grep -rn "showModal\|<dialog" apps/scenario-lab/src/scenarios/`
  → nothing). That branch is reasoned, not exercised.
- **The false positive I know about and did not close**: a covered target
  *inside* a rendered modal is reported as an intervention. `storefront-checkout`
  renders an `aria-modal` consent scrim, so a refusal there will now read as an
  intervention rather than a rejection — which I judge correct (until it is
  answered, nothing on that page is reachable), but it is a behaviour change on
  a fixture I did not test. No spec asserts `web.action.rejected` on
  `storefront-checkout` today; I checked.

## Open questions or contradictions found

1. **`NOT_IMPLEMENTED` needs an owner for `execute-action.ts`** — see
   [The third dead member](#the-third-dead-member). It is the same defect shape
   the brief sent me after, one file short of being mine.
2. **`domain/src/actions/types.ts` still declares a `cancelled` action status
   that nothing produces**, and `WebAutomationRuntimeError` still has no
   producer anywhere. Both were flagged by earlier workers and both are still
   true. Same shape again: a declared vocabulary member with nothing behind it.
3. **The full PAGE_CHANGED window is still open.** What ships closes the
   content-side half. The dangerous half the plan actually names — a command
   dispatched to a tab that navigates before the content script runs it — needs
   one field on `BrowserActionCommand`, stamped in `action-runner.ts` and
   compared in `message-handler.ts`. All three are one-line changes and none of
   the three is in any Wave 3 brief's Owns. Worth one narrow brief; the code and
   its precedence rules now exist for it to use.
4. **`results.ts` is 395 lines, five under the 400-line advisory**, and it is
   now the home of two page-decided codes plus five result builders. The next
   thing added to it trips the warning. The natural split is the page-decided
   rules into their own module — but they read `document`, and any module
   `results.ts` can import lives in `action-runtime/`, which would put the
   split behind whoever owns that directory next.
5. **`reports/w3-failure-codes.md` §"How to produce a code" is now one claim
   out of date** (the `validation-outcome.ts` producer of NOT_IMPLEMENTED). The
   code-set table itself is still accurate.
