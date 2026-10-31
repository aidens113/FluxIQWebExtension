import type { AutomationStudioResolvedControlIntent } from "fluxiq/automation-studio";
import type { WebLlmSnapshotBinding } from "../sanitize";

/** Classify actual retained capture controls once per binding, by its own handles. */
export type WebLlmControlIntentCollector = (binding: WebLlmSnapshotBinding) => ReadonlyMap<string, AutomationStudioResolvedControlIntent>;
