// src/runtime/llm-evidence/tests/present.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/runtime/llm-evidence/present.ts
function present(fields) {
  const source = fields;
  const written = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== void 0) written[key] = value;
  }
  return written;
}

// src/runtime/llm-evidence/tests/present.test.ts
var dialog = () => present({ role: "dialog", name: void 0, modal: true });
test("an optional field given undefined is absent, not present-and-undefined", () => {
  const value = dialog();
  assert.deepEqual(Object.keys(value), ["role", "modal"]);
  assert.equal("name" in value, false, "an absent dialog name is a missing key, not a key holding undefined");
  assert.equal(JSON.stringify(value), '{"role":"dialog","modal":true}');
});
test("false, 0 and the empty string are values and survive", () => {
  const element = present({
    target: "target.1",
    tag: "input",
    frameId: 0,
    role: "",
    name: void 0,
    text: void 0,
    inputType: void 0,
    controlType: void 0,
    hasValue: false,
    selectedValue: "",
    href: void 0,
    options: void 0,
    revealKind: void 0,
    expanded: false,
    focused: void 0,
    recent: void 0,
    changed: void 0,
    form: void 0,
    landmark: void 0,
    heading: void 0,
    item: void 0,
    cell: void 0
  });
  assert.deepEqual(element, { target: "target.1", tag: "input", frameId: 0, role: "", hasValue: false, selectedValue: "", expanded: false });
});
test("key order is the literal's, so the serialized bytes are the writer's own", () => {
  const value = present({ modal: void 0, name: "Name", role: "dialog" });
  assert.equal(JSON.stringify(value), '{"name":"Name","role":"dialog"}');
});
test("a packet type whose keys are all optional is writable, which the extension's own helper cannot do", () => {
  assert.deepEqual(dialog(), { role: "dialog", modal: true });
});
test("the compile-time rows above and below are the real assertions", () => {
  present({ role: "dialog", name: void 0, modal: void 0 });
  present({ roel: "dialog", name: void 0, modal: void 0 });
  present({ role: "dialog", name: void 0 });
  present({
    // @ts-expect-error a required field may not be undefined: present would strip it and the returned type would be a lie
    target: void 0,
    tag: "input",
    frameId: void 0,
    role: void 0,
    name: void 0,
    text: void 0,
    inputType: void 0,
    controlType: void 0,
    hasValue: void 0,
    selectedValue: void 0,
    href: void 0,
    options: void 0,
    revealKind: void 0,
    expanded: void 0,
    focused: void 0,
    recent: void 0,
    changed: void 0,
    form: void 0,
    landmark: void 0,
    heading: void 0,
    item: void 0,
    cell: void 0
  });
  assert.deepEqual(present({ role: void 0, name: void 0, modal: void 0 }), {});
});
