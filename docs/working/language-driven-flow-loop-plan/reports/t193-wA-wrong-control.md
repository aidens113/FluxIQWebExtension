# t193-wA: a wrong-control refusal names the node that fits

## Outcome

Done. When a choice node (`web.output.dom-select`) or a text-entry node
(`dom-type`, `dom-clear`) is given a handle it cannot act on, the refusal now
names the node that does act on that control, when the control's tag, role or
input type says which one. The node id reaches the model two ways:

- In the resolver's issue codes, as the closed code
  `web.handle.expected.node.web.output.dom-click` (or `...dom-select`). This is
  what Core's plan path shows the model.
- On the run-node path, as `detail.useNode: "web.output.dom-click"`, next to
  `detail.target` (the same handle).

## What changed and why

### 1. What the model receives for this refusal (before the change)

This describes the structure only. There is no page data in it.

**Run-node path.** This is the path the live run used. Core's run-node tool
dispatches to `domain/src/runtime/llm-evidence/node-run/run.ts`
`runWebOutputNode`. A resolver refusal goes through `handleRefusal`
(run.ts:517), which calls `rejectionDetail` (tool-rejection.ts). The tool
execution's `evidence` is a `WebLlmToolRejection`:
`{ schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unobserved", detail: { reason: "handle_wrong_kind_of_control", target: "target.N", instead: ["web.handle.wrong_control", "web.handle.wrong_control:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] }, page?: <sanitized packet, when it fits the budget> }`.

The result code is `web.action.rejected.target_unobserved`, and
`resultReason` is the same reason word. On a repeat,
`repeated-refusal.ts` adds `repeatedAnswer` and rebuilds the detail through
`rejectionDetail`. Nothing in the result said which node fits a button.

**Plan path.** Core's `plan-parameter-resolution.ts` accepts
`{ status: "refused", issueCodes }`. The codes must match
`/^[a-z0-9_.:-]{1,100}$/i`, and there can be at most 16. Core reports each code
as a parameter issue at the node's path. Before the change the codes were
`["web.handle.wrong_control", "web.handle.wrong_control:<slot>"]`.

**Model-facing prose explaining reasons.** There is none in `domain/src`:

- The explanation of each reason is TSDoc on `WEB_LLM_TOOL_REJECTION_REASONS`
  in tool-rejection.ts. It is written for developers and never sent to the
  model.
- The node and tool descriptions (`harness-options/options.ts`,
  `actions/schemas.ts`, `output-nodes/`) do not mention refusal details.
- Core's generic instruction (`AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION`)
  only says to treat `{ok:false,code}` as feedback.

So the words inside `detail` are the only explanation the model gets, which is
why the node had to be put in the detail itself.

### 2. Resolver: `plan-resolution/resolve-plan-node.ts`

- `WEB_PLAN_HANDLE_ISSUE_CODES` gains two closed codes at its end:
  `web.handle.expected.node.web.output.dom-click` and
  `web.handle.expected.node.web.output.dom-select`. They sit in the
  `web.handle.expected.*` family, which holds hints about where a handle is
  accepted, not reasons. So the existing check that every code maps to a
  reason treats them the way it treats shape hints, with no special case.
- The new `fittingNodeCode(identity)` reads only the identity the handle
  already resolved to:
  - `select` names dom-select.
  - Tags `button`, `a` and `summary` name dom-click.
  - Roles `button`, `option`, `menuitem`, `tab`, `radio`, `checkbox` and
    `link` name dom-click.
  - `input` with type `button`, `submit`, `reset`, `image`, `checkbox` or
    `radio` names dom-click.
  - A native `<option>` names nothing, because it is chosen through its
    `<select>`, which has a different handle.
  - Any other tag, or no tag, names nothing.
- A `Refusal` carries an optional `fits` code, and `refusal()` adds it to the
  code set. The Run Output (`builtin.policy.action`) path carries `fits` from
  its inner refusals as well.
- The resulting codes are `[wrong_control, expected.node.<id>, wrong_control:<slot>]`.

### 3. The detail the model reads: `tool-rejection.ts`

- New closed field `WebLlmToolRejectionDetail.useNode?: string`. It holds a
  node id taken from the resolver's closed codes through a two-entry
  module-private table, `HANDLE_FITTING_NODES`. It is never page text.
- `rejectionDetail` sets `useNode` only when the sharpened reason is
  `handle_wrong_kind_of_control` and `instead` carries one of the table's
  codes. Because this is the same place and the same input that sharpens the
  reason:
  - `run.ts` `handleRefusal` needed no edit.
  - A repeat through `repeated-refusal.ts` names the node again.
- The TSDoc for `handle_wrong_kind_of_control` now says that the handle is not
  the mistake, the node is, and that `useNode` names the node to call with the
  same handle (`target`). The file header now lists node ids among the closed
  vocabulary.

**Why a new field and not `instead`.** On this refusal, `instead` already
holds the resolver's codes and the handle shapes. A node id among them would
be one entry the model has to pick out, and moving the codes out would break
the reason sharpening, which reads them from `instead`. The brief allowed one
closed field in that case. **This departs from the wording of brief step 3**
("`instead` names the node that can"): `useNode` names it.

**The file that turns a plan refusal into the tool rejection** is
`domain/src/runtime/llm-evidence/node-run/run.ts` (`handleRefusal`). It is
unchanged.

### 4. Tests

- `plan-resolution/tests/resolve-plan-node.test.ts`:
  - The pinned code list now includes the two new codes.
  - The existing wrong-control test now expects the dom-click code.
  - New test "a refusal for the wrong control names the node that acts on it,
    and only when the control's kind says which". It covers:
    - dom-select on a `<button>` names dom-click, and dom-click then resolves
      with the same handle;
    - dom-select on a `<select>` still resolves;
    - dom-type on a `<button>` names dom-click, and on a `<select>` names
      dom-select;
    - `li[role=option]` and `input[type=checkbox]` name dom-click;
    - a native `<option>` and an unknown tag (`x-store-card`) name nothing;
    - Run Output gives `wrong_control:parameters.target`.
- `tests/tool-rejection-detail.test.ts`:
  - New end-to-end test through the run-node tool. dom-select on the button
    gives `{ reason: "handle_wrong_kind_of_control", target: "target.1", useNode: "web.output.dom-click", instead: [...] }` with no page text. dom-type
    on the button gives the same `useNode`. The unknown tag gives no `useNode`.
    dom-click on the same handle is then dispatched: exactly one click, on the
    button's selector.
  - New table test. Every published `web.handle.expected.node.*` code maps to
    its node. There is no `useNode` beside any other reason, and none from a
    look-alike string. A rebuilt detail stays identical.

## Commands run and observed results

1. Focused run of three test files (resolve-plan-node,
   tool-rejection-detail, plan-node-identity). They were bundled by a scratch
   script with the same esbuild options as `domain/scripts/test-domain.mjs`,
   output to `domain/.test-build-scratch/t193-wa-focused`, then run with
   `node --test`. Result: `tests 29, pass 29, fail 0`. The four wrong-control
   tests are listed as passing.
2. The same focused run with both source files restored to `HEAD` using
   `git show HEAD:<path> > <path>`, then my versions copied back. Result:
   `pass 24, fail 5`. The failing tests were:
   - "a misplaced or malformed handle refuses the whole node, by name" (the
     pinned code list);
   - "a handle naming a control this step cannot act on ...";
   - "a refusal for the wrong control names the node ...";
   - "a node given a control it cannot act on is told which node can ...";
   - "a node is named only beside the wrong-control reason ...".

   `git diff --stat` afterwards showed both files carrying my changes again.
3. Type checks:
   `bash .../heavy.sh "t193-wA domain tsc" bash -c 'npx tsc -p tsconfig.json --noEmit; npx tsc -p tsconfig.test.json --noEmit'`
   printed `src tsc exit 0` and `test tsc exit 0`.
4. Whole domain suite:
   `DOMAIN_TEST_BUILD_LABEL=t193-wa bash .../heavy.sh "t193-wA domain suite" node scripts/test-domain.mjs`
   exited 0 with `# tests 908 # pass 908 # fail 0 # cancelled 0`. There were
   0 `not ok` lines, and the new tests appear in the log.
5. Structure audit:
   `bash .../heavy.sh "t193-wA structure audit" node scripts/structure-audit.mjs`
   printed `structure-audit: passed (124 warning(s), 120 baselined).`, exit 0.
   My three files show only the advisory `file-lines` warning. All three were
   already over 400 lines at HEAD: 492, 559 and 404 lines.

## Not verified

- No Lab or browser run was made (the brief did not allow one). So it is not
  verified that deepseek-flash acts on `useNode` on bigbox-retail, or that
  act 1 now happens.
- Core's plan path was not exercised end to end against Core. The codes were
  checked by hand against Core's `ISSUE_CODE` pattern and its 16-code cap.
  The longest new code is 46 characters.
- `pnpm check` and `pnpm build` at the repository root were not run. The
  domain `tsc` for source and tests and the structure audit were run instead.

## Open questions or contradictions found

- **Brief step 3 wording.** It says "`instead` names the node". I used a
  dedicated closed field, `useNode`, for the reason given in section 3. The
  supervisor should confirm this, or ask for the id to be put first in
  `instead` as well.
- **No prose reaches the model.** There is no model-facing text in `domain/src`
  that explains reasons. If the supervisor wants prose, the candidates are
  outside what I own:
  - the `web.dom.select` node description in `domain/src/actions/schemas.ts`,
    for example "a custom chooser's buttons are pressed with
    web.output.dom-click";
  - Core's run-node tool description, where one line could say
    "`detail.useNode`: call that node with the same `target`".
- **Other lanes' edits in this checkout.** The worktree already holds
  uncommitted edits from other lanes: `apps/extension/...`,
  `packages/test-runner/...`, and `domain/src/runtime/llm-evidence/node-run/replay.ts`.
  I did not touch them. The domain suite and `tsc` ran against the tree with
  those edits in it.
- **Scratch output.** Scratch build output was left in
  `domain/.test-build-scratch/t193-wa-focused` and
  `domain/.test-build-scratch/t193-wa`. Both are ignored.
