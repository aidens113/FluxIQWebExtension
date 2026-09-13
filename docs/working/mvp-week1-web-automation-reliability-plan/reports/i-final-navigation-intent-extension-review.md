# i-final-navigation-intent-extension-review — Stage 4e extension cross-review

## Final Stage 4h disposition

This amendment supersedes the earlier “changes required” verdict below.
**Accepted for the targeted W10 live proof.** The amended extension half closes
the prior P1 and P2 findings, and no new P1/P2 issue was found in this final
read-only pass.

### Prior findings resolved

- **Independent debounce:** `ScriptedNavigationIntent` now owns
  `debounceTimer` separately from its expiry and retention timers and replaces
  only that timer on redirect commits
  (`scripted-navigation-intent.ts:22-45,125-137`). Production no longer injects
  or calls `NavigationRecorder.schedule` (`connection.ts:96-103`). The focused
  regression leaves an ordinary landing pending, claims two intent commits,
  fires both lanes, and requires one ordinary callback plus one intent send
  (`scripted-navigation-intent.test.ts:154-166`). Thus the W10 click landing can
  no longer be erased by the later scripted-navigation commit.
- **Original arm deadline:** arm stores `deadlineAt` and installs the one
  30-second expiry (`scripted-navigation-intent.ts:77-92`). Terminal transition
  retains the result only for `deadlineAt - now`, or removes it immediately at
  the deadline (`:161-185`). The late-terminal test pins a 100 ms remainder
  after 29.9 seconds rather than a restarted lifetime
  (`scripted-navigation-intent.test.ts:168-179`).
- **Failure/lifecycle coverage:** rejected recording send becomes only
  `send_failed` (`scripted-navigation-intent.ts:147-153`; test `:181-187`).
  Recording stop and live refusal cancel before idle
  (`active-recording.ts:174-190,355-369` and its focused tests); connection
  disconnect and tab removal cancel before their prior work
  (`connection.ts:301-307,334-338`;
  `scripted-navigation-control.test.ts:78-90`). Reset continues through the
  already-tested disconnect call in `background/index.ts`.
- **Composed send acknowledgement:** the state machine awaits
  `recordNavigation` before success (`scripted-navigation-intent.ts:147-153`),
  production binds it to intake (`connection.ts:96-103`), and intake awaits the
  public recording facade (`recorded-event-intake.ts:121-131`). The composed
  test holds the actual intake gateway send and proves the opaque await remains
  pending until release (`recorded-event-intake.test.ts:247-274`).

### Cross-half compatibility and security

- Extension and runner agree exactly on arm/await success
  `{ ok:true, intentId }`, fixed negative `{ ok:false, code }`, and cancel
  `{ ok:true, cancelled }`. The extension emits no extra response keys; the
  amended runner rejects extras.
- Arm takes `{ type, url }` only and the manager derives the active tab. The
  state validator accepts bounded bare loopback HTTP(S), rejects credentials,
  query, fragment, invalid recording/tab state, and stores the canonical safe
  arm destination (`scripted-navigation-intent.ts:48-60,77-92`). Commit
  comparison ignores query/fragment, but the event sends the validated arm URL,
  never raw commit data (`:139-153`).
- Only this extension's exact sidepanel/popup pages with no `sender.tab` pass
  the control boundary (`scripted-navigation-control.ts:6-29`). Unauthorized
  arm/await return fixed `forbidden`; unauthorized cancel remains fixed and
  idempotent. Intents are memory-only and all terminal/control results contain
  no URL, tab id, recording id, caught text, token, or page data.
- Owned top-frame commits receive first refusal before reload/transition
  classification (`recorded-event-intake.ts:105-119`). Once claimed, they do
  not also enter the ordinary path; unarmed behavior is unchanged. Sending is
  entered before the public promise, and `finish` refuses to overwrite a
  terminal cancellation with a late send (`scripted-navigation-intent.ts:139-173`).

### Non-blocking coverage note

The validator is straightforward and runner-side tests cover unsafe public
destinations, but extension state tests still do not pin both exact length
edges, HTTPS/IPv6 acceptance, or every invalid safe-integer tab value. Likewise,
reset-through-disconnect is established by composition rather than a dedicated
background-entrypoint test. These are P3 test-depth opportunities, not source
correctness blockers for the fixed loopback W10 path.

**Final gate:** proceed to the supervisor's targeted W10 primary and
`broken-link` 3/3 live acceptance. This pass reviewed source/tests only and ran
no build, unit suite, browser, or Lab command.

Read-only Stage 4f review, 2026-09-13. I reviewed only the Stage 4e extension
diff, its focused tests and report, and the accepted control/state-machine
contract. I made no extension, runner, Core, shared-document, build, Lab,
commit, or remote change; this report is the only edit.

## Verdict

**Changes required before live W10.** The control messages, sender boundary,
first-refusal branch, post-send acknowledgement, fixed response vocabulary,
and lifecycle cancellation are implemented coherently. However, the intent
reuses the ordinary navigation recorder's single per-tab debounce slot. That
can delete the preceding click's still-pending landing callback — precisely the
W10 evidence required to retain the click candidate and its `broken-link`
failure. The fixed intent lifetime is also restarted on every terminal result,
and several claimed failure/lifecycle guards have no targeted test.

## Findings, ranked

### P1 — the intent debounce can erase W10's preceding click landing

`ScriptedNavigationIntent.claimCommit` delegates its commit to the injected
`schedule` (`scripted-navigation-intent.ts:119-126`). Production injects
`this.navigation.schedule` (`connection.ts:99-104`). `NavigationRecorder` has
one pending entry per tab; every `schedule` clears that tab's prior timer before
installing the new callback (`navigation-recorder.ts:79-87`).

W10 records `full-navigation` click, waits only until the next page's heading
is visible, and then immediately performs scripted navigation
(`navigation/scenario.ts:32-36`). The click landing is itself held in that
250 ms ordinary debounce. If the heading becomes visible before the debounce
fires, the intent's `/history` commit clears the click-landing callback and
replaces it with its own. This is timing-dependent under load.

The loss is material, not merely diagnostic. The landing event carries the
click's expected destination. It is what lets `broken-link` replay report
`navigation_unexpected`; removing it can also change W10's candidate shape.
The current intent test sees only its own replacement callbacks
(`scripted-navigation-intent.test.ts:71-81`), and the intake test starts with no
ordinary callback pending (`recorded-event-intake.test.ts:227-245`), so neither
detects cross-lane cancellation.

**Correction:** give `ScriptedNavigationIntent` a separate intent-owned 250 ms
debounce timer/state. Redirect commits for the same armed intent should replace
only that intent timer. They must never call or clear the ordinary
`NavigationRecorder.schedule` slot. Do not add a fixed pre-arm sleep/drain in
the runner: it guesses when the browser commit reached the extension, adds
latency to every scripted step, and recreates the timing seam this explicit
acknowledgement was introduced to remove.

**Required regression:** leave an ordinary click-landing callback pending for
the tab, claim two redirect commits for the scripted intent, and deterministically
fire both lanes. Assert the ordinary callback survives exactly once, the intent
records only its settled commit exactly once, the click landing retains its
claim, and acknowledgement still waits for the typed event send. A mutation
that routes the intent back through the ordinary scheduler must fail this row.

### P2 — terminal retention restarts, rather than remaining inside, the fixed arm lifetime

Arm installs the fixed 30-second timer (`scripted-navigation-intent.ts:71-85`).
Every terminal transition clears it and starts a fresh 30-second removal timer
(`:151-158`). Therefore an intent which becomes terminal just before its arm
deadline remains in `byId` for almost 60 seconds after arm. An expired intent
also remains for another full 30 seconds after expiry.

The accepted design bounds terminal retrieval by the original arm lifetime,
not by a fresh lifetime per transition. The implementation has no injected
clock or stored `expiresAt`, despite the accepted design requiring an injectable
clock for this exact boundary. Tab ownership is released, so this does not
leave the tab busy, but it violates the fixed lifetime and retains opaque state
longer than agreed.

**Correction:** store the arm-relative expiry/deadline and inject `now`. On a
terminal transition, retain only for the non-negative remainder; at the
deadline, resolve an already-waiting await as `expired` and remove the entry.
Add deterministic early-terminal, just-before-deadline, and expiry-removal
rows; prove no terminal transition extends the original deadline.

### P2 — claimed failure and lifecycle acceptance rows are absent

The state source catches a rejected recording send and returns `send_failed`
(`scripted-navigation-intent.ts:137-143`), but the harness can only resolve or
hold its send; no test rejects it. The worker report nevertheless claims this
coverage. Likewise, direct state tests call `cancelTab`/`cancelAll`, but no
connection-level test proves the production tab-removal, disconnect, and reset
wiring. The active-recording test covers ordinary stop only
(`active-recording.test.ts:314-337`); its refusal row explicitly exercises an
idle refusal and expects no cancellation (`:270-301`), so cancellation of an
armed/sending intent on a refusal while recording is not pinned.

URL tests also do not exercise either exact length boundary, overlong pathname,
IPv6 loopback, HTTPS loopback, or invalid safe-integer tab ids
(`scripted-navigation-intent.test.ts:56-69`). Control tests exercise valid
calls and three unauthorized senders, but not malformed await/cancel ids or
fixed negative forwarding (`scripted-navigation-control.test.ts:30-64`).

Add the missing deterministic rows before accepting the report's stated
coverage. At minimum, a rejected send must yield only `send_failed`; stop and
refusal must cancel before idle; tab removal/disconnect/reset must settle the
open await with their agreed fixed outcomes; malformed requests and URL/tab
boundaries must return only fixed shapes. No caught sentinel may appear in a
response.

### P3 — post-send ordering is unit-tested only across disconnected stubs

The production chain is correct by inspection: the intent awaits
`recordNavigation` (`scripted-navigation-intent.ts:137-143`), the connection
binds that to `RecordedEventIntake.recordScriptedNavigation`
(`connection.ts:99-104`), and intake awaits its public `recordEvent`
(`recorded-event-intake.ts:121-130`), whose normal process awaits the gateway
send. The state test's send gate proves the first link, while the intake test
manually invokes `recordScriptedNavigation`; no focused row composes the actual
intent and intake collaborators. This is not an additional source blocker, but
one integration-style unit row should hold the gateway send pending and prove
the runtime await remains pending, then resolves only after that exact send.

## Contract and structure checks that pass by inspection

- Arm/await/cancel names and response discriminants match the runner contract;
  no request accepts a tab id, and the manager derives the current page tab.
- The sender guard accepts only this extension's exact sidepanel/popup URL,
  requires no sender tab, and returns `forbidden` or idempotent cancel without
  manager access for unauthorized callers.
- Arm accepts only bounded bare loopback HTTP(S), stores canonical origin/path,
  and emits the validated armed URL rather than the commit's query/fragment.
- A top-frame owned commit gets first refusal before reload/transition
  classification; unowned commits retain the old path.
- Sending state is entered before the public recording promise is awaited;
  cancellation/expiry terminal state cannot be overwritten by a late send.
- Stop and refusal cancel synchronously before setting recording idle. Tab
  close, disconnect, and reset-through-disconnect have explicit cancellation
  calls in production source.
- New source modules are cohesive, under the line budget, colocate tests under
  the owning directories, and use the existing connection barrel. No Core or
  domain contract was added.

## Minimum acceptance after correction

Fix P1 with an independent intent debounce and its cross-lane mutation proof;
fix P2's arm-relative lifetime and add the missing send/lifecycle/security
rows. Re-run extension check and the focused private extension suite after
exact restoration. Only then should the supervisor proceed to W10 primary and
`broken-link` 3/3 live acceptance. This review ran no commands that execute
tests or builds and makes no claim about browser behavior.
