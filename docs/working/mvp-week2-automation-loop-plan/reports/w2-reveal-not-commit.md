# w2 — Reveal is not commit: what exploration may press

Worker report. Branch `task/t011-exploration-reveal-safety`, worktree
`F:\fxwork\t011-exploration-reveal-safety`. Nothing committed.

## Outcome

Partial. The defect is fixed and proven, at the rule and in a live run: the
exploration gate no longer refuses openers, row checkboxes, row menus or
in-site links, and it still refuses Send, Save, Delete, Confirm, Refund,
Dispatch, Assign, Resolve, anything that submits a form, and anything inside an
open dialog. The `schedule-post` job still does not build a Flow live, but for a
different reason than it did before, and that reason is recorded below.

## What I inherited, and whether I kept it

A previous worker was killed mid-edit. On disk were a rewritten
`domain/src/runtime/llm-evidence/reveal.ts` and a new, untracked
`domain/src/runtime/llm-evidence/control-intent/` holding `index.ts`,
`intent.ts` and `wording.ts`.

**I kept all of it**, and it is the larger part of the fix. It was the right
shape and the tree did not compile only because it was unfinished:
`safeRevealElement` had grown a second parameter and neither call site had been
updated, so `pnpm build` failed with two `TS2554` errors. What it had right:

- The decision moved out of `reveal.ts` into a module of its own that takes a
  **packet element**, which carries no selector — so reading a selector is
  impossible rather than merely discouraged.
- Three classes of word rather than one list, which is what lets "Post" commit
  while "New post" opens.
- One `pressToReveal` shared by the authoring tool and the runtime recovery
  option, so the two cannot drift.
- Unticking a row after reading the page it revealed.

What I finished or corrected:

1. Wired both call sites (`tools.ts`, `harness-options/execute.ts`) through
   `pressToReveal`. Until this the tree did not build.
2. Removed the second selector-reading gate, in
   `harness-options/safety.ts`, which the inherited work had not touched. Its
   `WEB_RECOVERY_COMMITTING_WORDS` regex was matched against
   `[element.name, element.text, element.selector]`. It now asks the same
   `webControlWording`. The exported regex is deleted, not left for reuse.
3. Corrected one thing the inherited work had wrong: it read
   `page.blockedBy` as "a dialog is up" and refused every opener while it was
   set. `blockedBy` means some ranked control is painted over by something,
   which a sticky header does on any ordinary dashboard. See "The one
   correction" below.
4. Rewrote the reveal tool's description, which is the model's only statement
   of what the tool is for and still described the old allowlist.
5. Added the tests.

## The reproduction, before any change

Taken first, at `HEAD`, with the inherited work moved aside so the tree built.

### Live

`DEEPSEEK_API_KEY` from `.env.local`,
`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=t011
pnpm lab:campaign social-scheduler-schedule-post`.

`run-mu7c7sd5-4da03bfd` — `flowCreated: false`, `oracleVerdict: null`,
`reportedVerdict: null`, 27 provider calls, 256,370 tokens, $0.1156.

Every single reveal was refused:

| tool | result |
| --- | --- |
| `web.reveal_safe` ×4 | `web.action.rejected.target_unsafe` ×4 |
| `web.reveal_safe` ×4 | `llm_evidence_loop.already_answered` (the same call again) |
| `web.navigate_same_origin` ×8 | succeeded, going in circles |
| `core.decision_unusable` ×3 | `web.handle.ambiguous` |

Build ended `flow_bootstrap.evidence_iteration_limit`, and the run then failed
`performance.budget`: **27 provider calls against an authorized 26**. Recorded
as a finding, per the standing decision that a fixed call ceiling is itself a
defect — but note it was the *baseline* that hit it. Every run after the fix
used 5, 9 and 6 calls, so nothing below is bounded by the ceiling and I did not
narrow the fix to fit it.

### At the rule

Raw snapshot elements shaped exactly as `apps/extension` sends them, taken from
the fixtures' own markup, through the real sanitizer and the real gate:

| control (fixture, line) | packet element | `safeRevealElement` |
| --- | --- | --- |
| `New post` (`social-scheduler/markup.ts:54`) | `{tag: "button", name: "New post", controlType: "button"}` | **false** |
| row checkbox (`social-scheduler/table.ts:98`) | `{tag: "input", name: "Select the post for Tue 09:00", inputType: "checkbox"}` | **false** |
| order row link | `{tag: "a", name: "ORD-40100", href: …}` | **false** |
| `Order actions` row menu | `{tag: "button", name: "Order actions", revealKind: "disclosure", expanded: false}` | **false** |

The first three fail on shape: `revealKind` is `undefined`, so
`if (element.revealKind !== "disclosure") return false` refuses them. Nothing
about "New post" says it commits; it was refused for not being a `<summary>`,
a tab or an `aria-expanded` button. That is why the composer was never opened,
so the fields the Flow had to fill were never in any packet.

The fourth is the order-operations defect, and it is worth stating exactly,
because the word list was **not** the whole story — the selector was:

| control | packet element | selector kept behind | verdict |
| --- | --- | --- | --- |
| row menu, renamed | `{tag: "button", name: "Row actions", revealKind: "disclosure"}` | `[data-testid="order-rows"] > tr:nth-child(1) > td:nth-child(8) > button` | **REFUSED** |
| identical element | `{tag: "button", name: "Row actions", revealKind: "disclosure"}` | `table tbody > tr:nth-child(1) > td:nth-child(8) > button` | ALLOWED |

Two identical packet elements. The only difference is the selector, which the
model never sees and which this domain assembles from the test ids of every
ancestor above the element. `\border\b` matches inside `order-rows`, so on an
order-management site every row control was unsafe. Confirmed at
`harness-options/safety.ts:46` and `:91-92` as the brief said, and the same
mistake was in `reveal.ts` itself, whose `COMMITTING_ACTION_WORDS` was tested
against `[element.selector, element.name, element.text].join(" ")`.

## The new rule

`domain/src/runtime/llm-evidence/control-intent/` answers one question: would
pressing this control **reveal** something or **commit** something? It takes a
`WebLlmEvidenceElement` — the packet element, which has no `selector` field —
so the decision cannot reach a selector.

Refusal comes first, then shape:

1. Its type submits or resets a form → commits.
2. Its words commit → commits, whatever shape it has, so a disclosure named
   "Delete" is still refused.
3. Otherwise a shape is required. Anything unrecognised is `unclear`, which is
   refused too: the allowlist is what keeps an unknown button unpressed, and
   the words are a second line rather than the only one.
4. A control the page put in a form commits, unless it is a link, or a
   disclosure or tab that says it is not a submit. A `<button>` with no `type`
   in a form is a submit button whatever it looks like.
5. In a dialog, or with a modal one up, only a disclosure, a tab or a
   dismissal is pressed.

Words are read in three classes, because English uses the same words as nouns
and as verbs:

- **Commit anywhere**: `send save delete confirm refund dispatch assign resolve
  submit pay purchase approve remove revoke unsubscribe retry …`. Nobody labels
  a control "Bulk delete" unless it deletes.
- **Commit only as a command's verb, first**: `post order schedule add create
  share ship start …`. "Post" and "Order now" commit; "New post",
  "Post actions", "Select order" and "Order details" do not. A label that is
  the word followed only by nouns for a container of controls — actions,
  options, details, menu — is naming the container, not giving the command.
- **Close / Cancel**, which dismiss when they stand alone or name what they put
  away ("Close composer") and commit when they name a record ("Cancel order",
  "Close ticket").

A link to another page is read differently: its words name where it goes, so a
noun in first place is expected, and only a word that commits anywhere — in the
label or in the path, never the host — refuses it.

### How it classifies

All seventeen cases below were run through the real sanitizer and the real
rule. Every one came out as intended.

Revealed: `New post` (opener), `Select the post for …` and `Select all posts`
(row selection), `Close composer` (dismissal), the `ORD-40100` row link (page
link), `Order actions` under `[data-testid="order-rows"]` (disclosure),
`Order details` `<summary>` (disclosure).

Refused: `Send reply`, `Schedule post` (submit), `Delete`, `Confirm refund` in
a dialog, `Refund`, `Retry failed posts`, `Dispatch run`, `New post` while a
modal dialog is up (dialog_open), an unlabelled button (unclear), a logout link.

### The one correction to the inherited work

The inherited `dialogIsOpen` was
`page.dialogs?.some(modal) === true || page.blockedBy !== undefined`, and any
`opener`, `row_selection` or `page_link` was refused while it held.

`page.blockedBy` is set whenever *any* of the up-to-40 hit-tested controls is
painted over by anything — a sticky header, a sidebar, a footer
(`apps/extension/src/content/evidence/overlays.ts:30-50`). On a real dashboard
that is normal, and reading it as "a dialog is up" would have refused every
opener on every such page: the same defect in a new place. It is now read only
where its meaning honestly supports the conclusion — to let a bare "Close"
through, because there really is something to close — and "a dialog is up"
means a modal dialog, or the control's own landmark being `dialog`.

## How committing controls stay refused

Both reveal tools now go through one `pressToReveal`, so there is one gate
rather than two that can drift. `Send`, `Delete`, `Confirm` and `Refund` are
refused three times over: by the wording rung, by `submit_control` where they
submit, and by `dialog_open` where they sit in a confirmation dialog. The
runtime recovery `act` option keeps its own wider ladder and asks the same
`webControlWording` for its committing rung.

## What I found about the carried-over dialog

The prior observation (`w2-corpus-c.md:131-138`) was a Reply dialog still open
during playback, with the note "unverified hypothesis: the Flow's navigate
matched without reloading the page". That hypothesis is right, and the
mechanism is two things meeting:

1. The lane resets the fixture and calls `prepareFlowPage()` between the build
   and the run, which does `page.goto(start)` on the **Playwright** scenario
   page (`packages/test-runner/src/run-scenario.ts:251-259, 747-749`).
2. But exploration does not necessarily run in that tab. A non-navigation
   action uses `request.activeTabId`, while a **navigation** resolves through
   `resolveAutomationTab`, and with nothing driven yet that calls
   `chrome.tabs.create` — a brand-new tab
   (`apps/extension/src/runtime/automation-tab.ts:25-37`). From the first
   `web.navigate_same_origin` onwards, exploration is in the extension's own
   tab, which `prepareFlowPage` never reloads.
3. The Flow then opens with a navigate, which reuses that tab and calls
   `chrome.tabs.update(tabId, { url, active: true })`. **Chrome ignores a
   `tabs.update` to the address the tab already shows**, so nothing reloaded
   and the Flow inherited the page exploration had left — dialog open.

Fixed at the root, in `apps/extension/src/runtime/automation-tab.ts`: a
navigation to the URL the tab is already on now reloads it. A navigation means
"be on this page", not "be on this page unless you already are", and this is a
correctness bug for any Flow whose first step navigates to the page the browser
is already showing, not only for the Lab.

Not papered over in a fixture, and no fixture was touched.

**Not verified.** I did not observe a carried-over dialog myself — the
`schedule-post` runs never built a Flow to play back, so there was no playback
to inherit anything. The chain above is read from the code, and the Chrome
`tabs.update` no-op is the one link I have not demonstrated in this repository.

## Live output after the fix

Same command, same task, three runs.

| run | calls | reveal refusals | ended |
| --- | --- | --- | --- |
| `run-mu7cj62r-58da6187` | 5 | 1, on a `<select>` | `evidence_repeat_without_progress` |
| `run-mu7cojks-e6ee0105` | 9 | 1, on a `<select>` | `evidence_unusable_decision` (`web.handle.wrong_control` ×2) |
| `run-mu7ctzm2-b96ee2d5` | 6 | 1, on a `<select>` | `evidence_repeat_without_progress` |

The change in kind is the result: **no button, checkbox, link or menu was
refused in any run after the fix**, against four button refusals in the
baseline. The one refusal in each run is a `<select>`, and the structural
diagnostic says why —
`{"effect":"unclear","tag":"select","revealKind":null,"landmark":"region"}`.
That refusal is correct: a dropdown is not explored by pressing it, it is
filled by the Flow. Cost fell from $0.1156 to $0.0128–$0.0276 per attempt.

`flowCreated` is still `false`, and the reason has moved. The model's only
attempted press is the `<select>`; it never tries "New post". It then repeats
the identical refused call, and the loop's no-progress guard ends the build.
Per the coordinator's distinction: **this is the no-progress guard doing its
job on a model that retries a refused press, not a call-ceiling stop.** Runs
after the fix used 5, 9 and 6 of 26 authorized calls, so no authorization
increase is needed for this task.

The remaining blocker is that `target_unsafe` says two different things —
"this control commits and never will be allowed" and "this control is not
something a press explores" — and the model cannot tell them apart, so it
retries. Separating them is a small, bounded change (add one code to
`WEB_LLM_TOOL_REJECTION_CODES`; the result-code set and the type both derive
from it, and `webAutomationExplorationRefusalClassifier` should return
`undefined` for it rather than `destructive_action_refused`, so a correctable
mistake does not read to Core as a policy stop). I did not make that change:
it is a wire-vocabulary change that wants its own unit of work.

## Commands run and observed results

Filled in below.

## Not verified

Filled in below.

## Open questions or contradictions found

Filled in below.
