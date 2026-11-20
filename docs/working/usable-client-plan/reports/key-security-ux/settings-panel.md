# settings-panel report (t925)

Outcome: Done. W = Core apps/web/src, U = packages/ui-components/src. Nothing committed.

## Password removal
- U/model-access/key: no password field on the card form or the remove confirm; `ModelKeySave.password` and the password args of `replace`/`remove` are gone. `requiresPassword` stays only as an optional, ignored field so the extension's port (still writes `requiresPassword: false`) compiles; the extension worker can drop it.
- W/model-keys port: no `authorizationPassword`, no `requiresPassword`; `keyFailure` no longer has a password sentence.
- W/settings-page: removed password from `replace-key.ts`, `remove-key.ts`, `ReplaceKeyForm`, `RemoveKeyConfirm` (one confirm press); deleted `new-key.ts` and `AddKeyForm.tsx`; `use-settings-data` lost `addKey` and the password args.
- W/security/keys/manager/SecretKeysLive.tsx: removed `AuthForm`, `AuthorizationFields`, `authPayload`, `canSubmitAuth` (create/edit/replace/remove are one press, no password or two-step code). Tool pages with PIN/password (database-manager recheck, deployment-sync) untouched: t954.

## Jank items
- New defect 3 / jank 9, 10: Add another key was a second form with two unlabelled password inputs. Fix: the full card shows "Add another key" while a key is saved (`model-key-add-another`) and opens its own form with Save and check plus Cancel (full variant only). Files: key/card.ts, form.ts, model-access.css. Tests: card.test.ts (add another, Cancel, no password field, one-press remove).
- New defect 1 / jank 6: stale "default key was removed" note stayed, because the engine keeps it until a default is chosen. Fix: `defaultNoticeStillTrue` (a note is stale once a model key is newer than it) plus `useLiveDefaultNotice` (hidden once the keys or default change after it was first seen). No sentence is matched. Tests: default-notice.test.ts, use-live-default-notice.test.tsx, AiKeysSection.test.tsx.
- Jank 7: card, notes, list and Replace/Remove forms are one `.settings-keybox` with hairlines; the card's own border is flattened inside it. Jank 9: forms share `.settings-actions` button height.
- Jank 8: key row is a grid (name, provider, "Turned on" chip, buttons at the end, Default/Offer underneath); at 520px and below it stacks, buttons never wrap. Legend is no longer a fieldset (it fought the box border).
- Jank 1: appearance radios sat under the label because `.settings-page label {display:grid}` out-ranked `.settings-appearance-choice`. Now `.settings-page .settings-appearance-choice` chips (accent when checked), radios/checkboxes drawn from tokens like the extension (`settings-page.css`). Same specificity fix for Default/Offer labels. Test: AppearanceSection.test.tsx.
- Jank 2: Allowance input and the two buttons are one flex row, same height, wrap together.
- Jank 3: slider track and thumb styled in U/chat/controls/humanness/humanness.css (appearance none, token thumb); label "Level" so the title is not repeated; value sits beside it; helper lines 13px.
- Jank 4, 5, 16: the "Saved." lines of Allowance, Assistant and key actions (`.settings-saved`) and the humanness status keep their height. Jank 5 (31px heading jump) not re-measured live.
- Jank 11: one `--select-height: 36px` token plus the base `:where(select)` rule; select-specific rules in 03, 09, 10, 04/05/06 programs and the certification sheet use it. Test: app/styles/tests/select-height-css.test.ts.
- Jank 12: Engine-tools links carry `aria-label`. Jank 13: Advanced uses the new shared `.disclosure` chevron (global-shared-controls.css).
- Jank 14: `.settings-tool` is a `minmax(0,1fr)` grid so no pane widens it (cause of the 134px overflow); Runtime tabs wrap; raw "runtime.<id>" removed from the visible note (kept as `title`); data-table buttons are nowrap so commit hashes and Rollback are not one letter wide (the table scrolls in its box); database store names are plain words (`storeLabel`, raw id as `title`) with a table icon instead of "T"; Docs kicker no longer shows the route path. Tests: store-label.test.ts, RuntimeLive.test.tsx updated.

## Commands run (all through the gate)
- `pnpm --filter @fluxiq/ui-components check` -> exit 0.
- U vitest `src/model-access src/chat` -> first run 1 stale expectation (card.test.ts replaced args); fixed; `src/model-access` -> 4 files, 23 tests pass.
- `node scripts/build-cache/cli.mjs ui-components:build` -> built (28 s).
- `pnpm --filter @fluxiq/web exec vitest run src/features/settings-page src/features/model-keys src/features/security/keys src/app/styles` -> Test Files 60 passed, Tests 549 passed.
- `pnpm --filter @fluxiq/web check` -> passes (final run after all edits).
- `node scripts/structure-audit.mjs` -> exit 0, no output (run before the final web check in one gated command).
- grep: no `authorizationPassword` or "Your password" in the owned key forms (only in test assertions and the "Your sign-in" tool blurb); iconv UTF-8 clean on every changed file; no 0x85 bytes.

## Not verified
- Nothing viewed in a browser: layout at 390, chevron, slider, chips, row grid, and jank 5 are unmeasured.
- U vitest was not re-run on all of `src/chat` after the card.test fix (first run: only that one failure).
- The extension was not touched; `requiresPassword` can be removed from its port later.

## Notes
- Fixed a stale test (AiKeysSection "honest line" expected "FluxIQ keeps the key"; the text always said "It keeps the key").
- `git mv` is blocked, so model/tests/allowance-and-new-key.test.ts was moved to allowance.test.ts by plain mv.
