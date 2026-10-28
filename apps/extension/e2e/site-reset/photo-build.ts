import type { Page } from "@playwright/test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "@fluxiq-web-extension/domain";
import type { InstalledBuild } from "./installed-build";
import { digest, type InstrumentedRuntime, type ObservedDeclaration, type ObservedOutcome, type ObservedRead } from "./instrumented-runtime";
import { handleBefore } from "./page-view";

/**
 * `./instrumented-runtime.ts` `bindInstrumentedRuntime`, observing the same
 * things the same way, with one difference: the connected extension's
 * sessions are also offered for repeating-structure detection, as the real
 * binding offers them (domain `runtime/llm-evidence/tools.ts`
 * `bindWebAutomationLlmEvidenceRuntime`). Without it
 * `web.detect_repeating_structure` throws ("does not declare
 * repeating-structure detection"), so no spec could write a listing a repeat
 * walks. Kept beside the photo specs that need it rather than changing the
 * shared helper under specs already running.
 */
export function bindDetectingRuntime(build: Pick<InstalledBuild, "fluxiq" | "service">): InstrumentedRuntime {
  const { fluxiq, service } = build;
  const reads: ObservedRead[] = [];
  const declarations: ObservedDeclaration[] = [];
  const outcomes: ObservedOutcome[] = [];
  let clickDispatches = 0;
  const ready = () => fluxiq.programs.clientGateway.snapshot().sessions.filter((session) => session.status === "ready").map((session) => session.sessionId);
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: ready,
    structureDetectionSessionIds: ready,
    executeAction: (session, command) => {
      if (command.actionType === "web.dom.click") clickDispatches++;
      return fluxiq.programs.automationStudioClientGateway.executeAction(session, command);
    }
  });
  const startState = runtime.startState!.bind(runtime);
  runtime.startState = async (input) => {
    const result = await startState(input);
    if (result) {
      const collections = result.collections ?? [];
      reads.push({
        call: input.callId,
        ...(typeof result.location === "string" ? { location: result.location } : {}),
        ...(typeof result.scope === "string" ? { scope: result.scope } : {}),
        scopes: collections.map((collection) => collection.scope),
        groups: collections.map((collection) => collection.group),
        sizes: collections.map((collection) => collection.subjects.length),
        hash: digest(collections),
        subjects: collections.flatMap((collection) => collection.subjects),
        ...(result.resource ? { resourceHash: digest(result.resource) } : {}),
        stateHashes: collections.map((collection) => collection.subjects.map((subject) => digest(collection.states[subject]))),
        ...(result.controls ? { controls: structuredClone(result.controls) } : {})
      });
    }
    return result;
  };
  const execute = runtime.executeTool.bind(runtime);
  runtime.executeTool = async (input) => {
    const permission = input.permission;
    const watched = permission ? { permission: async (declaration: Parameters<typeof permission>[0]) => {
      const verdict = await permission(declaration);
      const control = declaration.control;
      declarations.push({
        call: input.callId,
        consequences: declaration.consequences,
        ...(control?.scope ? { scope: control.scope } : {}),
        ...(control?.subject ? { subject: control.subject } : {}),
        ...(control?.page ? { page: control.page } : {}),
        ...(control?.item ? { item: control.item } : {}),
        ...(control?.dialog ? { dialog: control.dialog } : {}),
        ...(control?.place ? { place: control.place } : {}),
        ...(control?.state ? { state: control.state } : {}),
        ...(control?.resource ? { resourceHash: digest(control.resource) } : {}),
        permitted: verdict.permitted
      });
      return verdict;
    } } : {};
    const result = await execute({ ...input, ...watched });
    const evidence = record(result.evidence);
    outcomes.push({ call: input.callId, tool: input.toolId, ok: evidence.ok, code: evidence.code });
    return result;
  };
  service.bindLlmEvidenceRuntime(runtime);
  return { reads, declarations, outcomes, clicks: () => clickDispatches };
}

/** The photo-social scenario's root path on the Lab. */
export const PHOTO_ROOT = "/scenarios/photo-social/";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Opens photo-social as a person arrives: the cookie dialog declined and the
 * app prompt dismissed, then `profile` with the site's dock collapsed. The
 * build's first observation knows this page.
 */
export async function openPhotoProfile(page: Page, origin: string, profile: string): Promise<void> {
  await page.goto(new URL(PHOTO_ROOT, origin).href);
  await page.getByTestId("cookie-policy-manage-dialog-decline-button").click();
  await page.getByRole("button", { name: "Not Now", exact: true }).click();
  await page.goto(profile);
  await page.locator(`fl-dock [part="collapse-button"]`).waitFor({ timeout: 9000 });
  await page.locator(`fl-dock [part="collapse-button"]`).click();
}

/**
 * The posts the visitor's account has liked, as the page's own account script
 * states them (`photo-social/pages/shell.ts`, rewritten after each change the
 * server accepts). Read off whatever page is open, never by navigating, so a
 * build in progress keeps its page. Post codes are fixture ids; specs compare
 * them and print only counts.
 */
export async function likedPosts(page: Page): Promise<string[]> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const text = await page.locator(`script[data-testid="photo-studio-account"]`).first().textContent({ timeout: 2000 });
      const liked = record(JSON.parse(text ?? "{}")).liked;
      if (Array.isArray(liked)) return liked.filter((code): code is string => typeof code === "string");
    } catch {
      // A page mid-navigation has no account script yet: read again.
    }
    await page.waitForTimeout(300);
  }
  throw new Error("diagnostic.account_unreadable");
}

/** The post's own action control `label`: its actions row draws Like (or Unlike), then Comment; every comment carries a Like of its own elsewhere. */
export function postActionHandle(view: string, label: "Like" | "Unlike"): string {
  return handleBefore(view, label, "Comment");
}

/** The post's own like control in whichever state the view shows it, or none. */
export function postToggle(view: string): { handle: string; shows: "Like" | "Unlike" } | undefined {
  for (const shows of ["Unlike", "Like"] as const) {
    try {
      return { handle: postActionHandle(view, shows), shows };
    } catch {
      // Not shown in this state: try the other.
    }
  }
  return undefined;
}

/** The grid cell of post `code` in a page view: the link to its address. */
export function gridCellHandle(view: string, code: string): string | undefined {
  return view.split("\n").find((line) => /^t\d+ link /u.test(line) && line.endsWith(` ~/p/${code}/`))?.split(" ")[0];
}

/** One column a detection proposed, as `web.detect_repeating_structure` answered it: page structure, and its first sample. */
export type DetectedColumn = { key: string; label: string; kind: string; coverage: number; sample?: string };

/** The columns of a detection answer. */
export function detectedColumns(packet: JsonObject | undefined): DetectedColumn[] {
  const fields = Array.isArray(packet?.fields) ? packet.fields : [];
  return fields.map(record).filter((field) => typeof field.key === "string").map((field) => ({
    key: String(field.key),
    label: String(field.label ?? ""),
    kind: String(field.kind ?? ""),
    coverage: typeof field.coverage === "number" ? field.coverage : 0,
    ...(typeof field.sample === "string" ? { sample: field.sample } : {})
  }));
}

/** The grid's columns a Flow names: the post's address, and the badge that marks a pinned tile (its first sample is the first tile's, a pinned post). */
export function gridColumns(packet: JsonObject | undefined): { link?: string; pin?: string } {
  const columns = detectedColumns(packet);
  const link = columns.find((column) => column.kind === "link" && /\/p\//u.test(column.sample ?? ""))
    ?? columns.find((column) => /\/p\//u.test(column.sample ?? ""));
  const pin = columns.find((column) => /pin/iu.test(column.sample ?? "") || /pin/iu.test(column.label));
  return { ...(link ? { link: link.key } : {}), ...(pin ? { pin: pin.key } : {}) };
}

/**
 * Every issue code a refusal carries (any object's `code`), with the key it
 * names when it names one -- codes and structural paths only, never page words.
 */
export function issuesIn(answer: unknown): Array<{ code: string; at?: string }> {
  const found: Array<{ code: string; at?: string }> = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object" || value === null) return;
    const entry = value as JsonObject;
    if (typeof entry.code === "string") {
      const at = [entry.path, entry.at, entry.key, entry.field].find((candidate): candidate is string => typeof candidate === "string");
      found.push({ code: entry.code, ...(at ? { at } : {}) });
    }
    for (const nested of Object.values(entry)) visit(nested);
  };
  visit(answer);
  return found;
}
