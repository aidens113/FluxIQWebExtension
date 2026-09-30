# FluxIQ Web Automation: User Guide

FluxIQ uses AI to build and adapt your automation, then reuses what it learns
so routine runs can execute without repeatedly relying on AI.

It has two parts that work together:

- **The FluxIQ runtime.** It runs on your computer, serves the FluxIQ web app
  at `http://127.0.0.1:3000`, and stores your automations.
- **The FluxIQ browser extension.** It records what you show it, reads the pages
  you automate, and carries out each step in your browser. It talks only to
  the runtime you pair it with.

| Guide | What it covers |
| --- | --- |
| [Install](install.md) | Installing the runtime and the extension in Chrome, Edge or Firefox, updating, uninstalling, and where to find diagnostics |
| [Quickstart](quickstart.md) | Going from nothing to a working automation in about five minutes |
| [Permissions](permissions.md) | Each browser permission the extension asks for, and why |
| [Privacy policy](privacy-policy.md) | What data the extension reads, where it goes, and what never leaves your computer |
| [Store listing](store-listing.md) | The Chrome Web Store and Firefox Add-ons listing text and the submission checklist (for maintainers) |

## Supported browsers

| Browser | Minimum version | Where the FluxIQ panel opens |
| --- | --- | --- |
| Google Chrome | 116 | Side panel |
| Microsoft Edge | 116 | Side panel |
| Mozilla Firefox | 128 | Toolbar popup |

Each minimum is set by an API the extension needs. Chrome and Edge 116 added
the side-panel behaviour the toolbar button uses. Firefox 128 added page-level
content scripts, which FluxIQ uses to handle a page's own `alert`, `confirm` and
`prompt` dialogs during a run.
