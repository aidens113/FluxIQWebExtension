import { assertNoSensitiveText, redactText } from "@fluxiq-web-extension/test-evidence";
import { providerFailureRecord, type ProviderFailureObservation, type ProviderFailureRecord, type ProviderFailureRequestBounds } from "./provider-failure-record.js";

/** The most failures one run keeps. A run is capped at 48 provider calls; a run that fails more than this has said what it had to say. */
export const PROVIDER_FAILURE_LOG_MAX_RECORDS = 20;

/** What stands in for a record whose body could not be made safe to keep. */
export type WithheldProviderFailure = Readonly<{ at: string; route: string; httpStatus: number; withheld: "redaction_failed" }>;

export type ProviderFailureEntry = ProviderFailureRecord | WithheldProviderFailure;

export type ProviderFailureLogOptions = {
  /**
   * Every literal that must not reach the file. This is deliberately wider
   * than the bundle's own redactor: `run-scenario.ts` keeps the provider
   * credential *out* of the bundle's secret list, because a redactor there
   * would scrub it on write and hide the leak the redaction attestation exists
   * to find. Nothing scans this file -- the attestation runs on the bundle's
   * staging directory before `finalize`, and this is written after the rename
   * -- so the credential has to be redacted here rather than merely scanned
   * for.
   */
  secrets: readonly string[];
  bounds?: ProviderFailureRequestBounds | undefined;
  now?: (() => Date) | undefined;
  /**
   * The redaction pass, for this directory's own tests to replace so the
   * fail-closed path can be exercised. A run passes none and gets
   * `redactText`. Substituting a weaker one does not open a hole: the
   * `assertNoSensitiveText` check below runs on the finished record with the
   * run's real secrets whatever redactor produced it, so a redactor that fails
   * to remove a secret yields a withheld stub rather than a leak.
   */
  redact?: ((value: string) => string) | undefined;
};

/**
 * The run's local record of provider calls that failed.
 *
 * It holds nothing until something fails, which is what makes "a successful
 * call writes nothing" a property of the log rather than of the writer: an
 * empty log produces no file.
 *
 * Every string that reaches a record passes `redactText` with the run's
 * secrets, and the finished record is then asserted clean with
 * `assertNoSensitiveText` -- the same pair the evidence bundle uses on every
 * artifact it writes. A record that still contains a configured secret after
 * redaction is not repaired and not kept: the entry becomes a `withheld` stub
 * naming only the route and the status, so a leak costs the diagnostic rather
 * than the guarantee.
 */
export class ProviderFailureLog {
  private readonly records: ProviderFailureEntry[] = [];
  private readonly secrets: readonly string[];
  private readonly bounds: ProviderFailureRequestBounds | null;
  private readonly now: () => Date;
  private readonly redact: (value: string) => string;
  private overflowed = 0;

  constructor(options: ProviderFailureLogOptions) {
    this.secrets = options.secrets.filter(secret => secret.length > 0);
    this.bounds = options.bounds ?? null;
    this.now = options.now ?? (() => new Date());
    const secrets = this.secrets;
    this.redact = options.redact ?? (value => redactText(value, { secrets }));
  }

  get size(): number {
    return this.records.length;
  }

  /** How many failures were dropped for exceeding the cap, so a truncated log says it is truncated. */
  get dropped(): number {
    return this.overflowed;
  }

  record(observation: ProviderFailureObservation): void {
    if (this.records.length >= PROVIDER_FAILURE_LOG_MAX_RECORDS) {
      this.overflowed += 1;
      return;
    }
    const at = this.now().toISOString();
    try {
      const entry = providerFailureRecord(observation, this.bounds, this.redact, at);
      assertNoSensitiveText(JSON.stringify(entry), this.secrets);
      this.records.push(entry);
    } catch {
      this.records.push(Object.freeze({ at, route: observation.route, httpStatus: observation.httpStatus, withheld: "redaction_failed" as const }));
    }
  }

  entries(): readonly ProviderFailureEntry[] {
    return Object.freeze([...this.records]);
  }
}

/**
 * The log one scenario run keeps, built from what that run already knows.
 *
 * The secret list is the bundle's own `secrets` **plus** the live run's
 * provider credential. `run-scenario.ts` deliberately keeps the credential out
 * of `secrets`, because the bundle's redactor would scrub it on write and hide
 * the very leak the redaction attestation exists to find. Nothing scans this
 * file -- the attestation runs on the bundle's staging directory before
 * `finalize`, and the sidecar is written after the rename -- so the credential
 * has to be redacted here rather than merely scanned for.
 */
export function runProviderFailureLog(input: {
  secrets: readonly string[];
  live?: { readonly redactionLiterals: readonly string[]; readonly providerRequestBounds: ProviderFailureRequestBounds } | undefined;
}): ProviderFailureLog {
  return new ProviderFailureLog({
    secrets: [...input.secrets, ...(input.live?.redactionLiterals ?? [])],
    ...(input.live ? { bounds: input.live.providerRequestBounds } : {}),
  });
}
