import { isJsonRecord, isWithheldText, screenedPageText } from "../llm-evidence";

/** Malformed shown state must not silently become absent sanitized state. */
export function webRuntimeRepeatElementKnown(element: unknown): boolean {
  if (!isJsonRecord(element) || typeof element.tagName !== "string" || element.tagName.trim() === ""
    || typeof element.selector !== "string" || element.selector.trim() === "") return false;
  for (const name of ["role", "implicitRole", "accessibleName", "name", "label", "visibleText", "text", "ownText", "readableText", "inputType", "value", "selectedValue", "href"]) {
    if (element[name] !== undefined && typeof element[name] !== "string") return false;
  }
  for (const name of ["checked", "hasValue", "hidden"]) if (element[name] !== undefined && typeof element[name] !== "boolean") return false;
  if (["checkbox", "radio"].includes(String(element.inputType).toLowerCase()) && typeof element.checked !== "boolean") return false;
  if (element.tagName.toLowerCase() === "select" && (typeof element.selectedValue !== "string" || !Array.isArray(element.options))) return false;
  if (element.options !== undefined && (!Array.isArray(element.options) || element.options.some((option) => !isJsonRecord(option)
    || typeof option.value !== "string" || typeof option.label !== "string" || (option.selected !== undefined && typeof option.selected !== "boolean")))) return false;
  const attributes = element.attributes;
  if (attributes !== undefined && (Array.isArray(attributes) ? attributes.some((entry) => !Array.isArray(entry) || entry.length !== 2 || entry.some((part) => typeof part !== "string"))
    : !isJsonRecord(attributes) || Object.values(attributes).some((value) => typeof value !== "string"))) return false;
  const context = element.context;
  if (context === undefined) return true;
  if (!isJsonRecord(context)) return false;
  for (const name of ["formId", "formName", "landmark", "heading", "fieldsetLegend"]) if (context[name] !== undefined && typeof context[name] !== "string") return false;
  for (const [name, fields] of [["listPosition", ["index", "total"]], ["tablePosition", ["row", "column"]]] as const) {
    const position = context[name];
    if (position !== undefined && (!isJsonRecord(position) || fields.some((field) => typeof position[field] !== "number" || !Number.isSafeInteger(position[field]) || Number(position[field]) < 0))) return false;
  }
  if (context.shadowHosts !== undefined && (!Array.isArray(context.shadowHosts) || context.shadowHosts.some((host) => typeof host !== "string" || host.trim() === "" || isWithheldText(screenedPageText(host))))) return false;
  if (context.dialog !== undefined && (typeof context.dialog !== "string" || context.dialog.trim() === "" || isWithheldText(screenedPageText(context.dialog)))) return false;
  const record = context.record;
  if (isJsonRecord(record) && ["key", "keyAttribute", "text"].some((field) => record[field] !== undefined && (typeof record[field] !== "string" || String(record[field]).trim() === ""))) return false;
  if (isJsonRecord(record) && record.keyAttribute !== undefined && record.key === undefined) return false;
  if (record !== undefined && (!isJsonRecord(record) || !(typeof record.key === "string" && record.key.trim() !== "" || typeof record.text === "string" && record.text.trim() !== "")
    || Object.values(record).some((value) => typeof value === "string" && isWithheldText(screenedPageText(value))) || record.values !== undefined)) return false;
  return true;
}
