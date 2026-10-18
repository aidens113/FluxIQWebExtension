import type { WebLlmSnapshotBinding } from "../sanitize";
import { webControlSpotToken } from "./token";

type Page = Partial<Pick<WebLlmSnapshotBinding, "evidence" | "selectors" | "subjects" | "resetResource">>;

/** Only a positively complete semantic collection can witness absence. DOM absence alone cannot. */
export function webResetCollections(page: Page): { controls: ReadonlyMap<string, string>; collections: Array<{ scope: string; group: string; subjects: string[]; states: Record<string, string> }> } {
  const controls = new Map<string, string>();
  const collections: Array<{ scope: string; group: string; subjects: string[]; states: Record<string, string> }> = [];
  if (!page.resetResource || !page.evidence || !page.selectors || !page.subjects) return { controls, collections };
  const elements = page.evidence.elements;
  const byHandle = new Map(elements.map((element) => [element.target, element]));
  const role = (handle: string) => {
    const element = byHandle.get(handle);
    return element?.role ?? element?.implicitRole;
  };
  const ancestors = (handle: string): string[] => {
    const found: string[] = [];
    for (let at = byHandle.get(handle)?.parent; at !== undefined && found.length < 256; at = byHandle.get(at)?.parent) found.push(at);
    return found;
  };
  const number = (handle: string, key: string): number | undefined => {
    const value = byHandle.get(handle)?.attributes?.find(([name]) => name === key)?.[1];
    return value !== undefined && /^(?:0|[1-9][0-9]*)$/u.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
  };
  for (const list of elements.filter((element) => role(element.target) === "list")) {
    const rows = elements.filter((element) => role(element.target) === "listitem" && ancestors(element.target).find((handle) => role(handle) === "list") === list.target);
    const total = rows[0] ? number(rows[0].target, "aria-setsize") : undefined;
    // Unknown, virtualized, lazy or partial sets cannot vouch for absence.
    if (total === undefined || total < 1 || total !== rows.length) continue;
    const positions = rows.map((row) => number(row.target, "aria-posinset"));
    if (positions.some((position) => position === undefined || position < 1 || position > total) || new Set(positions).size !== total || rows.some((row) => number(row.target, "aria-setsize") !== total)) continue;
    const rowSubjects: string[] = [];
    const rowStates: string[] = [];
    for (const row of rows) {
      const subjects = new Set([...page.subjects].filter(([handle]) => handle === row.target || ancestors(handle).find((above) => role(above) === "listitem") === row.target).map(([, subject]) => webControlSpotToken("subject", subject)));
      if (subjects.size !== 1) break;
      rowSubjects.push([...subjects][0]!);
      const semantic = elements.filter((element) => element.target === row.target || ancestors(element.target).includes(row.target)).map((element) => {
        const state = element as unknown as Record<string, unknown>;
        return ["tag", "role", "implicitRole", "name", "text", "value", "checked", "selected", "disabled"].map((key) => state[key] ?? null);
      });
      rowStates.push(webControlSpotToken("scope", `state\0${JSON.stringify(semantic)}`));
    }
    if (rowSubjects.length !== total || new Set(rowSubjects).size !== total) continue;
    const selector = page.selectors.get(list.target);
    if (!selector) continue;
    const group = webControlSpotToken("scope", `${page.resetResource}\0${page.evidence.location}\0${list.frameId ?? 0}`);
    const scope = webControlSpotToken("scope", `${group}\0${selector}`);
    collections.push({ scope, group, subjects: rowSubjects, states: Object.fromEntries(rowSubjects.map((subject, index) => [subject, rowStates[index]!])) });
    for (const element of elements) {
      if (ancestors(element.target).find((above) => role(above) === "list") === list.target) controls.set(element.target, scope);
    }
  }
  return { controls, collections };
}
