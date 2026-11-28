# Brief t1096 (sub-supervisor): fix the eight defects behind the user's manual eldorado run

**Plan.** The diagnosis is your plan: `docs/working/language-driven-flow-loop-plan/debugs/manual-eldorado-osrs-2026-11-27.md`.
- It names each cause with file and line, and designs an offline proof on the user's recording.
- The recording copy is at `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad/heavy-eldorado-dbg/`. Read only.
- Never put its page text into the repository; build fixtures from its structure.

The user watched the run loop and called it "a bunch of bullshit". Seventeen of its 46 decisions (44% of its cost) were
calls refused as repeats.

**The fixes** (none caps a count, wait or retry; user rules in AGENTS.md):
1. **Parameters checked first.** A call with missing or undeclared parameters is refused before anything is sent,
   saying the shape it needs. The first Next press sent `list` at top level, with no `nextPage`.
2. **Nothing happened means nothing happened.** A verb that fails before touching the page says so. A lasting-act
   statement must not call such a failure "may have happened" (`lasting-act-statement.ts:80`,
   `apps/extension/src/content/actions/next-page.ts:66`).
3. **A page turn answered by the page.** The address, the pager's current page and the first rows say whether a page
   turn moved. Ask the page; do not leave it to the model as uncertain. Never press it blindly again.
4. **A failed capture is a refusal, not an answer** (`view-channel/binding.ts:77`, `repeat-policy.ts:136`).
5. **The visible page first.** When the whole page does not fit, the visible page comes first, and the reply names the
   parts not shown so the model can ask for them.
6. **Answered repeats count.** They go through loop detection (`evidence-loop.ts:764`).
7. **An unreadable page is reported as unreadable,** never `not_at_start_location` with "go to <start>"
   (`frozen-execution/page/readable.ts:17`, `run.ts:280`). The user's rule: nothing sends the browser back to the start
   page.
8. **Step fields only where they mean something.** `act`, `place` and `add` are offered only on tools whose calls
   become steps (`evidence-loop-decision.ts:403`).

Also trace and fix, if real:
- "up to 10 pages" was read as `limit: 10` and then dropped by the build's declaration;
- a `(?i)` regex was kept although JavaScript rejects it as written;
- the build never used the site's search for the asked word. Note it, but keep model guidance generic: never teach to
  a site.

**Trees.**
- Downstream: `C:/Users/osrs_/FluxStuff/fxwork/t1096/!FluxIQWebExtension`.
- Core: `C:/Users/osrs_/FluxStuff/fxwork/t1096/!FluxIQ`.
- Branch `task/t1096-manual-run-loop-fixes`.
- Never touch the main checkouts or ports 3000 and 4777; the user's panel runs there.

**Must not touch.**
- Core `runtime/llm/anthropic/**`, `runtime/models/**`, `runtime/llm/step-log/**`, `runtime/conversations/commands/**`
  and `flows/authoring/model/authoring-mode/**` (t1093).
- `answer-first/result/**` and `answer-first/result-feed/**` (t1091).
- `apps/web`, `@fluxiq/ui-components` and `apps/extension/src/panel/**` (t1095).
- Downstream `apps/extension/src/runtime/**`, `page-world/**` and `content/**` (t1094), except
  `content/actions/next-page.ts`, which is yours.

If a fix needs a file on these lists, stop and tell the lead.

**Budget.** `worker` by default, `worker-heavy` for the loop-detection and effect-check pieces, at most about 6
workers.

**Checks.**
- Each fix's offline proof on the recording.
- The tests beside each change, Core `pnpm check`, the domain and extension checks for what you touch, both structure
  audits and `node scripts/check/model-text.mjs`.
- A provider-free 4-attempt kestrel harness run and a bigbox harness run (both must still pass 4 of 4).
- Heavy commands go through the heavy slot.
- No live or paid runs, no git.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1096.md`, plus the return contract.
