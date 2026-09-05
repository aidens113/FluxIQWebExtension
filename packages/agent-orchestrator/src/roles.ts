import type { AgentRole, ProhibitedAction, RepositoryName } from "./types.js";

export type RolePolicy = {
  role: AgentRole;
  writable: boolean;
  repository?: RepositoryName;
  purpose: string;
  mandatoryProhibitions: readonly ProhibitedAction[];
};

const COMMON: readonly ProhibitedAction[] = ["merge", "publish", "deploy", "live-site-write", "disable-test", "weaken-expectation", "edit-outside-scope"];

export const ROLE_POLICIES: Readonly<Record<AgentRole, RolePolicy>> = {
  coordinator: { role: "coordinator", writable: false, purpose: "Select and bound work; aggregate results without editing.", mandatoryProhibitions: COMMON },
  scenario: { role: "scenario", writable: true, repository: "facility", purpose: "Author one explicitly scoped scenario and its direct tests.", mandatoryProhibitions: COMMON },
  diagnosis: { role: "diagnosis", writable: false, purpose: "Produce evidence-linked hypotheses without edits.", mandatoryProhibitions: COMMON },
  "core-repair": { role: "core-repair", writable: true, repository: "core", purpose: "Repair only explicitly scoped domain-neutral Core paths.", mandatoryProhibitions: COMMON },
  "extension-repair": { role: "extension-repair", writable: true, repository: "facility", purpose: "Repair only explicitly scoped extension or domain paths.", mandatoryProhibitions: COMMON },
  reviewer: { role: "reviewer", writable: false, purpose: "Review comparisons and expectation integrity without edits.", mandatoryProhibitions: COMMON },
};
