import type { FrameLocator, Locator, Page } from "@playwright/test";
import type { ScenarioTarget } from "./parse-target.js";

export type AriaRole = Parameters<Page["getByRole"]>[0];

/** What a target resolves inside: a page, a frame, or an item located earlier. */
export type TargetScope = {
  locator(selector: string): Locator;
  getByRole(role: AriaRole, options?: { name?: string; exact?: boolean }): Locator;
  frameLocator(selector: string): FrameLocator;
};

export function locateTarget(scope: TargetScope, target: ScenarioTarget): Locator {
  if (target.kind === "testid") return scope.locator(`[data-testid=${JSON.stringify(target.id)}]`);
  if (target.kind === "css") return scope.locator(target.selector);
  if (target.kind === "role") return scope.getByRole(target.role as AriaRole, target.name === undefined ? {} : { name: target.name, exact: true });
  return locateTarget(scope.frameLocator(`iframe[title=${JSON.stringify(target.title)}]`), target.inner);
}
