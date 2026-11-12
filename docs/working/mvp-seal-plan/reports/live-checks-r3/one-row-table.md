# One-row table trace: run-mwbkuxqt-c57f42cb (follow-official-store)

Read-only trace. Nothing was edited except this report. No Lab, build or test was run.

## Outcome

Root cause found. There were three faults, and any one of them was enough to block the result.

1. **No tool could store one element's text as a row.** The model read the right line with a real read, `web.output.dom-extract` at step 0036. That answer holds a string, and Core only takes an array as rows. The tool that does make rows, Extract List, first needs `detect_repeating_structure`. Detection refused the line's handle every time, because it binds handles only through page views, and a search had found this line. On visible ancestors, detection returned unrelated lists instead.
2. **The judge never received the full line from the site.** Core passes the judge a look's `found` or `page` and nothing else. The extract's own value (`read.extracted`) and describe_element's full text are dropped. The only site evidence of the line the judge got was find_on_page's line, which the domain cuts at 80 characters. Every judge said "cut off", and they were right.
3. **The rounds could not converge.** Each "no" told the model to bring a new read or a new look. The model did both, but the faults above gave it no way to make new evidence. The repeated looks came out the same, so `same_evidence` and the loop guard fired, ending at ask_person after 73 calls.

**Correction to the brief.** The oracle is not `Hubsmith; Mirafone; Qinport; ...`. The manifest builds it from the store names (`apps/scenario-lab/src/scenarios/crossborder-marketplace/manifest/follow-official-store.ts:12,16`, `catalog/stores.ts:9,11,13,19`), so it is `Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store; Voltbay Official Store`. That is exactly the model's answer at steps 0037 to 0146. The Lab judges this task `expected-dataset` against `extract-followed-stores`, which expects one record `{following: ...}` (`live-tasks.ts:155-161`, manifest `:44`). The model had the right value every time; only the stored row and the judge's evidence were missing.

## Answers

### (a) Did the model try to store the line as a row?

Yes, many times. Each attempt failed for a reason in the tooling.

| Step | Call | What happened |
| --- | --- | --- |
| 0036 | `core.run_node web.output.dom-extract {target: t1297, extract: {mode: text}}`, add | Succeeded. `read.extracted` = `"Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store; Voltbay Official Store"`, a string. No row was made. |
| 0041, 0058, 0095 | `detect_repeating_structure` on t1297, t1292 and t510 (the hidden `<p data-testid=followed-stores>` and its flyout div) | Refused `target_unobserved / handle_not_in_packet`. |
| 0054, 0080 | detect on t1081 and t1084 (the item page's account control) | Answered with the product's colour and size option list (`Space Grey`, `7-in-1`, ...), labelled `target: t1081`. |
| 0087, 0093, 0117, 0137, 0143 | detect on t15, t16 and t18 (the home page's account control) | Answered with the home page's 10-item product grid, labelled `target: t15`. |
| 0056 | `core.describe_nodes web.output.dom-extract_list` | The model learned that Extract List reads "one record" but needs "Detect the list first and name it by its handle". It never got a detection it could use. |
| 0072, 0110/0112 | dom-extract again (t1081, t510, t15) | Same as 0036: a string, no row. |

The model knew how. The tools offered no working way to read one text line into a row:

- **Core takes only an array as rows.** `framework/automation-service/service/answer-first/rows/found-rows.ts:28-30` and `:54-60` (`atKey`): `return Array.isArray(rows) ? rows : undefined`. The domain declares one rows key for both reads, `readRowsKey: "read.extracted"` (`domain/src/runtime/llm-evidence/tools.ts:233`). Extract List puts an array there; Extract puts a string, so `automationStudioAnswerFirstReadRows` returns `undefined`.
- **Extract's description sends a table to Extract List.** `domain/src/output-nodes/extract/catalog-text.ts:33-37`: "Read one value off one element ... For rows of a list, use Extract List". Extract has no column parameter and no `recordOutput`.
- **Extract List needs a detection, and detection binds only through page views.** `domain/src/runtime/llm-evidence/structure/detect.ts:252-256` (`boundTarget`: `observed = returned ?? current; ... if (!selector) recoverable("target_unobserved", handleRefusal("handle_not_in_packet", ...))`). `returned` is `returnedEvidence`, written only by `shown` (`tools.ts:183-187`, read at `:396`). find_on_page's and describe_element's captures go to `looked`, and `tools.ts:188-190` says so plainly: "it is never the packet a detection binds its handles through". Presses and reads bind through `targetPackets`, which does hold looks, which is why dom-extract on t1297 worked and detect on t1297 did not.
- **The product's own recorder has the right shape.** The fixture's recording script reads the single element as a one-record read: `{operation: "extract", target: "testid:followed-stores", fields: {following: ":scope"}}` (manifest `:32`). The model's tool surface has no equivalent.
- **Detection on a visible ancestor answered with a list that does not contain the target, still labelled with that target** (0087 result: `target: "t15"`, items are product URLs). The detect header (`detect.ts:27-37`) says a page-wide fallback "names no target". Either the content script's outward search reached the product grid, or the label is wrong. I did not trace which. In both cases the model was told a list was around its account control when it was not.
- **Contributing, not the cause:** the account flyout opens only on CSS hover (`styles/stylesheet.ts:33`: `account:hover flyout{display:block}`). FluxIQ's click sends synthetic pointer and mouse events (`apps/extension/src/content/action-runtime/click-gesture.ts:44-47`), which never set `:hover`. The node catalog has no hover node (see the enum in 0035's request). So the six attempts to open the menu (0043, 0047, 0060, 0089, 0097, 0139) left it "not rendered". Reads work on hidden elements, so this is not needed once a single-element row read exists. A person hovering would see the line, though, and a detection that skips unrendered content cannot find the flyout's lines.

### (b) Where is "cut off" cut?

There are two cuts, and the model's own view is cut too.

1. **The model's own find_on_page answer (domain).** Step 0030 (and 0018, 0091, 0099, 0141) printed `t1297 p "Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official S…" not rendered`. The code is in `domain/src/runtime/llm-evidence/page-find/search.ts`:
   - `:59-60` `const WORDS_SHOWN = 80;`
   - `:203-206` `function cut(words) { ... characters.length <= WORDS_SHOWN ? words : \`${characters.slice(0, WORDS_SHOWN).join("")}…\` }`
   - applied to every match at `:166` and every close match at `:180`, `parts.push(quotedWords(cut(words)))`
   - plus `:62` `WINDOW = 60` and `:209-214` `windowAround`, which cuts a matching attribute or field value.

   This breaks the whole-page rule: an element only the search can show (hidden, collapsed, off-view) is shown to the model only in its first 80 characters. The model got the whole line only through describe_element (0032: `element: t1297 <p> "Followed stores: ... Voltbay Official Store"`) and through its own extracts. The page view itself (0036 `page`) was not cut, but it does not hold the hidden line.

2. **The judge's `looked` (Core).** The judge got two looks (0038 request, lines 622-641):
   - the find_on_page answer, carrying the 80-character cut above
   - **the dom-extract call's look, which is the page view after the read, cut at 600 characters** (`... ="…`), not the value the read returned.

   The code:
   - `framework/automation-service/service/answer-first/attempt/call-chain.ts:136-146` (`lookOf`): `const text = typeof evidence.found === "string" ? evidence.found : typeof evidence.page === "string" ? evidence.page : "";`. A read's `read.extracted` (and the extract's `control`) is never looked at. describe_element's answer has neither key (its text is in `element`), so its full line is dropped altogether. `:51` `FOUND_CHARS = 600`, `:145` `cut(found, FOUND_CHARS)`, `:149-152` `cut`.
   - `.../answer-first/completion/check.ts:97-99` `LOOKS_SHOWN = 6; FOUND_CHARS = 600`, `:288-296` `shownLooks` cuts again.
   - `runtime/result-verification/flow-less/judged-summary.ts:33-36` (same bounds), `:88-98` `lookedShown`, `:101-104` `cut`.
   - `runtime/result-verification/flow-less/question.ts:18` tells the judge each look is "a short cut of what was found", so the judge rightly refuses to treat a cut line as the whole.

   So the judge never saw the full line from the site. It got the full line only as the model's `answerText`, which the question says "proves nothing by itself".

### (c) Why did the rounds not converge?

What the model was told after each "no" or "unsure" (0039, 0067, 0075, 0078, 0102, 0105, 0115, 0120, 0123): the judge's observed text, for example "No rows were read: recordSets is empty. The account line was seen only cut off (...Qinport Official S…)", followed by the fixed text in `.../answer-first/completion/refused-words.ts:18` (`NEW_EVIDENCE`): "Only new evidence changes the check's answer: ... a read that returns different rows ..., after your acts a look at the page that shows what the check said it could not see (open that page, then read or search it there) ...". After a repeat, `same_evidence` (0070, 0108, 0128) added "go to where what the check could not see is shown, and look, read or act there".

The model did exactly that each time. It re-ran dom-extract (0072, 0112, and 0130-0132 through run_flow), searched again (0091, 0099, 0141) and tried detection 11 times. None of it could change what the check reads:

- a dom-extract answer adds no row (a), and its look is the page view's first 600 characters, not the line (b)
- a repeated search gives the same 80-character cut, and `call-chain.ts:72-80` hands the same look on only once, so it is "no new evidence"
- detection either refused or gave unrelated lists (a).

So `resultHolds` stayed `{totalRows: 0, acts: 1}` from 0039 to the end. The completion loop guard escalated near_repeat (0069 steer, 0107 steer, 0127 steer, 0134 change_approach, 0147 ask_person), and the no_progress guard steered at 0083. The feedback was accurate. It promised a way forward that the tools could not give, so convergence was impossible without a tooling fix. Rewording the feedback would not have changed the outcome.

## (d) Root fixes, with owners

| # | Cause | Fix at the root | Files | Likely owner |
| --- | --- | --- | --- | --- |
| F1 | No read stores one element's value as a one-row record. | Give the model the recorder's own shape: a read of one element into named columns, with `":scope"` meaning the element itself, that answers its rows under the declared rows key as a one-item array (`[{following: "..."}]`). Either Extract List accepts an element handle `tN` directly (no detection needed for one record, as its description already promises), or Extract takes an optional column name and a `recordOutput`. The rows still come only from a real read (D9 holds), and nothing about a scenario enters the guidance. Core's `found-rows.ts` needs no change if the domain answers an array. If Core should instead take a scalar under `readRowsKey` as a one-field row, it needs a column name from the read's parameters, which belongs in the domain. | `domain/src/output-nodes/extract/**` or `output-nodes/extract_list` (catalog text, parameter contract, read answer), `domain/src/runtime/llm-evidence/node-run/**` for binding | Domain lane (not in either listed Core lane). Core `rows/found-rows.ts` (mine) only if the scalar route is chosen. |
| F2 | Detection binds handles only through page views, so a handle a search or describe printed is refused. Detection on a target can answer a list that does not contain it, labelled with the target. | Bind detection's target through the same store presses and reads use (`targetPackets`, which holds looks), so every handle the model was shown binds the same in every tool. When the list found is not around the target, say so (no `target`, as the header promises). | `domain/src/runtime/llm-evidence/tools.ts:183-193,392-401`; `structure/detect.ts:252-260` and the fallback path near `:140-160` | Domain lane |
| F3 | The judge's look for a read carries the page, not what the read found. A describe's finding is dropped. | `lookOf` takes what the call found from keys the domain declares (as it declares `readRowsKey`), for example the search's `found`, a single read's `read.extracted`, and describe's `element`, and uses `page` only when nothing more specific was found. Add the declaration to the runtime contract. | Core `.../answer-first/attempt/call-chain.ts:136-146`; the domain declaration in `domain/src/runtime/llm-evidence/runtime-contract/runtime.ts:45` and `tools.ts:233` | `attempt/call-chain.ts` is in neither listed lane. It is closest to mine (`attempt/**`). The lead should assign it, plus the domain lane for the key. |
| F4a | The model's own search view cuts element words at 80 characters and matched values at 60. | Print a match's whole words (and the whole matching value), as the page view does. The whole-page rule forbids the cut. | `domain/src/runtime/llm-evidence/page-find/search.ts:59-62,166,171,180,203-214`, and its tests in `page-find/tests/search.test.ts` | Domain lane |
| F4b | The judge's looks are cut to 600 characters, three times over, and the judge is told they are cuts. | Hand on each distinct look whole. Dedupe already prevents repeats (`check.ts:288-296`). Then drop "a short cut" from the question. If size must be bounded, bound by distinct looks, never by cutting a look's text. | Core `attempt/call-chain.ts:51,145,149-152`; `completion/check.ts:97-99,288-296`; `runtime/result-verification/flow-less/judged-summary.ts:33-36,88-104`; `flow-less/question.ts:18` | `result-verification/**` is mine. `completion/check.ts` is the other lane's. `call-chain.ts` is unassigned (see F3). |
| F5 | (Contributing) CSS-hover menus cannot be opened, and there is no hover node. | A hover node, or a press that produces a real hover. Synthetic events cannot set `:hover`, so this needs trusted input, which raises the "no debugger" standing rule. That needs the user's or lead's decision. | `apps/extension/src/content/action-runtime/click-gesture.ts`; node catalog | Extension lane. Not required once F1 exists. |

No change to feedback wording (c) is needed. Once F1 to F4 land, the existing `NEW_EVIDENCE` path (a new read that returns rows) works as written. The only addition worth making is in F1's own node text: say that one value for a one-row table is read with the new column form. That wording stays generic.

## Commands run and observed results

Read-only inspection only, with `ls`, `cat`, `grep`, `sed`, and short Python readers over the step JSON:

- `steps/index.md`: 147 steps. Judges at 0038, 0066, 0074, 0077, 0101, 0104, 0114, 0119 and 0122, all refused (judged_unsure or judged_no). ask_person at 0147.
- All 73 `*-decide/decision.json` were printed and summarised above.
- Results read: 0030, 0032, 0034, 0036, 0041, 0054, 0058, 0062, 0080, 0087, 0091, 0093, 0095, 0117, 0137 and 0143.
- Judge 0038 request and decision were read in full. The refusal feedback at 0039, 0067, 0070, 0105, 0123 and 0128 was read.
- `test-runs/instances/t885-live/attempts/run-mwbkuxqt-c57f42cb/` is an **empty directory**, so the Lab's evidence was not available. Either the run is still finishing or the evidence was never written there.

## Not verified

- Why exactly t1297, t1292 and t510 are missing from `returnedEvidence`'s selectors. The code says looks never feed detection (`tools.ts:188-190`). I did not prove that the last shown packet lacks those handles or numbers them differently.
- Whether the content script's detection would find a one-item record inside a `display:none` flyout if the binding were fixed. This is why F1 is the primary fix, not F2.
- Why detect answered the product grid labelled with the target `t15`: content-script outward search versus the domain's labelling.
- Judges 0066, 0074, 0077, 0101, 0104, 0114, 0119 and 0122: I read their summaries in `index.md` and their feedback text, not their full requests.
- The Lab-side verdict and dataset comparison, since the Lab evidence directory is empty.

## Open questions or contradictions

- The brief quotes the oracle as `Followed stores: Hubsmith; Mirafone; Qinport; Voltbay Official Store`. The manifest builds it from the full store names and it equals the model's answer (see Outcome).
- `detect.ts:27-37` says a page-wide fallback names no target, but steps 0087, 0093, 0117, 0137 and 0143 answered an unrelated list labelled `target: t15/t16/t18`.
- Ownership: `attempt/call-chain.ts` is in neither listed lane. F1, F2 and F4a are in the downstream domain, which neither listed lane covers.
