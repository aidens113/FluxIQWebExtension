# Report: l-final-recheck-w10-intent

Worker report, 2026-09-13. Bounded identifiers, counts, categories, and timings
only; no raw logs, page data, screenshots, or secret values.

## Setup

- Downstream worktree `F:\fxlab\fxlab-16ff729-b`: detached and clean at
  `db3cc17979cba5cfdfdca60815fd1694c61c6a47`.
- Shared Core worktree `F:\fxlab\!FluxIQ`: clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`, used read-only.
- Downstream `domain`, `test-contracts`, and `scenario-lab` builds exited 0.
- New run root: `F:\fxlab-runs\final\recheck-w10-intent`.
- Initial free physical memory: 11.49 GB. No auth secret is used.

## Current status

The six-run acknowledged-intent acceptance completed under isolated instance
`l-final-recheck-w10-intent`.

## Outcome: candidate rejected at arming

Acceptance count is 0/6. Every command failed before recording or Flow creation
because the extension refused to arm scripted navigation. Consequently none
could retain the required two extension/Core actions or two proposal candidates,
and no start index, harness count, oracle verdict, or reported verdict exists.

| Run | runId | Exit / test | Command seconds | Bundle seconds | Failure category | Leak findings | Minimum free GB |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| primary 1 | `run-mu0f8th2-fc544f4d` | 1 / failed | 46.5 | 25.9 | `extension.worker` | 0 | 9.89 |
| primary 2 | `run-mu0f9tdo-df384df5` | 1 / failed | 49.2 | 28.6 | `extension.worker` | 0 | 8.91 |
| primary 3 | `run-mu0fav38-6e8e8638` | 1 / failed | 47.0 | 26.7 | `extension.worker` | 0 | 9.78 |
| `broken-link` 1 | `run-mu0fbvjr-c80f4235` | 1 / failed | 50.3 | 29.7 | `extension.worker` | 0 | 9.03 |
| `broken-link` 2 | `run-mu0fcxzc-98e7ea42` | 1 / failed | 46.1 | 26.0 | `extension.worker` | 0 | 9.87 |
| `broken-link` 3 | `run-mu0fdxt4-23fd07bd` | 1 / failed | 44.9 | 24.5 | `extension.worker` | 0 | 9.88 |

The fixed error summary is `The extension refused to arm scripted navigation`
in all six bundles. The bundle's error detail exposes only
`failureCategory=extension.worker` and the sanitized capture locator; it does
not expose a `reasonCode`. A structured-key scan of every JSON/NDJSON artifact
and a token-only scan of the generated command logs found no reason-code field
or safe enum to report. No reason value is inferred.

Each later run used the normal completed-run cleanup followed by a fresh arm.
The next arm did not change the result: the same category and fixed summary
occurred 6/6, including across the primary-to-variant boundary. There was no
successful arm whose cancellation state could be measured.

## Acceptance accounting

- Two retained extension/Core actions: 0/6 (recording never began).
- Two proposal candidates: 0/6 (no proposal/Flow snapshot exists).
- Primary click then navigation with all verdicts passed: 0/3.
- Variant start at zero, expected `navigation_unexpected` first-click failure,
  and test pass: 0/3; execution never reached the click.
- Harness activations zero: unavailable rather than asserted; no Flow existed.
- Leak findings zero: 6/6.
- Persistence failures zero and recording discards zero: 6/6.

## Memory and cleanup

- Campaign minimum free physical memory: 8.91 GB, well above the 3 GB pause
  threshold. No memory wait was required.
- All six completed bundles are preserved under the owned run root.
- Owned runtime processes 0 and owned listening sockets 0 after completion.
- Downstream and shared Core worktrees are clean at the exact pins above;
  generated tracked files required no restoration.

## Not verified

- The extension's refusal `reasonCode`: it is not present in the accepted
  bundle contract or generated log token stream.
- Any post-arm behavior, candidate shape, action sequence, Flow verdict, or
  harness count: arming failed before those observations existed.
- Chromium e2e build only; Firefox was not run.
