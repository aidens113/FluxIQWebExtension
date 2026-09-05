# FluxIQ testing boundary audit

This private package prevents browser-domain testing infrastructure from being
promoted into FluxIQ Core without evidence. It is an audit gate only: it does
not copy files, edit Core, or perform an extraction.

## Command

From the web-extension repository root, build once and invoke the CLI directly:

```bash
pnpm --dir packages/boundary-audit build
node packages/boundary-audit/dist/cli.js --repository .
```

The default candidate is `packages/test-contracts`; the default second checkout
is the sibling `../!FluxIQ`. Override locations for an isolated checkout with
`--repository`, `--core`, or `--candidate`, and the package identity with
`--package`. Use `--output report.json` to select a report destination.

`--require-eligible` turns the recommendation into a CI gate:

```bash
node packages/boundary-audit/dist/cli.js --repository . --require-eligible
```

Direct invocation preserves exit code `2`. Package-manager script wrappers can
translate any nonzero child status to their generic lifecycle-failure code.

Exit codes are:

- `0`: the audit ran; inspect `recommendation`, which may still be `defer`.
- `2`: `--require-eligible` was requested and the recommendation is `defer`.
- `1`: the audit could not run, such as a missing candidate or unreadable input.

## Input and output

The CLI derives input from repository sources and package manifests. The library
equivalent is a JSON-compatible `BoundaryAuditInput`; for example:

```json
{
  "candidate": {
    "name": "@example.test/private-contracts",
    "path": "packages/private-contracts",
    "sources": [{ "path": "src/index.ts", "content": "export type Run = { id: string }" }]
  },
  "consumers": [
    { "id": "fixture-one", "repository": "synthetic-domain-a", "evidencePaths": ["packages/fixture-one/package.json"] }
  ],
  "requiredConsumers": 2,
  "auditedRepositories": ["synthetic-domain-a", "synthetic-core"]
}
```

A shortened machine report looks like:

```json
{
  "schemaVersion": "0.1",
  "candidate": { "name": "@example.test/private-contracts", "path": "packages/private-contracts" },
  "auditedRepositories": ["synthetic-core", "synthetic-domain-a"],
  "gates": {
    "domainNeutralVocabulary": { "passed": true, "findings": [] },
    "independentConsumers": {
      "passed": false,
      "required": 2,
      "found": 1,
      "consumers": []
    }
  },
  "recommendation": "defer",
  "reasons": ["only 1 independent domain/repository consumer(s) found; 2 required"]
}
```

## Promotion rule

`promote-eligible` requires both gates:

1. Candidate source contains none of the forbidden browser, DOM, URL, selector,
   tab, extension, Playwright, or web-automation vocabulary.
2. At least two independent domain repositories consume the candidate. Multiple
   runner/orchestrator packages in one repository count as one domain consumer.

Any failed gate yields `defer`. Eligibility is evidence for a human design
review, not permission to edit or publish FluxIQ Core. The current facility is
expected to defer because it has one web-domain consumer and browser-specific
fields.
