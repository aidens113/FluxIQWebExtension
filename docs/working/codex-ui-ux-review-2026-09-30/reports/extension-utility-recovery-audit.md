# Extension utility recovery audit

Status: Complete — source audit; fixes queued behind current extension gate freeze
Owner: Codex supervisor
Date: 2026-10-01

## Confirmed source sequences

- Open FluxIQ captures the observed web address, then installs a failed-result error after awaiting a request. If observe already received a different address during the request, the error's clearing predicate is installed after that observation and remains until another push. This is the same stale-feedback sequence reproduced and fixed in Getting Started, but this shared utility has its own state and needs its own regression. Native disabled controls are present; there is no internal request lock for retained/direct handler activation. No browser duplicate was exercised.
- Problem report releases its button immediately after the diagnostic request, before creating the file and awaiting clipboard acknowledgement. A user can natively request another report during a slow clipboard write; the earlier copy completion may then overwrite the newer outcome. Missing clipboard support throws synchronously at writeText access. A fulfilled write rejection already gives useful Save report fallback and must retain that behavior. PanelStore request is explicitly never-throwing, so unexpected request rejection is defensive coverage, not a reproduced ordinary transport defect.
- Problem report object URL creation can throw outside recovery; old URLs are only revoked on a later successful report. Preserve redaction ownership in background diagnostics and use synthetic report data in tests. Do not read/log a user's actual report or invent frontend redaction.
- Activity feed guards read replies against intervening pushes, but not a newer read in the same push generation or stop/restart lifetime. An old read can therefore replace a newer confirmed read after a hidden settings lifecycle. Overlay submission already has a synchronous lock; its reply can still replace a newer push because its completion lacks the read's push predicate. These are source sequences needing deferred-request regressions before implementation; no live relay failure is certified.

## Exact proposed serial supervisor partitions

1. Open FluxIQ: panel/open-fluxiq/open-fluxiq-button.ts and new owning tests/open-fluxiq-button.test.ts. Keep labels/style/runtime message and notice detail contract; reconcile response with latest observed address and add synchronous pending recovery. Fixed rejection feedback must not display exception content. Same-address refusal remains until retry or address change; no automatic retries or new requests.
2. Problem report: panel/settings/problem-report-section.ts and new owning tests/problem-report-section.test.ts. Lock through diagnostic/file/clipboard completion, preserve acknowledged copy versus downloadable file fallback, catch missing/denied clipboard and URL errors with local feedback. Do not change problem-report-plan/background/report schema. Account for old artifact URL lifetime and retained retry behavior without adding an unowned caller lifecycle API.
3. Activity feed: panel/chat/feed/activity-feed.ts and existing owning tests/activity-feed.test.ts. Reproduce out-of-order same-generation reads, stop/restart and reply-after-push separately; preserve direct read APIs, unsupported lifetime semantics, overlay mutation acknowledgement and existing thread consumers. No source release yet; this shared feed needs independent behavior review before changing lifecycle semantics.

## Validation

Read exact utility components, problem-report-plan, PanelStore contract and activity-feed owner plus on-page model test. No source/test mutation, runtime state inspection, heavy command, browser/provider or panel management. Findings are source analysis; source release and reproduction remain pending current gates.
