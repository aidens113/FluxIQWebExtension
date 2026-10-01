# Core shell and global operational UX discovery

Status: Discovery complete; supervisor verification/prioritization pending. Read-only current-source review in paired task t224. Product source, shared documents and other worktrees untouched; no tests/builds/panel/browser/provider calls or commits.

## Current evidence

Required brief/Current State, Core Repository Boundary and ui-theme.md read. References below are relative to paired Core root `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ`; observations are source facts, not browser certification.

## Surface inventory

| Surface | Journey and current implementation |
| --- | --- |
| Sign-in / temporary-password setup | Home renders LoginPanel when signed out; username/password, requested TOTP, lockout countdown, password visibility/Caps Lock and initial password replacement. AuthShell.tsx. |
| Home / domain directory | Search categorized programs/domains, open recent items, keyboard arrow/Home/End navigation, account menu; domain breadcrumb and unknown-domain boundary. app/page.tsx, ProgramLauncher.tsx, domains/[domainId]/page.tsx. |
| First-run setup | Signed-in /get-started delegates to OnboardingLiveView; selecting a start option navigates to Studio with ?start. No navigation link to /get-started found in current app source. Studio-owned onboarding internals excluded from this lane. |
| Generic program shell | Breadcrumb preserves domain return URL, account menu, program header, Technical details drawer with keyboard-operable API/Storage/Runtime tabs; dynamic live renderer. programs/[programId]/ProgramWorkspace.tsx. |
| Identity and Access | Users search/filter/detail, profile/role/enable changes, password/PIN and TOTP enrollment/removal; Roles and Authentication Policy read-only views; acting-user authorization, operation lock, final-admin protection. live-views/identity-access.tsx. |
| Secret Keys | Search/filter redacted metadata, add then authorize, edit/rotate/reveal/delete; domain/project/flow scope selection, temporary reveal expires after 30 seconds, busy boundary. live-views/secret-keys.tsx. |
| Database Manager | Database/store explorer, debounced search, columns/sort, 50-row pages, explicit record detail, credential recheck for five-minute sensitive-store grant. live-views/database-manager.tsx. |
| Background Tasks | Scheduler pause/resume, task search/filter, selection, run-history status filter/pages, run detail, enabled toggle, manual/retry run. live-views/background-tasks.tsx. |
| Compute Control | Node search/health/capability filters, heartbeat-derived status, capability/metadata detail, latest command activity and leases; read-only panel. live-views/compute-control.tsx. |
| Deployment Sync | Repository summary, branch target, dry-run, confirmed checkout/rollback, versions/git/branches/action history, action detail. live-views/deployment-sync.tsx. |
| Runtime | Catalog advertises clients/capabilities/runs/dispatch/transports but renderer has no runtime case: generic registered-without-workspace placeholder. _shared/catalog.ts, runtime-control/metadata.ts, ProgramLiveViews.tsx. |
| Documentation | Source/title/path search, virtual keyboard tree, on-demand content, document URL/back navigation, outline, narrow explorer drawer, rebuild and warnings. live-views/docs.tsx. |
| Production Runner | Select task/routine/interface target, parameters and loop timing, launch, active workload details/advance/cancel, filtered latest 500 logs, target inventory. live-views/production-runner.tsx. |
| Global pairing approval | Root runtime.control eligibility, adaptive snapshot poll, reference match, expiration, approve/reject with busy/error recovery. GlobalClientGatewayPairing.tsx. |
| Global questions | Root authenticated eligibility; outside Studio polls open conversations and detail, answers or locally dismisses a question. GlobalConversationPrompt.tsx. |
| Global notifications / route failures | Shared toast stack with focus/hover pause, dismiss/actions and alert/status roles; home/domain/program route error surfaces and loading indicators. Root layout, feedback/GlobalAlertViewport.tsx, RouteErrorSurface.tsx. |

Automation Studio itself is intentionally left to the separate Studio report; it is one of ten catalog programs. Eight global programs have specific live views, Runtime is a placeholder, and Studio has its own route.

## Confirmed priorities

1. P1 — generic program session recovery is not mounted. `program-api.ts:158` awaits requestProgramAuthentication on 401; `program-auth-recovery.ts:8` dispatches an event and waits without a fallback. Only GlobalTopbar mounts SessionReauthentication (`AuthShell.tsx:36`); generic ProgramWorkspace uses AuthStatus, and root layout mounts only alert/pairing/question globals. Users whose sessions expire in an operational panel see a stuck request rather than the promised work-preserving restore flow. Move a single recovery host to authenticated root shell; keep drafts mounted and explicitly settle cancellation/unmount. Validate 401 on initial read and mutation, successful restore/retry once, cancel, concurrent 401 and route change.
2. P1 — global question starvation. `apps/web/src/app/GlobalConversationPrompt.tsx:101` selects only the first open conversation, then idles if that thread has no promptable turn at line 115. A newer idle or locally dismissed thread masks an older waiting question. Inspect bounded candidates for pending asks and provide a queue/count; validate newer-idle/older-waiting, dismiss/answer advances, pagination and permission failures. This is global prompt ownership; coordinate shared conversation contracts with Studio lane.
3. P2 — Runtime launcher promises an unimplemented workspace. `runtime-control/metadata.ts:3`, `_shared/catalog.ts:21`, `ProgramLiveViews.tsx:56` include Runtime in catalog but no renderer. Either implement the current metadata's inspection journey or label/disable preview with an explicit next destination. Validate every catalog route in global and domain scope has an intentional actionable state.

4. P1 — Production workload mutations lack an operation guard and ignore advance/cancel failures. `apps/web/src/features/programs/live-views/production-runner.tsx:38` starts without busy/operation state; the launch button at line 57 disables only when no target exists. Workload callbacks at line 70 ignore `ApiResponse.ok` and refresh regardless, while controls at line 88 remain active. `program-request-coordinator.ts:23` explicitly does not deduplicate mutations, so repeated activation issues multiple POSTs. Add a guarded launch operation and per-run advance/cancel guard, preserve labels with busy indicators, and attach failure/retry feedback to the affected workload. Validate double activation produces one request, refused/timeout actions are visible, and unrelated workloads remain operable. Whether duplicate POSTs create duplicate work is a backend consequence to verify, not claimed here.

5. P2 — Production target-type changes reuse another target's parameter values. `production-runner.tsx:59` passes setTargetType directly; only the target-select handler at line 61 clears parameterValues. A user entering `amount` for a task then changing mode to a routine with an `amount` field can submit the old value through `buildProductionParameters` at line 112. Reconcile target identity and reset or explicitly migrate parameters whenever the effective target changes. Validate same field names with different defaults across task/routine/interface and refreshed target removal.

6. P2 — Compute selection can contradict the visible search/filter. `compute-control.tsx:39` resolves selectedId against all nodes instead of filtered nodes. After selecting node A then filtering it away, details/activity can still show A even with an empty result list. Use the same visible-selection reconciliation already present in Background Tasks, Identity and Secret Keys. Validate search/health/capability changes, all-filtered-out and node removal; detail must match a visible selection or clear.

7. P2 — Operational status lacks automatic freshness ownership. Compute snapshots load on mount (`compute-control.tsx:25`) while the clock advances every ten seconds at line 26; heartbeat-derived health will eventually mark an actually online node offline unless manually refreshed. Background Tasks advances the local clock but fetches snapshots only on mount/commands/manual refresh (`background-tasks.tsx:32`, `:37`); Production does the same mount-only read (`production-runner.tsx:27`). These are confirmed source data flows; actual stale-screen frequency needs live measurement. Add bounded visibility-aware refresh for active operational panels with a last-updated/stale indicator, pause hidden/inactive polling, and preserve selection/detail. Validate externally completed runs, scheduler executions, recurring next-due updates, fresh heartbeats, lost connection and hidden-tab resume. Do not interpret passage of local time as authoritative current remote health.

8. P2 — Clipboard acknowledgement reports success without knowing the result. Secret reveal immediately sets "Copied" (`secret-keys.tsx:205`); shared `copyText` returns void and discards clipboard promise at `shared.tsx:174`. Permission denial, insecure-context API absence and write rejection still produce success. Return an explicit async result and show success only after resolution; preserve selection/manual-copy fallback and keep the 30-second reveal expiry. Validate clipboard success/rejection/API absence using synthetic values, never captured credentials.

9. P2 — First-run setup has no directory entry. Home builds only catalog/domain launcher entries (`apps/web/src/app/page.tsx:11`), and current app source search found /get-started only in its route/tests. A signed-in newcomer has no shell command to reach the dedicated setup journey. Add a clear Get started entry or readiness-based primary action, retaining later return access. Validate a fresh installation and ready returning user. Separately, `get-started/GetStartedClient.tsx:8` documents that the emitted ?start choice is currently ignored; Studio lane must confirm the current consumer before treating that comment as a bug.

10. P2 — Sensitive-store authorization lacks an in-flight guard. `database-manager.tsx:99` begins authorize-store without busy/ref fencing; the authorization modal's button checks credential completeness but not an operation state. Repeated Enter/click can issue multiple grant requests and closing/changing stores can leave an old request completing into UI state. Add an operation lock tied to the requested database/store, keep busy interruption ownership explicit, and reject stale completions. Validate double submission, close during request, store change, rejected credentials and grant expiry. Server credential protections are not evaluated in this UX lane.

## Lower-priority journey improvements and hypotheses

- P3 — Preserve deep-link/domain destination through sign-in. Generic program route redirects unauthenticated users to /; DomainPage renders LoginPanel, whose successful login always sets window.location.href to /. This loses the requested panel/domain. Suggested fix: validated local return path owned by auth shell; verify malicious external paths cannot become redirects, and intended destination is restored after setup/TOTP as well as ordinary login.
- P3 — Launcher recent-history write has no failure boundary. ProgramLauncher.tsx reads localStorage in a try/catch but `remember` writes directly. Storage-denied/full browsing modes can throw on an otherwise valid navigation click. Treat recents as optional and recover silently; verify link navigation still completes. Whether the current event exception prevents Next navigation is a browser hypothesis.
- P3 — Production schema handling needs explicit limits/validation. `productionParameterFields` at line 107 slices to 30 fields without a visible omission message; required/min/max/enum constraints are not represented, and `Number(raw)` maps blank numeric input to 0. Validate required-schema coverage and backend refusal presentation before replacing this with a schema-owned form. Treat unsupported schemas as explicit nonlaunchable states rather than silently omitting parameters.
- P3 — Keep large technical payloads lazy. Background run Result detail and Database Detailed JSON use JSON.stringify during render even while native details is collapsed. Shared JsonViewer already has the intended lazy/collapsed contract. Profile synthetic large payloads before prioritizing; migrate these owner views if measured. No performance result is claimed.
- Browser verification: 320/768/1440 px composition, 200% zoom, focus return/trap in stacked pairing/auth/authorization drawers/modals, tree virtualization keyboard scroll, exact table labels/scoped headers, reduced motion, toast timing with pointer plus keyboard focus, and errors inside busy boundaries. Database grid has no table label in source; this is a concrete accessibility improvement even before assistive-technology confirmation.

## Good current behavior to preserve

- Named loading and retry states exist across all eight live panels; heavy detail reads occur on selection rather than initial directory load.
- Identity/Secrets share operation locking, explicit acting-user security factors, selected-visible-object reconciliation, and useful consequence text. Secret reveal is time-bounded and closes on key change; sensitive database grants expire and clear displayed data.
- Technical details are secondary drawer content, not the primary program flow. Drawer tabs implement arrow/Home/End and roving tabIndex.
- Directory search has a visible accessible search label, a no-result state, real navigation links and recent items. Route errors offer retry and return without exposing raw error bodies.
- Docs owns URL/popstate, dynamic detail cancellation, source/search empty states, virtual tree and narrow drawer. These should be verified before replacing them in a redesign.

## Suggested implementation order and file partitions

1. Fix the single authenticated session-recovery host and pending promise lifecycle first: app/AuthShell.tsx, app/layout.tsx, program-auth-recovery.ts and owning new behavioral tests. Supervisor independently confirmed this source defect; product edits await a separate brief/setup completion.
2. Repair global question candidate selection in GlobalConversationPrompt.tsx with synthetic queue tests, coordinating conversation ownership with Studio.
3. Guard and validate production mutation/target transitions in production-runner.tsx; this is independent of shell recovery after shared transport stays stable.
4. Reconcile Compute visible selection, then implement a shared bounded freshness contract with each operational panel owning its refresh policy. Avoid starting an unconditional global poll.
5. Close Runtime/onboarding navigation gaps, then clipboard and sensitive-store submission handling.
6. Perform authorized live visual/keyboard/browser verification before broader layout changes. Source code alone does not justify replacing working dense layouts.

## Validation limits

All findings come from the isolated source snapshot and named imported global shell/program components. No tests/builds/live rendering, focus behavior, responsive layout or runtime result have been exercised. Discovery report is the only file changed in this lane. Installation's build is a supervisor process and is not review validation. Product work is not claimed complete; P1/P2 recommendations require dedicated implementation and the named behavioral/live checks.
