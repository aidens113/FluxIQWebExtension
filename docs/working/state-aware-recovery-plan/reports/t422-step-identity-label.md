# t422: a created step's saved identity keeps every stable fact about its element

Worker report. Trees: downstream `fxwork/t422/!FluxIQWebExtension` and Core `fxwork/t422/!FluxIQ`, both on
`task/t422-step-identity-label`. Nothing is committed.

## Outcome

Done, under the scope as widened by the two coordinator messages from the user (2026-10-10):

- "every element is found by its fingerprint";
- "the model never deals with fingerprints".

A step built from a handle now saves the same fingerprint a recorded step saves. It is built by the recorded path's own
normalizer. The extension, on the real crossborder item page, finds such a step after its label changes, after its id
changes, and after its id and class both change. Once every identifying signal has changed, it is honestly not found.

**Core feedback.** I first added an "address only" message, then reverted it under the second rule. Today's not-found
feedback already says to try again. The gate answers that once with `retry_allowed` and then closes the revision.
A Core test now pins that behaviour; Core's source is unchanged.

## What changed and why

### Domain: `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`

**How it is built.** `webPlanElementIdentity` writes the packet element as the descriptor the recorder captures. It
runs that through the recorded path's normalizer (`output-nodes/targets` `elementFingerprint`), so the two paths read
one vocabulary.

**What it now carries.** The identity type gains these fields:

- `implicitRole`, `label`, `id` and `classNames`;
- `name`, the authored attribute;
- `testId`, derived by the recorded normalizer from `data-testid`, `data-test` or `data-cy`;
- `attributes`, limited to an allowlist: `name`, `placeholder`, `aria-label`, `data-testid`, `data-test`, `data-cy`.

The context gains `landmark` and `tablePosition`. It already kept form, list position, shadow hosts and record.

**What it never carries.** Values, `checked`, the selected option, `href`, `type`, `inputmode` and `autocomplete`.

**Secret controls.** A control is now judged secret by its `autocomplete` and `data-sensitive` attributes as well as by
its type. A secret control keeps no words and no attributes: no id, class, name, label, placeholder or test id.

**Where the facts come from.** Nothing new is stored. The packet the domain keeps for each handle already holds every
attribute the capture's descriptor carried (`elements.ts` `publishedAttributes`; `describe-element` sends `id` and
`class` among them). So no store had to grow, and the page view is unchanged. A test asserts the view shows no id,
class or selector.

**Across views.** `webPlanElementIdentityAcrossViews` keeps the fields two views agree on. For `classNames` it keeps
the tokens both views share, so a class an act toggles (such as `is-focused`) is dropped and the stable classes stay.

### Domain: `target-packets.ts`, outside the original ownership

`agreedIdentity` writes every identity field through `present<>`, so it must name the new fields or it does not
compile. I added `implicitRole`, `label`, `id`, `classNames`, `name`, `testId` and `attributes`, each kept only when
two pages agree on it.

### Domain tests

- Exact-match expectations now include the new fields in `plan-node-identity.test.ts`, `resolve-plan-node.test.ts`
  and `shadow-host-identity.test.ts`.
- New file `identity-stable-facts.test.ts` covers:
  - the R4a quantity box saved with its label, implicit role, id and class, reaching `command.element` through Core's
    normalizer and the gateway mapping, with no value and no `inputmode`;
  - the identifying attributes;
  - a control marked secret by `autocomplete`;
  - a label changed between views being dropped;
  - a toggled class being dropped;
  - the page view showing no fingerprint.

### Extension: new content-harness spec, outside the original ownership

`apps/extension/e2e/content/tests/created-identity/tests/fingerprint-after-change.spec.ts`, on the crossborder item
page (a realistic scenario). The step is built the real way:

- the content script's snapshot is read through the domain's evidence runtime;
- the handle comes from the printed page view (`tNNN field "Quantity"`);
- `resolvePlanNodeParameters` turns it into the step's parameters;
- each dispatch goes through Core's normalizer and `webAutomationActionFromGatewayCommand` to the content script.

The cases, in order:

1. **The label's words change** ("Qty"), same load: the step succeeds and the box holds "2".
2. **A new load gives a new id.** R4a's address-only identity fails exactly as it did live: `web.target.not_found`,
   "nothing matched; 3 control(s) of the same family…", with no `bestScore`. The full identity succeeds and the box
   holds "3". The page's first lookup finds it by class, and the veto passes it.
3. **The class is replaced too:** the step succeeds by `scored-candidate` among the 3 controls, through the label, and
   the box holds "4".
4. **The label also changes:** `web.target.not_found`, and the box still holds "4".

### Core: `target-on-page.test.ts` only

Core's source is unchanged. My earlier `addressOnly` case in `target-on-page.ts` and the one-line change to
`feedback.ts` were restored with `git restore`.

New rows rebuild R4a's second attempt: no score, 3 same-family controls, an address-only node. They check four things:

- the step keeps today's feedback: "The step's control was not found on the page.", `retryable: true`;
- it has no `targetOnPage`, `onPage` or `advice`;
- none of the feedback's own words ask the model to find or re-address the control;
- through the real `AutomationStudioFlowCandidateTrialGate`, the first trial answers `retry_allowed`, the second
  identical stop closes the revision (`failedStep`, `retestsLeft: 0`), and a third request is refused
  `candidate.trial_same_failure`.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t422 node scripts/test-domain.mjs plan-resolution client/tests` printed
  `# pass 183`, `# fail 0`. This is the final run, after the scope change and the audit fix.
- `pnpm --filter @fluxiq-web-extension/domain check` exited 0. It first refused on a stale Core build; I rebuilt Core
  with `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (exit 0)
  after each Core source change and the restore.
- `apps/extension: pnpm check` exited 0. A first run failed on `className` being read-only in the spec; I fixed it.
- `apps/extension: EXTENSION_TEST_BUILD_LABEL=t422 node scripts/test-extension.mjs content/identity content/action-runtime`
  printed `# pass 418`, `# fail 0`.
- `apps/extension: node scripts/test-content.mjs -- created-identity --workers=1` printed `1 passed (22.1s)` on the
  final run.
- `packages/fluxiq: pnpm check` exited 0.
- `npx vitest run …/service/candidate-trial …/flow-bootstrap/candidate/tests/trial-gate.test.ts` reported 7 files and
  89 tests passed.
- `node scripts/structure-audit.mjs`, downstream: `structure-audit: passed (184 warning(s), 651 baselined)`. A first
  run failed `[contract-spread]` on two spreads in the new test; I fixed them.
- `node scripts/structure-audit.mjs`, Core: `structure-audit: passed (322 warning(s), 1160 baselined)`.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1` exited 0 with
  `"cases":[{"caseId":"1","verdict":"passed","reasons":[]}]` (run `rmx-2026-10-10T18-50-42-402Z-9ed771`).
- A one-off measurement during development, before the id and class were carried: the label-only identity resolved by
  `scored-candidate`, `bestScore` 1, `runnerUpScore` 0.293, 3 candidates.

## Not verified

- **No paid or live run.** It is not shown that a model-built Flow on the live loop now passes R4a's quantity step.
- **The full suites were not run.**
- **Effect on existing Flows.** Already-saved created nodes keep their old, thin identity. Only steps resolved from now
  on carry the full fingerprint.
- **Veto risk.** A wrong control that keeps the saved id or the saved class tokens now gets more support, as on the
  recorded path. Not measured beyond the spec and the extension's identity tests.

## Open questions or contradictions found

1. **Fingerprint text still reaches the model through Core.** Core trial feedback passes the domain's failure
   `expected` through, which reads "an element matching selector #fb1l6ufkg, element fingerprint, …". That conflicts
   with "fingerprints never appear in … trial feedback". t420's `onPage` text also speaks of "the address it was saved
   with". I did not change either: they live outside this brief, in `feedback.ts` and in the extension's
   `resolve-target.ts`.
2. **Two files edited outside the original ownership.** `target-packets.ts` had to change to compile. The new e2e spec
   is the proof item 2 asked for.
3. **Not reused from the recorder.** The recorder's whole attribute map is not reused; a closed allowlist is used
   instead, because the map also carries state such as `aria-expanded`. If t425 wants the recorded path narrowed the
   same way, the allowlist is `IDENTITY_ATTRIBUTES` in `element-identity.ts`.
4. **Line endings.** Both repositories use `core.autocrlf=true`. The touched files are LF in the working copy, and the
   Core test file's siblings are CRLF. Git normalizes both on commit.
