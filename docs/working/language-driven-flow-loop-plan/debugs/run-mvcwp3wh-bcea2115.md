# Debug: run-mvcwp3wh-bcea2115

- Instance: bf-slot-2, task `auction-marketplace-cheap-accessory-auctions`, authoring mode `project` (breadth round,
  2026-10-17, downstream `fb3919e2` / Core `76d66fe8`, before lane 2's covered-press fix), lane tree `fxwork/t565`.
  Steps: 30. LLM calls: 15, all supervisor.
- Verdict: **failed**, no Flow created (`lab.chat_build_failed`: "the model's answer could not be used"). Billed
  $0.0068 of $0.25.
- How far it got: the supervisor looked at the start page (0003) and the search results' structure (0013). It never
  wrote a plan. No brief was dispatched.
- Cause: **every `project.write_plan` the supervisor sent put the tool's `reason` key beside `input` instead of inside
  it, and Core never said which key was wrong.** That makes 12 plan decisions from 14 calls:
  - 10 were unreadable JSON (`llm.provider_malformed_response`: 6 `content_mismatched`, 4 `content_unclosed`). Every
    one ends `...,"subflows":[...]},"reason":"..."}}` with one closer too many or too few. The model wrote `reason`
    after `subflows`, meaning it as an input key, but closed `input` before it and lost count.
  - 2 were readable (0011, 0017) and were refused `llm_output.unexpected_field` with no path. `reason` sat at
    `response.decision.reason`. Core's parser refines that path for one known key only, `write`
    (`harness/provider-result.ts` `rejectUnexpectedFields`, `unusable-decision.ts` `WRITE_FIELD_ISSUE`). For any
    other key, the model is told only "unexpected field" plus the accepted shape. It made the same placement again.
  - Six unreadable replies in a row (0019-0029) ended the build (`llm_evidence_loop.unreadable_replies`).
  - The same misplacement cost run-mvbyldi7 three unusable plan replies before its plan was taken. It is a
    recurring cost of the plan tool's large nested input, not this site.
- UI review (chat): each unusable reply posted "Deciding the next step: The AI model's answer didn't make sense, so
  FluxIQ is asking it again", one per reply, which is honest. The ending card shows an internal code to the person:
  "The supervisor stopped before a whole trial passed (llm evidence loop.unreadable replies)". That is a code turned
  into words, not a sentence. The plain "The build failed: the model's answer could not be used" message after it is
  right.
- Fix (lane 2, Core, general): a tool call's key written beside `input` that the tool's own input schema declares,
  and that `input` lacks, is moved into `input` before the call is checked. This is grammar only: the tool's input
  checks, permissions and the explicit `write` correction stay as they are. Any other unexpected key beside `input`
  is refused with its path and where it belongs, never a bare code.
- Next: rerun this task on the changed source.
