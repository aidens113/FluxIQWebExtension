import type { JsonObject } from "fluxiq/core";
import type { ElementMatcher, TargetBounds, TargetMatchingSnapshot } from "fluxiq/runtime/target-matching";

export type WebElementFingerprint = {
  visibleText?: string;
  accessibleName?: string;
  label?: string;
  id?: string;
  testId?: string;
  automationId?: string;
  entityId?: string;
  entityKind?: string;
  tagName?: string;
  role?: string;
  selector?: string;
  xpath?: string;
  queryPath?: string;
  statePath?: string | { namespace: string; path: string };
  url?: string;
  classNames?: string[];
  bounds?: TargetBounds;
  attributes?: Record<string, string>;
  metadata?: JsonObject;
};

export type WebElementFingerprintCandidate = WebElementFingerprint & {
  candidateId: string;
  visualFrameId?: string;
  visualLayerId?: string;
  isVisibleOnViewport?: boolean;
};

export type WebElementFingerprintContribution = {
  signalPath: string;
  score: number;
  weight: number;
  reason: string;
  metadata?: JsonObject;
};

export type WebElementFingerprintScore = {
  candidateId: string;
  totalScore: number;
  normalizedScore: number;
  confidence: number;
  matchedSignals: string[];
  failedSignals: string[];
  positiveContributions: WebElementFingerprintContribution[];
  negativeContributions: WebElementFingerprintContribution[];
  candidate: WebElementFingerprintCandidate;
  metadata?: JsonObject;
};

export type WebElementFingerprintWeights = {
  visibleText: number;
  accessibleName: number;
  label: number;
  id: number;
  testId: number;
  automationId: number;
  entityId: number;
  statePath: number;
  role: number;
  tagName: number;
  entityKind: number;
  selector: number;
  queryPath: number;
  xpath: number;
  url: number;
  classNames: number;
  bounds: number;
  attributes: number;
  visibility: number;
};

export type WebElementFingerprintScoringOptions = {
  weights?: Partial<WebElementFingerprintWeights>;
  minimumNormalizedScore?: number;
  metadata?: JsonObject;
};

export type WebElementMatcher = ElementMatcher<WebElementFingerprint, WebElementFingerprintWeights>;
