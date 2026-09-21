// The guarantee `present` exists for, asserted by every build rather than
// proved once in a report.
//
// The `@ts-expect-error` rows are the load-bearing half. A worker showing once
// that a renamed packet field fails to compile shows it for one afternoon;
// these fail `pnpm --filter @fluxiq-web-extension/domain check` the moment any
// of them *stops* being an error -- if `PacketFields<T>` is "simplified" to
// `Partial<T>`, if the `NoInfer` is dropped, if TypeScript's excess-property
// rules move. `tsconfig.test.json` includes `src/**/*.ts`, so they are checked.
//
// The last row carries no directive and must keep compiling: it is the one
// that fails if closing the hole ever makes an optional packet field
// mandatory, which would be a worse packet than the hole was.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmEvidenceDialog } from "../page-evidence";
import { present } from "../present";

const dialog = (): WebLlmEvidenceDialog =>
  present<WebLlmEvidenceDialog>({ role: "dialog", name: undefined, modal: true });

test("an optional field given undefined is absent, not present-and-undefined", () => {
  const value = dialog();
  assert.deepEqual(Object.keys(value), ["role", "modal"]);
  assert.equal("name" in value, false, "an absent dialog name is a missing key, not a key holding undefined");
  assert.equal(JSON.stringify(value), '{"role":"dialog","modal":true}');
});

test("false, 0 and the empty string are values and survive", () => {
  const element = present<WebLlmEvidenceElement>({
    target: "target.1", tag: "input", frameId: 0, role: "", name: undefined, text: undefined,
    inputType: undefined, controlType: undefined, hasValue: false, selectedValue: "", href: undefined,
    options: undefined, revealKind: undefined, expanded: false, focused: undefined, recent: undefined,
    changed: undefined, form: undefined, landmark: undefined, heading: undefined, item: undefined, cell: undefined,
    repeats: undefined, dialog: undefined, within: undefined, alike: undefined
  });
  assert.deepEqual(element, { target: "target.1", tag: "input", frameId: 0, role: "", hasValue: false, selectedValue: "", expanded: false });
});

test("key order is the literal's, so the serialized bytes are the writer's own", () => {
  const value = present<WebLlmEvidenceDialog>({ modal: undefined, name: "Name", role: "dialog" });
  assert.equal(JSON.stringify(value), '{"name":"Name","role":"dialog"}');
});

test("a packet type whose keys are all optional is writable, which the extension's own helper cannot do", () => {
  // `WebLlmEvidenceDialog` has no required key. The extension's `present` guards
  // an un-named type argument with `object extends T ? never`, which is true of
  // any all-optional type, so it rejects this call. This one keys on the type
  // parameter's default instead. Half this directory's packet types are this
  // shape, so the difference is why the helper is a sibling rather than an import.
  assert.deepEqual(dialog(), { role: "dialog", modal: true });
});

test("the compile-time rows above and below are the real assertions", () => {
  // @ts-expect-error present must be told the packet type it is writing
  present({ role: "dialog", name: undefined, modal: undefined });

  // @ts-expect-error 'roel' is not a field of WebLlmEvidenceDialog
  present<WebLlmEvidenceDialog>({ roel: "dialog", name: undefined, modal: undefined });

  // @ts-expect-error 'modal' was deleted, which is how an optional field silently leaves the packet
  present<WebLlmEvidenceDialog>({ role: "dialog", name: undefined });

  present<WebLlmEvidenceElement>({
    // @ts-expect-error a required field may not be undefined: present would strip it and the returned type would be a lie
    target: undefined,
    tag: "input", frameId: undefined, role: undefined, name: undefined,
    text: undefined, inputType: undefined, controlType: undefined, hasValue: undefined, selectedValue: undefined,
    href: undefined, options: undefined, revealKind: undefined, expanded: undefined, focused: undefined,
    recent: undefined, changed: undefined, form: undefined, landmark: undefined, heading: undefined,
    item: undefined, cell: undefined
  });

  // No directive, and there must never be one: every optional field of the
  // packet stays optional. If this line starts failing, the fix made fields
  // mandatory on the wire.
  assert.deepEqual(present<WebLlmEvidenceDialog>({ role: undefined, name: undefined, modal: undefined }), {});
});
