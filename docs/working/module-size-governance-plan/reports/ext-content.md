# Worker report: ext-content

Split `apps/extension/src/content/index.ts` (1,188 lines) into sibling modules,
leaving `index.ts` as a 25-line entry point that wires them together.

## Outcome

**Done**, with the honest qualification the brief asked for: **types check, the
package smoke test passes, the load-order and message-reply behaviour is
identical under a stubbed-DOM harness, and runtime in a real browser is
unverified.** I cannot load an unpacked extension here, and the Playwright e2e
suite needs browsers, so no claim in this report is a claim about a real page.

## What changed and why

`index.ts` held four responsibilities in one body — bootstrap, DOM event wiring,
DOM interrogation, and `chrome.runtime` message handling — plus the type
declarations, the wire constants, and all of the recorder's mutable state. It is
now 25 lines: four calls in the order the original top-level statements ran.

### Module map

| Module | Lines | Owns |
| --- | ---: | --- |
| `index.ts` | 25 | Entry point. Order of bootstrap, nothing else. |
| `types.ts` | 91 | The wire shapes: JSON envelope, DOM descriptors, action command/result. |
| `messages.ts` | 10 | The four wire-visible message names, in one place. |
| `instance.ts` | 18 | Which injected copy of the script owns the window; script version. |
| `capture-settings.ts` | 10 | The three capture flags, as a leaf module so nothing cycles on them. |
| `compact-object.ts` | 4 | Drops `undefined` before a payload goes on the wire. |
| `frame-geometry.ts` | 103 | Cross-frame viewport offset: the bridge, the request, the cache. |
| `element-traits.ts` | 125 | What kind of thing an element is, including what is sensitive. |
| `visual-bounds.ts` | 141 | Where an element appears, with the text-range fallbacks. |
| `describe-element.ts` | 135 | One element to one descriptor, plus the field accessors. |
| `dom-snapshot.ts` | 174 | The state snapshot: candidates, inclusion, ranking, truncation. |
| `event-elements.ts` | 68 | Elements the user has touched; resolving a target from an event. |
| `recorder.ts` | 128 | The recording pipeline: emit, payload, start/stop, input and mutation batching. |
| `action-runtime.ts` | 190 | Page-side capabilities `actions.ts` executes against; result shaping. |
| `message-handler.ts` | 44 | The `chrome.runtime.onMessage` contract. |
| `dom-events.ts` | 161 | The eight recording listeners, in registration order. |

Pre-existing siblings kept: `actions.ts` (102, its duplicated type block now
re-exported from `types.ts`), `element-finder.ts` (67, untouched),
`snapshots.ts` (7, untouched).

Largest file in `content/`: 190 lines. Total across the directory went from
1,410 to 1,603 lines; the ~190-line increase is import statements and the
file-header comments explaining each module's responsibility.

### Decisions worth reviewing

**Flat, not nested.** The methodology would suggest `content/dom/`,
`content/element/`, and so on. That is not available here: `content/index.ts`
makes `content/` a *barrel directory* to the `imports` rule, so any
`content/<sub>/x.ts` importing `../recorder` is a hard failure. I measured this
rather than assuming it — see the subdirectory probe under Commands. Flat also
keeps every intra-module import same-directory, which the rule exempts outright.

**The capture flags became one object.** `captureMutations`,
`captureInputValues`, and `captureSnapshots` were three module-local `let`s read
from four modules, so they are now `captureSettings.mutations`,
`.inputValues`, and `.snapshots` in a leaf module. These were never exported
symbols, and **the wire field names are unchanged** — `message-handler.ts` still
reads `typed.settings?.captureMutations` and friends, verbatim.

**`meaningfulText` sits in `element-traits.ts`.** It is a string predicate, not
an element trait, but `visual-bounds.ts` and `dom-snapshot.ts` both need it, and
its natural home (`describe-element.ts`) would have created a cycle with
`visual-bounds.ts`. Noted rather than hidden.

**No unit tests were added, and I could not add them.** The brief's shared
context asks for a test beside each extracted module. `apps/extension` has no
unit test runner: `pnpm test` is `node scripts/smoke-test.mjs`, which only
asserts five files exist, and there are zero `*.test.ts` files anywhere under
`apps/extension/src`. Adding one would mean editing `apps/extension/package.json`
and its devDependencies, which my brief lists outside what I own, and these
modules need a DOM the repository has no harness for. I built the verification
harness described below instead and left it in my scratchpad rather than
committing a test nothing runs — the `Current State` already records three such
orphaned test files in `domain/` as a defect. **This is the one part of the
definition of done I did not meet; the supervisor should decide whether
`apps/extension` gets a unit runner as separate work.**

## Commands run and observed results

### 1. Type check and smoke test

```
pnpm --filter @fluxiq-web-extension/extension check
> tsc -p tsconfig.json --noEmit
(no output, exit 0)

pnpm --filter @fluxiq-web-extension/extension test
> node scripts/smoke-test.mjs
Extension smoke test passed.
```

Both were green before I started, and are green now. The smoke test only checks
that `src/content/index.ts` exists, so it proves nothing about the split beyond
the entry point still being where the manifest and `background/tabs.ts` expect.

### 2. Load-order and message-reply harness (the real evidence)

Compilation is not validation, so I bundled the content entry with the same
esbuild settings the extension build uses (`format: "iife"`, `target:
["chrome109","firefox109"]`) and ran the bundle in a `node:vm` context with a
stubbed `window`, `document`, `chrome.runtime`, and `MutationObserver` that
records every registration and reply in the order it happens. Harness:
`<scratchpad>/content-probe.mjs`; captured runs: `before-trace.txt`,
`after-trace.txt`.

Trace **before** the split (unchanged lines omitted from neither side):

```
--- module load ---
chrome.runtime.sendMessage type=fluxiq.contentReady payload.kind=content.ready keys=[kind,sequence,url,title,eventTimestampMs,metadata]
window.addEventListener("message", capture=undefined)
window.addEventListener("resize", capture=true)
window.addEventListener("scroll", capture=true)
chrome.runtime.onMessage.addListener
document.addEventListener("pointerdown", capture=true)
document.addEventListener("click", capture=true)
document.addEventListener("input", capture=true)
document.addEventListener("change", capture=true)
document.addEventListener("submit", capture=true)
document.addEventListener("keydown", capture=true)
document.addEventListener("wheel", capture=true)
window.addEventListener("scroll", capture=true)
new MutationObserver
--- module load complete ---
--- message handler replies ---
onMessage("fluxiq.ping") -> returned false; sendResponse {"ok":true,"active":true,"version":<n>}
MutationObserver.observe({"childList":true,"subtree":true,"attributes":true,"characterData":true})
onMessage("recording") -> returned true; sendResponse {"ok":true}
onMessage("captureSnapshot") -> returned true; sendResponse {"url":...,"viewport":{...},"frame":{"isTop":true,...},"interactiveElements":[]}
onMessage("executeAction") -> returned true; sendResponse {"commandId":"c1","actionType":"web.dom.scroll","status":"succeeded","message":"Page scrolled.",...}
onMessage("executeAction") -> returned true; sendResponse {"commandId":"c2","actionType":"unsupported.thing","status":"failed","message":"Unsupported action type: unsupported.thing",...}
onMessage("unknown.message") -> returned false; sendResponse <no sendResponse>
MutationObserver.disconnect
onMessage("recording") -> returned true; sendResponse {"ok":true}
--- registered listener types, in registration order ---
window: message, resize, scroll, scroll
document: pointerdown, click, input, change, submit, keydown, wheel
```

`diff before-trace.txt after-trace.txt` after the split:

```
1a2
> new MutationObserver
15d15
< new MutationObserver
```

**That is the entire difference, and it is not a listener.** Every
`addEventListener` call — target, type, capture flag, and position in the
sequence — is identical; `chrome.runtime.onMessage.addListener` still lands
after the three frame-geometry listeners and before the seven document
listeners; the `fluxiq.contentReady` message is still the first thing that
happens; and every reply body and every `true`/`false` return from the message
handler is byte-identical, including the async ones and the recorder settings
being honoured (`captureSnapshots: false` is why the second `executeAction`
carries no snapshot).

The one moved line: `new MutationObserver(callback)` used to be the last
top-level statement of the single file and is now a module-level constant in
`recorder.ts`, so it is constructed during module evaluation instead of after
the listeners register. **A MutationObserver registers nothing on construction**
— it becomes live only at `observe()`, which the trace shows still happening at
exactly the same point, inside `setRecordingState` on the first `recording`
message, with identical options. Same observer, same lifetime, same count, one
step earlier in the load phase. I could have made it lazy to move the line
somewhere else in the diff, but not to remove the diff, and lazy construction
would have been a real behaviour change rather than a cosmetic one.

### 3. Wire-visible strings

Every string literal and template chunk in `apps/extension/src/content/**`
(module specifiers excluded), via the TypeScript AST, deduplicated and sorted —
`<scratchpad>/string-literals.mjs`:

```
diff before-strings.txt after-strings.txt
STRING LITERALS IDENTICAL
185 after-strings.txt
```

185 literals before, 185 after, no difference. That covers all four message
names (`fluxiq.contentEvent`, `fluxiq.contentReady`,
`fluxiq.frameGeometryRequest`, `fluxiq.frameGeometryResponse`), the four
inbound message types (`fluxiq.ping`, `recording`, `captureSnapshot`,
`executeAction`), the instance key
(`__fluxiqWebAutomationActiveContentInstance`), every `dom.*` event kind, every
`web.dom.*` action type, and every selector string.

`chrome.runtime` call sites, before then after:

```
index.ts:124  chrome.runtime.onMessage.addListener(...)     ->  message-handler.ts:16
index.ts:290  chrome.runtime.sendMessage({ type: CONTENT_READY, payload })  ->  recorder.ts:52
index.ts:302  chrome.runtime.sendMessage({ type: CONTENT_EVENT, payload })  ->  recorder.ts:59
```

Three call sites before, the same three after, same payload expressions.

### 4. Exported surface

`content/index.ts` exported nothing before and exports nothing after — it is a
content-script entry bundled as an IIFE, not a barrel:

```
index.ts exports before: 0
index.ts exports after:  0
```

`actions.ts` keeps its exported type names by re-exporting them from
`types.ts` (`RectDescriptor`, `DomElementDescriptor`, `DomSnapshot`,
`BrowserActionCommand`, `BrowserActionResult`) alongside its own
`ContentActionDependencies` and `executeContentAction`. No exported symbol in
`content/` was renamed or removed.

### 5. Structure audit

I did **not** run `pnpm structure:baseline`. Read-only run of
`node scripts/structure-audit.mjs`:

```
failures: ["docs/working/README.md"]
warnings mentioning content:
  apps/extension/src/content/: 19 source files is past the 15-file advisory threshold.
  apps/extension/src/content/element-traits.ts: 11 exported values is past the 8-value advisory threshold.
```

Zero failures from this work. The single failure is the working-document index
being stale against `module-size-governance-plan.md`, which was already modified
in the tree when I started and is the supervisor's to regenerate. The two
content warnings are advisory (`severity: "warn"`, `ratchet: false`) and do not
affect the exit code; I judged 19 single-responsibility modules better than
merging unrelated ones to get under an advisory line.

`content/index.ts` at 1,188 lines is gone from `file-lines` entirely rather than
merely lowered, so the baseline key `apps/extension/src/content/index.ts` should
disappear when the supervisor regenerates.

**One thing to know about that audit run:** the audit reads `git ls-files`, so
it is blind to untracked files. Run against the working tree as-is it reported
*nothing* about my 15 new modules. I therefore ran `git add -N` on
`apps/extension/src/content/*.ts` so the audit could see them, and **left that
intent-to-add registration in place** — `git status` now shows those files as
`A` rather than `??`. Nothing is staged for content and no commit was made. If
the supervisor prefers them untracked again, `git reset -- apps/extension/src/content` restores it.

### 6. Subdirectory probe (why the layout is flat)

To check the claim rather than assert it, I temporarily created
`content/probe-sub/x.ts` importing `../recorder`, registered it, and ran the
audit:

```
FAIL  [imports] apps/extension/src/content/probe-sub/x.ts: 1 import(s) reach into
      another directory's files instead of its barrel, e.g. "../recorder" at line 1.
```

Removed immediately afterwards; `content/` contains no `probe-sub`. This is the
mechanism: `barrelDirectories()` in `scripts/structure-audit/rules/imports.mjs`
treats any directory containing `index.ts` as a barrel, and `content/index.ts`
is an entry point that happens to be named `index`. Grouping these modules into
subdirectories would need either a real `content/` barrel (which an IIFE entry
point cannot be) or an exemption in the rule — a Core change, out of scope here.

## Not verified

- **Anything in a real browser.** No extension was loaded, no page was visited,
  no recording was made, no action executed against a live DOM. Every claim
  above is from type checking, a stubbed-DOM harness, and static comparison.
- **The Playwright e2e suite** (`apps/extension/e2e/action.spec.ts`,
  `install-and-content.spec.ts`, `network-policy.spec.ts`,
  `resilience-and-isolation.spec.ts`) was not run — it needs browsers and a full
  `pnpm build`. These specs are the existing coverage for exactly what I touched
  (content injection, action execution, instance isolation) and are the right
  gate before this is trusted. They do not import content sources directly, so
  the refactor cannot have broken them at compile time.
- **`pnpm build`** was not run. It rewrites the tracked `apps/extension/build/`
  and would collide with the concurrent `ext-connection` worker's output. The
  content entry bundles cleanly — the harness bundles it with the same esbuild
  settings on every run — but the full multi-entry build is unexercised.
- **Cross-frame geometry**, which needs a real iframe hierarchy: the bridge's
  listeners are registered in the same order with the same messages, but the
  parent/child exchange itself was not executed.
- **Root `pnpm check` and `pnpm test`** were not run; `pnpm check` currently
  fails on the stale `docs/working/README.md` regardless of this work, and the
  background package is being edited concurrently.
- **Shadow DOM, `composedPath`, and untrusted-event paths** in `dom-events.ts`
  are copied verbatim but never executed by the harness.

## Open questions or contradictions found

1. **The brief's test requirement cannot be met inside the brief's ownership
   boundary.** `apps/extension` has no unit test runner and I own only
   `src/content/**`. Either `apps/extension` gets one as separate work, or the
   e2e suite is accepted as this directory's coverage. I did not silently skip
   this — see the decision note above.
2. **`content/` cannot be subdivided while `index.ts` is both an entry point and
   the thing the `imports` rule reads as a barrel.** This affects the other
   entry points too (`background/`, `popup/`, `sidepanel/` all have an
   `index.ts`), so any future split in those directories faces the same
   constraint. Worth a rule change in Core if nesting is wanted: exempting a
   directory whose `index` file exports nothing would be the narrow fix.
3. **The audit is blind to untracked files.** A worker that adds files and runs
   `structure:check` gets a clean report that means nothing. Worth stating in the
   plan's brief template — a future worker will hit this and believe the pass.
4. **`apps/extension/src/content/` is at 19 files against a 15-file advisory.**
   It will fail at 25. With nesting unavailable (point 2), the next extraction in
   this directory has six files of headroom.
