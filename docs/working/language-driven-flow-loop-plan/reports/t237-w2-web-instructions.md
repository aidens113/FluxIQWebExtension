# t237 W2: web domain system instructions

## Outcome

Done.

## What changed and why

- `domain/src/runtime/llm-evidence/system-instructions.ts` (new): exports
  `WEB_LLM_SYSTEM_INSTRUCTIONS: { readonly version: string; readonly text: string }`,
  version `web-1`, frozen, structural type only (no Core import). Text length
  **1,964 characters** (measured `text.length`), recorded in a file comment.
- `domain/src/runtime/llm-evidence/tests/system-instructions.test.ts` (new): 9
  node:test cases pinning the version pattern, no control chars but `\n`,
  length <= 2,500, and the key sentences (website on the person's behalf;
  site search vs `find_on_page`; close covering popup first then retry; consent
  banners; one item + "state repeat"; money/delete/send-publish asked; no
  passwords/secrets; no CAPTCHA; few decisions / cost ceiling) plus the
  page-view terms.
- `domain/src/runtime/llm-evidence/index.ts`: one export line (with a two-line
  comment) appended, since the barrel re-exports the module's public surface.
  `tools.ts` not touched.

Term verification against the renderer: PAGE/URL/VIEW/COVERING/DIALOG
(`page-view/header.ts`); `<handle> [heading tag] <kind> "<words>" <state>`
(`line-render.ts`); `[region]` markers such as `[main]`, `[search]`,
`[dialog tN]`, `- i/n` (only lists of more than one), `--- below the fold ---`
(`structure-markers.ts`); `field[search]` (`element/kind.ts`); `placeholder`,
`covered-by`, `selected`, `pressed`, `current`, `marked`, `=value`, `checked`,
`open/closed`, `disabled` (`element/state-tokens.ts`); `~` base
(`link-writer.ts`). Every term in the brief is real. Confirmed against the live
page view `lab-runs/2026-10-01/run-muqbzu32-8691a65e/steps/0004-tool-core.run_node/page.txt`
(the brief's `0003-decide/request.json` holds no page view; the page arrives in
the preceding tool step). No page data was copied into source.

Duplication avoided: `find_on_page`'s description already lists kinds and the
general line shape, so the text names only what it lacks (COVERING/DIALOG,
what covered-by means for a press, field[search] as the site search, the
t229 states). The list routing word is "state repeat", matching Core's decision
prose ("do it to one item and state repeat").

## Final text (1,964 characters)

```text
You operate a real website in the person's own browser, through the FluxIQ extension, on their behalf, to build a Flow that does their instruction on that site.

Reading the page view. Header lines first: PAGE is the title, URL the address (~ stands for the base it names), VIEW the window and how far it is scrolled, COVERING a popup, banner or layer in front of the page, DIALOG an open dialog. Then one line per element in page order: <handle> <kind> "<words>" <state>. Copy a handle (tN) exactly to act on it. field[search] is the site's own search box. State tokens include ="value", placeholder "...", checked, open or closed, selected, pressed, current (the page a menu says you are on), marked (the option drawn as chosen, such as a size), disabled, and covered-by tN: another element, tN, lies over this one, so a press on it lands on tN instead. [main], [search] or [dialog tN] name the region the lines below sit in, - i/n is item i of a list of n, and --- below the fold --- marks lines off screen.

Finding things. To reach a product, page or record, use the site's own search (type into its field[search] and submit) and its menus and links. find_on_page searches only the page you are already on; it never searches the site.

Popups. When a COVERING or DIALOG line is shown, or the control you want is covered-by another element, first close that popup or banner with its own close control (Close, x, No thanks), then retry. A cookie or consent banner may be accepted or dismissed.

Lists. Do each act once, on one item. To do it to every item of a list, do it to one item and state repeat.

Limits. Anything a person could do on the site is allowed, but acts that spend money, delete something, or send or publish something are asked of the person first. Never type a password or other secret. Never solve a robot check (CAPTCHA); say that one blocks you.

Be efficient: use as few decisions as the task needs. Every build has a small cost ceiling.
```

## Commands run and observed results

- Domain test runner (`domain/scripts/test-domain.mjs`) has no label filter; it
  bundles every test. Ran only this test with the same esbuild options
  (bundle, node22, esm, `fluxiq` external) into the scratchpad, then node:
  `node si.test.mjs` -> `# tests 9 # pass 9 # fail 0`.
- Length: `node -e` import of the bundled module -> `web-1 1964`.
- `pnpm --filter @fluxiq-web-extension/domain check` (after the barrel line)
  -> exit 0, no tsc diagnostics.

## Not verified

- Full domain `pnpm test` (the full suite, not requested; needs a Core build).
- Structure audit not run.
- The Core seam itself and the wiring in `tools.ts` (the lead's).
- Model behaviour with the text in place (needs a live run).

## Open questions or contradictions found

- "asked of the person" assumes Core's permission gate asks before money,
  delete and send acts; the text does not tell the model how to ask.
- Brief example path `0003-decide/request.json` holds no page view; used the
  step 0004 `page.txt` instead.
