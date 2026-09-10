import type { Page } from "@playwright/test";

const DEFAULT_MAX_PAGES = 4;
const DEFAULT_MAX_ELEMENTS_PER_PAGE = 80;
const DEFAULT_MAX_EVIDENCE_BYTES = 48_000;
const MAX_INSTRUCTION_LENGTH = 4_000;
const MAX_URL_LENGTH = 2_000;
const MAX_SELECTOR_LENGTH = 500;
const MAX_TEXT_LENGTH = 300;

export type WebFlowExplorationLimits = {
  maxPages?: number;
  maxElementsPerPage?: number;
  maxEvidenceBytes?: number;
};

export type WebFlowExplorationRequest = {
  projectId: string;
  flowId: string;
  instruction: string;
  startUrl: string;
  allowedOrigins: string[];
  limits?: WebFlowExplorationLimits;
};

export type WebFlowExplorationElement = {
  tag: string;
  selector: string;
  role?: string;
  name?: string;
  text?: string;
  inputType?: string;
  href?: string;
};

export type WebFlowExplorationPage = {
  location: string;
  title?: string;
  elements: WebFlowExplorationElement[];
};

/**
 * This is intentionally an in-memory handoff. Page evidence is untrusted and
 * must not be written to runner evidence, logs, or screenshots by callers.
 */
export type WebFlowBootstrapExplorationEvidence = {
  schemaVersion: "web-flow-exploration.v1";
  trust: "untrusted-page-evidence";
  startLocation: string;
  pages: WebFlowExplorationPage[];
  truncated: boolean;
};

export type WebFlowExplorationBrowser = {
  navigate(url: string): Promise<void>;
  captureSnapshot(): Promise<unknown>;
};

/**
 * Implemented by the Core-facing transport. Provider selection, secrets,
 * budgets, grants, model calls, parsing, and proposal persistence stay in the
 * global Core LLM harness; this repository supplies only web evidence.
 */
export type CoreFlowBootstrapExplorationGateway = {
  selectExplorationPages(input: {
    projectId: string;
    flowId: string;
    instruction: string;
    initialEvidence: WebFlowBootstrapExplorationEvidence;
    maxAdditionalPages: number;
  }): Promise<unknown>;
  proposeFlowBootstrap(input: {
    projectId: string;
    flowId: string;
    instruction: string;
    explorationEvidence: WebFlowBootstrapExplorationEvidence;
  }): Promise<unknown>;
};

export type WebFlowExplorationResult = {
  adaptationId: string;
  status: "proposed";
  pagesCaptured: number;
  elementsCaptured: number;
  evidenceTruncated: boolean;
};

export async function exploreWebsiteAndProposeFlow(
  request: WebFlowExplorationRequest,
  dependencies: { browser: WebFlowExplorationBrowser; core: CoreFlowBootstrapExplorationGateway },
): Promise<WebFlowExplorationResult> {
  const instruction = boundedText(request.instruction, "instruction", MAX_INSTRUCTION_LENGTH);
  const projectId = identifier(request.projectId, "projectId");
  const flowId = identifier(request.flowId, "flowId");
  const allowedOrigins = normalizeAllowedOrigins(request.allowedOrigins);
  const startUrl = allowedUrl(request.startUrl, allowedOrigins);
  const maxPages = boundedLimit(request.limits?.maxPages, DEFAULT_MAX_PAGES, 1, 10, "maxPages");
  const maxElements = boundedLimit(request.limits?.maxElementsPerPage, DEFAULT_MAX_ELEMENTS_PER_PAGE, 1, 150, "maxElementsPerPage");
  const maxEvidenceBytes = boundedLimit(request.limits?.maxEvidenceBytes, DEFAULT_MAX_EVIDENCE_BYTES, 1_000, 100_000, "maxEvidenceBytes");

  const pages: WebFlowExplorationPage[] = [];
  let truncated = false;

  await dependencies.browser.navigate(startUrl.href);
  const capturedInitialPage = sanitizeSnapshot(await dependencies.browser.captureSnapshot(), allowedOrigins, maxElements);
  const initialPage = fitPageToEvidenceBudget(startUrl, [], capturedInitialPage, maxEvidenceBytes);
  if (!initialPage) throw new Error("initial exploration page exceeds the evidence byte limit");
  if (initialPage.elements.length !== capturedInitialPage.elements.length) truncated = true;
  pages.push(initialPage);
  const selectableLocations = new Set(initialPage.elements.flatMap(element => element.href ? [element.href] : []));
  const selection = maxPages === 1 ? [] : parsePageSelection(await dependencies.core.selectExplorationPages({
    projectId,
    flowId,
    instruction,
    initialEvidence: {
      schemaVersion: "web-flow-exploration.v1",
      trust: "untrusted-page-evidence",
      startLocation: evidenceLocation(startUrl),
      pages: [initialPage],
      truncated: false,
    },
    maxAdditionalPages: maxPages - 1,
  }), selectableLocations, maxPages - 1);

  for (const selectedLocation of selection) {
    const destination = allowedUrl(selectedLocation, allowedOrigins);
    await dependencies.browser.navigate(destination.href);
    const page = sanitizeSnapshot(await dependencies.browser.captureSnapshot(), allowedOrigins, maxElements);
    const boundedPage = fitPageToEvidenceBudget(startUrl, pages, page, maxEvidenceBytes);
    if (!boundedPage) {
      truncated = true;
      break;
    }
    if (boundedPage.elements.length !== page.elements.length) truncated = true;
    pages.push(boundedPage);
  }
  if (selection.length === maxPages - 1 && selectableLocations.size > selection.length) truncated = true;
  const explorationEvidence: WebFlowBootstrapExplorationEvidence = {
    schemaVersion: "web-flow-exploration.v1",
    trust: "untrusted-page-evidence",
    startLocation: evidenceLocation(startUrl),
    pages,
    truncated,
  };
  const proposal = proposalRecord(await dependencies.core.proposeFlowBootstrap({ projectId, flowId, instruction, explorationEvidence }));
  return {
    adaptationId: proposal.adaptationId,
    status: "proposed",
    pagesCaptured: pages.length,
    elementsCaptured: pages.reduce((total, page) => total + page.elements.length, 0),
    evidenceTruncated: truncated,
  };
}

export function sanitizeWebExplorationSnapshot(input: unknown, allowedOrigins: readonly string[], maxElements = DEFAULT_MAX_ELEMENTS_PER_PAGE): WebFlowExplorationPage {
  return sanitizeSnapshot(input, normalizeAllowedOrigins([...allowedOrigins]), boundedLimit(maxElements, DEFAULT_MAX_ELEMENTS_PER_PAGE, 1, 150, "maxElementsPerPage"));
}

export function createPlaywrightExtensionExplorationBrowser(input: {
  extensionPage: Page;
  targetPage: Page;
  allowedOrigins: string[];
  timeoutMs?: number;
}): WebFlowExplorationBrowser {
  const allowedOrigins = normalizeAllowedOrigins(input.allowedOrigins);
  const timeoutMs = boundedLimit(input.timeoutMs, 10_000, 1, 30_000, "timeoutMs");
  let sequence = 0;
  return {
    async navigate(url) {
      const destination = allowedUrl(url, allowedOrigins);
      await input.targetPage.goto(destination.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    },
    async captureSnapshot() {
      sequence += 1;
      const result = await input.extensionPage.evaluate(async ({ targetUrl, commandId }) => {
        const browser = (globalThis as unknown as { chrome: { tabs: { query(query: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>; sendMessage(id: number, message: unknown): Promise<unknown> } } }).chrome;
        const tabs = await browser.tabs.query({});
        const tab = tabs.find(candidate => candidate.url === targetUrl);
        if (typeof tab?.id !== "number") throw new Error("exploration target tab unavailable");
        return browser.tabs.sendMessage(tab.id, { type: "executeAction", topFrameOnly: true, action: { commandId, actionType: "web.dom.capture_snapshot" } });
      }, { targetUrl: input.targetPage.url(), commandId: `web-exploration-${sequence}` });
      const record = object(result, "extension snapshot result");
      if (record.status !== "succeeded" || !record.snapshot) throw new Error("extension snapshot capture failed");
      return record.snapshot;
    },
  };
}

function sanitizeSnapshot(input: unknown, allowedOrigins: readonly string[], maxElements: number): WebFlowExplorationPage {
  const snapshot = object(input, "DOM snapshot");
  const url = allowedUrl(snapshot.url, allowedOrigins);
  const rawElements = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements : fail("DOM snapshot interactiveElements must be an array");
  const elements: WebFlowExplorationElement[] = [];
  for (const raw of rawElements) {
    if (elements.length >= maxElements) break;
    const element = object(raw, "DOM snapshot element");
    const tag = optionalText(element.tagName, 40)?.toLowerCase();
    const selector = optionalText(element.selector, MAX_SELECTOR_LENGTH);
    if (!tag || !selector || isSensitiveElement(element)) continue;
    const href = safeHref(element.href, url, allowedOrigins);
    elements.push({
      tag,
      selector,
      ...(optionalText(element.role, 80) ? { role: optionalText(element.role, 80)! } : {}),
      ...(optionalText(element.name, MAX_TEXT_LENGTH) ? { name: optionalText(element.name, MAX_TEXT_LENGTH)! } : {}),
      ...(optionalText(element.visibleText ?? element.text, MAX_TEXT_LENGTH) ? { text: optionalText(element.visibleText ?? element.text, MAX_TEXT_LENGTH)! } : {}),
      ...(optionalText(element.inputType, 40) ? { inputType: optionalText(element.inputType, 40)!.toLowerCase() } : {}),
      ...(href ? { href } : {}),
    });
  }
  const title = optionalText(snapshot.title, MAX_TEXT_LENGTH);
  return {
    location: evidenceLocation(url),
    ...(title ? { title } : {}),
    elements,
  };
}

function isSensitiveElement(element: Record<string, unknown>): boolean {
  const inputType = optionalText(element.inputType, 100)?.toLowerCase();
  if (inputType === "password") return true;
  const attributes = element.attributes && typeof element.attributes === "object" && !Array.isArray(element.attributes) ? element.attributes as Record<string, unknown> : {};
  const autocomplete = optionalText(attributes.autocomplete, 100)?.toLowerCase() ?? "";
  return autocomplete === "current-password" || autocomplete === "new-password" || autocomplete === "one-time-code" || autocomplete.startsWith("cc-") || attributes["data-sensitive"] === "true";
}

function safeHref(value: unknown, base: URL, allowedOrigins: readonly string[]): string | undefined {
  if (typeof value !== "string" || !value || value.length > MAX_URL_LENGTH) return undefined;
  try { return evidenceLocation(allowedUrl(new URL(value, base).href, allowedOrigins)); }
  catch { return undefined; }
}

function normalizeAllowedOrigins(values: string[]): string[] {
  if (!values.length || values.length > 10) throw new Error("allowedOrigins must contain between 1 and 10 origins");
  const normalized = values.map(value => {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.origin !== value.replace(/\/$/u, "")) throw new Error("allowedOrigins must contain exact HTTP(S) origins");
    return url.origin;
  });
  return [...new Set(normalized)];
}

function allowedUrl(value: unknown, allowedOrigins: readonly string[]): URL {
  const text = boundedText(value, "URL", MAX_URL_LENGTH);
  const url = new URL(text);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || !allowedOrigins.includes(url.origin)) throw new Error("exploration URL is outside the allowed origins");
  return url;
}

function evidenceLocation(url: URL): string { return `${url.origin}${url.pathname}`; }
function evidenceBytes(startUrl: URL, pages: WebFlowExplorationPage[], truncated: boolean): number { return Buffer.byteLength(JSON.stringify({ schemaVersion: "web-flow-exploration.v1", trust: "untrusted-page-evidence", startLocation: evidenceLocation(startUrl), pages, truncated }), "utf8"); }
function fitPageToEvidenceBudget(startUrl: URL, pages: WebFlowExplorationPage[], page: WebFlowExplorationPage, maximum: number): WebFlowExplorationPage | undefined {
  const elements = [...page.elements];
  while (evidenceBytes(startUrl, [...pages, { ...page, elements }], true) > maximum) {
    if (!elements.length) return undefined;
    elements.pop();
  }
  return { ...page, elements };
}
function parsePageSelection(input: unknown, selectableLocations: ReadonlySet<string>, maximum: number): string[] {
  const value = object(input, "Core exploration selection");
  if (Object.keys(value).some(key => key !== "locations")) throw new Error("Core exploration selection contains unsupported fields");
  if (!Array.isArray(value.locations) || value.locations.length > maximum) throw new Error("Core exploration selection exceeds the page limit");
  const result: string[] = [];
  for (const location of value.locations) {
    const selected = boundedText(location, "selected location", MAX_URL_LENGTH);
    if (!selectableLocations.has(selected) || result.includes(selected)) throw new Error("Core exploration selection contains an unavailable or duplicate location");
    result.push(selected);
  }
  return result;
}
function proposalRecord(input: unknown): { adaptationId: string; status: "proposed" } { const value = object(input, "Core proposal"); if (value.status !== "proposed") throw new Error("Core exploration result must remain a reviewable proposal"); return { adaptationId: identifier(value.adaptationId, "adaptationId"), status: "proposed" }; }
function identifier(input: unknown, name: string): string { const value = boundedText(input, name, 200); if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(value)) throw new Error(`${name} must be a bounded identifier`); return value; }
function boundedText(input: unknown, name: string, maximum: number): string { if (typeof input !== "string" || !input.trim() || input.length > maximum || /\0/u.test(input)) throw new Error(`${name} must be a bounded non-empty string`); return input.trim(); }
function optionalText(input: unknown, maximum: number): string | undefined { if (typeof input !== "string") return undefined; const value = input.replace(/\s+/gu, " ").trim(); return value ? value.slice(0, maximum) : undefined; }
function boundedLimit(input: unknown, fallback: number, minimum: number, maximum: number, name: string): number { const value = input === undefined ? fallback : input; if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`); return Number(value); }
function object(input: unknown, name: string): Record<string, unknown> { if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${name} must be an object`); return input as Record<string, unknown>; }
function fail(message: string): never { throw new Error(message); }
