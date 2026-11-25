# Page Diff Delivery Plan

Status: Active
Status detail: Planned 2026-11-25 on the user's instruction; the build is dispatched to one sub-supervisor (P1-P4), then live tests (P5).
Created: 2026-11-25
Last updated: 2026-11-25
Owner: Senior supervisor agent
Scope: How the model sees pages: each page address's whole cleaned view once per run, then only what changed, delivered with every result; no look command; the model may ask for the whole page; page data per request stays within a limit.
Paired document: none yet (Core gets one if the sub-supervisor opens a Core working document)
Related: [data-first-simplification-plan.md](./data-first-simplification-plan.md) (the paid round of 2026-11-24 and the five bigbox recordings this plan answers), the t1035 structural audit (`data-first-simplification-plan/reports/t1035-agent-structure-audit.md` when it lands)

## Current State

- **The user's instruction (2026-11-25), recorded in AGENTS.md "The page reaches the model as run-scoped diffs; there is no look command":**
  - send each page address's first version whole, then only the differences on that address for the rest of the run;
  - run-specific, never stored between runs;
  - the model can ask for the full page;
  - "no more look command, its ridiculous";
  - a data limit on pages so not everything is sent on every request.
- **Why (from the 2026-11-24 bigbox recordings):**
  - The model sees the page only when it calls a look tool, at round openings and when it asks. It spends many decisions on looks, finds and detections; looks are withdrawn after repeats, which changes the tool schema mid-run and breaks the prompt cache.
  - Requests grow from about 25k to 276k input tokens within a run, with a median of about 24k new (uncached) tokens per request.
  - One whole cleaned page view is 4-11 KB, about 2.5-3k tokens.
- **State:** planned; the build is dispatched (see Phases). Nothing built yet.
- **Next:** the sub-supervisor's report; the lead integrates and runs the offline proof, then live tests on Sonnet (AGENTS.md: Lab runs start on Sonnet since 2026-11-25).

## Decisions

- **D1. One page channel, owned by Core, domain-neutral.** Core keeps, per run (never persisted across runs), the last page state it delivered to the model for each page key. The domain names the key (its normalized address; the domain decides what is "the same page") and supplies a page view as keyed lines: each line is a stable element key plus its text. Core diffs keyed lines (added, removed, changed) and never parses page words.
- **D2. Stable element keys across captures within a run.** A diff is only meaningful if an element keeps its key from capture to capture. The domain and content script give an element the same handle for the whole run when it is the same element (by its fingerprint and place, never by its words alone). This also ends stale-handle refusals (`target_unobserved`) for elements that never left the page.
- **D3. Delivery rides on every result.**
  - A round opening carries the page: the whole view the first time the run meets that key, otherwise the diff since the last delivery.
  - So does every tool result that ran on a page (acts, reads, searches). The model never has to ask "what does the page look like now".
- **D4. No look command.** The look tool (and its withdrawal machinery) leaves the model's catalog. `find_on_page`, `describe_element` and `detect_repeating_structure` stay: they answer questions the view does not (hidden elements, one element's detail, a list's structure).
- **D5. The model can ask for the whole page.** `core.full_page`, or a domain tool if the domain must build it, returns the current whole view for the current key and resets that key's base. Over the limit, it comes in parts ("part 1 of 3; ask for part 2"), never cut silently.
- **D6. A data limit on page content per request.**
  - Each delivery is held to a per-request page budget (configurable; the sub-supervisor proposes the default from the recordings' view sizes).
  - A first view or diff over it is sent in page order up to the budget, says what was left out and how to get it, and the model asks for the next part.
  - A diff larger than a re-sent base is sent as a new base instead.
  - The limit bounds payload size only. It never ends a round or a run (AGENTS.md "No arbitrary limit ends or resets a run").
- **D7. The window keeps one current page state per key.** Base plus the diffs since; when the diffs outgrow the base, the base is re-sent and the old copies are dropped. Older page copies never pile up in the evidence window. Earlier rounds carry the current page state, not a stale copy.
- **D8. Cache-friendly order.** The page channel's content goes after the stable prefix (system prompt, tool schemas, the draft), so the prefix stays byte-identical and the cache holds. With no look withdrawal, the tool schema no longer changes mid-run.
- **D9. Out of scope:** the judge's trail (it reads the run's record, not the model's window); Flow playback (no model); anything persisted across runs.

## Phases

| Phase | What | Owner |
| --- | --- | --- |
| P1 | Domain and content: stable element keys across captures in a run; the page view as keyed lines; the page key per address | sub-supervisor lane (downstream) |
| P2 | Core: the run-scoped page channel (D1, D3, D5-D8); remove look from the catalog and its withdrawal (D4); guidance text, generic | sub-supervisor lane (Core) |
| P3 | Wire and integration: tool results carry page deltas; round openings and earlier rounds use the channel; protocol types, mappings, tests and architecture docs in sync | sub-supervisor |
| P4 | Offline proof: diff and budget unit tests; replay the five 11-24 recordings' page captures through the channel and report page tokens per request, old against new; a provider-free browser run on a realistic scenario showing deltas after acts and a full-page request | sub-supervisor, then the lead re-runs |
| P5 | Live: one watched bigbox run on Sonnet, then the other nine scoreboard tasks on four lanes | lead |

## Validation

- Narrow checks per the repository rules (typechecks of touched packages, the tests beside each change, both audits). Full suites run in the day's sweep.
- P4's token report is the acceptance for D6 and D8: page tokens per request and new (uncached) tokens per request on the recordings, before and after.
- Live acceptance as in AGENTS.md (deterministic attempts after the exploring one).

## Work Ledger

### 2026-11-25 - Planned on the user's instruction; build dispatched
- Changed: this document; AGENTS.md rule "The page reaches the model as run-scoped diffs; there is no look command". Lab runs start on Sonnet (AGENTS.md, same day).
- Evidence used: the five 11-24 bigbox recordings in `fxwork/recorded-evidence/t1015-bigbox/`. Page views are 4-11 KB. Input tokens per request run from 25k to 276k, with a median of about 24k uncached.
- Validation: not validated: plan only.
- Follow-up: the sub-supervisor's report (P1-P4).
