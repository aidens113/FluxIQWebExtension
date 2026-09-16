// The dispatched element target and the element fingerprint it carries.
//
// This is a directory rather than a loose `targets.ts` because it has a
// consumer outside `output-nodes/`: `actions/extraction/read-request.ts` calls
// `elementFingerprint` on the element a recorded extraction names. Reaching
// past a directory's barrel into its files is a `structure-audit` [imports]
// failure, and the two obvious ways out are both closed -- importing the
// `output-nodes` barrel instead closes a real runtime cycle
// (`output-nodes/index` -> `definitions` -> `actions/schemas` ->
// `actions/extraction` -> `read-request`), and `import type` does not apply
// because `elementFingerprint` is called as a value. Giving this module its own
// barrel is what lets an outside consumer import it the ordinary way.
//
// Flattening this back into `output-nodes/targets.ts` reintroduces that
// failure. If this module is ever split by cohesion -- the fingerprint
// normalizer, the output-target builder, and the JSON value readers are three
// separate things sharing one file today -- the pieces belong in here, and this
// barrel keeps every existing importer working while that happens.

export * from "./targets";
