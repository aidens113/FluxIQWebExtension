# Report: r3-frame-digest (worker)

## Outcome

Done.

## What changed and why

- `domain/src/runtime/llm-evidence/state-digest/state-digest.ts`: an element's `frameId` is now digested as `""` (top document) or `child:<rank>`, where rank is the element's frame's position among the distinct child frame ids carried by the capture's shown (non-hidden) elements, ascending. The raw browser frame id is never digested, because Chrome renumbers a child frame on reload (run `run-muwaobm2-882cadd9`: `[frame 10]`, `[frame 11]`, `[frame 12]` on the same page). Ranks are computed once per capture (`frameRanks`) over shown elements only, so a hidden element a search captured in another frame cannot shift ranks (keeps "search reads as look"). The exhaustive `Record` projections are unchanged in shape. Header "In" list now says how the frame is digested and why, citing the run. `STATE_DIGEST_VERSION` bumped `web-state.v3` -> `web-state.v4`, following the file's own convention that a projection change bumps the version so it does not read as a change of state.
- New `state-digest/tests/frame-identity.test.ts` (5 tests): renumbered single child frame digests the same; two child frames renumbered in order digest the same; controls split across two frames digest apart from the same controls in one frame; top-to-child move changes the digest; top-document page unaffected by child frame numbering.
- `state-digest/tests/state-digest.test.ts` and `call-state-digests.test.ts`: version regexes `/^web-state\.v3/` -> `/^web-state\.v4/` (the only tests pinning digest values; grep of domain/src, apps/extension/src, packages, scripts found no other).

## Commands run and observed results

- Fail-first: `node <scratchpad>/tools/run-subset.mjs "<abs>/domain" r3-frame-digest src/runtime/llm-evidence/state-digest/tests/frame-identity.test.ts` then `node --test <bundle>` before the fix -> `# pass 2 # fail 3` (tests 1, 2, 5 failed as expected).
- After fix, subset of frame-identity, state-digest, hidden-elements, call-state-digests, call-route-states (state-digest/tests), `llm-evidence/tests/layers.test.ts`, `llm-evidence/structure/tests/detect.test.ts` -> `# tests 69 # pass 69 # fail 0`. (Before the version-regex update, 8 failures were all the v3 regex pins.)
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> exit 0 (core-build current; domain:check built).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (170 warning(s), 118 baselined).` exit 0; no warning for state-digest.
- `pnpm.cmd --filter @fluxiq-web-extension/domain build` -> exit 0.

## Not verified

- No live run, Lab, or browser check (forbidden by the shared rules).
- Core's `evidence-loop-tool-failure.test.ts` uses literal `web-state.v2:` strings as opaque fixtures; not touched (Core out of scope) and not affected, since Core treats digests as opaque.
- Whole domain suite not run (narrow checks per the rules).

## Open questions or contradictions found

- Version bump means preconditions stored by existing Flows under `web-state.v3` no longer match. That is the file's stated convention, but the supervisor may prefer to keep v3 if stored Flows on the lane trees must keep replaying with digest preconditions; revert is a one-line change plus two test regexes.
- Ranking is per capture: if a page gains or loses an earlier child frame, later frames' ranks shift. That is a real page change, so a digest change is correct there.
