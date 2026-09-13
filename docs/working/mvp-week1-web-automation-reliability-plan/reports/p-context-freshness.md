# p-context-freshness

Worker report. Task: establish whether Core really refuses the ordinary
extension-initiated recording start because the Automation Studio context is
stamped only on mount, focus, and visibility-to-visible while the freshness
window is 10 s — and if so, fix it, choosing the mechanism deliberately.

## Outcome

**Done. The reading in `p-recording-latch` open question 1 is correct, and it
understated the problem.** The stale refusal is not an edge case: with the
listeners as they were, an extension-initiated start succeeded only if the
operator had touched the Studio tab within the previous ten seconds, which the
ordinary flow never does. Fixed in Core `apps/web`.

The defect is also dated and attributable. It is a regression from
**b891e67, 2026-08-27**, and the evidence is in this repository's own test
harness as well as in Core's history.

Validation: Core `pnpm docs:check`, `pnpm build`, `pnpm package:lint` each exit
0. `pnpm check` and `pnpm test` each exit 1 on pre-existing failures from
another worker's in-flight Core edits, detailed and attributed below; every
part of them that covers my change passes — `pnpm -r check` exit 0, the
structure audit clean on my files, and the whole `apps/web` suite 1156/1156.

**Not proven live.** I cannot run the extension against Core. See "Not
verified".

## The finding: a 10 s window outlived the 3 s heartbeat it was sized for

`resolveClientRecordingProject`
(`F:\!FluxIQ\apps\web\src\lib\automation-studio-context.ts`) accepts
`client.start_recording` only while `now - context.updatedAt < freshnessMs`,
and `freshnessMs` defaulted to `10_000`. The context is written by exactly one
caller — `POST /api/client-gateway/automation-studio-context`, whose only
product-path client is the Studio page. I verified that by grep across Core:
no other route writes it, and there is no `setInterval`, `EventSource`, or
`WebSocket` anywhere in `apps/web/src` that could refresh it.

The publication used to be a heartbeat. Before b891e67 the Studio ran

```ts
const interval = window.setInterval(() => { if (!cancelled) void publishContext(); }, 3_000);
```

unconditionally, foreground or background. Against a 3 s beat, a 10 s window
means "two missed beats and you are gone" — a sensible liveness test. The
window was added on 2026-08-06 (6368574), while that heartbeat existed.

b891e67 ("Ton of optimization and overhaul of data flow…", 2026-08-27) removed
the heartbeat under Phase 10's exit gate, *"idle Studio does no application
polling"*. Its ledger line claims it replaced the heartbeat "while preserving
the freshness safeguard". It preserved the number and destroyed the thing that
satisfied it. Nothing was left that could speak for a backgrounded Studio, and
the guard rails added in the same commit — a source test asserting the bridge
contains no heartbeat, and a later one asserting no `pointerdown`/`keydown`
listeners — locked the event-only shape in place.

So the real sequence produced this: the operator opens Studio (stamp), picks a
project (stamp), works for a while (**no stamp — a click inside the page fires
no `focus`**), switches to the tab they want to record (**no stamp — the hidden
branch was explicitly skipped**), spends thirty seconds getting to the right
screen, presses Record. Core measures the age from whenever they last *focused*
the tab, often minutes earlier, and refuses. It is worse than the open question
supposed: the clock is not even reset at switch-away.

### The harness had already written the diagnosis down

`packages/test-runner/src/run-scenario.ts:251-260` in this repository:

> Core accepts `client.start_recording` only while the approving operator's
> Automation Studio context is under 10 s old … The extension clears its
> pending start on that error, so its own 750 ms local fallback never fires and
> the recording stays idle for good — **no poll length can recover it**.
> Restamping the context here makes acceptance depend on this call instead of
> on how long startup happened to take.

The automated lane does not hit the bug because it restamps over authenticated
HTTP immediately before the start. That workaround is evidence about the
product path, and it is also the reason the option below called "refresh on
demand" is not available to the extension.

## What the 10 s was protecting, and why lengthening it is legitimate

I did not treat the number as a tuning knob. Its purpose is written down, in
`docs/working/codebase-audit-remediation-plan.md` point 4, "Scope Automation
Studio context":

> Context freshness remains bounded so a closed/stale browser cannot keep
> redirecting future recordings.

That is a **liveness bound on the approving page**, not an expiry on an
operator's approval. Who may start a recording is settled elsewhere and is
untouched by this change: pairing and trusted-client credentials, the operator
identity carried on the gateway session, and the `runtime.control` permission
on the endpoint that stamps the context. All the timestamp decides is whether a
Studio page is still there with that project open. The failure it prevents is
misrouting a recording into a project whose browser has gone, and the operator
in that scenario is the same person recording their own browsing into their own
project.

That distinction is what makes the fix a design change rather than a weakening.
The bound must distinguish *backgrounded but alive* from *closed*. A timestamp
alone cannot; the removed heartbeat could; nothing that survived b891e67 can.

## The three mechanisms, and what each costs

**A heartbeat while Studio is open — rejected, and not merely on cost.** It
would restore the pre-b891e67 signal, and it does burn work when nobody is
recording, which is what Phase 10 set out to remove. But the decisive objection
is that it cannot work in the one case that is broken: browsers throttle timers
in a hidden page to roughly once a second, and to **once per minute** once the
page has been hidden for a few minutes. A heartbeat aimed at a 10 s window is
unreliable in a background tab and useless in a long-backgrounded one. The
mechanism fails exactly where it is needed.

**Refresh on demand — rejected as unavailable, and undesirable if it were.**
Core has no push channel to the Studio page: no `EventSource`, no WebSocket,
nothing but the page's own fetches, so Core cannot ask a backgrounded Studio to
restamp. What the test harness does is not this: it authenticates as the
operator over HTTP and moves the context itself. Giving the extension that
ability would let a paired client change which project the operator's
recordings land in, which is a real privilege change, not a refresh.

**A longer window, re-founded on a signal that distinguishes closed from
backgrounded — chosen.** Three parts, and the third is what makes the first
honest:

1. **Publish on `visibilitychange` in both directions.** Hiding is the operator
   leaving Studio for the page they mean to record, and it is the last thing
   the page will say until they come back. Stamping on the way out makes the
   window measure *the excursion* rather than measuring from whenever the
   operator last happened to click on the Studio tab. This is the half that
   makes any window length comprehensible.
2. **Revoke on `pagehide` with `navigator.sendBeacon`.** The old code cleared
   the context in a React cleanup, which does not run when a tab is closed, and
   used a `fetch` that can be torn down with the page even when it does. A
   beacon is handed to the browser to deliver independently. **A clean close now
   revokes faster than before**, so on that path the change strengthens the
   documented protection rather than weakening it.
3. **Lease of five minutes** (`AUTOMATION_STUDIO_CONTEXT_LEASE_MS`), replacing
   the 10 s. With (2) in place it covers only a Studio that died *without saying
   goodbye* — a crash, a kill, a lost machine — and it has to cover the whole
   excursion: opening the target site, signing in, reaching the right screen,
   pressing Record.

**What it costs, stated plainly.** For an uncleanly dead Studio the misrouting
window grows from 10 s to 5 minutes. That is the whole price, and it is the one
dial the user may want to turn; the constant is exported and documented in one
place. I did not stop for a decision on it because the *purpose* was documented
and unambiguous and the change preserves it, but the number itself is a
judgement I am flagging rather than burying.

One ordering hazard came with the design and is handled. A closing tab is
hidden and then says goodbye in the same task, so the hide-stamp could land
*after* the revoke and resurrect a dead Studio for a full lease — precisely
what the lease exists to prevent. The hide-stamp is therefore deferred by one
task, so the `pagehide` that follows cancels it, and the revoke is not sent
through `keepalive`-marked publishing that would outlive the page. A test
drives both events in one task and asserts the context stays revoked.

## What changed and why

Five files in Core `apps/web`, one of them new. Nothing in
`packages/fluxiq/**`, nothing in the fingerprinting area, nothing in this
repository except this report.

**New — `apps/web/src/features/automation-studio/live/gateway-context-publication.ts`.**
`observeAutomationStudioGatewayContext({ window, document, publisher })` owns
*when* the page speaks; the hook owns *how*. Extracted rather than left inline
so the sequence can be tested without a DOM: the module takes narrow
`addEventListener`/`setTimeout` shapes that both the real `window` and a fake
satisfy. Listeners: `focus` (stamp only when visible, unchanged),
`visibilitychange` (stamp when visible; deferred stamp when hidden),
`pageshow` (stamp, for a bfcache restore), `pagehide` (revoke by beacon, and
suppress every later stamp). Teardown revokes by ordinary request. No timer, no
pointer or keyboard listener.

**Edited — `live/hooks/useGatewayRecordingBridge.ts`.** The first effect now
delegates to that observer and supplies the two transports. Behaviour otherwise
unchanged; the second and later effects are untouched.

**Edited — `apps/web/src/lib/automation-studio-context.ts`.** Adds the exported
`AUTOMATION_STUDIO_CONTEXT_LEASE_MS = 300_000` as the default `freshnessMs`,
with the reasoning above in the doc comment, including the b891e67 provenance,
so the next person to read the number learns what it bounds before changing it.
No change to the resolver's logic or to either refusal code, so the
classification `p-recording-latch` built downstream still holds exactly: a
`recording.project_required` naming an `activeProjectId` is still the transient
lapsed-context case, and a null one is still nobody having opened a project.

**Edited — `live/tests/automation-studio-live-ownership.test.ts`.** The guard
"publishes gateway context only on project, focus, and visibility changes"
became "…, visibility, and page lifecycle". It still forbids `pointerdown`,
`keydown`, and now `setInterval`, across both the hook and the new module, so
the property b891e67 was protecting stays protected.

**Edited — `apps/web/src/lib/tests/automation-studio-context.test.ts`.** One
assertion pinned the 10 s window by a literal `10_301`; it now expresses the
same intent against the lease constant. A second test was added covering the
boundary in both directions and the cleared-context refusal. I want to be
explicit that I changed an assertion that was failing: it pinned the defect, and
the new tests below fail without the fix, so the suite did not become weaker.

**Documentation.** `docs/integrations/client-gateway-websocket.md` still said
the panel "heartbeats" the project — stale since b891e67 — and now describes
the real publication events, the lease, what it does and does not bound, the
beacon revoke, and how the refusal metadata separates the two cases.
`docs/architecture/automation-studio/client-gateway.md` gained the same in
brief on its `client.start_recording` bullet.

## Commands run and observed results

Exit statuses by redirect to a scratchpad file and `echo $?`, never through a
pipe. No `pnpm lab` command and no build in `F:\!FluxIQWebExtension`.

1. **`pnpm --filter @fluxiq/web exec tsc --noEmit` → exit 0**, no output.
2. **`pnpm --filter @fluxiq/web test -- --no-file-parallelism` → exit 0**,
   `Test Files 228 passed (228)`, `Tests 1156 passed (1156)`.
3. **`pnpm -r check` → exit 0** — all four packages, `contracts`,
   `client-gateway-websocket`, `fluxiq`, `web`, each "Done".
4. **`pnpm structure:test` → exit 0**, `# fail 0`.
5. **`pnpm docs:check` → exit 0**, "Validated local links in 99
   authored/reference Markdown files. Deterministic framework reference is
   current."
6. **`pnpm build` → exit 0**, full Next.js route table emitted.
7. **`pnpm package:lint` → exit 0**, publint and attw green for all three
   packages.
8. **`pnpm check` → exit 1**, one violation, **not mine**:
   `FAIL [working-docs] docs/working/README.md is out of date with the
   documents' header blocks.` Isolated with
   `pnpm structure:check --rule working-docs` (exit 1, same single line). That
   rule reads only `docs/working`, where `git status` shows two files modified
   by the concurrent Core work — `README.md` and
   `mvp-week1-web-automation-reliability-plan.md`. My change set contains no
   file under `docs/working`, so the rule's inputs do not include anything I
   touched. `pnpm check` runs the audit before the type checks, so item 3 is the
   part of that gate covering my change, and it passes. The audit named none of
   my files in any finding (grepped for all three paths: no match).
9. **`pnpm -r test -- --no-file-parallelism` → exit 1**, three failures, **not
   mine**, all in
   `packages/fluxiq/src/programs/automation-studio/runtime/tests/service.test.ts`
   under "recording persistence": `expected [ Array(1) ] to deeply equal []`,
   `expected 'Recording recording.mapper-miss has n…' to contain 'saw 1
   entries…'`, and an `EPERM: operation not permitted, rmdir …\derived`.
   `git diff` shows a concurrent worker mid-flight adding
   `openRecordingProposalNotice(recording).issues` into proposal issues in
   `runtime/service.ts` — which is exactly what the first two assertions are
   about — and the third is Windows file locking. `packages/fluxiq` totals
   `845 passed, 3 failed`; `pnpm -r` stops at the first failing package, which
   is why item 2 was run separately.

### The new tests, and both halves of the fix failing without it

Nine tests in
`apps/web/src/features/automation-studio/live/tests/gateway-context-publication.test.ts`.
They are not listener assertions: the harness wires the real
`setAutomationStudioContext` to the observer's publisher and asks the real
`resolveClientRecordingProject` what Core would answer, so each test states what
an operator's sequence produces.

The brief's sequence is the first one, "accepts the ordinary
extension-initiated start: leave Studio, find the page, press Record": 45 s of
Studio work with no focus event, switch away, 32 s excursion, press Record →
`{ ok: true, projectId: "project.alpha" }`.

Both halves of the fix are load-bearing, shown by reverting each alone and
re-running that file:

- **Lease reverted to `10_000`, switch-away stamp kept** → **exit 1**,
  `Tests 2 failed | 7 passed (9)`:
  `× accepts the ordinary extension-initiated start: leave Studio, find the page, press Record → expected { ok: false, …(3) } to deeply equal { Object (ok, projectId) }`
  and `× recovers a lapsed lease when the operator returns to the Studio tab`.
- **Switch-away stamp removed, lease kept at `300_000`** → **exit 1**,
  `Tests 2 failed | 7 passed (9)`:
  `× accepts the ordinary extension-initiated start … → expected +0 to be 45000`
  and `× stamps on the way out, so the lease measures the excursion and not the
  last click on Studio → expected +0 to be 600000`.

Both reverts were undone immediately and the full suite re-run (item 2). The
other seven tests: the same sequence still refused at the old 10 s window
(pinning the regression permanently); a 10-minute idle before switching away
still accepted; a tab close revoking by beacon inside the lease; the
hide-then-close race leaving the context revoked; the lease still ending for a
Studio that died silently; recovery when the operator returns to the tab; focus
while hidden not stamping; and an ordinary project change revoking by request
rather than beacon.

## Not verified

- **The real operator sequence is unproven.** No browser, no extension, no
  running Core. Everything above about the product path is derived from the
  source, Core's git history, and the harness comment. What would prove it: load
  the unpacked extension, open Automation Studio with a project, pair, switch to
  another tab, wait a minute or more, press Record in the side panel, and
  confirm the recording starts and lands in that project — then repeat past five
  minutes and confirm the refusal still arrives and still names the project.
- **`navigator.sendBeacon` on the close path is untested against a browser.**
  The unit tests assert the observer asks for a beacon; nothing verified that a
  real closing tab delivers it, that the route accepts a `Blob`-bodied beacon
  (`Request.json()` ignores content type, and the beacon carries the
  same-origin session cookie, so it should), or that a beacon is not blocked by
  a stricter deployment policy. The fallback if it fails is a `fetch` that may
  not survive teardown, in which case the context waits out the lease — the
  pre-change behaviour, only longer. **This is the piece most worth exercising
  live**, because it is what pays for the longer lease.
- **The hide-before-close ordering** is asserted against my own model of the
  unload sequence, not against a browser. If some browser dispatches `pagehide`
  before `visibilitychange`, the flag is set first and the outcome is the same;
  if one dispatches neither, the lease is the backstop.
- **bfcache restore** (`pageshow`) is untested in a browser.
- **Multiple Studio tabs for one operator** share the context key
  `operator:*`, so the last event from any tab wins and one tab's close revokes
  for all of them. That is pre-existing and unchanged by this work, but the
  longer lease makes the window in which it is observable longer.
- **The 5-minute value is a judgement, not a measurement.** No data on how long
  a real operator takes between leaving Studio and pressing Record.

## Open questions or contradictions found

1. **The number is the user's to confirm.** The purpose of the bound was
   documented, so I did not stop; the length was not. Five minutes covers the
   excursion and caps an uncleanly dead Studio's misrouting at five minutes. If
   that trade is wrong, the constant is the only place to change, and making it
   an environment variable would be a small addition if a deployment ever wants
   it shorter.
2. **The downstream retry's premise is now true, and its bound is probably too
   short.** `p-recording-latch` retries a transient refusal over about four
   seconds. Before this change nothing could restamp within that window, so the
   retry could only help an operator who happened to click back to the Studio
   tab immediately. After it, the ordinary start no longer refuses at all, and
   the retry becomes a genuine safety net for the boundary case. But the case it
   still cannot recover — a lease that has actually lapsed — needs the operator
   to visit the Studio tab, which will rarely happen inside four seconds. The
   refusal message asking them to do that is now the load-bearing part, and it
   is worth checking that the panel wording says *return to Automation Studio*
   rather than *open a project*, because for a lapsed context a project is
   already open. I did not change the extension, so this is a note for whoever
   owns that string.
3. **A pre-existing race in the same effect, left alone.** When the project or
   flow changes, React runs the cleanup — which now revokes — and then the new
   effect, which stamps. Two requests are issued back to back with no ordering
   guarantee, so a `null` revoke can land after the new project's stamp and
   silently clear it. It behaves the same as before my change (the old code did
   the same with two `fetch` calls), the recovery is the next focus or
   visibility change, and fixing it properly wants a per-page sequence number on
   the context that the route enforces. I judged that outside this brief and
   flag it rather than leaving it undiscovered.
4. **Core's tree was not clean while I worked in it.** Another worker has
   in-flight edits to `packages/fluxiq/src/programs/automation-studio/{runtime,
   client-gateway}`, `scripts/structure-audit/config.mjs`, `AGENTS.md`, and two
   working documents. Those are the source of both gate failures above. No file
   overlaps mine, so there was no collision, but the supervisor should re-run
   `pnpm check` and `pnpm test` after that work lands rather than treating my
   two non-zero exits as settled.
