# Store Listing and Submission

This page is for maintainers. It holds the listing copy for the Chrome Web
Store and addons.mozilla.org (AMO), and the steps for building and submitting a
release.

## Listing copy

**Name.** FluxIQ Web Automation Client. The manifest's `name` is capped at 75
characters.

**Summary.** This is the manifest `description`, capped at 132 characters. The
build checks the cap.

> Record, run and repair browser automations with FluxIQ. Connects only to the FluxIQ runtime you run and pair.

**Category.** Chrome: Productivity > Workflow & Planning. AMO: Other.

**Description:**

> FluxIQ turns what you do in your browser into automations that keep working.
>
> Describe a task in plain words, show FluxIQ how by doing it once, or point at the data you want from a page. FluxIQ builds a runnable automation, lets you test it, and runs it whenever you need.
>
> When a site changes and a step can no longer find its way, FluxIQ works out what went wrong, finds another route, checks that the result is still correct, and saves what it learned. The next run reuses that fix without calling AI again, so routine runs stay fast and cheap.
>
> This extension is the browser half of FluxIQ. It works together with the FluxIQ runtime, which you run on your own computer. The extension sends page data only to the runtime you pair it with. It has no analytics, no telemetry, and no remote code. AI features use your own DeepSeek API key.
>
> Requires the FluxIQ runtime. See the install guide.

**Single purpose (Chrome).**

> Record, run and repair browser automations for the user's own FluxIQ runtime.

**Permission justifications (Chrome dashboard).** Paste the "Why FluxIQ
needs it" column of [Permissions](permissions.md), one row per permission. For
host access, use the `<all_urls>` row.

**Remote code (Chrome).** No. Every script ships inside the package. The build
refuses a page that loads a script or stylesheet from a URL.

**Data usage (Chrome).** The extension handles:

- website content;
- web browsing activity;
- user activity (clicks and typing while recording).

It uses them only for the extension's single purpose, never sells them, and
never transfers them for unrelated purposes. Link the published
[privacy policy](privacy-policy.md).

**Data collection (AMO).** This is declared in
`apps/extension/manifest.firefox.json` under
`browser_specific_settings.gecko.data_collection_permissions`:
`websiteContent`, `websiteActivity` and `browsingActivity`, all required.

**Screenshots.** Capture these from the release build, not the e2e build: 1280x800 or
640x400 for Chrome, and at least 1280x800 for AMO.

1. The side panel connected, with a site open.
2. A recording in progress.
3. A run in progress, showing its step list.
4. An adaptation proposal after a page change.
5. The extraction picker selecting a table.

**Icons.** The build renders the 16, 32, 48 and 128 px icons
(`apps/extension/scripts/release/icon-png.mjs`). For Chrome's store icon, use
the 128 px file from the package.

## Building a release

1. Set the same version in `apps/extension/package.json` and in all three
   `apps/extension/manifest.*.json` files. The build fails if they differ.
2. Build all targets:

   ```bash
   pnpm --filter @fluxiq-web-extension/extension build
   ```

   The build checks every target the way a browser checks it at install time.
3. Package the release:

   ```bash
   node apps/extension/scripts/release/package-extension.mjs --release
   ```

   This writes both ZIP files, `SHA256SUMS` and `package-report.json` to
   `apps/extension/dist/store/`. `--release` refuses owner placeholders, such as
   the example Firefox add-on id.
4. Run the release-candidate checklist:

   ```bash
   node apps/extension/scripts/release/release-candidate-checklist.mjs --evidence rc-evidence.json --bench <report.json>
   ```

   To create a blank evidence file, run it with `--template`. The candidate is
   ready only when every item passes. An item with no evidence is pending, not
   passed. The FluxBench thresholds in the script are provisional until the
   owner confirms them.

## Owner-only steps

- Choose the permanent Firefox add-on id and set it in
  `manifest.firefox.json`. The current `@example.local` id is a placeholder, and
  once an id is published on AMO it can never change.
- Create the Chrome Web Store and AMO developer accounts.
- Publish the privacy policy at a public URL.
- Set the CI configuration. See [Release
  packaging](../architecture/release-packaging.md#ci-configuration-the-owner-must-set).
- Prepare the AMO source submission. The package contains bundled code, so
  AMO requires:
  - the source of both checkouts at the release commit;
  - these build steps: install Node 22 and pnpm 9, build `!FluxIQ` with
    `pnpm install && pnpm build`, then run `pnpm install` and the build command
    above in `!FluxIQWebExtension`.

## Updates

Store installs update automatically. Chrome and AMO both deliver a new
version once it passes review. The extension does not set `update_url`: the
stores own updates. Every version must be greater than the last one
published.
