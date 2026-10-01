import type { JsonObject } from "fluxiq/core";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { webLlmLayerKind } from "../layer-marks";
import type { WebLlmPageEvidence } from "../sanitize";
import { screenWebBuildRefusalDiagnostic } from "./screen";
import type { WebBuildRefusalDiagnostic } from "./types";

/**
 * Project only the actual pre-call packet's target and coverage, never text,
 * selectors, URLs or input values. A handle the model wrote either way
 * (`t1` or the pre-t223 `target.1`) is recorded as the canonical `tN`.
 */
export function webBuildRefusalDiagnostic(input: {
  page?: WebLlmPageEvidence | undefined;
  parameters?: JsonObject | undefined;
  target?: unknown;
  code: unknown;
  reason?: unknown;
}): WebBuildRefusalDiagnostic | undefined {
  const target = handle(input.target) ?? ["target", "selector", "element"].map((key) => handle(input.parameters?.[key])).find((item) => item !== undefined);
  const element = target === undefined ? undefined : input.page?.elements.find((item) => item.target === target);
  const coveringTargets = element?.coveredBy?.flatMap((item) => {
    const cover = canonicalWebLlmTargetHandle(item);
    return cover === undefined ? [] : [cover];
  }) ?? [];
  const coveringKinds = [...new Set(coveringTargets.flatMap((cover) => {
    const layer = input.page?.elements.find((item) => item.target === cover);
    const kind = webLlmLayerKind(layer?.kind ?? layer?.isDialog?.kind);
    return kind === undefined ? [] : [kind];
  }))];
  return screenWebBuildRefusalDiagnostic({
    schemaVersion: "web-build-refusal.v1", phase: "before_action", code: input.code,
    reason: input.reason,
    pageObserved: input.page !== undefined,
    target,
    targetObserved: element !== undefined,
    coveringTargets,
    coveringKinds,
    coveringCount: element?.coveredBy?.length ?? 0,
  });
}

function handle(value: unknown): string | undefined {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).handle : value;
  return canonicalWebLlmTargetHandle(candidate);
}
