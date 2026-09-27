# t198 documentation precision fixes

Status: Complete

## Result

Corrected both non-blocking documentation findings from t194 without changing product behavior or live-status claims.

- `docs/architecture/web-capabilities.md`, **Default browser recovery**, now states the actual recovery-account carrier boundary: the account is appended only when the final result has a writable bounded validation or failure description. A successful evidence-only result with `validation.status: "none"` has no such carrier, so its account is currently omitted. The existing statement that no structured gateway recovery field exists remains explicit.
- `docs/architecture/failure-taxonomy.md`, **The Closed Set**, now separates ownership across layers. The page-side content loop applies its pre-dispatch target and read-only retry rules; `TRANSPORT_TRANSIENT` is classified by the background worker before the verb is reached; Core applies the ambiguous-outcome and node side-effect safety check before replay.

No live provider/browser success is claimed.

## Validation

- Reviewed the two edited paragraphs against `content/action-runtime/recovery/{record,fault}.ts`, successful evidence-only action results, `runtime/action-runner.ts`, `domain/src/runtime/failure/browser-api.ts`, and Core's defensive assessment cited by t194.
- `git diff --check` passed for both owned architecture documents and this report.

## Boundaries

Documentation-only task. I changed only the two owned architecture documents and this unique report. I did not edit product source, Core, shared working documents, or other files; run a build, test, Lab, provider, or browser; commit; or push.
