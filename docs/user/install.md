# Install FluxIQ

You need two things: the FluxIQ runtime on your computer and the FluxIQ
extension in your browser. When both are installed, follow the
[quickstart](quickstart.md) to pair them and build your first automation.

## 1. Install the runtime

The MVP runtime is installed from source. You need:

- Node.js 22 or newer;
- pnpm 9, which you can enable with `corepack enable`;
- Git.

The runtime is two checkouts, FluxIQ Core and this repository, placed side by
side in the same folder. Keep the folder names exactly as shown:

```text
<any folder>/
  !FluxIQ/               FluxIQ Core
  !FluxIQWebExtension/   this repository
```

Build Core once:

```bash
cd "!FluxIQ"
pnpm install
pnpm build
```

Then start FluxIQ from this repository:

```bash
cd "../!FluxIQWebExtension"
pnpm install
pnpm dev
```

The first `pnpm dev` also sets FluxIQ up. It creates a `.fluxiq/` folder inside
this repository to hold your configuration, automations and recordings. When
the terminal shows the web app is ready, open `http://127.0.0.1:3000`. Leave the
terminal running while you use FluxIQ, and press `Ctrl+C` in it to stop.

## 2. Install the extension

### From a store

Once FluxIQ is published, install it from the Chrome Web Store (for Chrome and
Edge) or from addons.mozilla.org (for Firefox). Then pin the FluxIQ button to
your toolbar so the panel is one click away.

### From a release package

A release provides two ZIP files:

- `fluxiq-web-extension-chrome-<version>.zip` for Chrome and Edge;
- `fluxiq-web-extension-firefox-<version>.zip` for Firefox.

A `SHA256SUMS` file lists the checksum of each package.

To install in **Chrome or Edge**:

1. Unzip the Chrome package into a folder you will keep.
2. Open `chrome://extensions` (or `edge://extensions` in Edge).
3. Turn on **Developer mode**.
4. Choose **Load unpacked**, then select the unzipped folder.

To install in **Firefox**, you need a signed package. Firefox's release build
does not install unsigned add-ons permanently. To try an unsigned package:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select the ZIP file.

A temporary add-on is removed when Firefox restarts.

In **Firefox**, access to websites is optional in Manifest V3. After you
install FluxIQ, open `about:addons`, select **FluxIQ Web Automation Client**,
go to **Permissions**, and allow **Access your data for all websites**. If you
do not, FluxIQ can only work in a tab after you click its toolbar button there.

### From source

To build the extension from source:

```bash
pnpm --filter @fluxiq-web-extension/extension build
```

This writes `apps/extension/dist/chrome` and `apps/extension/dist/firefox`.
Load either folder the same way as an unzipped release package. For
Firefox, select the `manifest.json` inside the folder.

To produce the store ZIP files from that build:

```bash
node apps/extension/scripts/release/package-extension.mjs
```

The files are written to `apps/extension/dist/store/`.

## Updating

**Store installs** update on their own, following the browser's normal
schedule. You can also update them right away:

- In Chrome, open `chrome://extensions`, turn on **Developer mode**, and choose
  **Update**.
- In Firefox, open `about:addons`, open the gear menu, and choose **Check for
  Updates**.

**Unpacked installs** do not update themselves. To update one:

1. Replace the folder's contents with the new version.
2. Choose the reload button on the FluxIQ card in `chrome://extensions`.

To update the **runtime**, pull both checkouts, then run `pnpm install` and
`pnpm build` in `!FluxIQ`. Restart `pnpm dev`.

Your pairing and settings survive an extension update. After an update, the
extension reconnects to the runtime by itself, and tabs that were already
open start working again without a reload.

## Uninstalling

To remove the extension, use the browser's **Remove** button. This deletes
everything the extension stored on your computer: the connection address,
the pairing, and panel preferences.

To remove the runtime:

1. Stop `pnpm dev`.
2. Delete the two checkouts.

Your automations and recordings are stored in `.fluxiq/` inside
`!FluxIQWebExtension`, so deleting that checkout deletes them too.

## Diagnostics and reporting a problem

When something goes wrong, collect the following before you report it:

- **The extension version.** It is shown on the FluxIQ card in
  `chrome://extensions` or `about:addons`.
- **What the panel says.** The status line names the problem. For example,
  "Can't reach FluxIQ" means the runtime is not running or the connection
  address is wrong.
- **The extension's own log.** In Chrome, open `chrome://extensions`, find
  FluxIQ, and choose **service worker** under **Inspect views**. Then copy the
  Console output. In Firefox, open `about:debugging`, find FluxIQ, and choose
  **Inspect**.
- **The runtime's terminal output** from `pnpm dev`, covering the time the
  problem happened.
- **The failed run** as FluxIQ shows it in the web app. Each failed step names
  its failure type.

Before you share a log, read through it. Logs can contain the addresses and
text of pages you automated. FluxIQ does not record what you type into
password, one-time-code or card-number fields. Even so, remove anything
private before you share a log. Never include a pairing code, token or API
key in a report.

Report problems to the FluxIQ maintainers through the project's issue tracker.
