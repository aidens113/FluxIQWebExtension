# Report: w2i-gateway-params

Worker: `w2i-gateway-params`. Wave 2 integration, closing the gap
[w2-domain-vocabulary](./w2-domain-vocabulary.md) (open question 1) and
[w2-browser-actions](./w2-browser-actions.md) (open question 1) both reported:
the seven new action types existed in types, schemas, output nodes and manifest
outputs, but no parameter reached the command, so none could be driven from
Core.

## Outcome

**Done.** Every gate in the brief's definition of done was run and observed:
domain `check` and `test` pass, extension `check` passes, the structure audit is
clean at **exactly the pre-edit warning count**, and there is a test per lifted
parameter group proving the value reaches the command.

One deviation from the brief's owns list, called out for the supervisor to
accept or revert: I added one new module beside the file I own. Reasoning in
[The one deviation](#the-one-deviation-a-second-module).

## What changed and why

### The shape: typed command fields, not a second vocabulary

The brief told me to check what `w2-browser-actions`' readers expect before
choosing a shape. They read the typed field first and fall back to a raw
parameter (`command-options.ts`: `action.frameId ?? integerAt(options,
"browserFrameId")`, `action.tab ?? …`, `action.download?.filename ?? …`). The
content verbs read **only** the typed field: `check.ts` reads `action.checked`,
`assert.ts` `action.assert`, `extract-list.ts` `action.extractList`, `upload.ts`
`action.upload?.files`, `dialog.ts` `action.dialog`, and the older verbs
`action.option`, `action.scroll`, `action.wait`, `action.modifiers`.

So the lift fills the command fields named in `actions/types.ts`. Because
`w2-domain-vocabulary` shaped the schemas as those same fields, this is a
**validated copy, not a reshape** — one shape crosses the wire, which is what
`AGENTS.md` requires of a wire-protocol change. Both shapes therefore work
today: the typed field is now populated, and `options: parameters` still
carries the raw form the background readers fall back to.

### What is lifted

Everything the Wave 2 contract defines, not only the seven new actions'
parameters — the eleven older actions' new parameters were dead in exactly the
same way.

| Command field | From | Notes |
| --- | --- | --- |
| `tabId`, `frameId` | `browserTabId`/`browserFrameId`, else `tabId`/`frameId` | Both names, because `command-options.ts` falls back to the `browser…` pair |
| `newTab` | `newTab` | navigate |
| `checked` | `checked` | check |
| `assert` | `assert{kind,expected,timeoutMs}` | kind held to the six |
| `extractList` | `extractList{item,fields,paginate{next,maxPages},maxItems}` | |
| `upload` | `upload{files[{name,mimeType,contentBase64}]}` | bounded, below |
| `dialog` | `dialog{response,promptText}` | |
| `tab` | `tab{operation,url,active,tabId,urlPattern}` | per-operation fields only |
| `download` | `download{filename,timeoutMs}` | |
| `option`, `scroll`, `wait`, `modifiers` | same names | the eleven's Wave 2 parameters |

### Refuse, never coerce

A value of the wrong shape is **not** lifted. The command field stays absent and
the raw parameter stays visible in `options`, so the verb refuses the command
with its own message instead of acting on a half-formed request. This follows
the repository's own rule that an unmapped input must not become executable, and
matches what `command-options.ts` already does ("refuses a malformed value
rather than coercing it, so a bad parameter fails the action instead of silently
retargeting it at another tab").

Four decisions inside that rule are worth recording, because each could
reasonably have gone the other way:

1. **A present-but-malformed `paginate` refuses the whole `extractList`.**
   Dropping just the pagination would quietly read page one of a request that
   asked for several — a silent partial extraction, which is worse than a clear
   failure.
2. **One bad or oversized file refuses the whole `upload`.** Dropping the
   offending file would put a *different set of files* on the page than the Flow
   asked for.
3. **`promptText` is carried only with `accept`.** The contract says it is the
   reply to a prompt and only with `accept`; beside a dismissal it answers
   nothing.
4. **`0` survives where it is meaningful** — it is the top frame and the first
   option index — but is refused as a count or a duration. Three separate
   numeric readers exist for exactly this reason.

### The two bounds that were documented but unenforced

- **Upload bytes.** `file-input.ts` says its limits are "the page-side backstop"
  and that "the domain schema enforces the same bounds on the way in". The
  schema does **not**: it has no length bound on `contentBase64`. That promise is
  now true — the lift computes each file's decoded size from the base64 length
  without decoding it, and enforces `WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES` and
  `..._MAX_TOTAL_BYTES`.
- **Pagination.** `maxPages` is held to `WEB_AUTOMATION_EXTRACT_MAX_PAGES`, the
  same bound `list-extraction.ts` applies, so the two agree exactly rather than
  disagreeing. I clamped rather than refused here, deliberately: the page-side
  reader already clamps, so clamping keeps a Flow authored with a too-large
  value working and bounded, where refusing would make it silently
  non-executable.

### `tabId` is not the tab a tab-operation acts on

`command.tabId` means "the tab this action runs in". The tab a
`web.browser.tab` switch or close acts on travels inside `tab`, and is not
lifted to the top level. A test asserts that distinction, because conflating
them would point an operation at the wrong tab.

### The one deviation: a second module

With the readers inline, `gateway-mapping.ts` reached **444 lines**, past the
audit's 400-line advisory threshold — a warning my change would have introduced
where none existed. I could have reached 400 only by stripping the explanatory
comments, which is not this codebase's style and would have traded a real
explanation for a number.

The threshold was diagnosing something true: the file now held three
responsibilities (recording-event mapping, action-type normalization, parameter
validation). So the readers live in **`domain/src/client/gateway-action-parameters.ts`**
(278 lines, one exported function and one exported type), imported by
`gateway-mapping.ts`, which is back to **205 lines**.

This file is not in my brief's owns list. It is a *new* file in the directory I
work in, no Wave 2 brief touches it, and it needs no barrel change (a
same-directory import stands between no barrel). I judged a new focused module
better than either a new audit warning or gutted comments, but the supervisor
should confirm it, since the brief partitioned by file.

### Tests

`domain/src/client/tests/gateway-command-parameters.test.ts` (166 lines), one
group per lifted parameter, each asserting the value **reaches the command
field** and that a malformed one does not. It also asserts the pre-Wave-2
contract is unchanged — the flat fields, a legacy dotted type, and a
command with no parameters at all. The pre-existing
`gateway-mapping.test.ts` is untouched and still passes.

## Commands run and observed results

From `F:\!FluxIQWebExtension`, with `DOMAIN_TEST_BUILD_LABEL` and
`EXTENSION_TEST_BUILD_LABEL` both set to `w2i-gateway-params`. Every exit status
was captured by redirecting to a file and echoing `$?`, never through a pipe. I
ran no `pnpm build`, no `pnpm lab` command, and no `pnpm structure:baseline`.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/domain check` | **exit 0** (no diagnostics) |
| `pnpm --filter …/domain test` | **exit 0** — `# tests 73 / # pass 73 / # fail 0`, including `Web automation gateway command parameter tests passed.` |
| `pnpm --filter …/extension check` | first run exit 2, **rerun exit 0** |
| `pnpm --filter …/extension test` | **exit 0** — `# tests 122 / # pass 122 / # fail 0` (not required by my brief; run because my change feeds the commands those tests build) |
| `node scripts/structure-audit.mjs` (scratch index, both new files staged) | **exit 0** — `passed (31 warning(s), 19 baselined)` |

**The audit number is identical to the reading I took before editing anything**
(`passed (31 warning(s), 19 baselined)`), so this work added no finding of any
severity and none cites a file of mine. Files: `gateway-mapping.ts` 205 lines,
`gateway-action-parameters.ts` 278, both under the 400-line advisory; exported
values 8 and 1, under the 8-value advisory and the 15-value limit.

**Audit method.** The audit reads only tracked files, so the two new files were
staged into a **scratch index** (`GIT_INDEX_FILE` under my scratchpad,
`git read-tree HEAD` then `git add -N`), leaving the real index untouched for the
workers running beside me.

### The first extension check failed in another worker's file

Three errors, all in `src/background/connection/browser-state.ts`, importing
`UNSUPPORTED_BROWSER_PAGE_REASON`, `UNSUPPORTED_STORE_PAGE_REASON` and
`unsupportedAutomationPageReason` from `../../runtime`, which did not export
them yet. That is `w2-browser-actions`' open question 3 being acted on by
someone — `runtime/index.ts` had not yet caught up with
`runtime/unsupported-page.ts`. I reran once as the brief directs and it exited
0. Nothing in `domain/src` errored on either run, and I touched no file under
`apps/`.

### My footprint

`git status -- domain/src/client` shows exactly three entries: `gateway-mapping.ts`
modified, `gateway-action-parameters.ts` and `tests/gateway-command-parameters.test.ts`
new. Nothing under `apps/` or `packages/`. My labelled test builds went to
`domain/.test-build-scratch/w2i-gateway-params/`; the tracked
`domain/.test-build/` holds no bundle of my new test, confirming I never wrote
there. (Several tracked `.test-build/*.mjs` files *are* modified in the working
tree — an unlabelled domain test run by another worker, not mine to regenerate.)

## Not verified

- **Nothing ran in a browser, and no Flow was dispatched end to end.** I proved
  the parameters reach `WebAutomationActionCommand`; I did not prove any of the
  seven actions then *executes* from Core. That still needs a live run, and it
  is the claim the phase actually cares about. `pnpm lab` and `pnpm build` are
  forbidden to me.
- **The content harness never ran** (`test:content`), so no verb was exercised
  against a real DOM with a lifted parameter.
- **The upload byte bounds are proven only against the base64 length
  arithmetic**, not against a real file: `base64ByteLength` is tested through
  the lift with synthetic content, and no upload has been decoded by a page.
- **No test asserts the *extension* reads what the domain now writes.** The two
  sides are tested separately; the contract between them is typed, not
  exercised. A cross-repository or Lab test is what would close that.
- **Root `pnpm check`, `pnpm test`, `pnpm build`** were not run, nor the
  `packages/` suites — I changed no file in them.
- I did not re-run `pnpm --filter …/extension test:content` or verify how the
  panel renders any of this.

## Open questions or contradictions found

1. **A refused `upload` produces a poor diagnostic.** When the lift refuses an
   oversized or malformed upload, `upload.ts` sees `action.upload?.files ?? []`
   and reports "the command carried no files" — true, but it does not say *why*.
   The precise reason (which file, how many bytes over) exists only in the
   page-side backstop, which is never reached. The mapper has no rejection
   channel for a *valid* action type with an unusable parameter: the only
   rejection it can build is `web.action.unsupported_type`. Giving it a second
   failure code — a parameter-level capability refusal — would fix this for
   every refused parameter, not just upload. That is a contract change beyond my
   brief.
2. **`browserFrameId` / `browserTabId` remain unconfirmed names.**
   `w2-browser-actions` invented them (its open question 2) and I now read them
   in the domain, so the same unverified name exists on both sides. If Core or a
   Flow author expects something else, it is one line in each place — but it is
   now two places.
3. **`maxPages` is clamped in two modules.** `paginationValue` and
   `list-extraction.ts` both hold it to 50, from two restatements of the same
   constant (the content bundle cannot import the domain barrel). They agree
   today and a domain test asserts the extension's copy equals
   `WEB_AUTOMATION_EXTRACT_MAX_PAGES`, so the drift is guarded — worth knowing
   it is guarded by a test rather than by a shared value.
4. **The seven actions' schemas require the structured parameter** (e.g.
   `web.dom.assert` requires `assert`), so a Flow authored through the schema
   always produces a liftable shape. A Flow built by hand or by an LLM against
   the older flat vocabulary will not, and will now fail clearly rather than
   silently — an improvement, but a behaviour change for any such Flow that
   exists.
5. **`webAutomationActionResultPayload` still omits `failure`**, as
   w2-foundation and w2-browser-actions both noted. It is in the file I own, but
   is a *result*-path gap, not a parameter one, and my brief scopes me to the
   command lift. Untouched, and still open.
