import type { AuthenticationTabs } from "../../authentication-tabs";
import type { HostedCredentialAudience, HostedCredentialRepository } from "../../credentials";
import type { HostedPkceFailureCode } from "./failure-codes";

export type HostedPkceSelection = Readonly<{ id: string; origin: string; clientLabel: string; extensionVersion: string }>;
export type HostedPkcePhase = "idle" | "preparing" | "waiting" | "exchanging" | "adopted" | "denied" | "cancelled" | "uncertain" | "failed";
export type HostedPkceAttemptView = Readonly<{ phase: HostedPkcePhase; attemptId?: string; failureCode?: HostedPkceFailureCode }>;
export type HostedPkceAdoption = Readonly<{ binding: HostedCredentialAudience; installId: string; revision: number; lineageId: string; connectedClientId: string; userId: string; workspaceId: string }>;
export type HostedPkceOwnerOutcome = HostedPkceAttemptView & Readonly<{ adopted?: HostedPkceAdoption }>;
export type HostedPkceAttemptBase = Readonly<{ version: 1; attemptId: string; browserSessionId: string; selectionId: string; binding: HostedCredentialAudience; installId: string; expectedCredentialRevision: number; createdAtMs: number }>;
export type HostedPkceStoredAttempt = HostedPkceAttemptBase & (
  | Readonly<{ phase: "preparing"; tabId: null; state: string; verifier: string }>
  | Readonly<{ phase: "waiting"; tabId: number; state: string; verifier: string }>
  | Readonly<{ phase: "exchanging"; tabId: number; submittedAtMs: number }>
  | Readonly<{ phase: "terminal"; tabId: number | null; outcome: "adopted" | "denied" | "cancelled" | "uncertain" | "failed"; failureCode?: HostedPkceFailureCode }>
);
export type HostedPkceAttemptEnvelope = Readonly<{ browserSessionId: string; revision: number; attempt: HostedPkceStoredAttempt | null }>;
export interface HostedPkceAttemptStore {
  load(): Promise<HostedPkceAttemptEnvelope>;
  compareAndSwap(expected: Readonly<{ browserSessionId: string; revision: number }>, next: HostedPkceStoredAttempt | null): Promise<boolean>;
}
export type HostedPkceTabPort = Readonly<{
  createBlank(): Promise<number>;
  navigateOwned(input: Readonly<{ tabId: number; attemptId: string; browserSessionId: string; url: string; stillCurrent: () => boolean }>): Promise<void>;
}>;
export type HostedPkceOptions = Readonly<{
  selection: HostedPkceSelection;
  isCurrent: () => boolean;
  credentials: HostedCredentialRepository;
  attempts: HostedPkceAttemptStore;
  authenticationTabs: Pick<AuthenticationTabs, "ready" | "own" | "owns" | "sessionIdentity">;
  tabs: HostedPkceTabPort;
  fetch: (url: string, options: RequestInit) => Promise<Response>;
  crypto: Readonly<{ getRandomValues: Crypto["getRandomValues"]; subtle: Pick<SubtleCrypto, "digest"> }>;
  now: () => number;
}>;
export type HostedPkceProtocol = Readonly<{
  start(): Promise<HostedPkceAttemptView>;
  observe(input: Readonly<{ tabId: number; url: string }>): Promise<HostedPkceOwnerOutcome>;
  cancel(): Promise<HostedPkceAttemptView>;
  restore(): Promise<HostedPkceAttemptView>;
}>;
