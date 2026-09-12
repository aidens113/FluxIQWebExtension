# Report: w2-upload-dialog

Worker: `w2-upload-dialog`. Brief: `### Brief: w2-upload-dialog` in
[briefs/wave-2.md](../briefs/wave-2.md), coding against
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** Both stubs are replaced, both capabilities implemented, the
page-world script exists and is wired into all three manifests and the build,
the `downloads` permission is added for `w2-browser-actions`, and the content
harness injects the page-world bundle. All six tests in the new T2 spec pass.
No file outside my owns list was edited.

## What changed and why

### The page-world script, and why it had to exist

`alert`, `confirm`, and `prompt` block the page's script the moment they are
called. Nothing in an isolated content script can answer one *after* it opens —
by then nothing else in that page runs, which is exactly why the capability
audit recorded "while a native dialog is open the action fails on the message
round trip with a transport error". And a page that copies `window.confirm`
into a local before we replace it would keep calling the original. So the
override must be in the page's own world, installed at `document_start`.

- `src/page-world/index.ts` — entry, wiring only. New bundle.
- `src/page-world/dialog-override.ts` — replaces `alert`, `confirm`, `prompt`.

**Unarmed dialogs are left alone.** The original is called, the page behaves
exactly as it would without the extension, and what the user answered is
recorded as evidence. Only an armed dialog is answered without opening. That
keeps `web.dom.dialog` an explicit automation step rather than a standing
change to every page the extension touches.

### The cross-world channel (`src/shared/dialog-channel.ts`)

The two halves are separate bundles in separate JavaScript worlds and cannot
share a module instance, so they need a channel — and it has to be
**synchronous**: `arm()` must report whether the override is there before the
verb builds its result, and the override must read the arming while a
`confirm()` call is already on the stack. `postMessage` is a task, so it is
unusable for both.

The DOM is the only surface both worlds see synchronously. So:

- `arm()` writes the request to `data-fluxiq-dialog-arm` on the document
  element, then dispatches `fluxiq:dialog-arm` on `document`. **Listeners in
  both worlds receive a dispatched DOM event synchronously, on the dispatching
  call stack**, so by the time `dispatchEvent` returns an installed override has
  already consumed and removed the attribute. A still-present attribute means
  nobody was listening — `arm()` removes it and returns false.
- The override writes what it handled to `data-fluxiq-dialog-observed`;
  `observed()` reads it back.

Payloads are JSON strings rather than an event `detail`, because a structured
`detail` does not cross world boundaries uniformly across browsers. The module
imports nothing: both bundles include it, and the page-world bundle must stay
free of extension, domain, and Core code.

### Detecting the wrong world — the honest-failure path

`world: "MAIN"` is honoured only from **Chrome 111** and **Firefox 128**, and
`manifest.firefox.json` still declares `strict_min_version: 109.0`. On an older
browser the manifest entry is ignored and this bundle runs *isolated*, where
replacing `window.confirm` changes nothing a page script ever sees.

`installDialogOverride()` detects that: a content script in an isolated world
can reach `chrome.runtime.id`; a script in the page world cannot, because a page
has no extension API. When it sees a runtime it refuses to install, nothing
acknowledges the handshake, and the verb reports
`web.action.dialog_override_missing` rather than arming a dialog that will never
be answered. I did **not** bump `strict_min_version` — see Open questions.

### The two capabilities and two verbs

| File | Behaviour |
| --- | --- |
| `action-runtime/file-input.ts` | `DataTransfer` from the command's base64, then `input` and `change`; per-file and total byte bounds mirrored from the domain |
| `action-runtime/dialog-control.ts` | `arm` / `observed` over the channel above |
| `actions/upload.ts` | validation compares the names the input **ended up holding** with the request |
| `actions/dialog.ts` | arms; carries the last handled dialog as evidence |

Two deliberate choices:

- **The file names are read back off the element**, not echoed from the request,
  so an upload that silently put nothing anywhere reports `failed` with
  `output_not_observed` instead of success.
- **A target that cannot hold files is `rejected`, not a failed validation.** A
  `<button>` is not a post-condition that did not hold; it is an action that
  should never have been attempted. It reports
  `blocked_by_capability_or_policy` / `web.action.upload_rejected`.

**File contents never leave `file-input.ts`**: not logged, not put on the
result, not read back. Only names and sizes.

### `web.dom.dialog`'s post-condition — a divergence worth flagging

The Wave 2 contract says `observed()` "is the evidence the verb validates
against". It cannot be, at arm time: the dialog is opened by a *later* action
(the click that triggers it), so when this verb returns, nothing has been
observed yet. Waiting would deadlock — a native dialog blocks the page, so the
triggering action could never be delivered.

So the verb's own post-condition is **the arming** (passed when the page
acknowledged it, refused when the override is absent), and the dialog the
override handled is carried on the *next* dialog action as `extracted`
evidence. The spec proves the full loop through the fixture's own state.

### Manifests and build

All three manifests gain the `downloads` permission (for `w2-browser-actions`)
and a `world: "MAIN"` content-script entry for `page-world/index.js`, listed
before the isolated content script. `build-extension.mjs` gains a `page-world`
entry; the harness's global setup builds it and `harness.ts` injects it
**before** the `chrome.runtime` stub, because the override refuses to install
where it can see an extension runtime.

## Commands run and observed results

From `F:\!FluxIQWebExtension`, label `w2-upload-dialog`, every exit status
captured by redirecting to a file and echoing `$?`, never through a pipe. No
`pnpm build` and no `pnpm lab` command was run.

| Command | Observed |
| --- | --- |
| `pnpm --filter … extension check` | **exit 0** (clean run, after the churn below) |
| `EXTENSION_TEST_BUILD_LABEL=w2-upload-dialog pnpm --filter … extension test` | **exit 0** — `# tests 80 / # pass 80 / # fail 0` |
| `pnpm --filter … extension test:content` | exit 1 — **`116 passed`, 1 failed**; the failure is `identity.spec.ts:97`, not mine (below) |
| `node scripts/structure-audit.mjs` (scratch index) | **exit 0** — `passed (31 warning(s), 19 baselined)` |

My spec, all six green:

```text
ok 102 upload-dialog.spec.ts:27 › upload: puts the file on the input and validates the names it ended up holding (514ms)
ok 103 upload-dialog.spec.ts:49 › upload: W17 -- the fixture echoes the uploaded file once the form is submitted (640ms)
ok 104 upload-dialog.spec.ts:62 › upload: a target that cannot hold files is rejected, not reported as a success (512ms)
ok 105 upload-dialog.spec.ts:74 › dialog: an armed dismiss answers the native confirm, and the arming is consumed by it (616ms)
ok 106 upload-dialog.spec.ts:98 › dialog: an armed accept deletes the draft and is reported as evidence afterwards (757ms)
ok 107 upload-dialog.spec.ts:113 › dialog: a command with no dialog request is refused rather than arming nothing (511ms)
```

**Why the dialog tests are meaningful:** Playwright's own default is to
**dismiss** every native dialog. So an accepted `confirm` cannot come from the
test runner — if the override were missing, `confirm()` would open a real
dialog, Playwright would dismiss it, and the draft would survive. A deleted
draft (`deletePrompts: { accepted: 1, dismissed: 0 }` in the fixture oracle)
proves the override answered the call itself.

The structure audit was run through a **scratch git index**
(`GIT_INDEX_FILE`), with the four new files `git add -N`'d there, so twelve
concurrent workers' real index was never touched. `pnpm structure:baseline` was
not run, and no baseline entry was added or raised: 31 warnings / 19 baselined
is exactly w2-foundation's number.

### Failures in files I do not own (parallel edits, reran as instructed)

The tree churned throughout. Each of these was confirmed to be another
worker's in-progress edit, not mine:

- `actionability.ts`: `Cannot find name 'FOCUSABLE'` (w2-click) — gone on rerun.
- `describe-element.ts`: `Cannot redeclare block-scoped variable 'role'`
  (w2-identity-capture). This is a **hard JS error, so esbuild refused to bundle
  the content script** and `test:content` could not run at all for a while. It
  cleared, and the run above is from that window.
- `actions.spec.ts` type/keypress "untrusted" assertions failed in an earlier
  run (w2-keyboard-input's trusted-input change); they pass in the final run.
- `identity.spec.ts:97` "the name is the aria-labelledby target's text" is the
  one remaining failure — w2-identity-capture's own new spec.

One error was genuinely mine and is fixed: TypeScript 5.7 types `Uint8Array`
over `ArrayBufferLike`, which no longer satisfies `BlobPart`, so
`decodeBase64` now returns the `ArrayBuffer` itself.

## Not verified

- **No live browser validation.** `test:content` runs the real content and
  page-world bundles in headless Chromium, but nothing loaded the unpacked
  extension. In particular **the manifests' `world: "MAIN"` entry has never been
  exercised by a browser** — the harness injects the bundle with
  `addInitScript` instead. That the *entry builds* is proven (the harness's
  global setup calls `bundleExtensionEntry("page-world", …)`); that Chrome
  honours the manifest key here is not.
- **The Firefox isolated-world fallback is unexercised.** The
  `chrome.runtime.id` detection is the honest-failure path for Firefox
  109–127; no test runs it, because the harness deliberately injects the
  page-world script *before* the runtime stub so that it does install.
- **`pnpm build` was not run** (forbidden by the brief: it rewrites the tracked
  `build/` directory). So `dist/*/page-world/index.js` and the copied manifests
  are unverified end to end, though `buildTarget` copies `build/` wholesale.
- **The `downloads` permission is declared but unused** here; `chrome.downloads`
  is `w2-browser-actions`'.
- **`beforeunload` is in `ObservedDialog`'s kind union but not implemented.** It
  is not a function that can be replaced, so it needs a different mechanism.
- **Multi-file upload is coded but untested**; the fixture has a single-file
  input. The `multiple` guard is unexercised.
- **`prompt` is implemented but untested** — no fixture calls it. Only
  `confirm` is covered.
- Domain tests, `packages/test-runner`, and `packages/test-contracts` suites
  were not run; I changed no file in them.

## Open questions or contradictions found

1. **`strict_min_version: 109.0` vs `world: "MAIN"` (Firefox 128).** For 19
   Firefox versions the page-world entry is ignored and native dialogs are
   unanswerable — the verb fails honestly, but the capability is simply absent.
   Bumping the minimum to 128 would drop those versions for the *whole*
   extension, which is a product call, not mine. **The supervisor should decide**
   whether to bump it or document dialog control as Chrome-only for now.
   Chrome's own floor (111) is above the esbuild target (`chrome109`).
2. **The contract's "`observed()` is the evidence the verb validates against"
   cannot hold at arm time**, for the deadlock reason above. I validated the
   arming instead and carried the observed dialog to the next action. If the
   plan wants the dialog itself validated, it needs a different shape — an
   `expectDialog` field on the *triggering* action, so the click that opens the
   dialog reports what was answered.
3. **The observed-dialog attribute is written during recording too.** The
   recorder's `MutationObserver` watches `document.documentElement` with
   `attributes: true`, so a native dialog answered while recording adds one to
   the `dom.mutation` attribute count. It is a count, not content, and no
   recorded event carries the attribute — but Phase 1.4 may want the recorder to
   ignore the two `data-fluxiq-dialog-*` attributes.
4. **The channel is page-visible by construction.** A hostile page can read the
   armed response and forge an observed dialog. Nothing secret goes through it
   (the message is the page's own text; `promptText` is about to be handed to
   the page anyway), but it is not a trust boundary and should not become one.
5. **`web.dom.upload` cannot be recorded**, only dispatched — a real file
   chooser is user-driven. The scenario contract's `upload` step drives the
   recording lane; nothing maps a recorded interaction to `web.dom.upload`.
   Worth confirming that is intended in `w2-domain-vocabulary`'s mapping work.
