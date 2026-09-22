# D4 — Target resolution defenses that already exist

Read-only inventory, 2026-09-22. Nothing was changed. Line numbers are against
`dev` at `1f4ecc2` unless a claim is marked **(t070)**, which means the file as
it stands on `task/t070-exploration-handles` — that work is merged into
`task/t075-core-batch-integration` and **is not on `dev`**.

---

## 1. How a target is resolved at replay

`apps/extension/src/content/action-runtime/resolve-target.ts` owns the whole
ladder. `resolveTarget` (`resolve-target.ts:219`) returns `{ element,
resolution }` or throws `TargetResolutionError` (`resolve-target.ts:193`).

**Before any strategy runs**, the lookup roots are fixed:
`resolveShadowScope(target?.context?.shadowHosts)` (`resolve-target.ts:224`).
A target recorded inside a shadow root is looked for *only* in the roots its
recorded host chain reaches; every strategy below and the scorer use those
roots.

### Level 1 — exact strategies, in order (`exactAttempts`, `resolve-target.ts:356-379`)

| # | Strategy | Query | Falls through to |
| --- | --- | --- | --- |
| 1 | `selector` | `action.selector` run in every root (`resolve-target.ts:358-360`; `querySelectorAll` at `:615-623` swallows an invalid selector) | next strategy on 0 matches, or on a veto refusal |
| 2 | `coordinates` | `action.coordinates` → `elementsAtPoint` (`:361-367`, `:632-639`) | next |
| 3 | `visual-target` | centre of `visualTarget.documentBounds` corrected for scroll, else `bounds`/`anchor.bounds` (`:368-375`; `pointFromVisualTarget` `:648-655`) | next |
| 4 | `fingerprint` | `fingerprintMatches` (`:376-378`, `:395-414`) | Level 2 |
| 5 | `active-element` | only when **no** strategy was even attempted: `document.activeElement` (`:270-273`) | `TARGET_NOT_FOUND` |

The `fingerprint` strategy is itself a sub-ladder, `findClosestFingerprint`
(`apps/extension/src/content/element-finder.ts:21-55`), **stable signals
first, first hit wins, one element only**:

1. recorded `selector` (`element-finder.ts:22`)
2. recorded `xpath` — skipped inside a shadow root, and pre-checked by
   `isReadableXpath` because a malformed literal makes `document.evaluate`
   *throw* out of the whole resolution (`element-finder.ts:28-31`, `:107-121`)
3. `id` (`:32-35`)
4. `data-testid` (`:37-41`)
5. authored name — `[aria-label=…]` or `[name=…]`, scoped to the recorded tag (`:42-45`)
6. the full recorded class set, scoped to the recorded tag (`:46-49`)
7. exact normalized `visibleText` within the recorded tag (`:50-53`)

`fingerprintMatches` calls that once per root and, **only if every root
missed**, repeats the text pass itself so a tie can be *counted* rather than
silently taken first (`resolve-target.ts:396-413`); the text scan is bounded by
`MAX_TEXT_SCAN = 2_000` (`:166`, `:409`).

### What each Level 1 answer must survive

- **The gate** — `gatedPool`/`passesGate` (`:423-431`): visible
  (`isVisibleForResolution` `:442-450`: connected, has a view, not
  `display:none`/`visibility:hidden|collapse`, non-zero box), enabled
  (`isEnabledForResolution` `:453-456`: `:disabled`, `[aria-disabled="true"]`
  ancestor), and same tag as recorded. **When every match fails the gate the
  matches themselves become the pool** (`:425`) — deliberate, so an assertion
  about a hidden control still reaches the verb.
- **The veto** — `vetoExactMatch` (`:247`; implementation
  `apps/extension/src/content/identity/veto.ts:247-267`), three rules in order:
  1. `other-record` — `agreesWithRecordedRecord` (`veto.ts:229`, `:251`), a
     gate not a score: a candidate in a different row/card/list-item is refused
     at any score, and a candidate in *no* record when the recording named one
     also disagrees (fail-closed, `identity/record.ts:70-79`).
  2. `contradicted` — Core's `normalizedScore < TARGET_VETO_FLOOR = 0`
     (`veto.ts:150`, `:234`).
  3. `uncorroborated` — `corroboratesExactly` (`veto.ts:235`;
     `identity/corroboration.ts:63-69`): at least one of `visibleText`,
     `accessibleName`, `label`, `id`, `testId` must agree at Core's exact rung
     of `0.92` or better (`corroboration.ts:46`, `:53`).
  A veto is a **miss, not an abort** — the loop pushes the summary into
  `misses` and continues (`resolve-target.ts:248-251`).
- **Positional strategies get one extra check** — `coordinates` and
  `visual-target` land on exactly one element by construction, so their count
  proves nothing about a twin. Before acting, the recorded target's whole
  family is scored, and a tie throws `TARGET_AMBIGUOUS`
  (`POSITIONAL_STRATEGIES` `:289`; check at `:254-257`). Pinned by the test
  *"a point on one of two identical twins fails TARGET_AMBIGUOUS instead of
  clicking it"*.
- **Several survivors** → `scoreTargetCandidates` over the surviving pool; a
  decided winner resolves, otherwise `TARGET_AMBIGUOUS` naming up to
  `MAX_NAMED_CANDIDATES = 5` labelled candidates with their scores
  (`:263-267`, `:466-476`, `:168`).

### Level 2 — scoring (`scoreFamily`, `resolve-target.ts:279-282`, `:297-300`)

Runs when every strategy missed. `collectTargetCandidates`
(`identity/candidates.ts:143-163`) enumerates the page's same-family controls
— same tag **or** same explicit/implicit role (`inFamily` `:269-275`) — from
`CANDIDATE_SELECTOR` (`:120-123`), bounded by `MAX_SCANNED = 5_000` interactive
elements examined (`:107`) and `MAX_CANDIDATES = 60` scored (`:109`), with
`truncated` reported so "0 of that family" and "we stopped looking" read
differently (`resolve-target.ts:552-556`).

Ranking is Core's matcher (`identity/score.ts:147`,
`fluxiq/automation-studio/fingerprinting`). This repo contributes four rules:

- the record gate, applied *before* ranking (`score.ts:166-167`);
- `hasIdentitySignal` — a recording describing only its family is never scored
  (`score.ts:170`, `:256-261`);
- `TARGET_SCORE_FLOOR = 0.35` (`score.ts:136`, applied `:181`) and
  `TARGET_SCORE_MARGIN = 0.2` over the runner-up (`score.ts:145`, `:183-185`);
- `corroboratesExactly` on the winner (`score.ts:188`).

Outcomes: `resolved` → strategy `scored-candidate` with Core's score,
runner-up score and confidence (`resolve-target.ts:320-331`); `ambiguous` →
`TARGET_AMBIGUOUS` with the ranking (`:484-500`); `unmatched` →
`TARGET_NOT_FOUND` carrying the family count, the truncation note and the best
score (`:527-540`).

Position is captured but deliberately **not** scored: Core's
`ElementFingerprint` has no positional signal, and wiring one through
`attributes` (weight 6 of 292) separates two identical row actions by 0.037
against a 0.2 margin (`identity/candidates.ts:173-195`).

---

## 2. Element handles: what they are, how minted, what makes one ambiguous

A handle is an opaque string the model is given in place of a selector. The
selector map behind it never leaves the domain (`WebLlmSnapshotBinding`,
`domain/src/runtime/llm-evidence/sanitize.ts:91-103`).

**Minting.** `sanitizeWebLlmSnapshotWithBindings` numbers positionally,
`target.${elements.length + 1}`, in capture order, capped at
`WEB_LLM_EVIDENCE_BOUNDS.elements` (`sanitize.ts:142-150`). Each handle gets a
row in `selectors` and, when the element sits in a record, in `records`
(`:148-149`).

**Renumbering.** `stable-handles.ts` `restamp` is applied to every authoring
capture (`press.ts:65`, `enter-field.ts:24` and `:27`; wired in
`tools.ts:176-178`, `:295`, `:309`).

- **On `dev` (pre-t070):** numbering is **per page**, `target.1`–`target.99`
  (`MAX_HANDLE_NUMBER`, `stable-handles.ts:38`), keyed on
  `frameId \0 selector \0 record \0 occurrence` (`addressesOf` `:129-139`),
  lowest free number first (`nextNumber` `:142-147`); exhaustion restarts the
  page's numbering rather than reusing a number (`:82-85`).
- **After t070 (not on `dev`):** numbering is **per Flow**, `target.1` to
  `target.9999` (`WEB_LLM_TARGET_HANDLE_MAX_NUMBER`,
  `WEB_LLM_TARGET_HANDLE_PATTERN = ^target\.[1-9][0-9]{0,3}$`), allocated
  strictly monotonically (`flow.spent += 1`), and the address gains the page:
  `location \0 frameId \0 selector \0 record \0 occurrence`, sha256'd. The
  header gives the reason: the Flow script format writes a step's target
  **bare**, and per-page numbering made a bare handle `web.handle.ambiguous` as
  soon as the exploration had seen two pages — the end of 6 of E1 lane B's 12
  builds on the realistic stores. `sanitize.ts` **(t070)** also sizes the byte
  budget as if every handle already carried the widest number
  (`renumberedBytes`).

**What makes one ambiguous or unusable.**
`plan-resolution/target-packets.ts:41-43` is the closed answer set:

| Code | Cause | Line |
| --- | --- | --- |
| `unknown` | no packet for this Flow, or the handle was never in that page's packet | `:93`, `:96`, `:98` |
| `stale` | the page was let go past `RETAINED_PAGES_PER_FLOW = 8` | `:96`, `:121` |
| `ambiguous` | a **bare** handle whose remembered pages give it different `frameId+selector` addresses | `:101-117` |
| `not_unique` | the selector behind the handle was given to **more than one described element** in the same packet — `shared` is computed at `remember` time | `:69-77`, `:99`, `:119` |

Two further binders refuse independently: `observedElement` refuses a handle
matching other than exactly one element as `target_unobserved`
(`press.ts:100-104`), and `currentElementForReturnedTarget` re-binds through
the selector recorded when the handle was issued and refuses if the page moved
or the selector no longer names exactly one element (`press.ts:113-126`).
`webLlmTargetsUnchanged` (`target/stability.ts`) is the batched-action check:
same location, and every previously-shown handle still mapping to the same
selector.

**(t070) look-alikes.** Two elements whose every published field agreed were
two handles for one description, and the model could only guess — on the
everything store's home page three of the first ten elements were
`{ tag: "div" }` and nothing more. `look-alikes.ts` gives only the elements
that read alike a `dialog` name, the record's `within` words, and failing both
an `alike: { index, total }` ordinal; it is recounted after every budget trim.
`front-layer.ts` **(t070)** additionally floats an open modal dialog's own
controls to the front of the packet, because a dialog appended at the end of
the document ranked past the 40-element bound and the model was refused
`blocked_by_dialog` with no handle for anything that could close it.

---

## 3. Readiness, wait and settle conditions

**Engine.** `waitUntil` (`action-runtime/waits.ts:30-71`): evaluate once
synchronously, then a `MutationObserver` on `documentElement`
(`childList + subtree + attributes + characterData`, `:65-69`) **and** a 50 ms
poll (`POLL_INTERVAL_MS` `:14`) — the poll exists because `pushState`, a CSS
transition, and "the page stopped changing" announce no mutation. Default
timeout `DEFAULT_WAIT_TIMEOUT_MS = 10_000` (`:17`). Running out of time is an
outcome (`undefined`), not a throw.

**Vocabulary.** `wait-conditions.ts:56-65`: `present`, `visible`, `enabled`,
`absent`, `url`, `stable` (default quiet window `DEFAULT_STABLE_FOR_MS = 500`,
`:20`). Reachable only through the two wait verbs
(`actions/wait-for-selector.ts:19-39`, `actions/wait-for-text.ts:17-37`), that
is, only when a Flow authors a wait node.

**What runs by default, per action:**

1. Background, before any DOM action: `if (!await
   consumeSnapshotReadiness(tabId)) await waitForTabReady(tabId)`
   (`runtime/action-runner.ts:79`). `waitForTabReady`
   (`runtime/automation-tab.ts:207-247`) waits for `status === "complete"` plus
   **1 s of URL stability**, polling every 250 ms, capped at 20 s.
   `consumeSnapshotReadiness` skips that when the immediately preceding
   snapshot came from the same `documentId` and URL, within 10 s
   (`automation-tab.ts:160-179`, `:33`).
2. `checkActionability` (`action-runtime/actionability.ts:35-58`), which
   **scrolls the element to the viewport centre** (`:46`;
   `scroll-element-into-view.ts:13-15`, `behavior: "instant"`) and then
   hit-tests it. Called by `click`, `type`, `clear`, `select`, `keypress`.
   **Not** called by `check`, `scroll`, `upload`, `extract`, `assert` (grep over
   `content/actions/*.ts`); `check` and `scroll` only scroll into view.
3. For a link click: `watchInPlaceEffect` plus `settle`, window
   `IN_PLACE_WINDOW_MS = 5_000`, shortened but never lengthened by the
   command's `timeoutMs` (`actions/click.ts:49`, `:74-84`, `:144-148`).
4. For `web.dom.assert`: re-query and re-judge until
   `DEFAULT_ASSERT_TIMEOUT_MS = 5_000`
   (`action-runtime/assertion-evaluation.ts:63`, `:68-71`); `timeoutMs: 0` is a
   single immediate check.
5. For a click, tab-level: `NAVIGATION_START_GRACE_MS = 300`, then
   `NAVIGATION_END_TIMEOUT_MS = 10_000` for the commit
   (`runtime/click-landing.ts:46`, `:49`).

There is **no default settle after a non-link click, a type, a select or a
check** — the verb returns as soon as its own post-condition is read.

---

## 4. Covered, off-screen, shadow root, frame

**Covered.** `checkActionability` hit-tests the clamped viewport centre;
`topmostAt` descends through open shadow roots up to 16 deep
(`actionability.ts:119-129`), and `isWithin` crosses shadow boundaries, which
`Node.contains` does not (`:132-139`). A hit on something else gives
`ACTION_REJECTED` with code `covered` (`:57`), and the click verb returns that
rather than acting (`click.ts:59-62`). `results.ts` then upgrades `covered` or
`hidden` to `USER_INTERVENTION_REQUIRED` when an open modal dialog is standing
over the page (`MODAL_BLOCKED_REFUSALS`, `results.ts:324`, `:362`; applied
`:196`). **Nothing dismisses the overlay** — the only dismissal path in the
codebase is the native-dialog verb (`content/actions/dialog.ts`,
`page-world/dialog-override.ts`); a cookie or consent banner is reported, never
cleared.

**Off-screen.** Resolution deliberately does **not** move the page
(`isVisibleForResolution` comment, `resolve-target.ts:433-441`). Actionability
scrolls to centre — chosen over minimal scroll precisely because sticky headers
and footers cover the edges (`scroll-element-into-view.ts:3-11`). `hitPoint`
clamps the rect to the viewport so an element taller than the screen still gets
a testable point (`actionability.ts:108-116`); nothing on screen at all gives
`hidden`, *"no part of the element is inside the viewport, even after
scrolling"* (`:49`).

**Shadow root.** Three cooperating pieces. `shadowHostChain` records every open
host above the element, outermost first, each named in its own tree
(`content/selector/shadow/host-chain.ts:83-89`; carried on the descriptor as
`context.shadowHosts`, `identity/context.ts:91`). `resolveShadowScope` walks
the chain back, widening a step that reaches no root to every open root in
scope, bounded by `MAX_HOST_SCAN = 5_000` (`shadow/scope.ts:38`, `:41-50`).
`deepElementFromPoint` descends through open roots so a point on a consent
banner inside a widget resolves to the button rather than the host
(`shadow/element-from-point.ts:106-114`, `MAX_SHADOW_DEPTH = 16`). A target
recorded in a shadow root is **never** looked for in the light document
(`scope.ts:19-22`). Closed roots cannot appear — events retarget to the host,
so the recorder never describes an element in one (`host-chain.ts:75-76`). Two
known holes: a recorded xpath is skipped inside a shadow root
(`element-finder.ts:28`), and `in-place-effect.ts` cannot see an effect that
happens inside a shadow root (`in-place-effect.ts:36-39`).

**Frame.** The action is addressed twice — the `chrome.tabs.sendMessage`
`frameId` option, and the `frameId` in the body, which the receiving frame uses
to confirm it is the addressee (`runtime/action-runner.ts:180-200`). Because
frame ids are reassigned on every navigation, `chooseFrame` re-addresses by the
frame document's **path**: one match wins whatever the recorded id was, several
fall back to the recorded id or fail `TARGET_AMBIGUOUS`, none fails
`TARGET_NOT_FOUND` naming the paths present (`runtime/frame-address.ts:42-56`).
An empty frame list means "the browser would not say", not "no frames" (`:47`).
Click events carry the element's own `defaultView`, so a click in a child frame
is dispatched in that frame (`actions/click.ts:173-174`). A paginated list read
is carried across documents from a pre-press checkpoint
(`runtime/extract-list-continuation.ts`), and a `web.dom.assert` whose channel
closed under a navigation is re-sent — only the assert, because it only reads
(`action-runner.ts:253-283`).

---

## 5. What the runtime keeps about what it acted on — and is it enough?

**On every content-script result** (`buildResult`,
`action-runtime/results.ts:401-431`): `status`; `validation`
(`expected`/`actual`, mandatory — `success()` takes one as an argument so a
verb with no post-condition must say so, `:5-8`); `message`; `failure` (closed
code set); `url`; `title`; `startedAt`/`finishedAt`; `element`, the full
`describeElement` descriptor of what was acted on
(`content/describe-element.ts:59-118`: selector, xpath, id, classNames, testId,
role and implicitRole, accessibleName, label, viewport and document bounds,
options and selectedValue, `hasValue`, and `context` including `record` and
`shadowHosts`); `snapshot` (always captured for a non-succeeded result, even
with snapshot capture off, `:424`); `extracted`/`extraction`/`dialog`/
`structure`; and `resolution`, the measurement that chose the target —
strategy, `candidateCount`, `bestScore`, `runnerUpScore`, `confidence`
(`domain/src/actions/types.ts:387-425`; `ActionResultEvidence`
`results.ts:80-89`).

**Cross-checks that can already catch a false success:**

| Check | What it catches | Where |
| --- | --- | --- |
| Link in-place effect | a link click the page swallowed: neither the address nor the rendered text plus structure moved within 5 s → `output_not_observed` | `action-runtime/in-place-effect.ts`; `actions/click.ts:115-133` |
| Click landing status | the server refused the page the click led to (404, 403) | `runtime/click-landing.ts` |
| Navigation landing | the tab is not at the requested destination (tolerant of scheme, www, trailing slash, fragment; query only when requested) | `runtime/navigation-outcome.ts:25-42`, used `action-runner.ts:144-159` |
| Page identity | the document was replaced or routed away *while the verb ran* → `PAGE_CHANGED`, substituted over the codes it explains better | `actions/page-identity.ts`, wired `actions/execute.ts:43-51` |
| `check` read-back | a handler that reverted the change → failed post-condition | `actions/check.ts:34-38` |
| Exploration `no_progress` | a press whose packet is byte-identical to the one before it | `llm-evidence/press.ts:69` |
| State digest | a step that changed nothing the automation depends on — stable across a no-op, different after a real change | `llm-evidence/state-digest.ts:114-116` |

**Is that enough for "reported success but nothing changed"?** No, and the
`everything-store` navigate is exactly where it fails. Four specific gaps:

1. **The state digest exists but is exploration-only.** `webLlmStateDigest` is
   reachable from one place, `captureStateDigest` in
   `llm-evidence/tools.ts:329-351`, whose input is `{ projectId, flowId,
   callId }` — the authoring loop. No replay path takes a before/after digest.
2. **Worker-side actions carry almost no evidence.** `navigate`, `tab` and
   `download` are built by `workerActionResult`
   (`runtime/action-results.ts:56-74`), which emits `status`, `validation`,
   `message`, `startedAt`/`finishedAt`, `url`, `failure` and `visualTarget` —
   **no snapshot, no title, no element, no resolution**. So a navigate result
   contains nothing that could show the page did not move.
3. **`compareNavigatedUrl` is a destination check, not a change check.** It
   compares *requested* against *landed* (`navigation-outcome.ts:25-30`). A
   navigate whose URL is the page the tab is already on matches trivially. The
   only thing that makes such a node do work is `updateTabUrl`'s reload
   (`automation-tab.ts:132-141`), and nothing verifies the reload happened —
   `readTabUrl` returns the same string either way.
4. **No before/after at all for a non-link click, type or select.** Those
   verbs' post-conditions are local: the hit test landed on the target
   (`click.ts:156-162`), the field reads back the typed value. A control that
   accepted the gesture and did nothing passes.

`in-place-effect.ts` is the one module in the tree that already implements the
right shape — baseline rendered text, plus a structural-movement requirement,
plus address polling — and it is wired to exactly one verb, link clicks
(`click.ts:76-80`), with its own header naming what it cannot see (a live feed
can make a dead link read as answered; an effect confined to a shadow root is
invisible to it).

---

## Existing defenses at a glance

| Defense | File | Used by default? |
| --- | --- | --- |
| Shadow scope for the whole resolution | `content/selector/shadow/scope.ts` | **Default** — every `resolveTarget` |
| Selector → xpath → id → testId → name → classes → text | `content/element-finder.ts` | **Default** (fingerprint strategy) |
| Visible / enabled / same-tag gate on matches | `resolve-target.ts:423-456` | **Default**; falls back to ungated matches by design |
| Ambiguity count per strategy | `resolve-target.ts:263-267` | **Default** |
| Family scoring behind a point strategy | `resolve-target.ts:254-257` | **Default** |
| Record gate (row, card, list-item identity) | `content/identity/record.ts` | **Default**, both at Level 1 and before Level 2 ranking |
| Score veto (floor 0) | `content/identity/veto.ts:150` | **Default** |
| Exact corroboration (0.92 rung) | `content/identity/corroboration.ts` | **Default**, both acting paths |
| Level 2 scoring, floor 0.35 / margin 0.2 | `content/identity/score.ts` | **Default** when Level 1 misses |
| Truncation honesty on the candidate scan | `identity/candidates.ts:57-70` | **Default** |
| Actionability gate (scroll to centre plus hit test) | `action-runtime/actionability.ts` | **Default for click, type, clear, select, keypress only** — not check, scroll, upload, extract, assert |
| Modal-blocked upgrade to `USER_INTERVENTION_REQUIRED` | `action-runtime/results.ts:324-362` | **Default** on a `covered`/`hidden` refusal |
| Auth-gate upgrade to `AUTH_REQUIRED` | `action-runtime/results.ts:291-300` | **Default** |
| Tab readiness (complete plus 1 s URL stability) | `runtime/automation-tab.ts:207-247` | **Default** before every DOM action |
| Frame re-addressing by document path | `runtime/frame-address.ts` | **Default** when the node carries a frame path |
| `PAGE_CHANGED` detection | `content/actions/page-identity.ts` | **Default** |
| Link in-place effect watch (5 s) | `action-runtime/in-place-effect.ts` | **Default for `a[href]` clicks only** |
| Click landing HTTP status | `runtime/click-landing.ts` | **Default for `web.dom.click`** |
| Navigation destination comparison | `runtime/navigation-outcome.ts` | **Default for `web.browser.navigate`** |
| `resolution` measurement on the result | `domain/src/actions/types.ts:387-425` | **Default** — emitted, but nothing gates on it |
| `visible` / `enabled` / `absent` / `url` / `stable` waits | `action-runtime/wait-conditions.ts` | **Available, unused** unless a Flow authors a wait node |
| `stable` (DOM quiet) settle | `wait-conditions.ts:107-111` | **Available, unused** — never applied after an action |
| `expectedState` → `web.dom.assert` evaluation | `domain/src/runtime/expectation/` | **Available**; only Core's expectation node and transition comparison invoke it |
| Web state digest | `llm-evidence/state-digest.ts` | **Available, unused at replay** — exploration only (`tools.ts:329`) |
| Stable per-Flow handle numbering | `llm-evidence/stable-handles.ts` **(t070)** | **Available, not on `dev`** |
| Look-alike disambiguation cues | `llm-evidence/look-alikes.ts` **(t070)** | **Available, not on `dev`** |
| Modal dialog controls first in the packet | `llm-evidence/front-layer.ts` **(t070)** | **Available, not on `dev`** |
| Repair equivalence refusals | `llm-evidence/target/equivalence.ts` | **Default** on a proposed target override |

---

## Cheapest additions

Four, smallest first. Each reuses a mechanism that already exists.

1. **Give every effectual verb the in-place-effect watch, not just link
   clicks.** `watchInPlaceEffect` already takes a baseline of rendered text plus
   a structural-movement requirement and polls the address; `click.ts` arms it
   only when `navigatingLink(element)` answers. Arming it around every click,
   select and check press, and reporting "the page gave no answer" as
   `output_not_observed`, closes the plain "clicked and nothing happened" case
   for the price of one `MutationObserver` per action.
   *Touches* `apps/extension/src/content/actions/click.ts` (drop the link
   condition), plus `select.ts` and `check.ts` to arm the same watch.

2. **Make a navigate prove it moved.** The navigate result today is
   destination-only and carries no page evidence. Capture the top frame's
   `documentId` before `updateTabUrl` and compare it with the one after
   `waitForTabReady`; a navigate that left the same document is a failure, not
   a success. `readTopDocumentId` already exists two functions away.
   *Touches* `apps/extension/src/runtime/automation-tab.ts` (return the
   document id from `updateTabUrl`) and `runtime/action-runner.ts:138-160`
   (`navigationResult`).

3. **Put a state digest on the replay path.** `webLlmStateDigest` is already
   written, already bounded, already exhaustive-by-construction, and already
   reachable through a host capability — it is simply never asked for outside
   the authoring loop. Taking it before and after an effectual node and
   reporting `digestBefore`/`digestAfter` on the result gives the recovery
   ladder a deterministic "this step changed nothing" signal with no new page
   contract.
   *Touches* `domain/src/runtime/llm-evidence/tools.ts` (a run-scoped sibling
   of `captureStateDigest`) and the result payload in
   `domain/src/client/gateway-mapping.ts`.

4. **Let the actionability gate settle instead of refusing at once.** The gate
   is a single synchronous read; `waitUntil` next door already re-evaluates any
   predicate on mutation plus a 50 ms poll. Re-running `checkActionability`
   through `waitUntil` for a short bounded window would absorb the banner that
   is animating out, the button that is about to enable, and the overlay that
   disappears on its own — which is most of what a site we do not control does
   in the first second after a page settles.
   *Touches* `apps/extension/src/content/action-runtime/actionability.ts` (an
   async wrapper) and the five verbs that call it.

Worth naming beside these, as a correctness gap rather than a robustness one:
`wait-conditions.ts` resolves every selector with a bare
`document.querySelector` (`:74`, `:82`, `:90`, `:96`), so a wait can never be
satisfied by an element inside a shadow root, although `resolveShadowScope`
exists for exactly that. Routing those four calls through the shadow scope is a
one-file change.

---

## Commands run and observed results

Focused unit run, bundled with the package's own esbuild into a scratch label
and executed under `node --test` (the runner script lived in the scratchpad;
the scratch build directory was removed afterwards, and `git status` shows no
change from this work):

```
node <scratchpad>/run-focused.mjs \
  content/action-runtime/tests/resolve-target.test.ts \
  content/action-runtime/tests/wrong-row-resolution.test.ts
```

Observed: `# tests 13 / # pass 13 / # fail 0 / duration_ms 314.814`. The 13
names, which are the evidence behind several claims above:

```
ok 1  - the declared element field is what resolves, not the untyped options blob
ok 2  - the untyped options blob still resolves while it is the only description sent
ok 3  - an exact resolution reports the strategy that answered and claims no score
ok 4  - a declared field with no identity in it falls back rather than blanking the target
ok 5  - neither description leaves the resolver with no target at all
ok 6  - a page whose family the scan never reached says the scan was cut short, not that the page is empty
ok 7  - a page the scan read to the end still says plainly that no such control is on it
ok 8  - a point on one of two identical twins fails TARGET_AMBIGUOUS instead of clicking it: coordinates
ok 9  - a point on one of two identical twins fails TARGET_AMBIGUOUS instead of clicking it: visual target
ok 10 - a point on a control with no twin still resolves by the point
ok 11 - a positional selector that lands in another record fails the step instead of acting on it
ok 12 - a repaired step is refused too when the control it finds sits in another record
ok 13 - and the same repaired step resolves in the row the recording named
```

## Not verified

- No live browser run, no live provider call. Every claim about runtime
  behaviour is read from source and from the unit run above.
- The **(t070)** files were read from `git show
  task/t070-exploration-handles:…` and were not built, type-checked or tested
  here.
- `pnpm check`, `pnpm test` and `pnpm build` were not run; this was a
  read-only investigation.
- The four "cheapest additions" are unmeasured proposals. The cost claims
  ("one `MutationObserver` per action", "two property reads") are read off the
  existing implementations, not benchmarked.

## Open questions or contradictions found

1. **t070 is not on `dev`.** `look-alikes.ts` and `front-layer.ts` do not exist
   on `dev`, and `stable-handles.ts` there still numbers per page,
   `target.1`–`target.99`. Any plan phase that assumes per-Flow handle
   numbering, look-alike cues or dialog-first packets depends on the Week 2
   integration branch landing first.
2. **`web.dom.wait_for_selector` cannot wait on a shadow-root element.** The
   condition evaluators use a bare `document.querySelector`
   (`wait-conditions.ts:74`, `:82`, `:90`, `:96`) while the resolver has a full
   shadow scope. A Flow that waits for a widget's control before clicking it
   will time out and then resolve it successfully.
3. **`check`, `scroll` and `upload` skip the actionability gate.** They call
   `scrollElementIntoView` (or nothing) and act. A covered or inert checkbox is
   set through the scrim with no `covered` refusal — the gate's whole purpose.
   Whether that is deliberate is not stated anywhere I read.
4. **`resolution` is emitted and never consumed.** Every result carries a
   strategy, a candidate count and Core's score and confidence, and no consumer
   in this repository gates on them. A `scored-candidate` resolution at 0.36 is
   acted on exactly like an `id` match at 1.0.
