# t732 sensitive capture: worker report

Worktree `C:/Users/osrs_/FluxStuff/fxwork/t732/!FluxIQWebExtension`, branch `task/t732-sensitive-cvc-capture`. No commits.
No typed value, token or page data appears in this report. The probe typed a random 4-digit code that was never printed.

## Outcome

Done. Three units, all with tests written first and seen failing:

1. Card security codes, and controls inside a marked group, are now withheld on every capture path. The headed probe shows the leak with the old classifier and no leak with the fix.
2. An inert file input now reports `hidden` (`web.target.not_shown`) instead of `disabled`.
3. A blank text wait is now refused at once, with the same closed, non-retryable record a blank assert ends in. This unit was added mid-task by the supervisor.

Two edits fall outside the paths the brief listed. I made them because "one rule" required them; see Open questions 1.

## 2026-10-19: Unit 2, inert file input reports `not_shown`

**What changed and why.** `unusableReason` in `upload.ts` now returns a code with its detail:

- a disabled input keeps `disabled`, which is TARGET_NOT_ACTIONABLE;
- an input in an inert subtree now gets `hidden`, which `results.ts` `PAGE_STATE_CODES` maps to TARGET_NOT_SHOWN (`web.target.not_shown`, `target_not_found`).

This is the contract from commit ba9fea58, and it is what the actionability gate already says for inert elements everywhere else. The e2e row `actionability-gate.spec.ts` ("upload: a file input in an inert subtree is refused…") already expected `web.target.not_shown`. I did not run that row (e2e belongs to t730).

**Commands and results.**

- Test first: `EXTENSION_TEST_BUILD_LABEL=t732 node apps/extension/scripts/test-extension.mjs src/content/actions/tests/upload.test.ts` printed `not ok 8 - an input inside an inert subtree is refused as not shown…` (it got `code: "disabled"`).
- After the fix, the same command printed `# tests 8 # pass 8 # fail 0`.

UNIT READY: apps/extension/src/content/actions/upload.ts, apps/extension/src/content/actions/tests/upload.test.ts

## 2026-10-19: Unit 1, card security codes and group-marked controls withheld by one rule

**Where the rule lives.** The extension's classification is `shared/sensitive-field.ts`. It only re-exports `isSensitiveFieldSignature` from `domain/src/sensitivity/signature.ts`, which is the one rule for both sides of the wire. Two adapters sit over that rule:

- `content/element-traits.ts` `isSensitiveFormControl` reads the live element;
- `domain/src/sensitivity/descriptor.ts` reads the wire descriptor.

`content/sensitive-text.ts` `isWithinSensitiveControl` asks the rule of the element and of each ancestor.

The capture paths that gate on it:

- `describe-element.ts` `readElementValue`, `checkedState` and `selectState`. These feed the descriptor, the snapshot, `dom.input`, `dom.change` and every keydown's `element`.
- `descriptor-attributes.ts`.
- `dom-events.ts` `recordableKey`.
- The snapshot's selection guard in `dom-snapshot.ts`.
- Forms evidence (`evidence/forms.ts`).
- The type, clear and select verbs' validations.
- The fact page.
- Text readers through `sensitive-text.ts`.

**Root cause.** The rule read only type, `autocomplete` and `data-sensitive`. bigbox's card frame field is `<input name="cvc">` labelled "Security code", with no `autocomplete`. So every path treated it as ordinary.

The ancestor case was already handled by the capture paths that ask `isWithinSensitiveControl`. It was not handled in four places that asked only whether the element itself is sensitive:

- the type, clear and select verbs (validation strings quote the value read back);
- the forms producer's `sensitive` flag;
- the fact page's checkbox state.

**What changed.**

- `domain/src/sensitivity/card-security-code.ts` (new): `namesCardSecurityCode(text)`.
  - It splits identifiers and labels into words, including at camelCase boundaries.
  - It matches whole words: cvc, cvv, csc, cvn, cvc2, cvv2, securitycode.
  - It matches the consecutive phrases "security code", "card verification" and "card validation".
  - It deliberately leaves out "verification code" alone, which is a one-time code.
- `domain/src/sensitivity/signature.ts`:
  - The signature gains optional `names` and `labels` (`ReadonlyArray<unknown>`; only strings are read).
  - They are consulted for text-entry input types only: `""`, text, tel, number, password, search. A button or checkbox called `cvc` stays ordinary.
- `domain/src/sensitivity/descriptor.ts`:
  - names come from `attributes.name`, `attributes.id` and `id`;
  - labels come from `label`, `accessibleName`, `attributes["aria-label"]` and `attributes.placeholder`.
  - Comments in `index.ts` were updated to match.
- `domain/src/recording/web-state/evidence/project.ts`: the projection's own second check passes the producer's `name` and `label` to the rule.
- `content/element-traits.ts` `isSensitiveFormControl` passes an input's `name`, `id` and label words: `aria-label`, `placeholder`, `labels`, and `aria-labelledby` targets. They are read raw, because `identity/` readers ask this predicate themselves.
- These now ask `isWithinSensitiveControl` instead of the self-only check:
  - `actions/type.ts`, `clear.ts` and `select.ts` (`withheld`);
  - `evidence/forms.ts` (`sensitive`);
  - `facts/dom-page.ts` (checkbox state).
  - Comments in `value-redaction.ts` and `select.ts` were updated to match.
- Tests:
  - new: `domain/src/sensitivity/tests/card-security-code.test.ts` and `apps/extension/src/content/tests/element-traits.test.ts`;
  - rows added: `signature.test.ts`, `descriptor.test.ts`, `project.test.ts`, `describe-element.test.ts`, `forms.test.ts`, and `actions/tests/value-redaction.test.ts`. That last one holds the type/clear/select-in-a-marked-group rows; a separate file would have pushed `actions/tests/` to 26 files, past the audit limit.
  - `tests/stub-page.ts`: `StubInput.labels` now returns the wrapping labels.

**Commands and results.**

- Domain tests, first run: `DOMAIN_TEST_BUILD_LABEL=t732 node scripts/test-domain.mjs src/sensitivity/tests` (from `domain/`) failed to build because the module did not exist yet. After the fix: `# tests 26 # pass 26 # fail 0`.
- `... src/recording/web-state/evidence/tests` first printed `# tests 10 # pass 9 # fail 1`. After the fix, run together with sensitivity: `# tests 36 # pass 36 # fail 0`.
- Content tests, first run: `EXTENSION_TEST_BUILD_LABEL=t732 node apps/extension/scripts/test-extension.mjs src/content/tests/element-traits src/content/tests/describe-element src/content/evidence/tests/forms src/content/actions/tests/withheld-in-marked-group` printed `# tests 34 # pass 26 # fail 8`, all eight being the new rows. Each verb row failed on `redacted` (`expected: true, actual: false`).
- After the fix: `... src/content/tests/ src/content/evidence/tests/ src/content/actions/tests/ src/content/facts/tests/ src/content/identity/tests/ src/content/extraction/ src/content/action-runtime/` printed `# tests 1263 # pass 1263 # fail 0`.
- After all three units, with the verb rows merged into `value-redaction.test.ts`: `... src/content/ src/shared/ src/background/connection/` printed `# tests 1773 # pass 1773 # fail 0`.
- Domain callers of the descriptor rule: `... src/sensitivity/tests src/recording/ src/client/ src/output-nodes/ src/element-fingerprint/ src/runtime/llm-evidence/packet-fingerprint src/runtime/tests` printed `# tests 562 # pass 562 # fail 0`.
- Typechecks: `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit`, in both `apps/extension` and `domain`. The first round found 3 errors:
  - `project.ts`: the signature type was too narrow for wire values;
  - two test casts.
  After the fixes, all four printed `exit 0`.
- `node scripts/structure-audit.mjs` first failed: `[directory-files] apps/extension/src/content/actions/tests/: 26 source files exceeds the 25-file limit`. After the merge it printed `structure-audit: passed (212 warning(s), 636 baselined)`.
- Headed provider-free probe on bigbox-retail (a realistic scenario).
  - Files, all in the scratchpad: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t732-probe/t732-cvc-probe.spec.ts`, with `t732-probe.config.ts` and `package.json` beside it. The config uses the content harness's global setup, headed, Chromium.
  - Setup: run first `node ../../scripts/build-cache/cli.mjs test-contracts:build` (restored from the store).
  - Command (from `apps/extension`): `NODE_OPTIONS=--no-experimental-strip-types node node_modules/@playwright/test/cli.js test -c <scratchpad>/t732-probe/t732-probe.config.ts`.
  - What it does: opens `/scenarios/bigbox-retail/checkout/payment-frame` as the top page, turns recording on with input-value capture on, clicks the "Security code" field, types a random 4-digit code, presses Tab, then reads the snapshot, the recorded events and the sent messages. It prints booleans only.
  - With the fix: `1 passed`. `snapshotCvcHasValueField: false`, `snapshotHasCode: false`, `formsEvidenceMarksCvcSensitive: true`, `keydownCount: 5`, `keydownDigitKeysWithheld: true`, `keydownsHaveCode: false`, `inputEventCount: 1`, `inputEventsHaveCode: false`, `inputEventsHaveInputValue: false`, `anyRecordedEventHasCode: false`, `anySentMessageHasCode: false`.
  - Contrast on the same site: an ordinary search field's typing was recorded with its value (`ordinaryInputRecordedWithValue: true`). So capture was on, and only the code was withheld.
  - Baseline: the same probe with `element-traits.ts` temporarily set back to `HEAD`, then restored and confirmed byte-identical with `cmp`. Result: `1 failed`, with `snapshotHasCode: true`, `formsEvidenceMarksCvcSensitive: false`, `keydownsHaveCode: true`, `inputEventsHaveCode: true`, `anySentMessageHasCode: true`. That reproduces t730 c2's finding.

UNIT READY: domain/src/sensitivity/card-security-code.ts, domain/src/sensitivity/signature.ts, domain/src/sensitivity/descriptor.ts, domain/src/sensitivity/index.ts, domain/src/sensitivity/tests/card-security-code.test.ts, domain/src/sensitivity/tests/signature.test.ts, domain/src/sensitivity/tests/descriptor.test.ts, domain/src/recording/web-state/evidence/project.ts, domain/src/recording/web-state/evidence/tests/project.test.ts, apps/extension/src/content/element-traits.ts, apps/extension/src/content/tests/element-traits.test.ts, apps/extension/src/content/tests/stub-page.ts, apps/extension/src/content/tests/describe-element.test.ts, apps/extension/src/content/actions/type.ts, apps/extension/src/content/actions/clear.ts, apps/extension/src/content/actions/select.ts, apps/extension/src/content/actions/value-redaction.ts, apps/extension/src/content/actions/tests/value-redaction.test.ts, apps/extension/src/content/evidence/forms.ts, apps/extension/src/content/evidence/tests/forms.test.ts, apps/extension/src/content/facts/dom-page.ts

## 2026-10-19: Unit 3, blank text wait refused at once like a blank assert

**Root cause.** `requireText` in `wait-conditions.ts` threw a bare Error. `results.ts` `actionFailure` classifies a bare Error as ACTION_FAILED, which is retryable, so the blank wait was run again. A blank text assert instead returns `verdict: "malformed"`, whose failed validation the result builder records as STATE_MISMATCH (`retryable: false`).

**What changed.**

- `action-runtime/blank-text-refusal.ts` (new) holds the one rule: `blankTextRefusal(text, "assertion" | "wait")`. It returns `{ expected: "a nonblank text expectation", actual: "the <by> named no meaningful text" }` for missing, empty, whitespace or non-string text, and `undefined` for any nonblank string, `"null"` included.
- `assertion-evaluation.ts` asks it. The wording is unchanged.
- `wait-conditions.ts` asks it. On a refusal it throws a private `BlankTextWaitError implements WebAutomationFailureCarrier`, which carries `webAutomationFailureRecord(STATE_MISMATCH, refusal)`. The existing failure path (`actionFailure` → `reportedFailure`) lifts a carried closed record as given, so the result has STATE_MISMATCH and `retryable: false`. `waitUntil` still ends on the first evaluation's throw, so nothing is polled.
- Tests:
  - new: `tests/blank-text-refusal.test.ts`;
  - `tests/wait-conditions.test.ts`: the blank row now asserts the carried record equals the STATE_MISMATCH record with the shared words, has `retryable: false`, and that the refusal returns in under 1 s;
  - `tests/assertion-evaluation.test.ts`: the blank row also pins the shared words.

**Commands and results.**

- Test first: `EXTENSION_TEST_BUILD_LABEL=t732 node apps/extension/scripts/test-extension.mjs src/content/action-runtime/tests/wait-conditions src/content/action-runtime/tests/assertion-evaluation src/content/action-runtime/tests/blank-text` printed `ERROR: Could not resolve "../blank-text-refusal"`.
- After the fix: `... src/content/action-runtime/ src/content/actions/tests/` printed `# tests 587 # pass 587 # fail 0`.
- Typechecks and the structure audit are the shared runs listed under unit 1: all four `exit 0`, audit passed.

UNIT READY: apps/extension/src/content/action-runtime/blank-text-refusal.ts, apps/extension/src/content/action-runtime/tests/blank-text-refusal.test.ts, apps/extension/src/content/action-runtime/wait-conditions.ts, apps/extension/src/content/action-runtime/tests/wait-conditions.test.ts, apps/extension/src/content/action-runtime/assertion-evaluation.ts, apps/extension/src/content/action-runtime/tests/assertion-evaluation.test.ts

## Not verified

- **Whole suites.** No `pnpm check`, `pnpm test` or full package suites; only the tests beside each change, as the brief asked.
- **Browsers.** No Firefox run. The probe was Chromium only.
- **Real iframe.** The content harness delivers top-frame messages only, so the probe opened the card frame's URL as the top page. It did not exercise the frame inside `/checkout` as an iframe in a loaded extension.
- **Group-marked control in a browser.** That case was covered by unit tests only. t730's account-recovery panel, which carries a marked group, is on t730's branch, not in this tree.
- **E2e row for unit 2.** I did not run `actionability-gate.spec.ts` (e2e is t730's).
- **Retry loop for unit 3.** I did not observe it live. The claim that nothing retries rests on the existing carrier lift plus STATE_MISMATCH's `retryable: false` row in `domain/src/runtime/failure/codes.ts`.

## Open questions or contradictions found

1. **Edits outside the listed "Owns" paths.**
   - The classification the brief asked me to find lives in `domain/src/sensitivity/`, re-exported by `shared/sensitive-field.ts`. A name and label rule kept only in `content/` would have been a second rule that the domain's descriptor checks never saw. That is the drift `signature.ts` warns about, and it is how a card number leaked before. So I edited `domain/src/sensitivity/*` and `domain/src/recording/web-state/evidence/project.ts`.
   - For unit 3, "one rule for both" required a one-line change in `action-runtime/assertion-evaluation.ts`, beside the `wait-conditions.ts` the supervisor assigned.
   - None of these paths is in L1's status, e2e or Core. I checked the other fxwork trees and found no in-flight edits to them.
2. **The wire descriptor still carries no marker for a control that is sensitive only through its group (t730 c2 open question 2).** The content side withholds such a control's value, checked state and options at source, and the forms producer now flags it. But `DomElementDescriptor` has no field for it, and `apps/extension/src/shared/dom-element.ts` is L1's (must not touch). Exact change for after L1 merges:
   - add `sensitive?: true | undefined` to `DomElementDescriptor` in `shared/dom-element.ts`, documented as "is or sits inside a control the shared rule marks";
   - in `content/describe-element.ts`, set `descriptor.sensitive = true` when `isWithinSensitiveControl(element)`;
   - in `domain/src/sensitivity/descriptor.ts`, treat `record.sensitive === true` as `dataSensitive: "true"`;
   - add a row in `descriptor.test.ts` and one in `describe-element.test.ts`.
   - I did not fake it through `attributes["data-sensitive"]`, because saved fingerprints and selectors read `attributes`.
3. **`content/identity/accessible-name.ts:104` (L1's file).** `buttonValueName` asks the self-only `isSensitiveFormControl`. A button-type input inside a marked group would still give its `value` as its name. Suggested one-line change after L1: use `isWithinSensitiveControl(element)`.
4. **`apps/extension/src/background/connection/runtime-status.ts` (not owned)** keeps its own descriptor adapter over the rule, without names or labels. It should call the domain's `isSensitiveElementDescriptor`. The content side already withholds the value at source, so this is defence in depth.
5. **`domain/src/runtime/llm-evidence/packet-fingerprint/from-packet.ts`** builds its `secret` flag without names or labels, so a fingerprint built from a packet does not mark a field that is sensitive only by name or label. I left it unchanged; it is under `llm-evidence/`, where L1 is active.
6. **Docs (not owned).** `docs/architecture/sensitive-values.md` ("One Rule") still says the rule "reads three attributes". It needs:
   - the name and label signals for text-entry inputs and the `card-security-code.ts` matcher;
   - the descriptor fields read;
   - that the type, clear and select verbs, forms evidence and the fact page's checkbox state now ask `isWithinSensitiveControl`.
   `docs/architecture/extension-client.md` also mentions the rule.
7. **`content/identity/reportable-text.ts`** still asks the self-only check. It reads the words of content-named elements (buttons, links), not control values, so I left it unchanged. Under the sensitive-text rule, a button inside a marked group gives no text; `reportableText` would still give its words.
8. **Unit 3's code.** STATE_MISMATCH matches the blank assert, as the supervisor asked. INVALID_PARAMETER would describe a malformed command more exactly (also not retryable). Changing it would mean changing both callers, because the code now comes from one place.
