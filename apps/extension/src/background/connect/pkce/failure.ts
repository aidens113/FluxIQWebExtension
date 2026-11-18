import { HOSTED_PKCE_FAILURE_CODES, type HostedPkceFailureCode } from "./failure-codes";

const known: ReadonlySet<string> = new Set(HOSTED_PKCE_FAILURE_CODES);

export class HostedPkceFailure extends Error {
  readonly code: HostedPkceFailureCode;

  constructor(code: HostedPkceFailureCode) {
    const safeCode = known.has(code) ? code : "operation_failed";
    super(`hosted_pkce.${safeCode}`);
    this.code = safeCode;
    this.name = "HostedPkceFailure";
    Object.freeze(this);
  }
}
