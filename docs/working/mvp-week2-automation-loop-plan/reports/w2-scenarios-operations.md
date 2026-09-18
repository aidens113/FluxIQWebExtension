# w2-scenarios-operations — two back-office fixtures that require real automation

Two new scenario-lab fixtures, `support-desk` and `order-operations`, built so
that **every** workflow in them needs a multi-step automation with a
consequence. No refusal case was added. Eight of the ten new live-instruction
tasks end in a state change, and six of them are judged on data that only
exists because the run changed something.

## What each scenario contains

### `support-desk` — a ticket queue (seed 141, `/scenarios/support-desk/`)

A 320-ticket queue in an application shell (6,890 DOM elements; measured in the
browser run below).

- **Rows**: 320 tickets, each with a reference (`TCK-2100`…`TCK-4333`), a
  requester name and address, a clipped subject, priority, status, assignee,
  a relative age and an SLA countdown. All 320 requesters, references and
  account numbers are unique. 12 tickets are past their response target, 19 are
  unassigned, 4 are unassigned *and* urgent or high priority.
- **Two more screens**: a ticket detail pane, **fetched from the desk** when a
  ticket is opened (`tickets/<reference>`), carrying the requester's account,
  the full untruncated subject and a conversation thread — none of which is in
  the queue's markup; and an **escalations screen** (`escalations`) reached from
  the desk's own navigation.
- **Markup texture**: every class name is a build hash (`css-1x7ab3f`), so the
  row action button and the top bar's notification bell wear the same class;
  320 overflow buttons all named "More actions" and 320 checkboxes all named
  "Select ticket", distinguishable only by the row they are in; two controls
  share the accessible name "Search"; one button has no accessible name at all;
  the row menu is portalled to the end of `<body>`; subjects are clipped with an
  ellipsis and the full text is only on the ticket; ages are relative
  ("7 minutes ago", "Yesterday") and the SLA column reads "Breached 9h 18m ago"
  or "Due in 3h 20m".
- **Confirmation and disabled controls**: resolving a ticket goes through an
  `alertdialog`; **Send reply** is disabled until the reply has something in it;
  **Raise escalation** is disabled until the typed reference matches a ticket
  the desk actually holds *and* a severity has been chosen.
- **Empty state**: a view plus a filter that cannot both hold renders
  "No tickets match this view."

### `order-operations` — an order back office (seed 142, `/scenarios/order-operations/`)

A 280-order book in an application shell (4,633 DOM elements).

- **Rows**: 280 orders with a reference (`ORD-40100`…`ORD-40937`), customer,
  placed date, total, payment state and fulfilment state, over a 54-day trading
  period. 80 await dispatch, 62 carry a refund. Every order has 2–4 lines.
- **A second screen**: each order has its **own page** (`orders/<reference>`,
  a full load) holding the line items, the delivery address and the refund
  control. Two fragment routes serve the parts that change after an action
  (`orders/<reference>/summary`, `dispatch-note`) so the page never rewrites
  state the desk would have written differently.
- **Markup texture**: generated class names throughout; 280 overflow buttons
  all named "More actions" and 280 checkboxes all named "Select order"; two
  "Search" labels; one unnamed button; a portalled row menu.
- **Confirmation and disabled controls**: refunding, dispatching and cancelling
  each go through an `alertdialog`; **Issue refund** is disabled until an amount
  above zero and a reason are given, and is disabled outright on an order nobody
  paid for; **Mark dispatched** is disabled unless the order is paid and
  unpicked.
- **Empty state**: "No orders match these filters."

Both fixtures are fully deterministic and ignore the lab seed: the data is
authored, and the manifests' expected records are literal text.

## Which jobs change state, and how that state is judged

| Scenario | Workflow | What it does | How it is judged |
| --- | --- | --- | --- |
| support-desk | primary (`playbackGoal` `triage-unassigned-backlog`) | Press the triage shortcut, select the view, bulk-assign all 4 unassigned urgent/high tickets to Priya Raman | Two method-independent lines: `triage-summary` becomes "0 unassigned tickets are urgent or high priority", and `workload` names Priya Raman's new count. Assigning to anyone else clears the first and fails the second. Server oracle: `awaitingTriageCount === 0`. |
| support-desk | `reply-and-resolve` | Find Dalia Hartnell's ticket, open it, insert the closing-summary template, send the reply, resolve through the confirmation | Dataset `read-resolved-ticket` (status `Resolved`, plus the **account**, which is on no other screen); `detail-status` text; the queue's own breach count drops 12 → 11, because resolving a *late* ticket is what stops its countdown. |
| support-desk | `export-sla-breaches` | Switch to the breaching view, read the rows | Dataset `extract-sla-breaches`: 12 records, exact text, columns reference/requester/subject/priority/assignee/sla. |
| support-desk | `escalate-longest-breach` | Read the longest-breaching reference off the queue, go to the escalations screen, type it, choose Critical, raise it, read the log | Dataset `extract-escalation-log`: one record whose **requester is the desk's own for that reference**, never anything the form was told — so a wrong reference names the wrong person. Plus `escalation-summary` and the URL path. |
| order-operations | primary (`playbackGoal` `refund-one-line`) | Find Ada Ainsworth's order, open it, refund the value of its first line (£12.50 of £190.50) | `payment-state` becomes "Part refunded" and `refunded-total` reads "£12.50 refunded". The payment state is **arithmetic on what was refunded**, not a flag the page may set, so refunding the wrong amount fails. |
| order-operations | `export-order-batch` | Narrow to paid + unpicked + 1–14 March 2026, read the rows | Dataset `extract-order-batch`: 13 records (3 under `quiet-week`). |
| order-operations | `read-line-items` | Find Dermot Ainsworth's order in the book, open it, read its lines | Dataset `extract-line-items`: 4 records with item/sku/quantity/unitPrice/lineTotal — all only on the order's page. |
| order-operations | `dispatch-batch` | Press the dispatch-run shortcut, select the 7 orders it finds, mark them dispatched through the confirmation, read the dispatch note | Dataset `extract-dispatch-note` — **the note exists only because the run dispatched something**. Plus the book summary, the note's own line, and `Showing 0 of 280 orders`, because the filters the run was working in no longer match anything. |

**Reading a value on one screen and using it on another** happens in three of
these: the escalation (reference read off the queue, typed on another
document); the partial refund (which order comes from the book, the amount from
the line table on the order's page); and the line-item read (which order comes
from the book, the data from the order's page).

## Instruction tasks and drift variants added

Ten entries in `LIVE_INSTRUCTION_TASKS` — 2 `form`, 2 `navigate`, 6
`navigate-and-extract`:

- `support-desk-triage-backlog` (form, playback-goal)
- `support-desk-sla-breaches`, `support-desk-sla-breaches-recovered` (dataset)
- `support-desk-reply-and-resolve` (dataset)
- `support-desk-escalate-longest-breach` (navigate, dataset)
- `order-operations-partial-refund` (form, playback-goal)
- `order-operations-batch-export`, `order-operations-batch-export-quiet-week`
- `order-operations-line-items` (dataset)
- `order-operations-dispatch-run` (navigate, dataset)

Every instruction is a goal, names the columns its judged dataset uses, and
contains no selector, test id, element id, URL path or numbered step; the
catalog's own guard test passes. Names inside instructions are **imported** from
the fixtures (`REPLY_TICKET.requester`, `REFUND_ORDER.customer`,
`TRIAGE_AGENT`, `LINE_ITEM_ORDER.customer`) rather than hard-coded, so an
instruction cannot drift away from the data it names.

Four variants, two of them genuine repair work:

- **`support-desk` / `relabelled-triage`** (repair task
  `support-desk-repair-relabelled-triage`): the queue header's triage shortcut
  is redesigned — same place, same job, **no test id, new class, label renamed
  to "Work the backlog"**. Import and New ticket sit beside it as the pressable
  wrong answers (pressing either leaves the whole 320-row queue selected). The
  variant declares no failure; its expectations are the *repaired* run's.
- **`order-operations` / `relabelled-dispatch`** (repair task
  `order-operations-repair-relabelled-dispatch`): the dispatch-run shortcut is
  redesigned to "Pick and pack", losing its test id and class. Export and New
  order are the wrong answers.
- **`support-desk` / `recovered-sla`** and **`order-operations` / `quiet-week`**
  change the data a filtered read returns and nothing about the page.

Both repair variants carry no `data-` hook on the redesigned control, following
`identity-drift`'s convention: the page's own bundle finds the control by its
position in the header's action group, which is how a real build wires it.

Neither data variant declares a "no filters applied" page fact. That fact names
`filter-summary`, a control the recordings wait on, and the repair-coverage
check reads such a fact on a variant as the drift having removed it — which
would demand a repair task for a row a recorded Flow passes perfectly well. The
manifests say so where the fact is defined.

## Files

New: `apps/scenario-lab/src/scenarios/support-desk/` (16 files + `tests/`) and
`apps/scenario-lab/src/scenarios/order-operations/` (15 files + `tests/`), each
with `markup.ts`, `route.ts`, `state.ts`, `manifest.ts`, `scenario.ts`,
`index.ts` and `tests/scenario.test.ts`. New browser specs
`apps/scenario-lab/e2e/support-desk.spec.ts` and
`apps/scenario-lab/e2e/order-operations.spec.ts`.

New shared module `apps/scenario-lab/src/build-classes.ts` holds the CSS-in-JS
class-name emitter, which three fixtures now need;
`member-directory/styles.ts` was switched to it rather than leaving a third
copy of the FNV-1a hash. Its class names are byte-identical (its own tests and
e2e spec still pass).

Registered in `apps/scenario-lab/src/types.ts` (`scenarioIds`) and
`apps/scenario-lab/src/registry.ts`, and in
`apps/scenario-lab/src/scenarios/live-instructions.ts` and
`live-repair-tasks.ts`.

## Validated, with observed output

- **`apps/scenario-lab` unit tests** —
  `node --test $(find dist -name "*.test.js")`:
  `# tests 330 / # pass 330 / # fail 0`. That includes the 30 new tests in the
  two `tests/scenario.test.ts` files, the corpus-wide registry test, and the
  live-instruction and live-repair catalog tests.
- **`node scripts/structure-audit.mjs`** —
  `structure-audit: passed (71 warning(s), 122 baselined).` Six of those
  warnings are mine and all advisory: `support-desk/` holds 16 source files
  (advisory 15); `order-operations/ledger.ts` and `orders.ts` export 9 values
  (advisory 8); both `client-script.ts` files and `live-instructions.ts` run
  past the 400-line advisory. No rule failed and nothing was baselined.
- **`pnpm check`** — ran to completion, every workspace project `Done`
  (`apps/scenario-lab check: Done`, `packages/test-runner check: Done`, …).
- **Browser run** — `npx playwright test -c e2e/playwright.config.ts
  support-desk.spec.ts order-operations.spec.ts`: **26 passed (8.6s)** in
  headless Chromium. Every workflow's recording script plays through, every
  declared dataset matches record-for-record, every final-state fact holds, and
  both repair variants are proven repairable (the recorded target resolves to
  zero elements; pressing the redesigned control and replaying the rest of the
  script reaches the declared state).
- **HTTP smoke run** — 24 checks over the live lab server against the pages,
  fragments and mutation endpoints (row counts 320 and 280, 404s for unknown
  references, disabled controls at load, the escalation log naming the desk's
  own requester, a refund moving the summary to "Part refunded", the dispatch
  note listing what went): all PASS.

The browser run caught one real defect that no other check could: the
empty-state row never rendered, because a `<tr>` set as a `div`'s `innerHTML`
is dropped by the HTML parser. Both client scripts now parse fragments inside a
`<template>`. Fixed and re-run green.

## Not verified

- **No live campaign or LLM run.** Building the fixtures was the task; nothing
  here was run through the Flow lane, the created-Flow lane or a provider. The
  manifests' `recordingEvents` therefore name types **without counts**, which is
  the only honest claim before a recording lane has run them; a count belongs
  there once a run has produced one.
- **The extension's own recorder has not seen these pages.** The browser run
  drives the scripts with plain Playwright, so what the *extension* records from
  them — and therefore whether the declared `expected.actions` are met — is
  still a claim, not a measurement. The declared actions are the types
  `recordableActionTypes` says each step can yield, and the contract validator
  accepts them, but no recording exists yet.
- **No Firefox run**, and no run under the extension-loaded browser profile.
- **Concurrency caveat.** `src/types.ts`, `src/registry.ts`,
  `live-instructions.ts` and `live-repair-tasks.ts` were edited while other
  workers were adding their own scenarios to the same four files. My entries sit
  immediately after `member-directory` in both `scenarioIds` and the registry
  map, and the registry test (which requires the two orders to match exactly)
  passed on the tree as it stood when I finished. If another worker appends
  after me in one file and before me in the other, that test will fail and needs
  reconciling — it is a shared-file race, not a defect in these fixtures.
- **Playwright artifacts** under `apps/scenario-lab/e2e/test-results/` are run
  output from the browser run and are not tracked.

## Open questions

- The dispatch-run preset spans a fixed week (9–15 March 2026) so the batch
  stays at 7 orders. If the corpus ever wants a larger bulk action, the preset's
  range is the one place to widen it (`order-operations/filters.ts`).
- `support-desk/` is one file over the 15-file advisory. Splitting `views.ts`
  back into `queue.ts` trades that warning for an exported-values warning; I
  left the file count high because the two modules answer different questions
  (what the desk shows versus what the desk counts).
