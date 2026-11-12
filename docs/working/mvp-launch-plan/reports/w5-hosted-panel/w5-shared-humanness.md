# W5 shared humanness (t901)

## Outcome
Done. The panel's Flow settings now host W4's `createHumannessControl` from `@fluxiq/ui-components`. The panel-local slider is gone.

## What changed and why
All paths are under `!FluxIQ/apps/web/src/features/automation-studio/settings/humanness/`.
- `HumannessSetting.tsx`: rewritten as a ref host (mount in `useEffect`, `dispose` and `remove` on unmount, `show()` when `value` or `starting` change from outside). The control's `commit` only calls `onChange(number | null)`, which updates the form draft; the form's own Save still sends `update-flow-settings` with `metadata.humanness` as a number or null. Dirty tracking and concurrent-revision handling are unchanged because they live in `FlowSettingsView`.
- `humanness-model.ts`: kept only the glue (bounds, `humannessFromStored`, `clampHumanness`, `humannessDraftValue`, `humannessSavePayload`). Removed the key-step constants, the default constant and `humannessAfterKey`, because the control owns key handling and steps of 5.
- `index.ts`: exports trimmed to match.
- `tests/humanness.test.tsx`: the control tests now use ui-components' `FakeElement` and `withFakeDocument`.
  - It mounts the shared control.
  - An absent value shows "Uses your starting value (0)", and 35 when `starting` is passed.
  - Setting 60 sends the number.
  - "Use starting value" sends null.
  - A re-read value is shown.
  - Through `FlowSettingsViewContent`, a set value reaches `saveFlow` as 70, and a clear reaches it as null.
  - The draft and save tests are unchanged.
- `FlowSettingsView.tsx` is unchanged. It already passes `value` and `onChange`.

## Commands run and observed results
- Library build (lock held, then removed): `heavy-slot run t901 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build`.
  - It also ran the `web:build` step, which failed on a type error in my first draft: `starting?: number` rejected an explicit `undefined`.
  - I fixed that with `starting?: number | undefined`. I did not rebuild web.
  - The contracts, fluxiq and ui-components steps finished. The tail of the output I kept showed only the `web:build` failure.
- `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings src/tests` -> 16 files, 99 tests passed.
- `pnpm structure:check` -> "structure-audit: passed (537 warning(s), 917 baselined)".
- `grep -rn 'type="range"' .../settings` (excluding tests) -> no matches.

## Not verified
- No typecheck after the type fix. vitest does not typecheck, and I ran no whole-package typecheck, per the brief. The `web:build` failure that exposed the type error is the only compile evidence, and I fixed it without re-running the build.
- No live browser. The tests use ui-components' fake DOM, not real range input behaviour.
- Not checked in a real browser: `chat.css` is imported from `HumannessSetting.tsx` to get `humanness.css`, so the control's look is unseen.

## Open questions or contradictions found
1. **Starting value is not available to the panel.** I found no preferences or Settings reader for the person's starting humanness in `apps/web/src`, so `starting` defaults to 0 (the last step of the precedence). The component accepts an optional `starting` prop; a Settings or preferences read needs wiring in `FlowSettingsView` once the panel can read it. That is outside my owned paths only if it needs a new query outside `settings/**`.
2. **The shared control shows "Saved." after each change**, but in the form the change is only a draft until Save Settings. This is slightly misleading. The form's "Unsaved changes" banner is also shown. A W4 option to suppress or reword the status (for example `status: false` or a `savedWord`) would fix it. I could not hide it with panel CSS because the styles live outside my owned paths.
3. **Key rest time.** I pass `settleMs: 300`, which differs from the control's default of 500 (chosen so the draft updates before a Save click).
4. **Stale web dist.** The web `build` step runs inside the library build command. It failed on my first draft's type error, which I have since fixed.
