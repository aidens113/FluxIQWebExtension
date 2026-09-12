// Which form fields must never have their value recorded or sent: password
// inputs, one-time codes, card fields, and anything marked `data-sensitive`.
//
// The rule itself is not here any more. It lives in `domain/src/sensitivity/`,
// because that is the only package every caller can reach: the structure audit
// forbids `domain/src` importing `apps/extension/src`, so a rule kept here had
// to be copied to be used by the recording reducer and the LLM evidence
// packet, and the copies drifted -- one of them stopped seeing a real card
// field. This file stays as the extension's name for that rule, so the eight
// call sites that import it do not have to know where it moved, and so that
// there is still exactly one import path on this side of the wire.
//
// The content script reads the signature from the live element
// (`content/element-traits.ts`), the background worker from the wire
// descriptor (`background/connection/runtime-status.ts`); both end here, and
// here ends in the domain package.

export { isSensitiveFieldSignature, type SensitiveFieldSignature } from "@fluxiq-web-extension/domain/client";
