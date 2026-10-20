# t737 unit 2: shown-addresses past Core's 64 KiB value bound

## Outcome

Done. The defect sits in the domain, not Core. The stored copy of `web.shown-addresses` now stays inside Core's per-value bound by keeping only the newest entries, under a documented rule. Core was not edited.

## What changed and why

**Owner.** Core sets its bounds in `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/limits.ts`: `maxValueBytes` 64 KiB, `maxScopeBytes` 256 KiB shared by every key in one build scope, and `maxKeysPerScope` 64. `document.ts` `put` throws `domain_build_state.value_too_large` when a value exceeds the per-value bound. The domain's `build-state/persistence.ts` catches that error and does nothing more, which is best-effort by design. So once a build's set passed 64 KiB, every later write was refused, and after a restart the host had only the last copy that fit. The domain was the right place to fix it.

**Reproduced.** The new over-limit test (two synthetic pages of 600 long links each, then a restart) failed against the old encoding: links from the newer page were refused after the restart. The test for a page the build returns to also failed.

**Rule chosen: a bounded copy, not chunking.**
- **What forgetting costs.** The set is used only to *refuse* navigations to addresses the build was not shown. If an old address is forgotten, a navigation is refused; nothing is wrongly allowed. The refusal tells the model to use a link from the packet, and that packet is then remembered again.
- **Why not chunking.** Splitting the set over several keys would not get past the 256 KiB scope bound. That scope is shared with `web.arrival`, `web.held-literals`, `web.own-layers` and every side-by-side brief's keys. A big chunked set would make Core refuse those correctness-critical writes as `scope_full`.
- **The rule.** The process itself still forgets nothing. Only the stored copy is bounded, to `STORED_BYTES` = 3/4 of `maxValueBytes` (48 KiB). It keeps every typed text it can, newest first, then the most recently shown addresses. The stored shape is unchanged: addresses run oldest to newest, typed texts newest first. An address shown again moves to the newest position (`keep` now deletes, then sets). A page's own location is now remembered after its links, so the bounded copy keeps that page before its links.
- **Where it is documented.** The header of `shown-addresses.ts` ("What the stored copy keeps") and `docs/architecture/build-loop.md` ("What A Build Remembers").

**Files.**
- `domain/src/runtime/llm-evidence/node-run/build-state/stored-prefix.ts` (new): `webNodeStoredPrefix(entries, budget)` returns the longest leading run of entries whose serialized list is at most `budget` UTF-8 bytes, counted the way Core counts them. It is exported from the `build-state/index.ts` barrel.
- `domain/src/runtime/llm-evidence/node-run/shown-addresses.ts`: the bounded `encoded`, recency in `keep`, the location remembered last in `saw`, and the header text.
- `domain/src/runtime/llm-evidence/node-run/build-state/tests/stored-prefix.test.ts` (new) covers:
  - a list kept whole;
  - the exact-budget edge, and one byte under it;
  - UTF-8 counting;
  - a budget too small for anything.
- `domain/src/runtime/llm-evidence/node-run/tests/shown-addresses.test.ts`: three tests appended through Core's real in-memory store:
  - an ordinary case, stored exactly in the old shape and read back;
  - an over-limit round trip: the stored copy is ≤ 48 KiB, the newest links, the page and the typed search survive, and the oldest are refused;
  - a re-shown address that is kept.

  I appended them rather than adding a new file because a new file took `node-run/tests/` to 26 files, past the audit's 25-file hard limit.
- `docs/architecture/build-loop.md`: the persistence paragraph is updated.

## Commands run and observed results

All run from `C:/Users/osrs_/FluxStuff/fxwork/t737/!FluxIQWebExtension`.
- `DOMAIN_TEST_BUILD_LABEL=t737-u2 node scripts/test-domain.mjs src/runtime/llm-evidence/node-run/tests/shown-addresses-stored.test.ts` (from domain/, before the fix, when the tests were a separate file): pass 1, fail 2. This is the reproduction.
- `DOMAIN_TEST_BUILD_LABEL=t737-u2 node scripts/test-domain.mjs src/runtime/llm-evidence/node-run/build-state/tests`: tests 9, pass 9, fail 0.
- `DOMAIN_TEST_BUILD_LABEL=t737-u2 node scripts/test-domain.mjs src/runtime/llm-evidence/node-run/tests` (after the merge into shown-addresses.test.ts): tests 254, pass 254, fail 0.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (domain/): both exit 0. I did not use `pnpm check` because it runs a Core build.
- `node scripts/structure-audit.mjs`: "passed (211 warning(s), 618 baselined)". `node-run/tests/` sits at 25 files, which is the hard limit, with an advisory warning.

## Not verified

- I did not run the full domain suite or any other test directories, as the brief asked. Other callers (`tools.ts`, `run.ts`) are unchanged and were not re-tested beyond the node-run folder.
- No live restart test.
- I did not check the scope-level budget when many briefs run side by side. Each brief's shown-addresses key can take up to 48 KiB, so five or more briefs on one build could still fill the 256 KiB scope.

## Open questions or contradictions found

- **Order is saved only when something new arrives.** A packet that re-shows only known addresses changes the in-process order without a write, because `changing` detects change by set size. The stored order catches up on the next write that adds something. I chose this to avoid a write on every packet.
- **The scope bound is shared.** The 256 KiB scope is shared by all memories and briefs, with no per-memory allocation. If several memories or briefs can grow, a scope-wide budget might belong in `build-state/memory.ts`. That is a design question for the supervisor.
- **`node-run/tests/` is full.** It is at the 25-file hard limit, so the next new test there must group files into a feature subfolder.
- `docs/architecture/build-loop.md` previously called the refused write the expected behaviour for this exact case. That text has been replaced.
