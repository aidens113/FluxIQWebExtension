# Web-authored Flow script examples

The web evidence runtime supplies `flowScriptExamples` through Core's optional
binding companion. The web runtime's own type requires this metadata and its
factory supplies the versioned `WEB_FLOW_SCRIPT_EXAMPLES` value from
`domain/src/runtime/llm-evidence/script-examples/`.

The four authored line arrays own the worked-example tails for the base format,
acts, loops and state handling. They are independent of the shorter domain
system instructions. Core owns grammar prefixes, validation, rendering, parser
semantics and executable node availability. The web producer does not parse
Core strings or infer examples from the current catalog.

Each nonempty array joins its Core grammar prefix with exactly one newline.
Candidate and subflow descriptions receive all four sections in the existing
order; the completion schema receives the base format. Missing client metadata
means no worked examples, without an inferred web fallback.

Owning parity tests pin the original four full sections' UTF8 byte lengths and
SHA256 digests before extraction. The explicit web composition must preserve
all original headings, blank lines, indentation and prose. Further owning tests
verify the supplied examples against the public Core parser and actual schema
consumers. These checks make no browser or provider calls and do not measure
model performance.

This seam moves worked examples only. Remaining inline medium-specific prose,
facts, intent classification and fingerprint contracts belong to subsequent
paired migrations.
