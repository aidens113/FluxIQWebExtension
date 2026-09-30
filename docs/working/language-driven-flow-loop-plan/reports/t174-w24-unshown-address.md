# t174-w24: a build may not navigate to an address it was never shown

## Outcome

Done. During a build, a `web.browser.navigate` to an address the build was never shown is now refused with
`web.action.rejected.address_not_shown` before the command goes out. The refusal hands back the current
page, so the model can press the link on it, and its `instead` gives the two ways to get there. Replay
and playback of a saved Flow are unchanged. Tests were written first, failed, and now pass. Final run:
domain 985/985, `domain check` exit 0, structure audit passed.

## What was already recorded (step 1)

- Packets (`sanitize.ts`, `location.ts`) keep only origin and path for the page `location` and for every
  link `href`. **The model is never shown a query string.** Queries appear only in a read's payload
  (`node-run/read-result.ts`, returned bounded to the model) and in the start location Core passes in.
- Before this change the domain recorded no addresses. `tools.ts` `shown` kept packets for handles and
  repair (`returnedEvidence`, `targetPackets`), and `arrival.ts` kept one bit per build. Nothing kept
  addresses, and the page's raw query was dropped at sanitize time. So I added a per-build memory.

## The rule (steps 2 and 4)

A navigation address is compared by origin, by path with any trailing slash removed, and by the set of
query keys. The fragment is ignored. Only absolute http(s) addresses and root-relative ones (`/…`, resolved
against the current page or the start location) are judged. Anything else, including a non-string `url`,
goes to the origin check and the page as before.

A navigation is **allowed** when its path matches one of these:
- the start location;
- the location of any packet this build was shown, which covers every page it stood on, including pages
  it reached by pressing;
- any link `href` in a shown packet;
- any address-shaped string (`/…` or `http(s)://…`) in a read result the model was shown, with its query.

**Query rule.** A target with no query needs only a matching path. A target with a query also needs a
record on that path with the same keys. Each value must be equal, **or** the recorded value must be text
this build typed with `web.dom.type` (compared after trimming, collapsing spaces and lowercasing). So a
search the build ran itself (type "paper towels", press, land on `/search?q=paper+towels&store=12`) can
be run again with other words (`/search?store=12&q=napkins`). These are still refused: a new key
(`&sort=price`), a changed store id, `?variant=2` on an item path (the query was never shown), and a
search the build never ran. Why this is justified: the site produced that exact address shape for this
build, and only the value the build itself typed may vary.

Anything else is refused with code `address_not_shown`. Its detail is `reason: "address_not_shown"` plus
two `instead` strings:
- `web.output.dom-click with target: {"handle": "target.N"} of the link that goes there, from the packet`
- `web.output.browser-navigate with url: an address from the evidence -- a link's href, a page's location, a read's address, or the start location`

It also carries `startLocation` when there is one. The current page comes back as `page` when it fits the
budget. `resultReason` is `address_not_shown`, and `draft.ranWith` is absent, so the refused step never
reaches the Flow.

**Memory.** Kept per (session, project, flow). At most 16 builds, 512 addresses per build and 16 typed
texts, with the oldest dropped first. A build's opening call (`initial.`) clears it, the same way it
re-arms arrival. The page query stays inside the domain on the binding (`pageQuery`), like selectors, and
is never put in a packet.

**Step 3 (replay).** Replay (`replay: "step"` / `"reset"`) returns before the check in `run.ts`, so a dry
run and a saved Flow's navigation go to what the step holds. A test covers it. A `rerun` amendment
(`rerun.N` call ids, Core `evidence-loop/rerun-request.ts`) is an ordinary node call, so it is checked.
Run 28's re-pointed s9 went through that path at iterations 19–20. Core's draft cannot change a step's
input other than by rerunning it (`flow-draft/amendment.ts:148`).

## What changed and why

- `domain/src/runtime/llm-evidence/node-run/shown-addresses.ts` (new): the per-build memory (`opening`,
  `saw`, `ran`, `refuses`) and `webUnshownAddressRefusal`.
- `node-run/run.ts`: a new `addresses` field on `WebNodeRun`. It re-arms on the opening call, runs the
  check right after the cross-origin check (refusing with the current page), and records what a
  successful node typed and read. Now 790 lines, still under the 800 limit.
- `node-run/arrival.ts`: exports `webNodeOpensBuild` and `WebNodeBuildKey`, so both memories read Core's
  `initial.` naming in one place.
- `node-run/index.ts`: barrel export.
- `tools.ts`: creates the memory, feeds it from the one `shown` closure every packet goes through, and
  passes it to the node run.
- `tool-rejection.ts`: the `address_not_shown` code and reason, with their documentation.
- `sanitize.ts`: `WebLlmSnapshotBinding.pageQuery`, set from the captured URL's query (at most 16 pairs).
  `capture.ts`, `stable-handles.ts` and `structure/detect.ts` carry it through. This is how a page reached
  by pressing contributes its query keys.
- Tests:
  - New `node-run/tests/shown-addresses.test.ts`, 7 tests: a made-up item address is refused, with the
    code, the page and nothing dispatched; a shown link, the start location without its trailing slash
    and a visited page with a fragment are allowed; an unshown query is refused; the search re-run rule,
    positive and negative; a read's address is allowed; replay is untouched; a new build forgets.
  - Existing fixtures changed because they navigated to addresses no packet showed:
    - `node-run/tests/person-needed.test.ts`: the page now has a link to NEXT.
    - `tests/page-refusal.test.ts`: a `/search` link was added.
    - `tests/tools.test.ts`: the start page links to `/next`, and the site adds `?private=yes` on arrival,
      so the check that the query is stripped still runs.
  - Changed behaviour: `node-run/tests/start-location.test.ts`. Its "deeper page from nowhere"
    (`/search?q=earbuds`) used to succeed and is now asserted as `address_not_shown`, with
    `startLocation` and no navigation sent.

## Commands run and observed results

- Failing first: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w24" pnpm --filter @fluxiq-web-extension/domain test`
  printed `# tests 980`, `# pass 976`, `# fail 4`. The 4 were `not ok 550, 552, 553, 556`, the refusal
  tests, each getting `'web.action.succeeded'` where `'web.action.rejected.address_not_shown'` was
  expected. The allow tests passed, as expected on the old code.
- After the implementation, the same command printed `# tests 980`, `# pass 978`, `# fail 2`. The two
  were `page-refusal` "a navigation that landed somewhere else…" (got `address_not_shown`) and `tools`
  "captures through the generic action bridge…". Both fixtures navigated to unshown addresses and were
  fixed as described above.
- Then `# tests 980`, `# pass 980`, `# fail 0`.
- Two later runs were broken by other lanes, not by this change:
  - One could not load `fluxiq/dist/.../nodes/index.js` while "t174 core-build" was rebuilding Core.
  - One stopped at `replay.ts:54:36: Could not resolve "./verify"` while w23 was writing it.
  - I waited for both, then reran.
- Final run: exit 0, `# tests 985`, `# pass 985`, `# fail 0`. The new tests are `ok 555`–`ok 561`. The
  count includes w23's in-flight tests.
- `bash …/heavy.sh "t174 w24 check" pnpm --filter @fluxiq-web-extension/domain check` (tsc src and tests):
  exit 0, no `error TS`.
- `node scripts/structure-audit.mjs`:
  - The first attempt failed with one `[failure-as-empty]` at `shown-addresses.ts` (a `catch` that
    returned `undefined`). It now returns `undefined` only for `TypeError` and rethrows anything else.
  - Rerun: `structure-audit: passed (128 warning(s), 120 baselined)`.

## Not verified

- Live behaviour. No Lab or browser run was made, as the brief required. I do not know how a live model
  responds to the refusal, for example whether bigbox now gets its search to reach results.
- Crossborder builds. Runs 15–19 navigated 7–11 times to model-written search and item addresses. Under
  this rule, each of those that the build did not type-and-press first is refused, and each refusal costs
  a decision. The net effect on those builds is not measured.
- A resumed build (a new process) starts with no memory. It relies on the replayed draft's pages, which
  replay shows through `run.shown`, and on the current page. Not exercised.
- `docs/architecture/testing-facility.md` and other authored docs do not describe the new refusal. They
  are not mine to edit.

## Open questions or contradictions found

- **Addresses in the person's instruction.** The domain never sees the instruction text, so an address
  the person wrote ("open https://site/deals") is refused unless it is the start location or shown on a
  page. Core would have to pass instructed addresses in, as it does the start location, for them to count.
- **The model learns the rule only from a refusal.** The navigate node's description
  (`actions/schemas.ts:219`, "Navigate a browser tab to a URL.") is unchanged, because that text is also
  the node library's user-facing description. A clause there would save the first refused decision. That
  is for the supervisor to decide.
- **The start-location test changed meaning.** Before, a build that had not reached its start could
  navigate to any address on the same origin as its first move. Now its first move must be the start
  location. This follows the brief's rule. It contradicts the old test comment ("a deeper page … is where
  the model may legitimately decide the Flow begins").
- **Pre-existing possible bypass, not changed.** `run.ts` routes any call whose value carries
  `replay: "step"` to the replay path before its key check. If Core ever passed a model-written `replay`
  key through, that call would skip this rule and the handle rules. I did not check Core's schema for
  that. `replay.ts` is w23's.
- The brief cites `run.ts:313-319`. In this tree the origin check was at `run.ts:334-337`, and the new
  check follows it.
