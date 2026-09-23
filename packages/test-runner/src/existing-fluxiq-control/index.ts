// What `existing-fluxiq-control.ts` reads a FluxIQ API answer with.
//
// `api-readings.ts` is one value at a time: refuse rather than coerce, and name
// the field. `adaptation-consequences.ts` is the one reading with a rule of its
// own -- what a Flow Bootstrap proposal says its steps would lastingly do, and
// where on the adaptation that actually lives; `adaptation-evidence-loop.ts`
// is the build's own accounting and the bounds it has to satisfy.

export * from "./adaptation-consequences.js";
export * from "./adaptation-evidence-loop.js";
export * from "./api-readings.js";
