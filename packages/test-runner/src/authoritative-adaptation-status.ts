/**
 * Preserve a terminal reverted status when readiness inspection exposes the
 * known stale-applied view. All other cases use the later summary/detail so
 * the workaround cannot mask an unrelated concurrent status transition.
 */
export function resolveAuthoritativeAdaptationStatus(
  adaptationId: string,
  authoritativeStatuses: ReadonlyMap<string, string>,
  summaryStatus: string | undefined,
  detailStatus: string
): string {
  const currentStatus = summaryStatus ?? detailStatus;
  return authoritativeStatuses.get(adaptationId) === "reverted" && currentStatus === "applied"
    ? "reverted"
    : currentStatus;
}

export function isActiveRuntimeAdaptationStatus(status: string): boolean {
  return status === "proposed" || status === "validated" || status === "applied";
}
