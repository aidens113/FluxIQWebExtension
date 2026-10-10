// Where an assembled plan still names an evidence handle.
//
// A candidate script names an element it observed by the handle exploration
// printed for it (`t7`), and the domain resolves that handle against the
// exploration's evidence before the Flow is saved. A hand-authored matrix Flow
// has no exploration. Its steps name elements by literal selectors, which the
// domain keeps exactly as written; but a fact (`when:`, `done when:`, `start
// at:`) can only name an element by a handle, so a row whose proof needs one is
// written with a placeholder handle and refused here, by name, before Core is
// asked to save it. Core's own check (`assertAutomationStudioFlowBootstrapPlanHandlesResolved`)
// reads node parameters only, so a handle in an entry's or a part's metadata
// would otherwise be saved and could never resolve at run time.

/** One `{ handle }` reference, by its path in the plan and the handle it names. */
export type PlanEvidenceHandle = Readonly<{ path: string; handle: string }>;

const MAX_DEPTH = 64;

/** Every `{ handle }` or `{ handle, location }` object anywhere in `plan`, in document order. */
export function planEvidenceHandles(plan: unknown): PlanEvidenceHandle[] {
  const found: PlanEvidenceHandle[] = [];
  const visit = (value: unknown, path: string, depth: number): void => {
    if (depth > MAX_DEPTH || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}.${index}`, depth + 1));
      return;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (typeof record.handle === "string" && keys.every(key => key === "handle" || key === "location")) {
      found.push({ path, handle: record.handle });
      return;
    }
    for (const key of keys) visit(record[key], `${path}.${key}`, depth + 1);
  };
  visit(plan, "plan", 0);
  return found;
}
