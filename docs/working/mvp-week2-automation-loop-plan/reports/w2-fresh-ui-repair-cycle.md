# w2-fresh-ui-repair-cycle

Status: stopped at the fresh UI creation result boundary; repair was not entered.

## Isolation

- Current paired t027 worktrees: downstream `96c6232`, Core `44686e1`.
- Disposable workspace/profile/store: `F:\fxlab-runs\t027-fresh-ui-repair\workspace`.
- Production panel/gateway used loopback ports 3375/4945 in headed Chromium. Both listeners were closed afterward.
- The user's port 3000, user store/profile, shared `dev`, product/Core source, and git history were untouched.
- Existing local credentials and provider configuration were available only to the launched processes. No credential, response body, page data, opaque identity, or provider output is recorded here.

## Live result

1. `pnpm panel:golden` built and launched the current production panel, extension, Core runtime, and isolated Chromium profile.
2. The first fresh-workspace pass reached the Flow Settings key selector and stopped because a genuinely new store has no saved provider key. No provider request was dispatched.
3. The documented one-time `pnpm demo:llm:setup` path configured the existing local provider key through the isolated production UI. Its redaction attestation reported zero findings.
4. The current-code golden path was restarted against the same isolated store. It created a new UI workspace/Flow, entered the bounded instruction, reactivated the real fixture, displayed the high-token confirmation, and accepted explicit approval.
5. Live evidence then recorded two successful runtime browser actions during evidence-guided creation. The generation endpoint completed with HTTP 200 and `responseOk: true`; the panel showed no allowlisted generic generation error.
6. Creation nevertheless produced no reviewable result. Provider-free durable inspection immediately afterward returned `proposedCount: 0`, `bootstrap: false`, `providerMatches: false`, and `modelMatches: false`. The project contains no proposed bootstrap adaptation for this request, so there is nothing the UI can review or apply.

The exact observed result category is therefore: **successful generation transport with no durable creation proposal**. The current driver ultimately exposes this as generic `panel_golden_path.failed`; its bounded evidence proves the narrower facts `httpStatus=200`, `responseOk=true`, `visibleGenericError=false`, and zero proposed/bootstrap adaptations. The response body was not persisted or exposed, so a more specific provider/structured-output code cannot be claimed.

## Oracle disposition

- Fresh production-UI workspace: reached.
- Applied bootstrap adaptation: **failed prerequisite**; none was proposed or applied.
- Semantic target drift: not entered.
- Repair candidate projection/provider call inspection: not entered.
- Exactly one unapplied `edit_action_target` proposal: not entered.
- Human approval, corrected rerun, full restart, zero-call saved reuse: not entered.

No retry was made after the model-backed creation returned no proposal. Continuing would require either another provider attempt or fabricating the bootstrap prerequisite, both of which would invalidate the requested fail-closed cycle.

## Evidence and residue

- Sanitized evidence bundle: `demo-llm-explore-2026-09-21T02-53-58-962Z-7f419d` under the disposable workspace.
- The bundle has 121 events. Its terminal diagnostics are `exploration.generation-response` and `exploration.visible-error.absent`; provider-free pending-creation inspection added zero calls.
- A read-only disposable SQLite helper remains under the run root and emits only schema names or closed status/code/count projections. It is not product source.
- No unit or broad suite was run: the live product boundary failed before any source change existed to validate.
