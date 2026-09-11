import type { BenchDistribution } from "@fluxiq-web-extension/test-contracts";

const EPSILON = 1e-9;

/**
 * p50 and p95 by the nearest-rank method: the smallest sample with at least
 * that share of the samples at or below it. Both are `null` without samples.
 */
export function benchDistribution(samples: readonly number[]): BenchDistribution {
  if (samples.length === 0) return { samples: 0, p50: null, p95: null };
  const sorted = [...samples].sort((left, right) => left - right);
  const rank = (share: number): number => sorted[Math.max(0, Math.ceil(share * sorted.length - EPSILON) - 1)]!;
  return { samples: sorted.length, p50: rank(0.5), p95: rank(0.95) };
}
