# t901 independent security review

Read-only source review, 2026-11-11. Reviewed the current uncommitted re-case
guard and own-user UI, and the offer/choice/release source changes against
Core `dev`. No secrets, runtime state, private notes or other lanes were read.

## Actionable finding

**P1: withdrawing a key offer does not stop later provider calls in an already
running assistant turn.** Introduced by this lane's cross-user key lending.

- Primary path: `packages/fluxiq/src/runtime/conversations/assistant/model/key-model-source.ts:53`
  resolves one `choice`; the release closure at lines 60-68 checks only that
  captured choice's `offeredByHolder` and `chosenForWorkspace` booleans.
- `runtime/conversations/assistant/panel-assistant.ts:233` creates the model
  once per turn; `assistant/loop/run-turn.ts:48` calls that same model for
  subsequent tool iterations and retries. An ongoing turn can therefore keep
  spending the holder's key after `offer-key` has successfully withdrawn it.
- The lower release path, `runtime/models/secrets/session-key.ts:56`, snapshots
  current key metadata and checks enabled/provider/ownership and `UseKey` for
  the substituted holder. It does not check current workspace consent or
  choice; the still-valid holder unlock continues to release the value.
- Deterministic reproduction: add/unlock a member's model key; offer it and
  choose it as the workspace key; await `source(otherUser)`; withdraw the offer;
  call the returned `model.decide` with that other user's caller. A stub
  provider still receives a call using the member's key. In the product,
  withdraw while a tool call is running, before the next model iteration.
- The same captured-state path keeps spending the old key if the workspace
  administrator selects a different key during the turn.
- Required fix: re-read current consent/choice at each release and refuse a
  withdrawn offer or changed key/provider/model before authorizing a reveal.
  A changed selection must refuse safely or rebuild a consistent adapter;
  silently continuing with the old key is unsafe. Add regressions that change
  settings after source resolution and between repeated model decisions.

Sent the exact trace and reproduction to the lead and owning worker. The owner
is authorized to repair it; no repair is included or claimed by this review.

## Other reviewed behavior

- No additional authorization, identity-race or other-user disclosure finding
  in the re-case guard or own-user UI. Both handlers select `recase` server-side;
  the live canonical-name/uniqueness checks and map mutation have no await
  between them. The self endpoint derives identity only from its actor.
- The sign-in server route passes only the authenticated user's selected
  fields, including their own username; fallback rendering adds no list grant.
  UI ownership generation prevents an old actor's async result updating a new
  actor's workspace. Its re-case request still carries only `username`.
- The holder-only offer check and workspace-level chooser IAM scope are
  present. Ordinary newly resolved messages refuse unoffered/unselected keys.

## Limits and preexisting behavior

No separate preexisting vulnerability is asserted. Legacy duplicate usernames
and multi-process identity persistence are already documented limits, not new
findings from this pass. No heavy tests, browser, real service tenant, provider
calls, deployment or git mutation ran. The reproduction above is established
by the source call chain; its automated regression remains the owner's work.

## Resolution review

Owner's subsequent frozen patch was reviewed in `key-model-source.ts` and its
12-test file. The P1 finding is resolved in the reviewed source; the earlier
unresolved status above records the original review, not the final state.

- Each release now re-resolves settings before and after asynchronous reveal.
  Current key, normalized provider, model and owner must match the adapter's
  pinned selection; a changed selection is refused without a provider call.
- Borrowed keys require the current offer and explicit choice at both checks.
  Own and unstamped legacy keys retain caller-owned unlock behavior without
  acquiring a new offer requirement. Resolver failures remain fail-closed.
- Known consent refusals are preserved through provider error wrapping;
  own-key and workspace-key locked errors retain their typed behavior.
- Six new cases cover five changes between repeated decisions plus withdrawal
  during reveal. Owner reports old source failed all six and fixed source
  passed 12/12. This reviewer inspected assertions but did not rerun tests;
  the lead's independent rerun remains the acceptance gate.

No concrete remaining security finding in this final patch.
