# t271-d-route-states: D phase 1 (shared instruction read, route states)

Worker: t271-d-route-states. Date: 2026-10-05. Trees: `fxwork/t271/!FluxIQ` (Core), `fxwork/t271/!FluxIQWebExtension` (downstream; only this report changed). Nothing is committed.

## Outcome

Done for D phase 1 as the t269 brief S4 scopes it:

- one shared, lazy instruction read;
- `unread`, `named`, `open` and `unavailable` route states;
- grounded consequence permissions are kept when the route is invalid.

Phase 1 adds preparation only. No code consumes the route yet. It does not protect a named route, so D is not closed. The old t195 URL scan, fail-open path and blanket companion withholding were not ported. No t264-owned file was touched.

## What changed and why

Core, `R = packages/fluxiq/src/programs/automation-studio/runtime/`:

- **`R/action-permissions/instruction-quote/`** (new: `comparable.ts`, `mapped.ts`, `index.ts`, `tests/mapped.test.ts`)
  - `comparable.ts`: the permission read's `comparable()`, moved out of `instructed.ts` unchanged and exported as `automationStudioComparableInstructionText`.
  - `mapped.ts`: the same comparison, built one code point at a time. Each compared unit keeps the original UTF-16 interval it came from, and spans are half-open. If the map does not reproduce the comparison text exactly, it returns `undefined`. The context-dependent final capital sigma is one such case and is tested. Compared indices are never reused as original offsets.
- **`R/action-permissions/instruction-route/`** (new: `reading.ts`, `schema.ts`, `read.ts`, `set-digest.ts`, `current.ts`, `index.ts`, `tests/read.test.ts`)
  - `reading.ts`: the closed union `unread | open{instructionSetDigest} | named{instructionSetDigest, routeId, instructionId, instructionDigest, quote, sourceSpan, waypoints[{id, order, instructionId, instructionDigest, quote, sourceSpan}]} | unavailable{reason, instructionSetDigest?}`. The reasons are `transport`, `non_complete`, `malformed`, `ungrounded`, `ambiguous` and `stale`.
  - `schema.ts`: the model answers `kind` (`named`, `open` or `unclear`). For `named` it also gives `instructionId`, the whole-route `quote` and the ordered `waypoints` (at most 20). The model never supplies ids, offsets, digests or proof.
  - `read.ts` (grounding):
    - Only an explicit `open` counts as open.
    - `unclear` becomes `ambiguous`.
    - A missing route, a route of the wrong shape, a missing id, empty or non-string waypoints, more than 20 waypoints, or the same place listed twice becomes `malformed`.
    - An unknown or inactive instruction, or words not found, becomes `ungrounded`.
    - The route quote must occur exactly once in the named instruction. Each waypoint must occur exactly once inside the route's own span. Otherwise the result is `ambiguous`.
    - Quotes stored are the raw slice of the person's words.
    - There is no 300-character bound on a route quote.
    - Core generates IDs from sha256 of the instruction id, its digest and the span(s). The route ID also covers the ordered waypoint IDs.
  - `set-digest.ts`: an order-independent digest of every active instruction's id and digest.
  - `current.ts`: once that set changes, `named` or `open` becomes `unavailable/stale` (keeping the old set digest). Nothing is read again.
- **`R/action-permissions/instruction-reading/`** (new: `schema.ts`, `read.ts`, `index.ts`, `tests/reading.test.ts`)
  - `automationStudioInstructionReadingSchema(acts)` is the existing consequence completion plus a required `route`. The public `AUTOMATION_STUDIO_INSTRUCTED_CONSEQUENCES_SCHEMA` is unchanged.
  - `readAutomationStudioInstructionReading` reads the two halves independently.
- **`R/action-permissions/instructed.ts`**: imports the moved `comparable` and has no other change. **`R/action-permissions/index.ts`**: exports the three new barrels.
- **`R/service/instruction-authority.ts`**:
  - It now returns `{ derive, route: { read, peek }, usage }`.
  - There is one memoized promise, assigned before anything awaits it. It always resolves, to either `{answer}` or `{failed}`.
  - `derive` re-throws a thrown failure, so the gate's UNKNOWN-on-rejection behaviour is preserved. A returned `!ok` or a non-completed answer still gives the legacy unanswered read.
  - `route.read` turns a thrown failure into `transport` and a non-complete answer into `non_complete`. `peek` never sends anything and returns `unread` until the read settles.
  - Usage accounting is unchanged: it is added once per returned answer, and nothing is added after a throw.
  - The decision description now also asks whether the instructions name a route. The header comment documents all of this.
  - `service.ts` needed no rewiring: it already passes `creation.reading(runHarness)` and `authority.derive`.
- **`R/service/tests/instruction-authority.test.ts`**: 10 new cases.
- **Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`**: a new paragraph, "The same read answers the route the person names (D phase 1)".

## Commands run and observed results

All Core commands ran from `fxwork/t271/!FluxIQ` (vitest from `packages/fluxiq`).

1. **Fail-first**, with the new tests written before any source: `npx vitest run R/action-permissions/instruction-quote R/action-permissions/instruction-route R/action-permissions/instruction-reading R/service/tests/instruction-authority.test.ts`
   - Result: `Test Files 4 failed (4); Tests 10 failed | 11 passed (21)`.
   - Three suites failed to load (`Failed to load url ../index.ts`).
   - The 10 authority cases failed on `Cannot read properties of undefined (reading 'read'/'peek')` and `expected [ 'instructed' ] to deeply equal [ 'acts', 'instructed', 'route' ]`.
2. **After the source changes**, the same files: `Tests 1 failed | 69 passed (70)`. The one failure came from my fixture: "Deals" also occurs in "Flash deals", so grounding correctly answered `ambiguous`. I renamed the fixture waypoint to "Offers".
3. **Narrow union**: `npx vitest run R/action-permissions R/service/tests/instruction-authority.test.ts R/service/flow-bootstrap-commands R/flow-bootstrap/tests/action-permissions.test.ts R/tests/service-authoring/tests/{build-call-admission,confirm-requests-build,quantity-arrival-build,retained-rerun-feedback}.test.ts R/tests/service-bootstrap/tests/judged-build.test.ts`
   - Result: `Test Files 21 passed (21); Tests 236 passed (236)`.
   - This includes the existing `instructed.test.ts`, `gate.test.ts`, the creation-purse tests and the real-service tests that use `instructionAuthority`.
4. `node scripts/build-cache/cli.mjs fluxiq:check` → exit 0 (run again after the last test edit, still exit 0).
5. `node scripts/structure-audit.mjs`
   - The first run failed: `[contract-spread] action-permissions/instruction-route/tests/read.test.ts line 25`, a conditional spread in a test helper. I fixed it.
   - It then passed: `structure-audit: passed (249 warning(s), 349 baselined)`.
6. `node scripts/structure-audit.mjs --rule docs-links` → `passed`.
7. `pnpm.cmd build` (Core) → exit 0.
8. Downstream: `pnpm.cmd --filter @fluxiq-web-extension/domain check` → exit 0 ("core-build: ... is current with its source"). No downstream source references the changed exports (checked with grep).
9. `node scripts/docs-reference.mjs --check` → fails with "docs/reference/framework-reference.md is stale". This was already stale before this change: it lists `readAutomationStudioInstructedConsequences` at `instructed.ts:104`, but at HEAD the function is near line 265. I did not regenerate it. It is not part of the narrow gate.

## Not verified

- I did not exercise a real provider refusal from the build purse (`readingRefused` set) through the shared read. The new purse test only shows that the real `creation.reading` wrapper is invoked once for concurrent `derive`, `route.read` and `derive`, and that `readingRefused` stays undefined.
- `peek()` returns `unread` while the one read is in flight. It does not report "pending".
- I have no evidence that a live model classifies routes well. Whether DeepSeek answers `named` / `open` sensibly is unmeasured; no provider call, Lab run or browser was used.
- I did not run the full Core suite or the downstream test and build steps.
- I did not run the extension check, because no extension or domain source changed.

## Open questions or contradictions found

- **Model-facing wording in t264-owned files.** Phase 1 needs none: nothing shows the route to the model or in the draft. Phase 4 should add the following, exactly as written:
  - In `R/llm/deepseek/request-body.ts`, the start note, when `route.peek()` is `named`: `The person named the route: <quote>. Follow it in that order: <waypoint quotes joined by ", then ">. Do not start deeper or skip a place on it.` When it is `open`: `The person named no route, so the Flow may start where the work begins.` When it is `unread` or `unavailable`, keep today's text and offer no shortcut, because an unavailable route is not open.
  - In `R/flow-draft/entry.ts` (authored draft header), when `named`: `Route the person named: <quote>`. Otherwise, nothing.
  - Both consumers must first pass the reading through `currentAutomationStudioInstructionRoute`.
- **Instruction ids.** The design requires `instructionId` for a named route; if the model omits it, the result is `malformed`. The model sees ids through `context.instructions`, but whether it copies them reliably is unmeasured. If live D shows `malformed` for that reason, the fallback is to find the quote uniquely across all active instructions. That is still unique-grounded and safe, but it needs a supervisor decision.
- **Legacy usage count.** As the preflight disclosed, `usage.calls` still counts a returned purse refusal (`not_attempted`) as one call. I preserved this and did not fix it.
- **Live proof.** Phase 1 alone has nothing to prove live. The D-lane named-route run (home, then Friends, then Friend requests) proves it only after phases 2-5 land. Phase 1 should then show in that run's step log exactly one `read`-phase call whose completion schema contains `route`, and a `named` reading.
