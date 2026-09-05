# Test evidence

Private evidence primitives for the FluxIQ web testing facility. The package
has no browser or media-composition dependency. Runner and browser adapters
provide screenshot, trace, and video bytes. Its only runtime package dependency
is the repository-local `@fluxiq-web-extension/test-contracts`, which is the
authority for durable evidence event and policy schemas.

## Contract boundary

- `EvidenceEvent` and `EvidencePolicy` are re-exported aliases of the canonical
  test-contract types. `events.ndjson` contains only validated canonical
  `EvidenceEvent` records, and `evidence-policy.json` contains a validated,
  fully populated canonical `EvidencePolicy`.
- Browser-specific capture context enters through `CaptureEvidenceEventInput`,
  `CaptureCorrelation`, and `CapturePolicy`. `toContractEvidenceEvent` and
  `toContractEvidencePolicy` are the explicit publication adapters.
- Browser correlation fields without canonical top-level equivalents are
  retained under `details.capture`; canonical `scenarioStepId` and
  `correlationId` remain top-level. Screenshot hashes use `imageSha256` or
  `duplicateOfSha256`.
- `CapturedEvidenceEvent` is the in-process result containing capture details
  plus its canonical `published` record. The former `Correlation` and
  `EvidenceEventInput` input names remain as deprecated aliases.
- Contract validation is fail-closed before an event append and immediately
  before final policy publication. Capture-only controls such as
  `minimumScreenshotIntervalMs` are intentionally absent from durable policy.

## Safety and publication contract

- `EvidenceBundle` writes into `.staging-<run-id>` and publishes the completed
  `<run-id>` directory with one rename.
- Structured and textual data is redacted before its first durable write.
- Screenshots and other binary artifacts must carry an explicit redaction
  attestation. Unverified values fail closed.
- `artifact-index.json` hashes every payload artifact. `bundle.complete.json`
  hashes the index itself and is the publication marker. These two integrity
  metadata files are intentionally not self-indexed because a file cannot
  contain its own stable digest.
- `events.ndjson` is the canonical source timeline. Correlation fields join
  scenario steps, gateway messages, recording entries, command attempts, and
  images without expanding the public contract.

`EvidenceCaptureController` implements trigger selection, rate limiting, byte
and frame quotas, and SHA-256 frame deduplication. It preserves an event when a
frame is suppressed or deduplicated.

The generated `review/contact-sheet.html` and `review/timeline.json` are the
current dependency-free review representation. A future image-composition
adapter may derive `contact-sheet.webp`; it should not be added as a hard
dependency of this package.
