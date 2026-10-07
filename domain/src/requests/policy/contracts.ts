/** Domain-owned policy only; neither enabling nor an origin entry is an execution grant. */
export type WebAutomationRequestPolicy = Readonly<{
  enabled: boolean;
  allowedOrigins: readonly string[];
  credentials: "omit";
  redirects: "reject";
  timeoutMs: number;
  maxResponseBytes: number;
}>;
export type WebAutomationRequestPolicyInput = Partial<WebAutomationRequestPolicy>;
