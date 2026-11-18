# key-choice-fix (t928 fix round, sub-supervisor key-backend)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t928/!FluxIQ`, branch `task/t928-key-backend`. Nothing is committed. All paths
below are under `packages/fluxiq/src/` unless they say otherwise.

## Outcome

Done. Saving a model key now sets only the saver's own key choice. It no longer moves the workspace's assistant key or
model, whether the save comes from the panel or through a paired token, with one exception: a workspace with no
assistant key at all takes the first saved key as its own. If the workspace's chosen key is removed, the workspace is
left with no key and is never switched onto another person's key. All acceptance checks pass.

## What changed and why

**Design: a per-person choice, kept beside the workspace choice.**
- `ModelKeySettingsRecord` (`programs/secret-keys/types.ts`) gets two new fields:
  - `personKeyChoices` holds one `{ userId, keyId, atMs }` per person. It always names that person's own key.
  - `noAssistantKey` means the workspace's chosen key was lost and nobody has chosen another since.
- Existing records still read as before, so no migration is needed.
- New pure helpers in `programs/secret-keys/runtime/person-key-choices.ts`: `keyOf`, `chosen`, `names`, `withoutKey`.
  Moving them out of `ModelKeySettings` keeps that class under its 25-method and 400-line advisory budgets. The audit
  shows no warning for it.

**`ModelKeySettings` (`programs/secret-keys/runtime/model-key-settings.ts`):**
- `keySavedBy(keyId, userId)` sets the saver's own choice.
  - It refuses a key that belongs to someone else or is not a model key.
  - It makes the key the workspace's assistant key (chosen by the saver) only when the workspace has no assistant key
    besides this one. That means no chosen key, and either no other model key standing as the default or the chosen
    key was lost. Anything already in place stays, including an unchosen oldest-key default, so a save never replaces it.
  - The check and the write happen in one synchronous step after `load()`. Two first saves at the same time therefore
    can never both take the workspace. At worst neither does, and each still has their own choice.
- `personKeyId(userId)` returns the person's choice only while it is still an enabled model key that they hold.
- `keyLost` changes:
  - It drops every person's choice of the lost key.
  - It sets `noAssistantKey` when the lost key was the workspace's chosen key: either an assistant key someone chose,
    or, when no assistant key stands, a default an owner or administrator chose. In that case `resolveAssistant()`
    and `view()` stop falling back to the default key, so people who relied on the lost key get `no_key`.
  - Without this, an assistant key that was removed fell back to the default. That default could be another person's
    key, chosen and offered, and members would have been switched onto it silently. A new unit test covers this case.
- `setAssistant` and `setDefault` (the signed-in workspace choices, otherwise unchanged) clear `noAssistantKey`.
- With keys present but no workspace key, `resolveAssistant()` gives a new reason: "No model key is chosen for this
  workspace's messages, so add your own key in Settings, under AI keys, or ask an owner or administrator to choose one."

**The save endpoint (`programs/secret-keys/api/model-key-endpoints.ts`):**
- `setAssistant(...)` is replaced by `service.modelKeys.keySavedBy(key.id, actor.userId)`.
- The doc comment states the per-person rule.
- Replace and remove are unchanged. Replace keeps the key id, so nobody's choice moves. Remove goes through
  `deleteKey`, then `keyLost`.

**One chooser, fed per caller:**
- `chooseAutomationStudioCallerModelKey` (`runtime/models/secrets/caller-key-choice.ts`) takes a new `ownKeyId`. The
  order of choice is now:
  1. The person's own choice, if it is still their enabled key. The workspace's model is used only when that same key
     is the workspace's key.
  2. The workspace's choice, under the unchanged consent rule. A lent key with both consents still serves anyone with
     no own choice.
  3. Their newest own key, then a legacy key.
- `automationStudioModelAccessState` (`model-access/state.ts`) passes `ownKeyId` through.
- `createAutomationStudioCallerKeyChatModel` (`runtime/llm/caller-key-chat/model.ts`) takes `ownKeyId(userId)`.
- New `callerModelKeyChoices` (`programs/_shared/key-access/caller-key-choices.ts`, exported from the barrel) returns:
  - `preferred()`: the workspace choice. This replaces runtime.ts's inline `preferredModelKey`.
  - `ownKeyId(userId)`.
  - `assistantKeyFor(userId)`: for the panel assistant. It returns the workspace's own answer whenever the person's
    calls would use the workspace key, or when no key could serve them, so the assistant's existing wording for keys
    it cannot use or may not lend is kept. Otherwise it returns the person's own key, never lent, with no model, so
    the adapter uses its usual default.
- `programs/_shared/runtime.ts` now wires the model-access state, the Flow binding for Flows that name no provider, the
  chat model and the panel assistant through it.

**Panel-assistant key source:**
- The file is `runtime/conversations/assistant/model/key-model-source.ts`.
- `resolveAssistant` is now called as `resolveAssistant(userId)`, both for the first choice and for the check before
  and after each release. A zero-argument resolver still type-checks, so `programs/automation-studio`'s
  `workspace-key.test.ts` did not change.

**Standing-check path: no code change was needed.**
- A Flow's standing result check uses the key named in its grant. The client picks that key from the model-access
  state, which now carries the person's own choice.
- At each use, `programs/_shared/key-access/authority.ts` still accepts another person's key only if it is the
  workspace's choice with both consents. That is a workspace fact a person's save can no longer change.
- A new test confirms that a member's standing check on a lent key keeps working after another admin saves a key.

**Comments and docs:**
- `server/program-route/program-route.ts`: comments only.
  - Line 41 area (F3) now says a token reaches no delete or payment. For the model-key exception, pressing Remove in
    your own settings is the confirmation and IAM decides, and only your own in-use key can be removed.
  - The allowlist comment at about line 189 now states the first-save exception.
- Core `docs/programs/global-programs.md`, "Secret Keys": two new bullets. One covers the per-person choice and the
  rule that removing the workspace key leaves no key. The other covers F2: an offered key that the workspace chose may
  pay for members' chats, Flows and their standing result checks, and withdrawing the offer stops it at the next use.

**Tests:**
- `programs/secret-keys/runtime/tests/model-key-settings.test.ts`:
  - New describe block of 7 tests: solo first save plus restart; another person's save leaves the workspace record
    `toEqual` the record before it; an existing default is not taken; refusals; a person's choice drops when the key
    goes; a lost chosen key leaves no key even with an offered chosen default, and choosing again restores it; a lost
    chosen default leaves no key, the marker survives a restart, and the next save fills the gap.
  - Two older tests asserted the old fallback ("is never a default that passed…", "drops the offer…"). They now assert
    no key and keep their original point (the offer is dropped, and the unchosen default is not lent).
- `programs/secret-keys/api/tests/model-key-writes.test.ts`:
  - The stand-in model-access reading now uses the real chooser with `personKeyId`.
  - Lines 110-118 now assert that a solo first save becomes the workspace key and that a later save leaves the
    workspace key as it was.
  - New describe "one person's key write never moves another person's key (F1)":
    - admin B saves from the panel and from a paired actor: the workspace record and model are unchanged, member Mia
      stays on A's lent key, A stays on A's key, and B uses B's key;
    - B replaces and removes his own key without moving anyone else's choice, and after removal B falls back to the
      lent key;
    - A removes the workspace key: Mia gets exactly `no_key`, B keeps his own key, and B's offered but unchosen key is
      never lent.
- `server/program-route/tests/paired-model-key-writes.test.ts`:
  - New test through the real route with a real pairing token. Admin A saves from the panel cookie, chooses a model and
    offers the key. Second admin B saves through the token.
  - Checked: the workspace record is unchanged, `resolveAssistant` is unchanged, the member's model access (read
    through the route's `snapshot`) stays A's key, and B's token removal changes nothing for anyone else.
- `runtime/models/secrets/tests/caller-key-choice.test.ts`: 3 tests.
  - Own choice beats the lent key, and the lent key still serves someone with no own choice.
  - An own choice of someone else's key, or of a disabled key, is ignored.
  - The workspace's model follows only when the same key is chosen.
- `runtime/llm/caller-key-chat/tests/model.test.ts`: the sender's own key is used ahead of the workspace's, and the
  lookup is by sender.
- `runtime/conversations/assistant/model/tests/key-model-source.test.ts`: the resolver is asked for the sender, before
  and at release.
- `programs/_shared/key-access/tests/caller-key-choices.test.ts` (new): the panel answer per person, the workspace's
  refusal answer kept, and fallback to a person's own key when the workspace has none.
- `programs/_shared/key-access/tests/standing-result-check.test.ts`: the lent-key standing check survives another
  admin's save.

## What clients see

- **The person who saves:** the answer from `save-model-key` (`modelAccess`) has the same shape and the same content as
  before: the key they just saved, ready or checked.
- **Everyone else:** their `modelAccess`, the paired-client push and the panel's change signal no longer change when
  another person saves. Before, a save could flip them to `not_permitted`.
- **Settings view after another person's save:** `get-assistant-model` and `snapshot.modelSettings` no longer move
  `assistantKeyId` or `assistantModel`.
- **After the workspace's chosen key is lost (new):**
  - `modelSettings` reads `assistantKeyId: null`, `assistantProvider: null`, `assistantKeyChosen: false`, even when
    other keys exist. Before, it showed the next default key.
  - People who relied on the lost key read `no_key` instead of `not_permitted` (another person's unchosen key) or a
    silent switch.
- **The panel assistant:** it now answers each person with their own saved key when they have one.
- No wire contract type changed.

## Commands run and observed results

All Core commands ran under `heavy-slot.mjs run key-choice-fix`, one at a time.
- `pnpm --filter fluxiq check`, first run after the code changes: exit 0, build-cache "build", 100668 ms.
- `pnpm --filter fluxiq check`, re-run after the test edits: exit 0, build-cache "build", 35052 ms.
- `npx vitest run` on the changed test files only (first pass): 3 failed, 172 passed.
  - Two failures were the old-fallback assertions in `model-key-settings.test.ts`, which I updated as described above.
  - One was my new panel test: the fixture's ports stamp `keyUpdatedAtMs: 1`, but `key.other` has `updatedAtMs: 2`, so
    the release reported a changed key. I switched the test to `key.chosen`.
- Acceptance run, from `packages/fluxiq`:
  `npx vitest run src/programs/secret-keys src/server/program-route src/programs/_shared src/runtime/llm src/runtime/models/secrets src/runtime/conversations/assistant/model src/programs/automation-studio/api/panel-assistant --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1`
  - This is the brief's five directories plus two panel-assistant directories my change touches.
  - Result: "Test Files 381 passed (381)", "Tests 3728 passed (3728)", exit 0.
- `node scripts/structure-audit.mjs` (Core root):
  - First it failed with 2 `statement-packing` violations in my new tests (one-line arrow bodies). I split them.
  - It then passed, but `model-key-settings.test.ts` was at 402 lines (advisory). I folded the restart test into the
    first-save test, bringing the file to 396 lines.
  - Final result: "structure-audit: passed (555 warning(s), 911 baselined)". None of the warnings is on a file I added
    or grew.
- After those last test edits, I re-ran `model-key-settings.test.ts`, `key-model-source.test.ts` and caller-key-chat
  `model.test.ts`: "Test Files 3 passed (3)", "Tests 52 passed (52)", exit 0.
- Generated files: not regenerated. No registration changed: no endpoint, action, classification, permission or
  assistant metadata was added or edited.

## Not verified

- No live or browser check: I did not open the extension, start a panel, or call any provider.
- The full package suites were not run, per the twice-a-day rule. Only the brief's directories and the two
  panel-assistant directories ran.
- The paired-client push (`programs/_shared/model-access/push.ts`) was not exercised for "another person's save sends
  nothing". It reads the same `modelAccessOf`, and the push tests in `programs/_shared` passed.
- Hosted (`service` IAM profile) callers were not tested specifically.

## Open questions or contradictions found

1. **When a first save may take the workspace.** "The workspace has no assistant key at all" is read as: no chosen
   assistant key, and either no other model key standing as the default or the chosen one was lost
   (`noAssistantKey`).
   - Consequence: after the workspace's key is removed, the next person who saves, from the panel or a token, fills
     the empty slot as the chosen key.
   - It is not lent until they offer it, so members go from `no_key` to `not_permitted` ("not offered"). If the lead
     wants only a workspace with no model keys at all to qualify, change `hasWorkspaceKeyBesides` to ignore the marker.
2. **Unchosen assistant keys.** An assistant key someone set with no chooser (`setAssistant` without `chosenBy`; every
   endpoint passes the actor) still falls back to the default when lost, as before, because nobody else relied on it.
3. **People who never saved a key.** Someone who added keys only through the general `create-key` has no own choice,
   so their calls still prefer a lent workspace key over their own key, as before t928. Only `save-model-key` sets the
   per-person choice.
4. **Mixed provider and model choice in Settings.** `set-assistant-model` still sets the workspace's model. A person
   whose own choice differs from the workspace key will see their own chats use their key's model, not the one they
   picked for the workspace. This is out of scope here; the UI may want to say which choice it edits.
5. F4 (the push skips IAM) was not touched, per the brief.
