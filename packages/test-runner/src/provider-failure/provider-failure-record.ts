/**
 * One failed provider call, as a local diagnostic keeps it.
 *
 * This is the *second* tier of a run's evidence and is never published. The
 * bundle carries codes, counts and identifiers only, by a guarantee stated in
 * `redaction-attestation/` and at the top of
 * `existing-fluxiq-control/publishable-step-value.ts`, and that guarantee is
 * not relaxed: a sentence, a reply and a body may not travel in it. So a live
 * run that died on its first provider call could say `httpStatus 400` and
 * nothing else, and two such runs -- `run-muhs8hx3-6fd929e6` and
 * `run-muhtuizo-c458e49c`, both `flow_bootstrap.provider_transport_unknown` --
 * could not be told apart from each other or from a provider having a bad
 * minute. The Lab forbids retries on purpose (`live-llm/live-llm-plan.ts`), so
 * each occurrence costs a whole run, and nothing was learned from either.
 *
 * What the two tiers hold, and why the split is where it is:
 *
 * - `core` is Core's own HTTP reply to the Lab's build request, kept verbatim
 *   and bounded. This is the body the Lab actually received; `httpStatus` here
 *   is Core's status, which is what the published record's `httpStatus` has
 *   always been.
 * - `provider` is what Core said about the call it made to DeepSeek, read out
 *   of that reply's diagnostic. `code` is the decisive field: the published
 *   record collapses to `flow_bootstrap.provider_transport_unknown`, which is
 *   the *default* arm of Core's own projection
 *   (`runtime/flow-bootstrap/generation-failure.ts`), so it names nothing. The
 *   diagnostic underneath it names the condition.
 * - `provider.body` is DeepSeek's own response body. It is `null` today and
 *   stays `null` until Core surfaces it: Core's DeepSeek adapter throws on a
 *   non-ok status without ever reading the response
 *   (`runtime/llm/deepseek/provider.ts`, the `if (!response.ok)` line), so no
 *   part of the system holds it. The field exists so that a Core change
 *   carrying the body into the diagnostic reaches this file unchanged.
 *
 * Nothing here is a header, an environment variable or a credential. The
 * record copies exactly one piece of free text -- Core's response body -- and
 * a fixed list of scalars read by name out of it; the request side keeps a
 * byte count and the run's declared bounds, never the request content.
 * `provider-failure-log.ts` redacts that text on the way in and refuses to
 * keep it if a configured secret survives.
 */

/**
 * The longest body this keeps.
 *
 * A first-call refusal is a few hundred bytes, but a build that failed part way
 * carries its whole decision trace in `diagnostic.evidenceLoop.steps` -- one
 * row per decision, with its amendments' refusals -- and 8,000 characters cut
 * that trace off mid-row, which is how a run's refusal reasons went missing
 * from the one file allowed to hold them. Core bounds that trace (at most two
 * rows a decision, every row codes and counts), so 64 KiB holds any build's
 * with room to spare while still refusing to keep a runaway proxy page.
 */
export const PROVIDER_FAILURE_BODY_MAX_CHARS = 65_536;

/** What the run authorized the call to be, so "the request was too large" reads against a limit rather than a guess. */
export type ProviderFailureRequestBounds = Readonly<{
  provider: string;
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokensPerRequest: number;
  maxCallsPerRun: number;
  maxTotalTokensPerRun: number;
  timeoutMs: number;
}>;

/** What Core said about the provider call it made, read out of its refusal diagnostic. */
export type ProviderFailureProviderDetail = Readonly<{
  /** Core's own failure code, before the projection collapses it. */
  code: string | null;
  stage: string | null;
  /** DeepSeek's HTTP status, where Core had one. `null` on a failure that never reached a status. */
  httpStatus: number | null;
  /** `attempted`, `not_attempted` or `unknown`, as Core reports it. */
  invocation: string | null;
  /** Whether Core says a response came back at all. */
  response: string | null;
  provider: string | null;
  model: string | null;
  /** Core's measure of the outbound request, which is what a size refusal is judged against. */
  estimatedInputTokens: number | null;
  /** How many tools the evidence loop had called when it failed, and which. Absent on a first-call failure. */
  toolCallCount: number | null;
  toolIds: readonly string[] | null;
  /** DeepSeek's own body. Always `null` until Core reads it; see this file's header. */
  body: string | null;
  /**
   * What the call threw, where Core could not name it
   * (`diagnostic.providerThrow`, beside `flow_bootstrap.provider_transport_unknown`):
   * the error's and its cause's class and code, and the message Core screened.
   * `run-mun5e1ie-5aeefbbd` stopped on that code with nothing under it, so a
   * reset socket and an adapter bug read alike. `null` when Core sent none.
   */
  thrown: ProviderFailureThrow | null;
}>;

/** Core's account of an unnamed throw, each string redacted again on the way in. */
export type ProviderFailureThrow = Readonly<{
  errorClass: string | null;
  errorCode: string | null;
  causeClass: string | null;
  causeCode: string | null;
  message: string | null;
  /** What Core withheld from its own account, as its codes. */
  withheld: readonly string[] | null;
}>;

export type ProviderFailureRecord = Readonly<{
  at: string;
  /** The Core route the Lab called. A caller-supplied constant, never page or user data. */
  route: string;
  request: Readonly<{
    /** The size of the Lab's request to Core, not of the provider request; `provider.estimatedInputTokens` is that one. */
    controlRequestBytes: number;
    bounds: ProviderFailureRequestBounds | null;
  }>;
  core: Readonly<{
    httpStatus: number;
    body: string;
    bodyBytes: number;
    bodyTruncated: boolean;
  }>;
  provider: ProviderFailureProviderDetail;
}>;

export type ProviderFailureObservation = {
  route: string;
  httpStatus: number;
  /** Core's reply exactly as it arrived, before any parsing. */
  body: string;
  controlRequestBytes: number;
};

/**
 * Builds the record from a raw observation. `redact` is applied to the body
 * before it is stored, and to nothing else -- every other field is a number, a
 * boolean, or a string read by name out of Core's own closed vocabulary.
 */
export function providerFailureRecord(
  observation: ProviderFailureObservation,
  bounds: ProviderFailureRequestBounds | null,
  redact: (value: string) => string,
  at: string,
): ProviderFailureRecord {
  const raw = observation.body;
  const truncated = raw.length > PROVIDER_FAILURE_BODY_MAX_CHARS;
  const body = redact(truncated ? raw.slice(0, PROVIDER_FAILURE_BODY_MAX_CHARS) : raw);
  return Object.freeze({
    at,
    route: observation.route,
    request: Object.freeze({ controlRequestBytes: observation.controlRequestBytes, bounds }),
    core: Object.freeze({
      httpStatus: observation.httpStatus,
      body,
      bodyBytes: Buffer.byteLength(raw, "utf8"),
      bodyTruncated: truncated,
    }),
    provider: providerDetail(raw, redact),
  });
}

/**
 * Reads Core's diagnostic out of the refusal body. Every field is optional: a
 * body this cannot parse leaves them all `null`, and the verbatim `core.body`
 * is still there to read.
 */
function providerDetail(body: string, redact: (value: string) => string): ProviderFailureProviderDetail {
  // Read out of the raw body and redacted field by field, rather than read out
  // of the already-redacted one: a body long enough to be truncated no longer
  // parses, and losing the diagnostic to a long reply would defeat the file.
  // Every string that leaves here is redacted, including the ones from Core's
  // closed vocabulary that could not hold a secret anyway.
  const safe = (value: unknown): string | null => {
    const read = asText(value);
    return read === null ? null : redact(read);
  };
  const diagnostic = asRecord(asRecord(asRecord(parsed(body))?.payload)?.diagnostic);
  const accounting = asRecord(diagnostic?.accounting);
  const loop = asRecord(diagnostic?.evidenceLoop);
  const thrown = asRecord(diagnostic?.providerThrow);
  return Object.freeze({
    code: safe(diagnostic?.code),
    stage: safe(diagnostic?.stage),
    httpStatus: asCount(accounting?.providerStatus),
    invocation: safe(diagnostic?.providerInvocation),
    response: safe(diagnostic?.providerResponse),
    provider: safe(accounting?.provider),
    model: safe(accounting?.model),
    estimatedInputTokens: asCount(accounting?.estimatedInputTokens),
    toolCallCount: asCount(loop?.toolCallCount),
    toolIds: asToolIds(loop?.steps, redact),
    body: safe(accounting?.providerBody),
    thrown: thrown ? Object.freeze({
      errorClass: safe(thrown.errorClass),
      errorCode: safe(thrown.errorCode),
      causeClass: safe(thrown.causeClass),
      causeCode: safe(thrown.causeCode),
      message: safe(thrown.message),
      withheld: asCodes(thrown.withheld, redact),
    }) : null,
  });
}

/** A list of Core's withholding codes, each redacted; `null` when there is none. */
function asCodes(value: unknown, redact: (value: string) => string): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const codes = value.flatMap((entry) => {
    const code = typeof entry === "string" ? entry : asRecord(entry)?.code;
    return typeof code === "string" && code.length > 0 ? [redact(code)] : [];
  });
  return codes.length === 0 ? null : Object.freeze(codes);
}

/**
 * The body parsed, or nothing where it is not JSON at all -- a proxy page, an
 * empty gateway error. That really is absent rather than unreadable, and
 * `JSON.parse` raises nothing else, so anything else is rethrown.
 */
function parsed(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The tools the loop had called, by name, from the diagnostic's own step rows. */
function asToolIds(value: unknown, redact: (value: string) => string): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.flatMap(entry => {
    const id = asRecord(entry)?.toolId;
    return typeof id === "string" && id.length > 0 ? [redact(id)] : [];
  });
  return ids.length === 0 ? null : Object.freeze(ids);
}
