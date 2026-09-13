# f-final-navigation-sender-guard

Worker implementation report, 2026-09-13.

## Outcome

Stage 4j is implemented in the owned extension partition. The scripted-navigation
control boundary no longer rejects a trusted extension control document merely
because Chromium reports a `sender.tab`. It still requires both this extension's
exact runtime id and exact equality with its side-panel or popup URL.

The focused regression now represents the live runner shape: this extension's
exact side-panel URL plus a tab reaches `armScriptedNavigation` and returns the
manager's exact success response. The former mislabeled content-sender row now
uses this extension's id, an HTTP page URL, and a tab; it remains forbidden and
does not reach the manager. Wrong-extension, other-extension-page, missing-URL,
unauthorized await/cancel, and unrecognized-message coverage remains intact.

## Owned changes

- `apps/extension/src/background/scripted-navigation-control.ts`: removed only
  the blanket `sender.tab !== undefined` condition from `isControlPage`.
- `apps/extension/src/background/tests/scripted-navigation-control.test.ts`:
  added the runner-shaped tab-hosted side-panel acceptance regression and
  corrected the content-sender fixture to an HTTP URL plus tab.
- This report.

No runner, Core, shared working document, generated extension build, or Lab
artifact was edited.

## Validation

- Focused command:
  `pnpm --filter @fluxiq-web-extension/extension exec tsx --test src/background/tests/scripted-navigation-control.test.ts`
  — exit 0, 5 passed, 0 failed.
- Extension check with private label
  `f-final-navigation-sender-guard-check` —
  `pnpm --filter @fluxiq-web-extension/extension check` exited 0.
- After mutation restoration, the same focused command again exited 0 with
  5 passed and 0 failed.
- After restoration, extension check with private label
  `f-final-navigation-sender-guard-restored` exited 0.
- `git diff --check` over the two owned source/test files exited 0; Git emitted
  only line-ending conversion warnings.

## Required mutation and exact restoration

I temporarily restored the removed production prohibition by adding
`sender.tab !== undefined` back to `isControlPage`. The focused command exited
1 exactly as required: the new runner-shaped acceptance test alone failed,
receiving fixed `forbidden` instead of the manager's successful arm response;
the other four tests passed.

The production line was then restored with `apply_patch`. SHA-256 values before
the mutation and after restoration match exactly:

- `scripted-navigation-control.ts`:
  `35BC23EEBE95401A22A02AD0679397C88A5267D17EC2B7FC1CB384824FDC6F1F`.
- `scripted-navigation-control.test.ts`:
  `0EF12BEEEB7002639B0CF42F175F26C879B97BDB7A953386EA4FE7BB1F9F2EDD`.

## Not verified

No full extension test suite, build, live browser, W10 Lab acceptance, runner or
Core check, commit, or push was run. The next live acceptance must confirm W10
primary and `broken-link` 3/3 on a committed pin; this unit-level fix does not
replace that proof.
