# t610 aria-groups-in-page-view: worker report

Worktree `fxwork/t610/!FluxIQWebExtension`, branch `task/t610-aria-groups-in-page-view`. Core, `host-runtime.ts`,
`state-diff/**` and `control-spot/**` were not touched. No live run and no provider probe.

## Outcome

Done. A control inside a `role="group"` or `role="radiogroup"` named by `aria-labelledby` or `aria-label` now ends
its view line, its find match and its describe context with `group="<name>"`, in the same format as t605's fieldset
groups. The nearest named group around a control wins, whether it is a fieldset or an ARIA group. An unnamed group
names nothing, and the walk goes on up. A named ARIA group gets one text line of its name, the way a legend does, unless
a line already says that name.

## What changed and why

**Design: the group is read from the packet's tree, on the view side.** The capture lists every rendered element, so an
ARIA group `div` is in the packet with its accessible name. The extension's `accessible-name.ts` already resolves
`aria-labelledby` and then `aria-label`, and every element has a `parent`. So no extension or protocol change was
needed.

Putting the resolved group into the packet's `group` field would need a pass over all elements in
`sanitize.ts` (`elements.ts` sees one raw element at a time). The brief does not give me `sanitize.ts`. So one resolver
in `page-view` is shared by the view, find and describe.

- **New `page-view/group-names.ts`** (`webLlmGroupNames(elements, tree)`, exported through the `page-view` barrel). It
  has two parts:
  - **`groupOf(element)`** walks the ancestors, nearest first.
    - At the nearest fieldset it uses the element's own `group`, which is the extension's `fieldsetLegend` of its
      closest fieldset, or the legend itself.
    - At an outer fieldset it uses that fieldset's `legend` child in the packet.
    - At a `group`/`radiogroup` element with `aria-labelledby` or `aria-label` it uses the group's `name`. Where the
      capture gave no name, it uses the words of the packet elements the `aria-labelledby` ids point at, and then the
      `aria-label` value.
    - A group with no name is skipped. If no fieldset is in the tree, it falls back to the element's packet `group`.
    - As in t605, a name equal to the element's own name or text is dropped.
  - **`lineOf(group)`** gives the words of a named ARIA group's own line. It gives none in two cases:
    - an `aria-labelledby` target has a line of its own (visible, with a line role);
    - the nearest group around it, or a `<legend>` inside it, says the same words. This is "without repeating a legend
      that names the same set".
- **`page-view/line/choice.ts`**: new rule 6. A visible element with no line role whose `lineOf` gives words gets a
  text line with those words. F1 does not fold it, because no ancestor's words hold an `aria-label`.
  `chosenWebLlmLines` takes an optional `groups` and builds one when it is not given, so the callers `facts.ts` and
  `structure/item-row.ts` are unchanged.
- **`page-view/line/render.ts`, `page-view/page-text.ts`**: the resolver is built once per page and passed to render.
  A control line's group comes from `groups.groupOf`.
- **`page-view/element/group-token.ts`**: `webLlmGroupToken` now takes the resolved group string instead of the
  element. The output format is unchanged.
- **`page-find/search.ts`**: matching on the `group` field, the control's `group=` token and the near-match token all
  use `groupOf`.
- **`page-find/description.ts`**: the context line prints `group` as the view reads it (`{ ...element, group }`). An
  existing fieldset `group` keeps its position, and an ARIA group appends the key.
- **`docs/architecture/page-evidence.md`**: the line section describes ARIA groups, the nearest-wins rule, the
  unnamed-group rule, the group line and its dedupe rules. It also says the packet field, digest and look-alikes still
  carry the fieldset legend alone. The find and describe text is updated too.

**Not changed, and why:**

- **System instructions (`web-9`)**: the existing sentence is "`group="..."` ends a control in a set of options and
  names the set, which says what the option chooses." It already covers an ARIA set. The token is the same, so there is
  no new sentence and no version bump.
- **State digest (`web-state.v5`)**: no bump. The view's format did not change: same token, and the new line is an
  ordinary text line. What is digested also did not change, because the packet's `group` field is still the fieldset
  legend. The ARIA group's name, role and attributes were already part of each element.
- **`elements.ts`, `look-alikes.ts`**: no edit was needed. See the open questions.

New tests (fixtures are a theatre seat-booking form, a bicycle-hire form and a recipe filter; none is one of the ten
scenarios):

- **`page-view/tests/aria-groups.test.ts`** runs a raw capture through the sanitizer into the published page. It
  covers:
  - a `radiogroup` named by `aria-labelledby` (the label span's line, then radios with `group="Seating area"`, and no
    second line);
  - a `group` named by `aria-label` (an `"Extras"` line, then its options);
  - a fieldset nested in that group (its legend line, and its option with `group="Interval drinks"`; a later sibling
    goes back to `group="Extras"`);
  - an unnamed group (no `group=`);
  - a group whose inner legend has the same name (only the legend line).

  A second test asserts that each group name is printed once.
- **`page-find/tests/aria-groups.test.ts`** runs a capture with no `fieldsetLegend` through the sanitizer into describe
  and find.
  - Describe context has `group="Frame size"` (aria-labelledby) and `group="Add-ons"` (aria-label). An unnamed group
    and the label outside its group show no `group=`.
  - Finding "add-ons" gives the group div, `t5 checkbox "Helmet" group="Add-ons"`, and a span with
    `(group="Add-ons")`. Finding "medium" prints `group="Frame size"`.
- **`page-view/tests/group-names.test.ts`**: `aria-labelledby` is resolved from the packet when the capture gave no
  name, an unnamed inner group is passed over, and a group labelled by a hidden element still gets its line.

## Commands run and observed results

All commands ran in the worktree; domain tests used `DOMAIN_TEST_BUILD_LABEL=t610`.

| Command | Result |
| --- | --- |
| Proof on old code: every modified source file replaced by `git show HEAD:<file>` (new tests kept), then `node scripts/test-domain.mjs page-view/tests/aria-groups page-find/tests/aria-groups` (in `domain/`) | tests 4, pass 0, fail 4. Restored from the scratchpad copy afterwards. `group-names.test.ts` was not part of the proof because it imports the new module. |
| `node scripts/test-domain.mjs runtime/llm-evidence` (in `domain/`) | tests 1121, pass 1121, fail 0 (t605's final count was 1114, plus the 7 new tests) |
| `node scripts/test-domain.mjs runtime/route-state runtime/state-diff runtime/facts/tests page-evidence/tests tests/domain.test` (out-of-directory consumers, run as a precaution) | tests 69, pass 69, fail 0 |
| `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (in `domain/`) | both exit 0, no output |
| `node scripts/check-extension.mjs` (in `apps/extension/`; the brief's root path does not exist) | exit 0, no output |
| `pnpm structure:check` | `structure-audit: passed (194 warning(s), 639 baselined).` |

## Not verified

- **No live browser check.** It is not verified that the real capture sends a `div role="radiogroup"` with its
  `accessibleName` resolved from `aria-labelledby`. That depends on `identity/accessible-name.ts`, which I read but did
  not test. The domain falls back to resolving ids from the packet.
- **Full suites not run** (`pnpm check`, `pnpm test`), per the full-suites rule.
- **View size not measured.** Size grows by one token per control in an ARIA group, plus one line per `aria-label`
  group.
- **Edge case not covered.** A fieldset that the packet does not describe, sitting inside a described ARIA group, would
  make the walk choose the ARIA group. In that case the element's own `fieldsetLegend` (the nearer group) loses.

## Open questions or contradictions found

- **The packet `group` field still holds only the legend.** Its consumers are the state digest, look-alike descriptions
  and identity:
  - Two options with the same words in different ARIA groups are still told apart only by `within` or `alike`, not by
    group.
  - Moving the resolution into the packet needs a whole-packet pass in `sanitize.ts` (not owned). That pass would also
    change digests and need `web-state.v6`.
  - If wanted, `webLlmGroupNames` can be called there unchanged.
- **The brief's script paths are relative to the packages.** `scripts/test-domain.mjs` is `domain/scripts/` and
  `scripts/check-extension.mjs` is `apps/extension/scripts/`; neither is at the repository root.

## Follow-up: the packet's `group` field (coordinator message)

Outcome: Done. Every consumer now names groups by the one rule in `page-view/group-names.ts`: the view, find,
describe, the packet, the state digest and look-alikes. `host-runtime.ts`, `state-diff/**` and `control-spot/**` were
not touched.

This supersedes the "Not changed" notes above on the digest, `elements.ts` and look-alikes, and the first open
question.

### What changed

- **`sanitize.ts`**: new private `writeGroups(elements)`, called right after every `parent` is written.
  - It runs before `tellWebLlmLookAlikesApart` and before anything digests the packet.
  - It resolves every element's group with `webLlmGroupNames(elements, webLlmPageTree(elements))`, imported through the
    `page-view` barrel. All groups are resolved before any is written, so one element's new group never feeds another
    element's walk.
  - It then sets or deletes `element.group`.
  - The view, find and describe still call the resolver on the packet. This gives the same answer on a sanitized
    packet: at the nearest fieldset the walk reads the element's `group`, which now holds the resolved answer. It also
    covers hand-built and recorded packets.
- **`state-digest/state-digest.ts`**: `web-state.v5` becomes `web-state.v6`, with a note in the version comment. The 5
  version regexes in `state-digest/tests/{state-digest,call-state-digests}.test.ts` are updated.
  - Why bump: on an ARIA page, the digested `group` of an option goes from `""` to the group's name. A saved v5 digest
    of an unchanged ARIA page would then differ from the new digest, and that would read as a change of state.
  - The file's own rule is "a change to what is digested must not read as a change of state". t605 bumped to v5 for
    the same kind of change, so I followed it.
  - Pages without ARIA groups keep the same projection, but the prefix still moves. That is the cost of making the
    meaning change visible.
- **`elements.ts`**: only the doc comment on `group`. It now says the sanitizer replaces the legend with the resolved
  nearest group.
- **`look-alikes.ts`**: no edit needed. It already describes by `element.group`, and that field now holds the resolved
  group.
- **New `page-view/tests/group-agreement.test.ts`**. The fixture is a cafe order form with two `radiogroup`s, one
  named by `aria-labelledby` and one by `aria-label`, each with a "None" radio. It checks three things:
  1. Each option's packet `group` is exactly the `group="…"` its view line ends with, and the label outside its group
     has none.
  2. The two "None" radios get different look-alike descriptions and no `alike` count.
  3. The digest is stable across two captures and changes when only one option's packet `group` changes.
  - It lives in `page-view/tests/` rather than `llm-evidence/tests/`, which would have reached 26 files, past the
    structure audit's 25-file limit.
- **`docs/architecture/page-evidence.md`**: says the sanitizer writes the resolved group into the packet, so the
  digest and look-alikes agree with the view. The digest version is now `web-state.v6` in both places.

### Commands run and observed results

| Command | Result |
| --- | --- |
| Proof on old code: `sanitize.ts` replaced by `git show HEAD:...`, then `node scripts/test-domain.mjs runtime/llm-evidence/tests/aria-group-agreement` (the test's first location) | pass 1, fail 2: packet-group/view agreement and look-alike grouping fail; the digest test passes, since `group` was already digested. Restored afterwards. |
| `node domain/scripts/test-domain.mjs runtime/llm-evidence` (repository root, `DOMAIN_TEST_BUILD_LABEL=t610`) | tests 1124, pass 1124, fail 0 |
| `node scripts/test-domain.mjs runtime/route-state runtime/state-diff runtime/facts/tests page-evidence/tests tests/domain.test runtime/tests` (in `domain/`, consumers outside the directory) | tests 177, pass 177, fail 0 |
| `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (in `domain/`) | both exit 0 |
| `node scripts/check-extension.mjs` (in `apps/extension/`) | exit 0 |
| `pnpm structure:check` | first failed on two violations: the `llm-evidence/tests/` 26-file limit and a deep import in `sanitize.ts`. After moving the test and importing through the barrel: `structure-audit: passed (194 warning(s), 639 baselined).` |

### Notes

- `node apps/extension/scripts/check-extension.mjs` run from the repository root fails with `TS5058 tsconfig.json does
  not exist`. It resolves paths from the working directory, so it has to be run from `apps/extension/`.
- **Saved preconditions:** any saved precondition or cache keyed on a `web-state.v5` digest no longer compares equal.
