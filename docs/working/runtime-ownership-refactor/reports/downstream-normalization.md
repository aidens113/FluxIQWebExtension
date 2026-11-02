# Web recording parameter normalization

Outcome: Source implementation and standalone acceptance complete; guarded package integration remains pending the normal matching Core rebuild.

The actual web interpretation closure now lives in `domain/src/target-normalization/normalize.ts`, with the mapper parameter adapter in `recording-parameters.ts`. `createWebAutomationOutputNodeImplementationBundle` registers the original adapter as `recordingCandidateParameterNormalizer`. Core binds that executable implementation by the actual manifest domain; manifest metadata is not executable authority.

The adapter preserves element/target precedence, typed action arguments, field aliases, candidate and selected-candidate identity, drawing tokens, bounds and sensitive target-metadata withholding. Its Core imports are type-only legacy wire DTOs; it does not call Core's old browser normalizer. The remaining Core legacy normalizer callers still require R8 migration before the overall boundary audit is complete.

Validation:

- A standalone source browser build traversed exactly three domain modules and zero Core runtime implementation modules.
- Four literal source-local Node unit cases passed: original parameter precedence, sensitive metadata, missing-identity shallow copy and persisted candidate/selection/drawing identity.
- A source-local comparison against actual unchanged Core functions from committed checkpoint `6a871e62` passed 650 exact JSON-byte comparisons with zero differences. The first probe referenced a current helper already moved by the concurrent mapper extraction; the comparison was corrected to the pinned committed source.

These source-local probes do not bypass or stand in for repository checks. Core's normal public package build, the downstream currency guard, domain build/check and named recording/proposal/host integration tests remain required. No provider, panel, browser profile or user data was used.
