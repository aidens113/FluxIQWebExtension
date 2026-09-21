// The rows the panel's "Changed fields" table must render for one change, the
// oracle the adaptation assertions compare the table against. It mirrors
// Core's `adaptationChangedFields` (apps/web/src/features/automation-studio/
// adaptations/adaptation-model.ts) exactly, including its display words and
// its 50-row cap: when Core changes how a before/after pair is shown, the live
// assertion fails and this mirror is updated with it, which is the point of
// asserting the rendered table rather than trusting it.

export type ChangedFieldRow = { path: string; before: string; after: string };

export function adaptationChangedFieldRows(before: unknown, after: unknown, limit = 50): ChangedFieldRow[] {
  const rows: ChangedFieldRow[] = [];
  const visit = (left: unknown, right: unknown, at: string): void => {
    if (rows.length >= limit || JSON.stringify(left) === JSON.stringify(right)) return;
    if (isRecord(left) || isRecord(right)) {
      const leftRecord = isRecord(left) ? left : {};
      const rightRecord = isRecord(right) ? right : {};
      const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort();
      if (keys.length) {
        for (const key of keys) visit(leftRecord[key], rightRecord[key], at ? `${at}.${key}` : key);
        return;
      }
    }
    rows.push({ path: at || "Value", before: display(left), after: display(right) });
  };
  visit(before, after, "");
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function display(value: unknown): string {
  if (value === undefined) return "Not set";
  if (value === null) return "None";
  if (typeof value === "string") return value || "Empty";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}
