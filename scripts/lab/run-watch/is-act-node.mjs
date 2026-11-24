// Whether a Core node the model ran changes the page or the site. A read, a
// snapshot or a wait is not an act; a press, type, select, navigate, scroll,
// keypress, upload or any other node is, so a node this list has not met counts
// as an act rather than hiding one.

const READ_ONLY = /(^|[.-])(capture_snapshot|extract_list|extract|wait_for_text|wait_for_selector|wait_for|read|inspect|merge)$/u;

/** @param {unknown} node the `node` id of a `core.run_node` call */
export function isActNode(node) {
  return typeof node === "string" && node.length > 0 && !READ_ONLY.test(node);
}
