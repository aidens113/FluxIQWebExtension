# Page Diff Delivery Plan

Status: Active
Status detail: Planned 2026-11-25 on the user's instruction and decisions (D1-D16, three workstreams). Nothing dispatched yet; the session ended at the user's request before dispatch. Resume from Current State "Next".
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
- **Why: the t1035 audit of the five 2026-11-24 bigbox runs** (`data-first-simplification-plan/reports/t1035-agent-structure-audit.md`). The lead had first told the user the model saw the page only when it looked; the audit corrected that:
  - **The whole cleaned page already rides with every decision.** `core.current_view` was in all 463 decisions, and all 36 acts came back with the page after them. "Look" is no tool: it is `core.run_node` with `web.output.dom-capture_snapshot`, run mostly by Core itself, and the words about it confuse the model.
  - **Requests grow from 25k to 310k input tokens.** Mostly earlier rounds' calls are carried in full (40-52% of input in the long runs); the page is 2-3% of a late request. 91% of decision spend was in calls over 100k tokens.
  - **48% of decisions are looks and searches; 6% are acts that landed; 34% were refused.** 55 of 109 page searches looked for words already on the page in front of the model. There were 102 detections for 44 reads.
  - **Handles go stale.** 38 of 136 page-handle uses named a handle no longer on the page, and all failed.
  - **Replies fail to parse.** 25 were unreadable (5.4%), because the reply is a JSON string inside JSON.
  - **Withdrawing looks changes the offered tools.** That happened 18 times, breaking the cache each time.
  - **Judging.** 22 judge calls cost $1.29 and accepted nothing; 7 judged a state unchanged since the last no.
- **State at the end of 2026-11-25:**
  - Planned and decided; nothing of W1-W3 is built or dispatched.
  - Nothing paid is running. Every leftover shell and `tail` of the session was stopped.
  - Round spend of 11-24/25 is about $9.20 of $50: five Haiku bigbox runs and one Sonnet run.
  - **The Sonnet run** (run-mwvgjb8c, $0.80, 90 s, 22 calls) set the store, read the cart as the result, and the product check accepted it. But the oracle marked the answer wrong: it added "Loftwell 1 Roll $1.97, 4.6 stars", which is not the cheapest towel that qualifies for pickup today at that store (`missingActs`, `unaskedChanges: cart:5520104:pickup`). Our judge, on Sonnet, accepted it, so judging pickup availability is an open defect.
  - Open task trees:
    - **t1034** (done by its worker, not yet lead-verified: the lead's check run was stopped at wrap-up; the worker's checks passed). It covers the asked table's own list, 3 unreadable-reply causes, and no judge over a table that cannot be the asked one. Trees `fxwork/t1034/{!FluxIQWebExtension,!FluxIQ}`; report `reports/t1034-asked-table-own-list.md` in that tree.
    - **t1036** `page-diff-delivery`: created for W1 at dev 63ba8dc13-era with its own Core; empty.
    - **t1015** `paid-bigbox`: the live lane, slot 1.
    - **t1035**: the audit tree; its files are on dev; to abandon.
- **Next (in order):**
  1. Verify t1034 (Core groups over `completion`, `tests/endings`, `llm/{anthropic,decision-handlers,decision-reading,verification-defects}`, `result-verification`; domain `llm-evidence`; both checks; audits), merge Core dev into it (bump to 0.54.19), finish both, push, sync the shared Core.
  2. Merge dev into t1036 (both sides); start t1037 (W2) and t1038 (W3) with `--core`.
  3. Dispatch three sub-supervisors (Opus) with briefs from Decisions and Phases. W1 and W2 build now; W3 designs now and builds after W1 merges.
  4. Integrate, offline proof (P4), then live on Sonnet (`--llm-model claude-sonnet-5-5`): bigbox first, then the nine others.
  5. Also open: the judge accepting a wrong item on pickup availability (above); the answer-contract column reader misreading "columns title only"; fake clocks for the deadline tests `second-attempt-proof` and `later-attempt`; `pinned-calls-job-board` setup wait; `tool-rejection.ts` at 799 lines; a Flow playback guard for list location (a wire change); a second full sweep and `main` promotion (`main` has not moved).
- **The user decided both open questions (2026-11-25):** "yes lets completely drop the search command" (D15), and "Drafting the flow automatically will help in many situations, as long as the model is able and encouraged to edit it for more efficient flows" (D16, W3). Both are recorded in AGENTS.md.

## Decisions

- **D1. One page channel, owned by Core, domain-neutral.** Core keeps, per run (never persisted across runs), the last page state it delivered to the model for each page key. The domain names the key (its normalized address; the domain decides what is "the same page") and supplies a page view as keyed lines: each line is a stable element key plus its text. Core diffs keyed lines (added, removed, changed) and never parses page words.
- **D2. Stable element keys across captures within a run.** A diff is only meaningful if an element keeps its key from capture to capture. The domain and content script give an element the same handle for the whole run when it is the same element (by its fingerprint and place, never by its words alone). This also ends stale-handle refusals (`target_unobserved`) for elements that never left the page.
- **D3. Delivery rides on every result.**
  - A round opening carries the page: the whole view the first time the run meets that key, otherwise the diff since the last delivery.
  - So does every tool result that ran on a page (acts, reads, searches). The model never has to ask "what does the page look like now".
- **D4. No look command.** The look capture leaves the model's catalog and its words, and look withdrawal goes with it. `describe_element` and `detect_repeating_structure` stay. `find_on_page` goes (D15).
- **D5. The model can ask for the whole page.** `core.full_page`, or a domain tool if the domain must build it, returns the current whole view for the current key and resets that key's base. Over the limit, it comes in parts ("part 1 of 3; ask for part 2"), never cut silently.
- **D6. A data limit on page content per request.**
  - Each delivery is held to a per-request page budget (configurable; the sub-supervisor proposes the default from the recordings' view sizes).
  - A first view or diff over it is sent in page order up to the budget, says what was left out and how to get it, and the model asks for the next part.
  - A diff larger than a re-sent base is sent as a new base instead.
  - The limit bounds payload size only. It never ends a round or a run (AGENTS.md "No arbitrary limit ends or resets a run").
- **D7. The window keeps one current page state per key.** Base plus the diffs since; when the diffs outgrow the base, the base is re-sent and the old copies are dropped. Older page copies never pile up in the evidence window. Earlier rounds carry the current page state, not a stale copy.
- **D8. Cache-friendly order.** The page channel's content goes after the stable prefix (system prompt, tool schemas, the draft), so the prefix stays byte-identical and the cache holds. With no look withdrawal, the tool schema no longer changes mid-run.
- **D9. Out of scope:** the judge's trail (it reads the run's record, not the model's window); Flow playback (no model); anything persisted across runs.

- **D10. Earlier rounds carry state, not transcripts** (audit change 1). A fresh round gets a compact state: what the run established (rows read, acts landed, the draft, open checks, the current page state), with earlier calls as short references, never every call's result whole. Later results replace earlier ones as references. Measured on the recordings, this is most of the spend.
- **D11. The offered tool list never changes mid-run** (audit change 4). Withdrawn looks are gone with D4; anything still withdrawn is refused by name, never removed from the schema.
- **D12. Decisions are native tool calls** (audit change 3), not a JSON string inside JSON, so the provider constrains the shape. t1025's shared decision reading stays the one reader.
- **D13. A list read is one call that detects the list itself** (audit change 2; the user's 2026-11-20 rule "keep all columns data during extraction"). The model names the list by a handle in the view (or its words); the read detects it and keeps every field. A separate detection stays available but is no longer required.
- **D14. No judge when nothing changed since the last no** (audit change 7). The same evidence gets the same no, with the same reasons, at no cost.
- **D15. No page search** (user, 2026-11-25). `find_on_page` leaves the catalog. The full-page request (D5) is the one way to see more than the view: hidden elements and their attributes, in parts under the data limit.
- **D16. The framework drafts the Flow; the model edits it** (user, 2026-11-25).
  - The draft is written from the acts and reads that worked, in order, with dead ends, failed and no-effect calls and repeats left out, and the asked table's read as the result.
  - The model is able and told to edit it for a leaner Flow: loops over repeated steps, parameters for typed values, the result read, dropping waste.
  - The draft-editing grammar shrinks to those edits.
  - Rules kept: lasting acts are never done twice, and permissions are untouched.

## Phases

Three workstreams, partitioned by file, each with its own sub-supervisor and task branch:

| Workstream | Decisions | Branch | Owns |
| --- | --- | --- | --- |
| W1 What the model sees | D1-D8, D10, D11, D14, D15 | t1036 `page-diff-delivery` | Core decision context, evidence window, rounds and earlier rounds, page channel, look removal, judge skip; domain page view, page key, stable element keys (content script) |
| W2 How the model acts | D12, D13 | t1037 `native-decisions-one-read` | Core provider adapters' decision transport and decision reading; domain read and detect nodes, extraction request, content list reader |
| W3 The framework drafts the Flow | D16 | t1038 `auto-draft` (design now, build after W1 merges) | Core `runtime/flow-authoring/draft/**`, the amendment handler and its feedback, the draft's guidance; the evidence loop only through W1's merged shape |

Each workstream proves itself offline:
- unit tests;
- the five recordings replayed through the new code, with tokens per request and decisions old against new;
- a provider-free browser run on a realistic scenario.

The lead then integrates W1 then W2, re-runs the narrow checks, and runs P5 live: one watched bigbox run on Sonnet, then the other nine scoreboard tasks on four lanes.

## Validation

- Narrow checks per the repository rules (typechecks of touched packages, the tests beside each change, both audits). Full suites run in the day's sweep.
- P4's token report is the acceptance for D6 and D8: page tokens per request and new (uncached) tokens per request on the recordings, before and after.
- Live acceptance as in AGENTS.md (deterministic attempts after the exploring one).

## Work Ledger

### 2026-11-25 - Handoff: decided and planned, not dispatched
- Changed:
  - The user's decisions were recorded in AGENTS.md and here: Sonnet for Lab runs, page diffs and no look, page search dropped, the framework drafting the Flow.
  - The t1035 audit is on dev.
  - The Sonnet bigbox run ran once (run-mwvgjb8c, $0.80, oracle: wrong item).
  - Orphaned background processes of this session were stopped: 15 `tail -F` left by stopped Monitors, 2 paid-round watcher scripts, 4 old verification shells.
- Validation: not validated: plan and records only. The lead's verification of t1034 was stopped unfinished (TaskStop) at wrap-up; the worker's own run: `vitest-groups` gave 794/794 and 86/86, domain `llm-evidence` gave 1778 pass 0 fail, checks exit 0, audits passed.
- Follow-up: Current State "Next".

### 2026-11-25 - Planned on the user's instruction; build dispatched
- Changed: this document; AGENTS.md rule "The page reaches the model as run-scoped diffs; there is no look command". Lab runs start on Sonnet (AGENTS.md, same day).
- Evidence used: the five 11-24 bigbox recordings in `fxwork/recorded-evidence/t1015-bigbox/`. Page views are 4-11 KB. Input tokens per request run from 25k to 276k, with a median of about 24k uncached.
- Validation: not validated: plan only.
- Follow-up: the sub-supervisor's report (P1-P4).
