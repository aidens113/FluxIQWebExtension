# A7 authoring guidance gap

Status: Complete read-only diagnosis; supervisor review pending. Existing precise guidance delivered; no reproduced missing-guidance or decomposition/presentation implementation defect.
Owner: resume-ab
Run: run-mutcb2ic-b3682a77. Own report only; source/tests/runtime untouched.

## Conclusion

A7 did not lack parent-versus-child act guidance or current-candidate-versus-original proof guidance. Those instructions were present in the actual requests. The model nevertheless claimed the lasting parent cart act on a shipping setting, then retargeted an allegedly performed lasting step; the host correctly treated the replacement as an unperformed checked candidate and judges rejected the unmet cart outcome.

The advertised checklist had NO shipping-origin child ID. It offered a1.quantity, a1.colour and a1.version only, while the parent quote still retained the Spain requirement. Teaching the model to use a nonexistent a1.origin would be wrong. This is the reader's deliberately conservative supported-choice scope, not a demonstrated dropped requirement.

A small generic authoring clarification could cover necessary preparation with no advertised child: add that preparatory step with add:true and omit act; never claim the lasting parent for it or invent a child ID. This fallback example is not explicitly stated in the inspected policy. It is a bounded teachable gap, not proof its absence caused A7, not an execution/permission repair, and not evidence the next paid retry will succeed.

## Actual guidance inclusion

Private inclusion probes inspected request0003 and the relevant0053/0056/0058/0067/0119 requests. Only source-text inclusion booleans, public IDs/keys and candidate flags were output; raw prompts/page/control values remain ignored.

| Guidance | Source producer | Actual delivery |
| --- | --- | --- |
| Parent act versus child choice, with a2 versus a2.quantity example | llm/evidence-loop-decision.ts act schema description | Exact description present in captured outputSchema0003/0053/0067; no schema-description omission |
| Name an act only on a step whose does is that act | flow-draft/entry.ts authored instruction | Present in0053/0056/0058/0067/0119 |
| Current checked configuration not performed; act claims intentions | flow-draft/entry.ts conditional checkedCandidate instruction | Present in all five relevant requests |
| priorExecution proves original configuration, not current candidate | Same entry producer | Present in all five |
| VERIFIED/PRESENT establishes a check, never performance of candidate effect | Same conditional instruction | Confirmed source instruction; current checked flags/prior original are separately visible in relevant actual requests |
| Add only necessary steps; add:true includes a step; no look/failed/detour/duplicate additions | Same authored instruction and decision schema | Actual authored draft instruction and schema delivered |
| Complete must meet actual task, checklist is model reading rather than acceptance bar | Same authored instruction plus evidence policy | Present; judges did not accept A7 |
| Required preparation with no advertised child: omit act rather than claim parent/invent ID | No explicit fallback/example in inspected instructions | Potential additive clarification only |

llm/stages/instructions.ts references the provider-neutral evidence policy for staged tool requests. The actual DeepSeek system-prompt producer includes the same policy for unstaged evidence decisions and avoids duplicating it for staged requests. Inspected A7 contexts have no stage; their decision schema carries the explicit act description. No provider-specific omission has been demonstrated.

## Shipping-origin decomposition

Three exact additional source owners settle the observed IDs:

- flow-bootstrap/instructed-acts/instruction-choices.ts documents a one-sided conservative reader: missing a choice retains prior behavior, inventing one falsely refuses tasks/sites. It recognizes quantity and named variant forms for sizes/colours/counts/packs/flavours/versions/etc. Shipping/origin is not one of those named variants or a separate reader form.
- contracts.ts declares choice kind quantity|variant. The act retains its whole quoted requirement and may attach supported choices under requires. A general location/shipping-origin decomposition contract is not declared.
- checklist.ts maps act.requires directly into child checklist entries; it does not filter away an origin child.

Captured A7 requests0003/0053/0067/0119 advertise exactly a1.quantity/a1.colour/a1.version. Public authored origin text remains in the parent quote in every inspected packet. No missing shipping-origin child can be blamed on checklist presentation, and no explicit requirement is lost from the whole task/parent wording.

Core's claim helper moves an exact act claim to the newly named step and removes its old claim; it does not semantically reinterpret a shipping setting as cart. That is intentional generic ownership. Existing does guidance supplies the distinction, and the model ignored it. A nonexistent child ID must not be manufactured by a prompt, inferred from DOM words or auto-remapped.

## Bounded optional clarification and regression proposal

If root chooses an authoring-quality refinement, smallest prospective source/test partition is Core runtime/flow-draft/entry.ts and its existing tests/entry.test.ts. A short generic example belongs beside the existing authored act/does explanation:

“When a necessary preparatory setting has a listed child choice ID, claim that exact child on its own setting step. If it has no listed child ID, add the necessary setting step with add:true and omit act; do not invent an ID or claim the parent act. Claim the parent only on the step that actually performs that act.”

This explains the existing optional act/add semantics. It does not add inferred instruction parsing, new authority, country keywords, a browser rule, permission, execution, optionality or a gate exception. Existing candidate/original warning should remain unchanged.

Meaningful contract fixture should build the ACTUAL authored draft entry with a parent lasting act, one advertised child setting and a separately quoted prerequisite with no child ID; include a checked replacement plus priorExecution. Assert the delivered entry preserves whole task quote/real child IDs, explicitly teaches both listed-child and unlisted-preparation cases, and still marks current checked effect unperformed/intended and original proof separate. Pair with existing schema/claim fixtures proving omit-act/add:true is legal, claims remain literal, and no nonexistent child is generated. Exact extra test owners require a separate release; they were not read here.

This is a guidance delivery regression, not a behavioral fail-first proving model adherence or cart success. Current permission/lasting/whole-test/judge/oracle controls are expected to remain strict. A scripted model following the clarified text may demonstrate the supported route, but cannot stand in for an actual next Flash outcome. A paid retry requires root justification, prior debug review and new gated checkpoints; unrelated C4/ambiguity changes alone do not justify it.

No production source correction is REQUIRED by this diagnosis. A broad prompt-gap claim, shipping-origin parser expansion, automatically pressing a retargeted cart, parent-to-child remapping, blanket PRESENT selected-state proof, stronger model or cap raise is unsupported.

## Read ledger and verification limits

Initial five exact Core owners: llm/stages/instructions.ts; flow-draft/act-claim.ts; flow-draft/entry.ts; llm/draft-amendment-feedback.ts; actual producer llm/deepseek/system-prompt.ts. Approved sixth: llm/evidence-loop-decision.ts constant/schema description. Approved final three: instructed-acts/instruction-choices.ts, contracts.ts and checklist.ts. Nine source owners total; no broad source expansion. Existing test filenames were discovered only, not read or executed.

Read current coordinator state and completed a7-retargeted-effect-causality report; inspected A7 public Stage1 instruction and private captured packets with screened probes. No tests, builds, types, audit, provider/live/browser/runtime/state/key/shared-doc/git actions or source edits. This report is frozen for supervisor review.
