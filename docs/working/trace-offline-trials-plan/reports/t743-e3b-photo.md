# t743-e3b-photo: why the trial's Like was ambiguous, and the spec finished

## Outcome

Done. The cause is the order in which the spec builds its Flow. It is not caused by this lane's product edits.

- The Flow was submitted after the build had moved from the post's dialog to the post's own page.
- Those two views share one address, so by then the Like's handle (`t593`) named the standalone page's control.
- The Flow reopened the dialog and pressed that standalone identity inside it. It matched no exact control there, and the post's and comments' Likes tied.

I fixed the spec so the Flow is written where the build last saw the Like: open the post's own page, then press Like. Run headed, it passed twice. photo-toggle.spec.ts passed on this build. No product code was changed.

## The trace

The evidence comes from a temporary capture added to my spec for run 2 and removed afterwards. It wrapped `automationStudioClientGateway.executeAction` and recorded every `web.dom.click` command, from both exploration and the trial. Selectors and context are structural; no page data is included.

| Click | `parameters.selector` | `element.context` | Name |
| --- | --- | --- | --- |
| Exploration `like`, inside the dialog | `body > div:nth-of-type(2) > article > … > section:nth-of-type(1) > div:nth-of-type(1)` | `{dialog: "harbourlight.studio"}` | Like |
| Exploration `unlike`, on the post's own page | `main > article > … > section:nth-of-type(1) > div:nth-of-type(1)` | `{landmark: "main"}` | Unlike |
| **Trial step 3 "like the post"**, run in the dialog over the profile | `main > article > … > section:nth-of-type(1) > div:nth-of-type(1)` | `{landmark: "main"}` | Like |

So the trial's step 3 carried the **standalone page's** identity: a selector under `main` and no dialog context. It did not carry the dialog identity that exploration pressed. The page views show why: `t593 button "Like"` is the post's Like both in the dialog view (steps 3 to 5) and on the standalone page (steps 6 to 12). The Flow named `t593` at step 8, after the standalone page had been viewed.

Where it is decided:

1. **Domain, at submission.** File: `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts`.
   - The packet store keeps one view per location (`flow.pages.set(location, targets)`, line 639). The dialog view's location is the post's pushed address, `/p/<code>/`, which is also the standalone page's. So the standalone page's capture replaced the dialog view's handles for that address.
   - The bare handle `t593` then resolves to the standalone selector (`resolveCurrent`, line 467).
   - `actedAs` (line 458) restores the identity that exploration's first act saw only `while it names that same address`. The dialog selector and the standalone selector differ, so the dialog identity with `context.dialog` is dropped. The node is saved with the standalone identity.
2. **Extension, in the trial.** File: `apps/extension/src/content/action-runtime/resolve-target.ts`.
   - In the dialog over the profile, `main > article …` matches no control. The fingerprint and name attempts give no single accepted match.
   - The family scoring of the post's and comments' `div role=button "Like"` controls (same classes and drawing, no dialog or record to separate them) ties.
   - `resolveIn` returns `ambiguous`. This is most likely at line 408 (`decided?.outcome === "ambiguous" && !isHiddenTie(decided)`), or at line 394 if the fingerprint attempt matched several. The trial feedback carries only the code, not which line.

Why photo-toggle.spec.ts passes: it submits its Flow at builder step 5, right after the dialog Like and before any view of the standalone page. At that point `t593` still names the dialog's control, and the acted identity, with its dialog context, survives.

Why this lane's edits are not the cause:

- The `identity/score.ts`, `identity/veto.ts` and `resolve-target.ts` changes are all gated on `readsWords`/`readsItsWords`. A press is not marked.
- The `fingerprintMatches` refactor to `scanTagMatches` keeps the same behaviour for unmarked targets.
- photo-toggle passed on this same build.

## What changed

I changed only `apps/extension/e2e/site-reset/tests/photo-dialog-destination.spec.ts`:

- **New Flow.** The Flow is now `step post: web.browser-navigate <post's own page>` followed by `step like: web.dom.click <the Like handle as the step-8 view shows it>, consequences: modify_existing`. Before, it was profile → grid cell → `t593`. A correct builder writes this Flow: it presses the control where its newest view shows that handle.
- **Trial-step assertion.** It now expects two succeeded steps, and asserts that the second step's control is "Like".
- **Header.** It now explains why the Flow is written on the own page and why photo-toggle differs.
- **Diagnostic.** It now also records `cellHandle`, `likeHandle` and `ownLikeHandle`.

All of e3's assertions are unchanged and pass: the dialog destination, the undo on the own page, `undo_already_back`, the trial admitted with the unread-list words, and the trial's own Like put back. The temporary click capture is removed.

## Commands run and observed results

All runs were headed, with one worker and the scripted provider, on photo-social:

```
cd C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQWebExtension/apps/extension && node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/<spec> --workers=1 --reporter=list --output <scratchpad>/<label>-<N>
```

`<scratchpad>` is `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad`.

| Run | Spec, state | Observed |
| --- | --- | --- |
| e3b-toggle-1 | photo-toggle.spec.ts (untouched) | `1 passed (2.5m)`. Tests were `trial_reset_required`, `yes`, `trial_reset_required`, `yes`; ending `proposed`. |
| e3b-dialog-1 | photo-dialog-destination, as e3 left it | `1 failed`. Tests were `execution_failed` ×2; step 3 failed with `web.target.ambiguous`. This matches e3's runs 8 and 9. |
| e3b-dialog-2 | as e3 left it, plus the temporary click capture | `1 failed`, same failure. The capture gave the table above. |
| e3b-dialog-3 | fixed spec | `1 passed (1.7m)`. Tests were `yes`, `candidate.trial_reset_required`, `yes`; `trialAct: act-3`; `trialUnlike: true`; ending `proposed`. |
| e3b-dialog-4 | fixed spec, again | `1 passed (1.9m)`, identical diagnostic line. The handles were `cell t116`, `like t593`, `ownLike t593`. The pre-trial reads were 3 reads at the dialog's address, each with 1 group, none holding a dialog group. |

## Not verified

- I ran photo-toggle.spec.ts once, before my edit. My edit touches only the other spec, so I did not re-run it afterwards.
- I did not establish exactly which line of `resolve-target.ts` returned `ambiguous` (408 or 394). The extension's failure message, with its candidate names, was not captured.
- No typecheck was run (forbidden by the brief). The spec is LF and has no unused locals that I know of.

## Open questions or contradictions found

- **Product weakness (not fixed, for the supervisor to decide).** A dialog view and a standalone page that share one address are one page to the target-packet store. A Flow written after viewing both can therefore save a control that the Flow's own steps never reach. Core accepted a Flow whose step 2 opens the dialog while step 3 names the standalone page's control. The real build model could write exactly the Flow e3 wrote.
  - Least general fix: in `target-packets.ts`, key a view by location plus its front dialog, or keep the acted identity when the Flow's preceding step reproduces the view the act was made in.
  - Alternatively, give the dialog's controls handles distinct from the standalone page's, so `t593` does not alias across the two documents.
- e3's "possible lead" (the in-flight identity and resolve-target edits) is ruled out by the trace and by photo-toggle passing.
