# Retained Extraction Data

A read of a detected list retains every safe discovered field. Naming `fields`
or `columns` selects the requested view and aliases; it does not discard other
readings. If an alias reads another attribute, the original detected reading is
also retained under a stable noncolliding key. Duplicate readings written by the
model still require the existing explicit `sameAs` relation.

Structure packets retain field semantics, marks and validated identity in the
handle's structural `recordSchema`. The binding contains no parsed sample or
captured row. Saved extraction bindings carry that schema with the item, field
specifications, frame ID/path and one-record declaration, so reopening does not
depend on the old handle store. Alias resolution rebases field IDs and identity
references together. A shared link is never promoted to identity when detection
validated none.

The complete safe schema reaches `recordOutput`; requested columns use
`process.columns`. Additional fields are optional, so a missing badge or helper
does not invalidate an otherwise valid row. Explicit handling exclusions remain
authoritative: the page does not read those values, validation removes them,
and stored schemas omit them. Sensitive-field screening remains before handle
retention. No raw page capture is added to storage.

Both direct exploration and replay attach the actual validated dispatch schema
to execution metadata. Core stores original values and derives typed comparisons
with its shared parsers. Parsed column samples never replace row values. See
the paired Core retained-record contract, `docs/architecture/retained-records.md`,
for schema unions, overflow failures, batch identity and durable exclusions.

Summary and lone-record detections use `structure/packet.ts`'s `boundList` with
`oneRecord`; element detail reads use `plan-resolution/extraction/element-record.ts`.
Both resolve through the same extraction slot. Child-frame bindings retain
`frameId` and `frameUrlPath`, which the plan resolver writes as browser-frame
parameters. The one-record declaration and complete metadata survive serialized
saved bindings through a fresh handle store.

Acceptance uses provider-free request/dispatch/row-validation tests with
campaign-shaped hidden filter, sort, mark and identity fields. Synthetic
footprint checks report only row/field/byte counts for the retained data and
its requested view. Browser tests remain separate; these unit tests open no
browser and make no provider calls.
