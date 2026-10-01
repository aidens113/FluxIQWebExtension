# Sign-in destination audit

Status: Complete read-only discovery and proposed bounded implementation (2026-10-01).
Worker: trace_endings
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ`

## Confirmed source findings

1. `apps/web/src/app/AuthShell.tsx:89` sends every successful password/TOTP sign-in to `/`; line132 does the same after successful temporary-password replacement. LoginPanel has no destination prop or local return-path reader. Its password, authenticator and credential-setup stages stay in one component, so retaining one validated requested destination across them needs no backend contract change.
2. `app/domains/[domainId]/page.tsx:10` already renders LoginPanel at the requested domain URL. Successful login still loses that domain because of the common hard-coded destination. Home similarly renders LoginPanel; its correct default destination is `/`.
3. `app/get-started/page.tsx:13`, `app/programs/[programId]/page.tsx:88` and `app/programs/automation-studio/page.tsx:13` redirect unauthenticated requests to `/` before rendering any sign-in component. Consequently program id, domainId, Studio project/flow/subflow/view/detail/start and setup scope disappear before the person enters credentials. There is no middleware or existing returnTo/returnPath/callbackUrl handling in the inspected app/lib paths.
4. `app/domains/[domainId]/programs/[programId]/page.tsx:5` redirects legacy domain-program URLs to `/programs/<id>?domainId=<id>` and discards every incoming query key. This is an independent earlier loss for a deep link entering through that alias, even when already authenticated. Fragment handling cannot be settled from server source because fragments are not sent to it; browser redirect behavior requires separate certification.
5. Authentication scope distinction: LoginPanel and `app/api/auth/login/route.ts:50` support username/password and optional TOTP, not PIN. `features/programs/components/overlays/AuthorizationDialog.tsx:28` supplies configured PIN and authenticator factors for privileged authorization within the existing workspace. A destination fix must preserve these existing factor contracts, not add PIN to session-login requests or conflate privileged authorization with login.
6. `app/session-reauthentication/SessionReauthentication.tsx:62` resolves the pending recovery and closes its dialog without assigning location. Existing mounted-session recovery therefore preserves path/query/workspace, including TOTP retry. Do not replace it with full-page login or change program-auth-recovery.ts. This audit concerns initial unauthenticated entry or a fresh navigation after session expiry.
7. `app/ProgramLauncher.tsx:71` catches optional recent-history reads but not writes. `remember` updates in-memory recents then directly calls localStorage.setItem. A denied/quota write throws from the Link onClick callback. Installed Next Link (`node_modules/next/dist/client/link.js:357`) calls that callback before its router navigation, without a catch: the throw interrupts its client navigation path. Native anchor fallback may still occur; a complete browser-navigation failure has not been reproduced and is not claimed. Optional recents must not throw into navigation.

## Recommended implementation

Prefer **inline sign-in gates at the requested route**, matching the existing domain gate. Return LoginPanel when unauthenticated in the three setup/program server pages rather than redirecting to home. Leave authenticated rendering, domain validation, program availability and not-found behavior unchanged. This retains the browser's path, complete query and fragment without a separate returnTo transport or reconstructing query arrays on the server. Studio's CSS-only layout simply returns children; no runtime needs to start for the login gate. RootLayout already excludes signed-in recovery/conversation/pairing hosts while unauthenticated.

Capture the requested local browser destination once when LoginPanel mounts and retain it through TOTP, retries, lockout and first credential setup. Validate it using a focused pure helper before successful full navigation. A full navigation remains useful because server components must see the new session cookie; use the validated local destination in both existing success branches. Do not store credentials or the destination in persistent storage or log query contents.

Validation contract: accept a string beginning with one `/`, preserve allowed path/query/hash bytes, reject network-path (`//`), absolute/protocol/javascript destinations, backslashes and control characters, and verify URL resolution remains on the same origin. Check ambiguous encoded leading separators/backslashes in the pathname so normalization cannot turn a supposed local path into an authority. Do not reject ordinary encoded query values such as a domain identifier. Fallback to `/` for invalid inputs. A supplied `returnTo` query is ordinary data and must not implicitly become authority; the recommended gate uses the actual browser location rather than honoring arbitrary redirect parameters.

Guard delayed login/setup completion against unmount or changed path/query scope. A successful old request must not navigate away from a newer route or publish old feedback there. Retain the same original validated target throughout the multi-stage credential flow; a TOTP refusal or failed replacement must never navigate. Keep API request bodies, cookie/session contracts, rate limiting and factor requirements unchanged.

For the legacy domain-program alias, optionally include its server searchParams in the canonical redirect: reconstruct URLSearchParams preserving repeated entries, set exactly the path-owned domainId (ignoring conflicting query domainId), and keep every other key including Studio canonical targets/start. Do not accept a query-defined external destination. Fragment preservation needs real-browser verification; no server-only implementation should claim to read the fragment.

Wrap only ProgramLauncher's optional persistent write in try/catch. Keep in-memory recents and the original Link destination/activation semantics; no alternate router.push or preventDefault. Persistence failure is not a user-blocking error and needs no new dialog. Preserve existing keyboard and prefetch behavior.

## Exact proposed ownership for a new brief

All paths below are Core; no product edits are authorized by this audit.

| Unit | Sources | Owning tests |
| --- | --- | --- |
| Validated sign-in destination | `apps/web/src/app/AuthShell.tsx`; new `app/auth-navigation/localAuthDestination.ts`, `index.ts` | Existing `app/tests/AuthShell.test.tsx` unchanged assertions plus behavioral cases; new `app/auth-navigation/tests/localAuthDestination.test.ts` |
| Requested-route sign-in gates | `app/get-started/page.tsx`; `app/programs/[programId]/page.tsx`; `app/programs/automation-studio/page.tsx` | New `app/get-started/tests/page.test.tsx`, `app/programs/[programId]/tests/page.test.tsx`, `app/programs/automation-studio/tests/page.test.tsx` |
| Existing domain gate verification | No domain source change needed | New `app/domains/[domainId]/tests/page.test.tsx` if route-level proof is required |
| Legacy alias query preservation (optional separate unit) | `app/domains/[domainId]/programs/[programId]/page.tsx` | New same directory `tests/page.test.tsx` |
| Nonblocking optional recents (independent unit) | `app/ProgramLauncher.tsx` | Existing `app/tests/ProgramLauncher.test.tsx`, retaining its three existing assertions/cases |

No lib/auth.ts, API login routes, identity/runtime/session storage, recovery module, onboarding source, shared theme or architecture changes needed. New directory gets a barrel; AuthShell imports that barrel. Route tests live directly in each owning tests directory. This ownership can execute independently from operational polling/clipboard/extension lanes once the coordinated source freeze is released.

## Meaningful regression cases

- Successful login from global home returns `/`; domain login returns the exact domain URL; scoped setup returns `/get-started?domainId=...`; generic docs preserves doc query/hash; Studio preserves project/flow/subflow/view/detail/start/domain/unrelated repeated params. No navigation at mount.
- Password accepted then TOTP challenge/refusal/retry preserves target; successful second step reaches it. Temporary-password login enters setup without navigation; replacement error retains entries and target; successful replacement reaches the same target. Existing rendered-login, password validation and recovery assertions stay intact. Privileged PIN/TOTP requests and session API bodies stay unchanged.
- Validate local targets including encoded non-ASCII path/query values and hash; reject `//outside`, backslash/encoded separator authority forms, absolute and javascript strings, control characters and origin mismatch. Malformed input safely falls back to `/` without throwing. Arbitrary returnTo is never obeyed as a destination.
- Deferred login/setup responses after unmount or a different path/query must not redirect/publish stale feedback. Retry after genuine auth failure uses the retained request rather than navigating automatically.
- Server gates return LoginPanel at unauthenticated setup/generic/Studio routes and do not call getFluxIQ/program loaders first. Authenticated routes still validate domain and availability and render original workspace/back links. Domain's existing unauthenticated inline gate remains intact.
- Alias preserves canonical targets/repeated query keys while forcing path-owned domainId; no external URL can enter its Location. Check actual fragment behavior later in the browser rather than guessing from synthetic server tests.
- Simulate both getter denial and quota/security write throws for localStorage. Actual launcher Link onClick must not throw or call preventDefault; destination unchanged, in-memory recents still update. Successful persistence remains bounded/deduplicated to six; existing search/empty/prefetch tests remain.

Validation performed: source searches/reads and inspection of the installed Next Link event order only. No product/test edits, heavy tests/checks/builds, live/browser/provider/panel calls, shared documentation edits, commits or pushes. Changed only this report. Findings are source-confirmed; implementation and real-browser navigation remain unverified.
