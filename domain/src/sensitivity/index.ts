// The one sensitivity rule, and the one adapter over it.
//
// `signature.ts` decides, from three attributes, whether a control holds a
// secret. `descriptor.ts` reads those three attributes off a serialized
// element descriptor. Nothing else belongs here: a caller holding a live DOM
// element adapts it where it lives (the extension's
// `content/element-traits.ts`), because this package must not depend on the
// browser, and a caller that needs a different question -- which controls a
// reusable fingerprint may describe, say -- names its own question and
// composes this one rather than widening it.

export { isSensitiveElementDescriptor, sensitiveFieldSignatureOfDescriptor } from "./descriptor";
export { isSensitiveFieldSignature, type SensitiveFieldSignature } from "./signature";
