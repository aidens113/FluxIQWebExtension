# Brief t1052: the Lab's frame-origin proof survives the store changing; the attempt lane never probes 3000

**Goal.** Fix the Lab defect behind scripted run `run-mwwwr1ty-d36c4ce1` (company-website-saturday-certificate).
The cause, its evidence and an offline reproduction are in `docs/working/page-diff-delivery-plan/reports/scripted-round-diagnosis.md`,
"1.". Read that section first.
- **What happened.**
  - `packages/test-runner/src/lab-control/frame-origin-proof.ts:29` caches the main Scenario Lab server's whole
    health reply at the first check. Line 31 requires every later origin's reply to equal it.
  - That reply carries the store's counters (`mutationSequence`, `resetGeneration`), which change whenever the
    site changes.
  - The attempt lane opens the extension panel with no `addresses` (`attempt-lane/live/attempt/session.ts:82`). So
    the panel probes the default `127.0.0.1:3000`, and that probe takes the cached copy at session open.
  - The cookie press then changed the store. The booking widget's frame server failed the proof, its frame was
    blocked, and `network-guard.ts:114` kept that failure for the session. Nothing in the attempt report showed it.

**Do.**
1. `frame-origin-proof.ts`: prove "the same Scenario Lab instance" by its stable identity,
   `provenance.ownerEpoch` (`state-store.ts:12`), never by counters that move with the site.
   - A server with a different owner epoch, a non-Lab server, or an unreadable reply is still refused. The proof
     keeps its purpose.
   - Keep its caching only for what is stable.
2. `attempt-lane/live/attempt/session.ts`: pass the run's `addresses` when the panel opens, as
   `run-chat-check.ts:130` does, so the panel never probes an address the run did not give it.
3. The attempt report names the network guard's violations (`guard.violations()`): a blocked frame or request is
   never silent again. Use plain words, and never expose page data, tokens or cookies.
4. `scripted-model/scripts/company-website-apprentices.ts`: give it the attempt-note guard that
   `company-website-saturday-certificate.ts:94-95` has, so a stray decision is refused where it strays, not at the
   script's last request.

**Proof.**
- Unit tests:
  - the proof holds when the store's counters change between checks;
  - it refuses a different owner epoch;
  - the session passes `addresses`;
  - the report carries violations.
- Then the scripted run: `FLUXIQ_LAB_INSTANCE=t1052-lab node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run
  t1052-saturday -- pnpm lab attempt company-website --task company-website-saturday-certificate --authoring-mode
  answer-first --scripted-model --attempts 4`. Run it headed; the watcher runs by itself.
  - Attempt 1 must reach the Wrenfield branch, give the right answer, and show no guard violations.
  - Attempts 2 to 4 may still be held by a separate Core defect that task t1053 is fixing: passed-over cover steps
    read as evidence gaps. Report what they did; do not fix that here.

**Owned paths.** `packages/test-runner/src/lab-control/frame-origin-proof.ts`, `.../network-guard.ts` (only to
expose violations), `attempt-lane/live/attempt/session.ts`, the attempt report writer, the apprentices script, and
the tests beside each.
**Must not touch.** Core, `domain/`, `apps/extension/`, the other scripted scripts. No git, no paid runs, no `node -e`.

**Checks.**
- `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1052-runner -- pnpm --filter @fluxiq-web-extension/test-runner test` -> 0 failures.
- `pnpm --filter @fluxiq-web-extension/test-runner check`.
- `node scripts/structure-audit.mjs`.

Work in `C:/Users/osrs_/FluxStuff/fxwork/t1052-lab-frame-origin-proof`.
**Report.** `docs/working/page-diff-delivery-plan/reports/t1052.md`, ending with the return contract.
