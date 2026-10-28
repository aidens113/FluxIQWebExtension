# t776 recording step labels

## Outcome
Done (Core side). The build model now sees, per recorded step, the kind, the control's label and role, whether a value was entered, and whether a later step undid it. No downstream source change was needed.

## What changed and why (Core tree `fxwork/t776/!FluxIQ`)
- New `packages/fluxiq/src/programs/automation-studio/runtime/service/instruction-led/recording-steps.ts` (exported from the directory barrel): `supportingRecordingSteps(timeline)`.
  - Source: canonical action entries, else domain events. Passive events (focus, blur, scroll, wheel, mutation, snapshot, ready, error, tab state) are dropped.
  - Each step: `kind`, `label` (accessible name, else name or label, else visible text; whitespace collapsed; capped at 80 characters), `role`, and `valueEntered: true` for entering steps.
  - An entering step is labelled by name alone, because a field's own text is its value.
  - A label that looks like a URL, an email address or a long digit run is dropped.
  - Never carried: typed or selected values, URLs, selectors, page text beyond the label.
  - Steps on password or payment controls are omitted entirely and only counted in `withheldSteps`. Detection is `type=password`, or a name, label, id, placeholder or autocomplete matching password, pin, secret, token, otp, cvv, card, cc-, iban, expiry, credit, payment and similar.
  - Undone: a repeated toggle click (checkbox, switch) marks the earlier click `undone` and the later one `undoes: n`. A later entry on the same field marks the earlier one `undone`. An explicit undo or back step marks the nearest earlier live step `undone`. The list is capped at 100 steps (`stepsTruncated`).
- `recordings.ts`: each supporting recording now also carries `steps`, `stepsTruncated` and `withheldSteps`, beside the unchanged description, authority and method fields. The instruction is untouched.
- `llm/deepseek/system-prompt.ts`: the recordings sentence, said only to requests that carry recordings, now adds a generic clause. It says steps list what the person did, show mistakes they undid as well as what worked, and are evidence of how the site behaves, not a script to replay. The instruction-wins sentence is unchanged and still comes first.
- Pins updated for this intended change only: `deepseek/tests/system-prompt-pins.json` (the `flow_bootstrap_recordings` entry) and the projection expectation in `service/instruction-led/tests/authority.test.ts`.
- New tests:
  - `instruction-led/tests/recording-steps.test.ts` covers labels kept and values, URLs and page text dropped; password and payment steps omitted and counted; label screening; undone marking; the cap; and the projection.
  - `llm/deepseek/tests/recording-evidence.test.ts` covers the packed build context carrying the steps beside the unchanged instruction, and the prompt keeping the instruction authoritative when the recording's steps conflict with it.
- Wording uses no scenario names, products or answers.

## Commands run and observed results
- Core grouped runner (`node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql` on `runtime/service/instruction-led`, `runtime/llm/deepseek`, `runtime/conversations`), final run: parallel group "Test Files 33 passed (33)", real-sql group "Test Files 11 passed (11)", "all groups passed". An earlier run that also included `runtime/llm/harness` gave 83/83 files and 703 tests (parallel) and 11/11 files and 149 tests (real-sql).
- Prompt-contract test `system-prompt.test.ts` is inside the deepseek directory above and green after the pin update. It failed on exactly the 2 `flow_bootstrap_recordings` pins before the update.
- The structure audit first flagged `as never`, the harness tests directory's 25-file limit, a barrel import, packed statements and three web-vocabulary names. I fixed all of them.
- Core `pnpm check`: after fixing a typecheck error in my test, `node --test` ran 471 pass, 0 fail. The structure audit then passed (0 new violations) and contracts, client-gateway-websocket, fluxiq and web checks built. I read the first four build-cache lines directly. I did not see a final "web:check" success line beyond its build record, and no failure was printed.
- `pnpm docs:check` (Core): "structure-audit: passed", "Deterministic framework reference is current". No public declaration change needed regeneration.
- Downstream `pnpm structure:check`: "structure-audit: passed (227 warning(s), 616 baselined)".
- Downstream provider-free demonstration dry run, after `pnpm --filter fluxiq build` in the Core tree (the Lab refused a stale Core build first):
  `FLUXIQ_TEST_ENV_FILES=none pnpm lab run job-board --instruction-task job-board-remote-easy-apply --demonstration job-board-remote-easy-apply-demo --dry-run`
  gave `run-mvrs927p-d4f4a78e`, verdict passed, chipShown true, 158 recording entries, no model calls (provider-free).

## Not verified
- Real web-recorded timelines were not inspected for how often the label and role fields are present. The unit tests use synthetic web-shaped `domain_event` payloads (`payload.element.{name,role,visibleText,attributes}`) and canonical actions with an element fingerprint. If the extension records labels under other keys, steps will show kind only.
- The dry run shows the provider-free path still passes. It does not print the steps the model would see, since no model call is made.
- No live or paid run, and no full suites.

## Open questions or contradictions found
- The sensitive-control screen is a conservative keyword match, so a control named for example "Payment method" is withheld and a benign control may be withheld too (it errs on the safe side). A domain-supplied "sensitive" flag on the element would be more precise if the web domain can mark one.
- Undo detection is generic and heuristic (toggles, replaced entries, explicit back or undo). It does not detect an undo made by navigating away or by other control kinds.

## Addendum: proof on the real job-board recording (lead request)
The first dry run's recording was not persisted, so I re-ran the same dry run with a temporary, since-removed dump of `get-recording` to a scratch file (run `run-mvrstxla-508c1282`, verdict passed, 154 timeline entries: 16 action, 8 domain_event, 114 observation). I ran the step function over the raw timeline and deleted the raw dump afterwards. The temporary line in `packages/test-runner/src/run-scenario.ts` is removed (`git status` downstream shows only this report).

**Real finding, fixed tests first.** The first version gave only `{"kind":"click"}` x13, `select`, `extract_list`, with no labels. Real recorded actions are `web.dom.click` / `web.dom.select` / `web.dom.extract_list` entries that keep the acted control in `parameters.element` (`accessibleName`, `label`, `name`, `visibleText`, `implicitRole`), not in `target`, and use `implicitRole` instead of `role`. The reader now merges `parameters.element` with any target fingerprint and takes `role ?? implicitRole` (also for domain events). A new unit test pins that shape. The real recording also showed the detours were not marked, because they are not toggles or back steps. I added `replaced-choices.ts` (generic, from step order alone), with a unit test: a pick replaced by another pick from the same opener, and a different item picked between two picks of one item, are marked `undone`. The step that replaces or returns carries `undoes`.

**Exact step list the model would receive for the real recording** (`withheldSteps: 0`, `stepsTruncated: false`):

| # | kind | label | role | flags |
| --- | --- | --- | --- | --- |
| 1 | click | Accept all | button | |
| 2 | click | Find jobs | button | |
| 3 | click | No thanks | link | |
| 4 | click | Remote | button | |
| 5 | click | Remote only | link | |
| 6 | click | Job type | button | |
| 7 | click | Full-time | link | undone |
| 8 | click | Job type | button | |
| 9 | click | Any job type | link | undoes 7 |
| 10 | click | date | link | |
| 11 | click | relevance | link | undone |
| 12 | click | Try again | button | |
| 13 | click | date | link | undoes 11 |
| 14 | select | Jobs per page | combobox | valueEntered |
| 15 | extract_list | none | none | |

Checks: the Remote filter (4-5), the Full-time detour with its undo (6-9) and the relevance sort detour with its return (10-13) each have a non-empty human label and the detours are marked `undone`. The selected "jobs per page" value is not present, only `valueEntered`. A scan of the serialized steps for `http`, `?`, `=` and `@` found none. Scroll actions are dropped as passive. No typed value, URL query or page text beyond control labels appears.

Caveats: undo detection for the `Full-time` / `Any job type` pair is "replaced from the same opener", so the model is told the Full-time pick was replaced; it is not told the person intended it as a detour. "Try again" (a rate-limit style interruption) is kept as a normal step. The `extract_list` step has no label (the picker defines a list, not a control).

**Re-validation after the fix**
- Core grouped runner on `runtime/service/instruction-led` and `runtime/llm/deepseek`: parallel "Test Files 18 passed (18)", real-sql "Test Files 1 passed (1)", "all groups passed".
- Core `node scripts/structure-audit.mjs`: passed. Core `pnpm check`: `# pass 471`, `# fail 0`; fluxiq:check and web:check each built with no error printed.
- Not re-run after the fix: the downstream lab dry run (it is unaffected: the change only changes what the build model sees), and a Core rebuild of `dist`.
