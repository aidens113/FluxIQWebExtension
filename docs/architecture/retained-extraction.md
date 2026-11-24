# Retained Extraction Data

A read of a detected list retains every safe discovered field. Naming `fields`
or `columns` selects the requested view and aliases; it does not discard other
readings. If an alias reads another attribute, the original detected reading is
also retained under a stable noncolliding key. Duplicate readings written by the
model still require the existing explicit `sameAs` relation.

An authored `dedupe: true` keeps the original requested-column key, so retaining
hidden evidence does not widen the rows an existing action iteration selects.
With no authored column selection it still uses every readable field. Explicit
`dedupe.by` is unchanged. Conditions may reference a retained hidden field instead
of repeating its inline read; both test the same original value before row dedupe.
This explicit read selection is separate from final-answer identity processing.

Structure packets retain field semantics, marks and validated identity in the
handle's structural `recordSchema`. The binding contains no parsed sample or
captured row. Saved extraction bindings carry that schema with the item, field
specifications, frame ID/path and one-record declaration, so reopening does not
depend on the old handle store. Alias resolution rebases field IDs and identity
references together. A shared link is never promoted to identity when detection
validated none.

**A stored label carries no page value (t997).** The model is shown a readable
label: where the page's own label is a generated class path, what the element is
and its first item's value (`link: '<a title>'`, `structure/field-sample.ts`).
That label stays in the packet. The stored `recordSchema` label is the page's own
column words where the detection has non-generated ones (a header, a test id, an
attribute's name, a badge's name), screened; otherwise it is the field key
(`structure/stored-label.ts`). A column the model renames that reads the same
detected column keeps that column's stored label under the model's id: `plus` for
a detected `brightaisle_plus` is stored with id `plus` and label `brightaisle_plus`,
or the page's words for that column when it has them. Core binds a declaration's
name to an exact id first and then to the one field whose label folds to it
(case and whitespace ignored), so a declaration may name the model's key or the
site's label, with no Core change. A field whose reading differs from every
detected column (an alias reading another attribute) is labelled by its id.
Labels are made unique by `structure/stored-labels.ts`: a label that folds to a
label already given, or to another field's id, becomes `<label> (<id> <n>)`, so
a name always binds one field and no value is added to tell two apart. A saved
read from before t997 may still hold a sample-built label; its reader
(`plan-resolution/extraction/saved-list.ts`) replaces each one with the field's
key. Datasets Core already stored keep the labels they were created with.

Saved bindings without the new schema metadata retain the legacy handle fallback
when unreadable. An explicitly present invalid or null schema refuses at the
binding; it cannot fall through to another in-memory binding with the same name.

The complete safe schema reaches `recordOutput`; requested columns use
`process.columns`. Additional fields are optional, so a missing badge or helper
does not invalidate an otherwise valid row. Explicit handling exclusions remain
authoritative: the page does not read those values, validation removes them,
and stored schemas omit them. Sensitive-field screening remains before handle
retention. No raw page capture is added to storage.

A browser client that does not declare the semantic-definition capability still
gets ordinary reads (`definition-fields/admission.ts`, t991). A definition column
that the read only retains is left out of what that client is sent, and the
stored schema keeps it as an absent optional column. "Only retains" means:
- `process.columns` names an answer view that leaves it out;
- it is not `required`;
- no condition, sort, dedupe key or identity names it;
- nothing dedupes by the whole row.

Any read that does depend on a definition column is refused whole, as before.
A client that declares the capability gets the read unchanged.

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

Model guidance treats requested columns as the answer view, while safe condition,
identity, mark and date fields remain available for processing. When a task has
declared automatic processing, reads collect candidate rows and Core applies
the declaration. A missing declaration can be supplied through the offered
processing tool; an evidence-based correction is distinct from calling it after
every read. Rows used for lasting actions are narrowed before those actions.

The web paging instructions distinguish learning a loop from completing a task.
One read and one next-page action establish the loop; a live task runs that loop
forward during the same attempt to collect all required pages. Only a build-only
request may leave the remaining execution for later.
