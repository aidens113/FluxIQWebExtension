# t194-w45: a field whose kind does not take a member drops it rather than being refused

## Outcome

Done for the files I own. Three existing tests in files I do not own still encode the old refusal, and they now fail.
They need the supervisor to update them (see Open questions). No code outside my files depends on the old behaviour.

## What changed and why

Field-spec helper named first: `fieldValue` in `domain/src/actions/extraction/read-request.ts`, a private function. It is
the only domain site that refused a stray `attribute` or `header` on a field spec. Grep for
`.(header|attribute) !== undefined` across `domain/src` and `apps/extension/src` found no other refusing site. It serves
every form of a field spec:

- the field map (`fieldMapValue`);
- the condition `read` form (`readableCondition`);
- every public entry point: `...RequestValue`, `...RequestRead` and `...RequestWhole`.

The change:

- `domain/src/actions/extraction/read-request.ts`, in `fieldValue`:
  - The two checks `kind === X ? member === undefined : spec.member !== undefined` became `kind === X && member === undefined`.
  - The member is still read only for its own kind (`attribute` for `attribute`, `header` for `column`), so a stray
    member is never copied.
  - An `attribute` field with no usable `attribute` is still refused, and so is a `column` field with no usable `header`.
  - The doc comment now states the rule and the rerun case (w42 cause 6a) that forced it.
- `domain/src/actions/extraction/tests/read-request.test.ts` has 3 new tests:
  1. Six stray-member shapes in the field map. Each one reads by its kind with the member absent, `dropped` is `[]`, and
     `Whole` equals `Read`. The shapes include the rerun's `{kind:"text", header:"Price", required:false}` and a stray
     member whose value is not a string.
  2. A condition `read` with a stray `header`. The condition is kept and its `read` comes back without the `header`.
  3. A guard: an `attribute` field that carries only a `header`, and a `column` field that carries only an `attribute`,
     are still refused. In the field map the whole request is refused; as a condition `read`, `where.0` is dropped.

How the dropped member shows:

- The parsed request leaves the member out, and is otherwise copied field by field exactly as before.
- Nothing is added to `dropped`. A stray member is not a part the read does without, because the field reads the same
  either way. So `Whole` accepts it too.
- The gateway lift (`client/gateway-action-parameters.ts`, through `webAutomationExtractListRequestValue`) builds the
  command sent to the page from this parse, so the command carries no stray member.
- The detector's proposal (`extraction/structure-detection.ts`) copies its specs from the parsed request, so the member
  is absent there too.
- The stored step does not go through this parse. Plan resolution `slot.ts` checks the request with this reader but
  returns the request as written. `output-nodes/extract-list/dispatch.ts` passes `rest` unchanged when there are no
  declared columns. So a stored node's parameters can still hold the member as written until the gateway lifts them.
  This is by reading the code only; I ran no stored-step check.

Extension reader (`apps/extension/src/content/extraction/field-spec.ts`, `normalizeSpec`): no change was needed. It
already reads strictly by kind:

- `text`, `link` and `value` never look at `attribute` or `header`;
- `attribute` ignores `header`;
- `column` ignores `selector` and `attribute`.

Since the domain's parse now strips the member, the page will not see one after the domain parse. If one arrives some
other way, the page already applies the same rule. I left the file untouched.

## Commands run and observed results

All commands ran from the `t194` tree root.

- `heavy.sh "t194-w45 domain tsc" npx tsc -p domain/tsconfig.json --noEmit` gave `exit=0`.
- `heavy.sh "t194-w45 domain tsc test" npx tsc -p domain/tsconfig.test.json --noEmit` gave `exit=0`.
- Narrow tests on `actions/extraction` with my source: `narrow: 11 test files`, `# pass 78`, `# fail 0`.
- Old-source check:
  - I copied HEAD's `read-request.ts` in, ran the same narrow run, then restored my version. `git diff --stat` showed
    `19 insertions(+), 5 deletions(-)` after the restore.
  - The run printed `# pass 76`, `# fail 2`.
  - The 2 failures were the two new behaviour tests. The guard test passes on both versions, which is what a guard
    should do.
- Narrow tests on `actions/extraction client output-nodes/extract-list`: `# pass 78`, `# fail 0`, but the run was not
  clean.
  - `client/tests/gateway-command-parameters.test.ts` is a top-level script, not a set of `test()` calls. It threw
    `AssertionError: web.dom.extract_list was dispatched: an attribute on a kind that reads none` (exit 1).
  - That throw ended the run before `output-nodes/extract-list` ran, so I ran it alone: `# pass 38`, `# fail 1`.
    - The failure is `issues.test.ts:66`, `{kind:"text", header:"Name"}`. It expected `web.extract_list.invalid_field`
      and got `[]`.
  - I checked the client script with a scratch copy (`scratchpad/t194-w45-client.mjs`) that removes only its two
    old-rule rows (`:178` and `:179`). It printed `Web automation gateway command parameter tests passed.`, exit 0. No
    other assertion in that script depends on the old rule.
- Wider narrow run on `runtime/llm-evidence/plan-resolution runtime/llm-evidence/node-run extraction io`:
  `narrow: 42 test files`, `# pass 240`, `# fail 1`.
  - The failure is `extraction/tests/structure-detection.test.ts:77`, the row "an attribute on a text field". The
    detection is now accepted, and the proposal's spec has no `attribute`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (154 warning(s), 118 baselined).`

## Not verified

- The full `pnpm test`, the extension test suites, and any Lab or live run.
- Core's side of the rerun. I did not run the end-to-end rerun from w42 cause 6a with Core's merge.
- The stored-step claim above. It comes from reading `slot.ts` and `dispatch.ts`, not from a test.

## Open questions or contradictions found

1. Three existing tests outside my files encode the old refusal and must be updated to the new rule. Each should become
   "reads, member absent".
   - `domain/src/client/tests/gateway-command-parameters.test.ts:178-179`: the rows "an attribute on a kind that reads
     none" and "a header on a kind that reads none". They are in the `malformedSpecs` refused-whole list. Remove them,
     or turn them into lifted-without-member assertions.
   - `domain/src/output-nodes/extract-list/tests/issues.test.ts:66`: `{kind:"text", header:"Name"}` now raises no issue.
     That is the intended author-side effect: the plan is no longer refused over the stray member. This file is under
     `output-nodes/**`, which my brief forbade.
   - `domain/src/extraction/tests/structure-detection.test.ts:77`: the row "an attribute on a text field". A detector's
     stray attribute is now dropped rather than refusing the detection.
     - This one is a judgement call. The `Whole` reading is meant for producers. I treated a stray member as not a
       misstatement, because the field reads the same either way. If the supervisor wants producers held strictly, the
       alternative is:
       - `fieldValue` reports the stray member, and `Read` names it in `dropped`, for example as `fields.<key>`;
       - `Whole` then refuses it.
     - But `issues.ts` uses `Whole` too (`readable()`, `:159`). So that alternative would bring back the author-side
       `invalid_field` refusal this brief removes.
2. `webAutomationExtractReadValue`, the single-value `web.dom.extract` read mode at `read-request.ts:292`, still refuses
   an `attribute` on a non-`attribute` mode. It is not a field spec, `recorded-definition.test.ts:119` encodes that
   refusal, and the brief covered field specs, so I left it alone. Say if the same rule should apply there.
