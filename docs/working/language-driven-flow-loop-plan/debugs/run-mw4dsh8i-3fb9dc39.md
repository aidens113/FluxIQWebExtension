# Debug: run-mw4dsh8i-3fb9dc39

Status: Failed as a pair. Both answers were right and the site is exactly right, with no duplicate collection. Attempt 2 ended `waiting_for_person` (`stuck_in_a_loop`) because the judge kept saying it could not confirm. This is the first live run of any task on photo-social, and lane B's first photo-social-kiln-notes pair (t876, slot-2).
Source: Core efba88efa (A5; A6's native judge schema, which the lead is now taking out of the integration) / Downstream 9ac3d6231.
Task: photo-social-kiln-notes, unchanged, `--attempts 2`. Visible Chrome, watched live.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards and no overrides.

## Result and distance reached

**Attempt 1: right, achieved.** 17 live steps, 18 calls, 80% cache, $0.3336, 124 s. Site change exactly as asked: `collection:kiln-theory-notes` +1 with both Kiln Theory posts (`Dn6ixXoKbtq`, `D1AanlGg31e`). Activity: "consent", "notifications", "collection-create". No filled bookmark was pressed and nothing was unsaved. Three rows were stored and shown (Kitchen 3, Studio inspo 5, Kiln Theory notes 2). The draft could not be saved as steps (`flow_bootstrap.evidence_completion_parameters_unresolved`), so attempt 1 saved notes only.

**Attempt 2: answer right, not finished.** It found "The Kiln Theory notes collection made" already done. The site's change and activity are empty, so there was no second collection. It read the same three rows. It explored from blank, because no steps had been saved. It then ran into the judge: 15 live steps, 27 calls, $0.6033, 214 s, and it ended asking a person.

## What happened in attempt 2

The judge was asked five times (0045, 0052, 0062, 0077, 0091) and never said yes:
- 0045 and 0091: the reply was a placeholder ("diagnosis: placeholder"). This is the same empty-judge failure as run-mw4db9pz-2789cf41 and run-mw4coxdn-e2b30c8c under A6's native schema.
- 0052, 0062 and 0077: real but unsure. "Two acts are recorded as landed, but only as generic presses with no names. The end view shows the All posts page with no authors, no collection contents, and no Saved page collection order. No before/after witnesses are given."

Between judges the model re-read and pressed into the collection, but each re-complete was refused `same_evidence` (0056, 0068, 0081, 0095). The loop ladder then went from steer to change_approach to `ask_person` (0097). The watcher's "a save may have been undone" at 0081 was the refusal quoting the request's "Don't unsave anything", not an act: attempt 2's activity is empty.

## Causes

1. **Empty judge replies (A6), decisive for 2 of the 5 judges.** The lead is taking A6 out, so this is lane A's to redo.
2. **The acts carry no names, so the judge has nothing to check them against.** Attempt 1's card reads "Pressed a control that changed the page." (the New collection press, whose model gave no consequence class) and "Done." (the picker's Done in a dialog). The judge's own words name this as why it cannot confirm. Two parts:
   - The generic line for a press with no class is `answer-first/act-record/words.ts`, the class-words line the lead routed to t869's untrue-lines worker.
   - The item a dialog press acted on has no card: lane B's card rule gives nothing in a dialog (`acted-on-card.ts`). The dialog's own name ("New collection" or the name typed into it) would be the thing acted on. This is lane B's area, and it is proposed to the lead, not started.
3. **No witness of the collection's contents.** The judge asked for what the collection holds and for the Saved page's order. The model re-read the same table, which is not new evidence, instead of opening the collection to show its posts. The `judged_unsure` refusal names what is missing, but the model did not act on it. That is generic model behaviour: guidance never mirrors a scenario, so it is noted, not tuned.

## The chat the person saw (attempt-1/answer-turn.jpg)

The table (Kitchen 3, Studio inspo 5, Kiln Theory notes 2) with CSV and JSON, then "On the site: Pressed a control that changed the page. Done." and "Checked: 3 rows, 2 acts on the site". "Saved today: notes only. I could not save steps, so next time I will start from what I learned." The table is true, but the act lines tell the person nothing about what was done.

## Next

Wait for the integration without A6 before more judged pairs. Propose naming a dialog press by its dialog (lane B's card rule) to the lead.
