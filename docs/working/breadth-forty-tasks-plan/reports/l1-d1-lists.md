# l1-d1-lists report

## Outcome

Done. The snapshot now marks every list or table container that has at least one item with a closed fact,
`listWayOn: "none" | "next_page" | "load_more" | "feed"`. The domain carries the fact on
`WebLlmEvidenceElement.listWayOn` and never prints it. `webResetCollections` now treats a list as complete in two
ways: the existing aria path, unchanged, or a new native path for plain lists and tables.

## What changed and why

Extension (worktree `C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQWebExtension`):

- New `apps/extension/src/content/extraction/read-coverage/list-way-on.ts` (`listWayOn(container)`). It runs only the
  existing detectors: `listContinuesPast(items, false)` gives `next_page` / `load_more`, then
  `isDeclaredFeed(items, items[0].parentElement)` gives `feed`, and anything else is `none`. No new heuristic.
  - A container's family comes from its role: the role it states, otherwise `implicitRole` (asked only for list and
    table tags). `list` → list. `table` / `grid` → table.
  - A list's items are its own `listitem`s. A table's items are its own `row`s, minus header rows (rows inside
    `thead`, or rows whose cells are all `columnheader`). Nested lists and tables keep their items to themselves.
  - It returns undefined for anything else or for a container with no items.
  - `<menu>` counts as a list because its implicit role is `list`. That keeps it consistent with how the domain finds
    lists by role.
- `read-coverage/index.ts` exports it. `content/dom-snapshot.ts` `snapshotDescriptor` writes it. It is snapshot-scoped
  and rendered elements only; hidden descriptors get no fact.
- `shared/dom-element.ts`: added `listWayOn?` to `DomElementDescriptor` and added it to `UnwiredElementField`, so it
  stays off the client-gateway element target. The background merge carries descriptors whole, so nothing else
  needed changing.

Domain:

- `elements.ts`: new `WebLlmListWayOn` type, the `listWayOn?` field, and `listWayOnValue`, which keeps the
  closed-set word and drops anything else. `sanitize.ts` needed no change: the element sanitizer writes the field, and
  `stable-handles` moves it with the element.
- `control-spot/collection.ts`, rewritten into helpers.
  - The kinds are lists (item `listitem`, aria path allowed) and tables/grids (item `row` minus header rows; native
    path only).
  - If any row carries `aria-setsize`, only the aria path is used. That path is unchanged and still applies to lists
    only.
  - Native path conditions:
    - `listWayOn === "none"`;
    - `!truncated && captureTruncated !== true`;
    - the list does not have `aria-busy="true"`;
    - at least one row.
  - Then, on either path, each row must have exactly one subject and all subjects must be distinct.
  - Scope, group and state tokens use the same formulas as before. Ancestors are memoised, and subjects and states are
    grouped per row in one pass, so it is no longer O(rows × elements).
- Edits outside the "Owns" list, each forced by the new field. None is on the "Must not touch" list:
  - `look-alikes.ts` and `state-digest/state-digest.ts` both build `Record<keyof WebLlmEvidenceElement, …>`, so they
    stop compiling unless each names the new key. Both now treat it as omitted.
  - `state-digest.ts`: adding the key changes the digest bytes, as earlier added omitted keys (t229) did. I did not
    bump the version.
  - `page-find/description.ts` (`web.describe_element`) prints every element field to the model, so I added a
    `NEVER_PRINTED` set holding `listWayOn`.

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=l1d1 node scripts/test-extension.mjs read-coverage/tests` → 17 tests, 17 pass, 0 fail.
  This includes the new `list-way-on.test.ts` cases: pager Next, following page number, Load more, spent Load more,
  declared feed (`role=feed` ancestor, `aria-rowcount`), none, last-page pager, `role=list`, table with `thead`,
  table with Show more, headers-only table, non-list / empty / `role=menu`, and nested list.
- `... test-extension.mjs content/extraction/tests content/extraction/read-coverage/tests content/tests` → 337 tests,
  337 pass, 0 fail.
- `... test-extension.mjs background/connection/tests shared/tests` → 286 tests, 286 pass, 0 fail.
- `DOMAIN_TEST_BUILD_LABEL=l1d1 node scripts/test-domain.mjs control-spot/tests` → 21 tests, 21 pass, 0 fail.
  - New cases that complete: plain list, table without header row, loose header row.
  - New cases that yield no collection: fact absent, `next_page`, `load_more`, `feed`, an unknown word, truncated,
    duplicate subject, two subjects in a row, no subject, empty list, `aria-busy`, set-size rows (`-1` and a
    mismatch), table with `next_page`.
  - A case asserting the fact is not in the published page or in `describe_element` output.
- `... test-domain.mjs runtime/llm-evidence/tests runtime/state-diff llm-evidence/page-find/tests llm-evidence/state-digest/tests llm-evidence/control-spot/tests`
  → 319 tests, 319 pass, 0 fail.
- `npx tsc -p domain/tsconfig.json --noEmit` → exit 0. An earlier run failed on `control-spot/target.ts`, which was
  D2's work in progress; it was clean on the rerun.
- `apps/extension: npx tsc -p tsconfig.json --noEmit` → exit 0.
- `node scripts/structure-audit.mjs` → "passed (213 warning(s), 638 baselined)".
  - The first run failed `contract-spread` on two spreads in my test fixture; I fixed it.
  - My files carry no new warnings. `elements.ts` already had the >400-line advisory (582 → 603 lines).
- Snapshot timing, provider-free. Setup:
  - Scenario-lab fixture server on port 47811 (stopped afterwards).
  - Headed Chromium (Playwright 1.51.1).
  - `captureSnapshot` bundled twice, with `listWayOn` and with it stubbed out; median of 7 alternating runs.

  | Page | Elements | Before | After | Facts written |
  | --- | --- | --- | --- | --- |
  | job-board `jobs?q=nurse` | 209 | 54.1 ms | 58.4 ms | 10× `none` |
  | everything-store home | 119 | 45.6 ms | 48.5 ms | 2× `none` |
  | everything-store cart | 180 | 71.2 ms | 74.6 ms | 2 `role=list` → `none` |
  | bigbox-retail home | 324 | 91.8 ms | 98.6 ms | 2× `none` |
  | local-classifieds home | 156 | 39.6 ms | 41.4 ms | 2× `none` |
  | social-network-feed home | 236 | 54.4 ms | 60.5 ms | 3× `none` |
  | professional-network home | 199 | 45.6 ms | 49.5 ms | 3× `none` |
  | auction-marketplace home | 108 | 44.9 ms | 44.9 ms | none |

  - The added cost is about 0–7 ms per snapshot (≤11%).
  - On job-board `jobs?q=engineer` (results with a 2/3/4/Next pager), the results `<ol>` reported `next_page`.
  - The social feed's `role=feed` div is not a list container, so it gets no fact and cannot complete.

## Not verified

- No Node unit test runs `content/dom-snapshot.ts` itself (it needs a DOM). The wiring was checked only by the
  Chromium measurement above, where `interactiveElements` carried the fact. I did not run the Playwright content
  harness (`test:content`).
- No end-to-end run fed a real fixture capture through sanitize → `webResetCollections` with a trusted
  `resetResource`, and no Core settlement was exercised.
- The everything-store search results page was behind its browser soft-check, so I never measured or inspected a
  store results list.
- I did not run full suites or rebuild Core, per the brief.

## Open questions or contradictions found

- The brief puts the field on `WebLlmEvidenceElement`. That forced the one-line edits to `look-alikes.ts`,
  `state-digest/state-digest.ts` and `page-find/description.ts`, none of which was on the "Owns" list. Without them
  the build fails, or `web.describe_element` would show the word to the model. The supervisor may want those three
  recorded as D1-owned.
- State digest bytes change for every page because of the new omitted key, and the version is unchanged (following
  the t229 precedent). If digests ever persist across versions, bump `web-state.v6`.
- The detectors look up to 6 ancestors for a pager. On a paged results page, small per-card `<ul>`s inside the
  results also report `next_page`. That is conservative: they cannot complete there. On an unpaged page, a one-item
  card list holding one subject does complete as a one-row collection. That is true of the page, but it is new
  behaviour for Core to see.
- The new native-path tests reuse the shared test-file helpers `webResetResource` / `webTargetSpot` from the
  control-spot barrel, which D2 is editing at the same time. If D2 changes `webTargetSpot`'s scope semantics, one
  assertion in the first native test will need updating.
