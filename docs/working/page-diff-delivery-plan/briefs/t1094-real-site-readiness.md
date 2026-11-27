# Brief t1094: a step waits for the page to be usable, not for a real site to go silent

**Goal.** On the user's own test (the web panel, the extension in Chrome, eldorado.gg), nearly every step sat for
20-40 s. Their step log (`FLUXIQ_LLM_STEP_LOG_DIR`) shows:
- an open-page step took 24 s: `page.navigate` 20,155 ms;
- another took 41 s: `send.navigate` 20,115 ms, then `look.after` / `send.capture_snapshot` 20,558 ms;
- `web.detect_repeating_structure` took 22 s and 42 s;
- model decisions took 2-4 s each.

Roughly 20 s each time is `waitForTabReady`'s deadline (`apps/extension/src/runtime/automation-tab.ts:386`). The same
deadline is `ADDRESS_SETTLE_DEADLINE_MS` (`content/action-runtime/page-work/address-settle.ts:33`).

The wait ends early only when "the page's own work" is done: every timer within the horizon, animation frame, fetch
and XHR (`runtime/navigation-events/page-work.ts`, `page-world/page-work/`, `content/.../page-quiet.ts`). The local
fixture sites go quiet. A real site never does: analytics beacons, ad refreshes, long polls, chat widgets and sockets.
So every wait runs to its deadline, and a wait that ends on its deadline "proves nothing", so the next action waits
again.

**The fix (root cause; never lower or remove the deadline as the fix).** Readiness is what the next step needs: the
document the step will act on, drawn and no longer changing.
- **DOM quiet.** A page is settled when its document has stopped changing for a short quiet window (mutations, layout
  of what is shown), after the navigation itself completed.
- **Network that changes nothing does not hold the page.** Requests and timers that cause no change to the document do
  not count, and recurring work never counts.
- **Network that changes the page does count.** Work that does change the document (a list fetched, then drawn) still
  holds it until the drawing is done.
- **What must not regress.** local-classifieds' timer-then-request panel and its sort that rewrites the address
  (t891, t893) must still be waited for: their DOM changes.
- **Keep the deadline**, only as the bound for a page that never stops changing. Say in the code why it is not the
  fix.

**Read first.**
- The header of `waitForTabReady` (`runtime/automation-tab.ts:340-380`) and its history.
- `content/action-runtime/page-work/`.
- `page-world/page-work/`.
- `docs/architecture/` sections on page work and readiness.

**Proof** (AGENTS.md: browser tests use only the ten realistic scenarios).
- Give one realistic scenario site the background traffic real sites have: a recurring analytics beacon and a long
  poll that never change the document. Name it in `docs/architecture/testing-facility.md`.
- Show that the old wait runs to its deadline there and the new one settles at once.
- Show that the t891 and t893 local-classifieds cases are still waited for.
- Also add unit tests for the settle rule.

**Owned.**
- `apps/extension/src/runtime/**`, `content/**` and `page-world/**`, with their tests.
- The one scenario fixture you choose, under `apps/scenario-lab/src/scenarios/<site>/`.
- `docs/architecture/testing-facility.md`, and the readiness section of the extension architecture doc.

**Must not touch.** Core, `domain/src/**`, `packages/test-runner/**`, and `apps/extension/src/panel/**` (the UI audit,
t1095).

**Checks** (in `C:/Users/osrs_/FluxStuff/fxwork/t1094-real-site-readiness`; put heavy commands through
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1094-<label> -- <cmd>`):
- `node apps/extension/scripts/test-extension.mjs content` and the tests beside each change;
- the content harness specs you add or touch: `node apps/extension/scripts/test-content.mjs -- <specs>`, run from
  `apps/extension`. 75 failures on dev are older; show yours are not among new ones;
- the extension typecheck (the package `check`);
- `node scripts/structure-audit.mjs`;
- one provider-free Lab run on a realistic task through the changed site, 4 attempts, reporting per-step times.

No `node -e`, no git, no live or paid runs. The user's panel runs on ports 3000 and 4777; leave them alone.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1094.md` in the worktree, ending with the return contract.
