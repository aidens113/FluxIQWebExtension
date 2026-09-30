# Why FluxIQ Asks for Each Permission

The extension asks only for the permissions listed below. Each one is tied to
something the extension does. The build enforces this list: a build that asks
for any permission not on the reviewed list fails. That list, with the code
that uses each permission, is `apps/extension/scripts/release/permission-review.mjs`.
Keep that file and this page in step.

## Permissions

| Permission | What your browser says at install | Why FluxIQ needs it |
| --- | --- | --- |
| Access to all websites (`<all_urls>`) | Read and change all your data on all websites | You choose which sites to automate, so FluxIQ cannot know them in advance. The recorder has to be present in every frame of a page as the page loads. Otherwise it misses the start of what you show it, and a run cannot act on the page. FluxIQ also uses this access to capture the visible tab as evidence for a step. |
| `tabs` | Read your browsing history | Automations open, switch, reload and close tabs. FluxIQ also tells your runtime which tab and address each step ran in. |
| `webNavigation` | Read your browsing history | FluxIQ follows every frame and every navigation as it starts, finishes or fails. This is how it acts inside embedded frames and tells a slow page from a failed one. |
| `downloads` | Manage your downloads | When a step saves a file, FluxIQ checks that the download finished. It only watches downloads: it never starts, opens or deletes one, and never reads what a file contains. |
| `scripting` | (included in site access) | Tabs that were open before you installed or updated FluxIQ lack its page script. FluxIQ adds the script to them, so your first run works without reloading them. It also reads the HTTP status of a page after a click. |
| `activeTab` | (none) | Keeps FluxIQ working in the current tab if you limit its site access to "on click". In Firefox, it also covers the time before you grant site access. |
| `storage` | (none) | Saves the connection address, your pairing and your panel preferences on this computer. |
| `sidePanel` (Chrome and Edge only) | (none) | Opens the FluxIQ panel in the browser's side panel. Firefox uses the toolbar popup instead. |

## What we considered narrowing, and why we didn't

- **Asking for site access per site** would break recording. Access granted
  mid-page arrives after the page has already loaded, and FluxIQ has to be
  there from the first moment it observes.
- **Making `downloads` optional** would make download steps fail until you
  granted it. The extension has no screen yet that asks at the right moment.
  The extension already handles the permission's absence: a download step then
  fails with a clear "permission not granted" error rather than passing
  unchecked. This is the most likely permission to move to optional later.
- **Dropping `tabs`** would mean relying on site access alone for tab
  addresses. That misses pages FluxIQ cannot script, such as the browser's own
  pages. FluxIQ needs to report those pages as unsupported rather than as
  blank.

## Limiting what FluxIQ can see

Both browsers let you limit FluxIQ's site access to specific sites:

- In Chrome or Edge, open the extension's details and use **Site access**.
- In Firefox, use **Permissions** in `about:addons`.

FluxIQ then works only on the sites you allow.
