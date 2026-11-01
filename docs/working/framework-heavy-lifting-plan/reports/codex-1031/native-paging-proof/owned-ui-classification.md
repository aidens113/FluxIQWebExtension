# Owned UI mutation classification — t840

Outcome: Done. Source is frozen for lead validation and the next installed provider-free replay.

The lead measured the existing refusal suffix `look_outside_change` in the retained native action result, after reproducing the saved graph's failure twice. This follow-up classifies that refusal against the lead-owned private registry. It does not suppress any mutation, change a settled-look verdict, or claim that the actual native mutation has already been attributed.

Changed:

- `apps/extension/src/content/action-runtime/ignored-press/settled-look.ts`
- `apps/extension/src/content/action-runtime/ignored-press/tests/settled-look.test.ts`
- `apps/extension/src/content/owned-ui/tests/hosts.test.ts`

The optional closed rejection union adds `outside_owned_ui`. The outside observer reports it only when every offending outside record is either a style attribute mutation on an exact registered currently empty closed host, or a nonempty child-list addition/removal consisting entirely of such hosts. Child-list records always inspect every moved node; an owned target alone is insufficient. Ordinary page changes remain `outside_change`.

A genuine page mutation permanently upgrades an earlier own-only classification to `outside_change`. A later request/navigation/focus signal or newly reachable open shadow replaces an earlier `outside_owned_ui` diagnostic with its existing stronger reason. Other first reasons keep their previous priority.

Every classified outside record still sets answered=true, so settled-look returns false exactly as before. No state markup is stripped. The existing loader-settlement union derives its look codes from this optional method, so the unchanged suffix path can expose `look_outside_owned_ui` without any additional source or wire field.

Private identity is distinct from page-visible markers. Direct registry tests verify exact registered identity, copied markup and markers refusing ownership, open/wrong roots refusing registration, and any current light DOM (including whitespace/text/descendants) refusing ownership. Classifier tests cover registered style/arrival/removal, unregistered/copied nodes, custom attributes, host light DOM, mixed records, a child added then removed before flush, later genuine page edits, and later non-change/new-shadow signals.

This is identity classification only; it does not authenticate who wrote a style on that host. No raw tag/attribute/page/selector/callback/URL/token values are added to the new diagnostic. The classifier uses the private owned-ui barrel, not the marker-based picker-host helper.

Stable interfaces and other ownership: lead-owned `owned-ui/{hosts,index}.ts` were read and tested but not edited. StatusPill registration/fake-DOM/UI tests belong to the separate UI worker. No loader producer, Domain/Core, manifest, network guard, fixture/task/oracle, model guidance, Lab state or git path was changed.

Validation:
```powershell
$env:EXTENSION_TEST_BUILD_LABEL = 't840-owned-ui-classification'
pnpm.cmd --filter @fluxiq-web-extension/extension exec node scripts/test-extension.mjs content/owned-ui/tests/hosts.test content/action-runtime/ignored-press/tests/settled-look.test content/action-runtime/ignored-press/tests/settled-look-notice.test content/extraction/page-advance/loader-progress/tests/settlement.test
```

Initial classifier run: exit 0, 42/42 pass, no failed/cancelled/skipped, duration_ms 9522.0021. Lead read-review then requested the stronger-signal ordering correction described above.

Final run after that correction: exit 0, 43/43 pass, no failed/cancelled/skipped, duration_ms 9470.1824. Source remained frozen afterward. Existing status-notice, genuine private single-use proof, copied-proof refusal, pending/delayed progress, unknown/request guards and one-physical-press fallback cases all remained in the selected run.

Not verified: lead-owned typecheck/structure audit/build, actual installed outside-owned versus page mutation attribution, and successful saved provider-free replay. No browser/provider/full-suite execution, safety waiver, new retry, second press, shared-document or registry-production edit was performed.
