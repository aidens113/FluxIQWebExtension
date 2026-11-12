# w5-panel-config report

## Outcome
Done, with one wiring item left for the supervisor (Settings tool listing, see Open questions).

## Config shape
- Branding: unchanged source, the product manifest (`PanelProduct`: name, shortName, assets.logo, brand.light). `currentPanelBranding()` now maps the package's `--color-primary/-hover/-focus` onto the panel's real tokens: `--accent`, `--accent-hover`, `--accent-text`, `--accent-ink` (stock ink or white, whichever contrasts more), `--focus`. No new tokens. Stock branding: name "FluxIQ", style `{}`, mark `/fluxiq-mark.svg`.
- Preset: `FLUXIQ_PANEL_PRESET` (default `full`), read on the server by `currentPanelPreset()`; an unknown value throws `FLUXIQ_PANEL_PRESET "x" is not a panel preset. Use one of: ...` (hit on every panel request via the panel layout, so it fails loudly). No package type change needed.
- Presets: `full` (all 6 screens, all 7 tools); `data-collection` (all 6 screens; tools Docs, Runtime); `task-automation` (no Data; tools Background Tasks, Production Runner, Docs, Runtime). Home, Security, Settings are in every preset (`ALWAYS_REACHABLE_PAGES`, tested). Presets only hide.

## Files
New: `apps/web/public/fluxiq-mark.svg` (copy of the website mark); `apps/web/src/app/product/preset/{panel-presets,resolve-panel-preset,current-panel-preset,require-panel-screen,settings-tools-for-preset,require-panel-settings-tool,index}.ts`; `product/server/accent-tokens.ts`; tests `product/preset/tests/panel-presets.test.ts`, `product/server/tests/accent-tokens.test.ts`, `(panel)/tests/preset-routes.test.tsx`.
Changed: `product/index.ts`, `product/server/{index,current-panel-branding}.ts`, `product/client/BrandMark.tsx` (stock now draws the FluxIQ mark image; `icon` prop kept, optional, unused), `features/panel-shell/{PanelShell.tsx,nav/PanelRail.tsx,nav/panel-nav-items.ts (navItemsForPages),nav/index.ts}` (optional `pages` prop), `(panel)/layout.tsx` (passes `preset.pages`), guard line in `(panel)/{flows,runs,data}/page.tsx`, `flows/[flowId]/page.tsx`, `flows/[flowId]/graph/page.tsx`, `runs/[runId]/page.tsx`, and `settings/[tool]/page.tsx` (now `requirePanelSettingsTool`), tests `product/tests/{branding-ui,layout}.test.tsx` (new accent tokens, stock mark), `(panel)/tests/layout.test.tsx`; `docs/operations/self-hosting.md` ("Customise The Panel" plus settings table row); `deploy/env/{self-hosted,service}.env.example` (commented placeholder). `product-branding.css` needed no change.

## Commands run
- `pnpm --filter @fluxiq/web exec vitest run src/app/product src/features/panel-shell "src/app/(panel)" src/tests` -> Test Files 19 passed (19), Tests 72 passed (72). (First run had one failure in branding-ui from a stale `not.toContain("<img")` assertion; fixed, rerun green.)
- `pnpm structure:check` -> "structure-audit: passed (531 warning(s), 917 baselined)".
- Free memory before vitest: 2333 MB.

## Not verified
- No apps/web typecheck (supervisor's). No browser check of the mark, accent or hidden nav. Accent is applied from the light brand only, on both themes (dark accents not applied, as before).
- Several edited files were CRLF; new/edited lines may mix endings (git warns, harmless).
- The worktree already held many unrelated uncommitted edits from other work; I touched only owned paths.

## Open questions or contradictions found
- WIRING NEEDED (not my path): `features/settings-page` EngineToolsSection (`ui/EngineToolsSection.tsx`) still lists all `SETTINGS_TOOLS`. Wire it by having the server `SettingsPage` route pass `settingsToolsForPreset(currentPanelPreset())` (both exported from `app/product`) down to it. The `/settings/<id>` route already refuses unlisted tools.
- The package's `panelBrandStyle` still emits obsolete `--color-primary` names (packages/fluxiq/src/platform/panel/brand/style.ts); I translate in apps/web. Suggested package change if wanted: emit `--accent`, `--accent-hover`, `--focus` directly.
- Hidden screens elsewhere (e.g. Home cards linking to /flows or /data) were not audited; links to a hidden screen would land on not-found.
- The unknown-preset error surfaces at panel layout render, not process boot; a boot-time check would need `instrumentation.ts` (not mine).
