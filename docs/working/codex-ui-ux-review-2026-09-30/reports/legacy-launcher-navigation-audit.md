# Legacy redirect and optional launcher history

Status: Complete read-only proposal (2026-10-01); implementation held until written release.
Worker: trace_endings
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ`

Read the current working state, exact brief, frozen auth-navigation reports, ProgramLauncher and its existing three tests, legacy domain-program route and available route tests. Current fourth-batch source freeze respected; changed only this report.

## Confirmed behavior

- `apps/web/src/app/ProgramLauncher.tsx:34` catches failures reading/parsing optional recent history. At line71, its click callback directly calls window.localStorage.setItem after updating in-memory recentHrefs, without a catch. Getter denial, SecurityError or quota failure therefore throws out of the Link onClick.
- Installed Next Link calls onClick before linkClicked/client navigation and has no surrounding catch (`apps/web/node_modules/next/dist/client/link.js:357`). Thus that optional write can interrupt the client navigation path. Native anchor fallback might still happen; no browser failure or fallback was exercised. The source-confirmed defect is an uncaught optional persistence exception, not a claim that every browser loses navigation.
- Existing `app/tests/ProgramLauncher.test.tsx` has three cases: compact searchable rows, loaded empty results and no eager route prefetch. None exercises storage/click behavior. All three cases and assertions must stay unchanged.
- `app/domains/[domainId]/programs/[programId]/page.tsx:5` currently receives params only and constructs a canonical program URL containing just the path-owned domainId. It loses project/flow/subflow/view/detail/start, unrelated keys, empty values and repeated entries before the canonical route can use them. There is no owning legacy route test in the current tree.
- New initial sign-in preserves the URL that actually reaches its inline gate. It cannot recover data already discarded by this earlier redirect. The alias fix and launcher write fix need no further AuthShell/session changes.

## Bounded proposed implementation

1. ProgramLauncher: wrap only the optional localStorage write in try/catch. Keep setRecentHrefs before that write, current six-entry/dedup behavior, Link href, default event semantics, keyboard navigation and prefetch=false. No new router call, preventDefault, warning dialog or persistent data owner. Recent-history failure must remain optional; in-memory grouping can continue to reflect explicit launches.
2. Legacy route: accept Next searchParams as a promised record of string/string[]/undefined. Resolve it with route params, build a fresh URLSearchParams, append scalar values and each repeated value in its per-key order, omit undefined, and force exactly one domainId from the path. Incoming conflicting/repeated query domainId has no authority. Keep a fixed local `/programs/${encodeURIComponent(programId)}` destination; external-looking returnTo/redirect/url values remain ordinary query data and must never select a destination. No backend or authentication lookup needed in this alias.

Next's server searchParams record cannot preserve the original byte encoding or interleaving between repeated different keys. The contract should preserve query values, multiplicity and order within each key, which is what canonical parsing needs. Do not promise byte-for-byte original URL serialization. Server code never receives the fragment; it cannot explicitly preserve or inspect an unseen hash. Actual browser redirect inheritance remains unverified; no new client redirect is proposed solely to handle it.

## Exact isolated ownership

| Unit | Product source | Owning tests |
| --- | --- | --- |
| Optional recent write | `apps/web/src/app/ProgramLauncher.tsx` | Existing `app/tests/ProgramLauncher.test.tsx`, add behavioral cases without replacing original three |
| Canonical legacy alias | `apps/web/src/app/domains/[domainId]/programs/[programId]/page.tsx` | New directly owning `tests/page.test.tsx` in that route directory |

These are two source files and two tests, independent of operational polling, AuthShell, clipboard and extension navigation. No helper module or barrel needed: each remains a small responsibility in its current owner. Do not edit navigation.ts, Studio query consumers, authentication, program catalog, other route gates, recents schema/key or shared documentation.

## Meaningful regressions

- Mount the actual launcher with isolated window/localStorage fakes. Preserve original rendering/empty/prefetch tests. Read denial/malformed JSON remains nonfatal. Click an actual Next Link row with a storage getter that throws, then a quota/security-throwing setItem; its custom callback must not throw, alter href or preventDefault. Exercise Next's router continuation with a focused router context or a narrow Link test adapter that delegates navigation only after the real callback returns. Do not infer actual browser navigation from a mock.
- Successful writes keep the same key, deduplicated newest-first values and six-entry bound. A failed write still updates the in-memory Recent section. A later explicit click remains usable after failure. Keep global/domain launch destinations and keyboard/prefetch behavior unchanged.
- Stub Next redirect to capture the actual route result. Empty query yields the existing canonical destination. Supply project/flow/subflow/view/detail/start/domain-independent keys; inspect URLSearchParams for exact values rather than relying on incidental encoding order. Include repeated keys, empty strings, undefined and encoded/non-ASCII values.
- Conflicting/repeated query domainId becomes exactly one path-owned domainId. External-looking program/domain identifiers are encoded into the fixed local path/query. An arbitrary external returnTo/redirect/url remains data, and parsed destination origin stays local.
- Alias route tests should not run an authentication/provider/backend operation. Full initial login tests remain in the independently frozen auth unit; no assertion change needed there. Real redirect hash/back/forward and optional-storage browser behavior require later browser certification.

Validation performed: read-only source/test inventory and installed Next event-order inspection. No product/test edits, tests/checks/builds/heavy commands, live/browser/provider/panel calls, shared docs, commits, merges or pushes. Report frozen; worker available for a subsequent bounded implementation brief.
