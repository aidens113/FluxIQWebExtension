export const BOUNDARY_AUDIT_SCHEMA_VERSION = "0.1" as const;
export const forbiddenVocabulary = [
  "browser", "dom", "url", "selector", "tab", "extension", "playwright", "web-automation",
] as const;

export type SourceDocument = { path: string; content: string };
export type ConsumerEvidence = { id: string; repository: string; evidencePaths: string[] };
export type VocabularyFinding = { term: string; path: string; line: number; excerpt: string };
export type BoundaryAuditInput = {
  candidate: { name: string; path: string; sources: SourceDocument[] };
  consumers: ConsumerEvidence[];
  requiredConsumers?: number;
  auditedRepositories: string[];
};
export type BoundaryAuditReport = {
  schemaVersion: typeof BOUNDARY_AUDIT_SCHEMA_VERSION;
  candidate: { name: string; path: string };
  auditedRepositories: string[];
  gates: {
    domainNeutralVocabulary: { passed: boolean; findings: VocabularyFinding[] };
    independentConsumers: { passed: boolean; required: number; found: number; consumers: ConsumerEvidence[] };
  };
  recommendation: "promote-eligible" | "defer";
  reasons: string[];
};

export function findForbiddenVocabulary(sources: readonly SourceDocument[]): VocabularyFinding[] {
  const findings: VocabularyFinding[] = [];
  for (const source of sources) {
    source.content.split(/\r?\n/u).forEach((line, index) => {
      const normalized = line
        .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
        .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
        .replace(/[^A-Za-z0-9.-]+/gu, " ")
        .toLowerCase();
      const tokens = normalized.split(/[\s.-]+/u).filter(Boolean);
      for (const term of forbiddenVocabulary) {
        const matched = term === "web-automation"
          ? normalized.includes("web-automation") || normalized.includes("web.automation") || normalized.includes("web automation")
          : tokens.includes(term);
        if (matched) findings.push({ term, path: source.path, line: index + 1, excerpt: line.trim().slice(0, 160) });
      }
    });
  }
  return findings;
}

export function auditPromotionBoundary(input: BoundaryAuditInput): BoundaryAuditReport {
  const required = input.requiredConsumers ?? 2;
  if (!Number.isInteger(required) || required < 2) throw new Error("requiredConsumers must be an integer of at least two");
  const consumers = deduplicateConsumers(input.consumers);
  const consumerDomains = new Set(consumers.map(consumer => consumer.repository));
  const findings = findForbiddenVocabulary(input.candidate.sources);
  const vocabularyPassed = findings.length === 0;
  const consumersPassed = consumerDomains.size >= required;
  const reasons: string[] = [];
  if (!vocabularyPassed) reasons.push(`candidate contains ${findings.length} browser/domain vocabulary finding(s)`);
  if (!consumersPassed) reasons.push(`only ${consumerDomains.size} independent domain/repository consumer(s) found; ${required} required`);
  return {
    schemaVersion: BOUNDARY_AUDIT_SCHEMA_VERSION,
    candidate: { name: input.candidate.name, path: input.candidate.path },
    auditedRepositories: [...new Set(input.auditedRepositories)].sort(),
    gates: {
      domainNeutralVocabulary: { passed: vocabularyPassed, findings },
      independentConsumers: { passed: consumersPassed, required, found: consumerDomains.size, consumers },
    },
    recommendation: vocabularyPassed && consumersPassed ? "promote-eligible" : "defer",
    reasons,
  };
}

function deduplicateConsumers(consumers: readonly ConsumerEvidence[]): ConsumerEvidence[] {
  const byIdentity = new Map<string, ConsumerEvidence>();
  for (const consumer of consumers) {
    const identity = `${consumer.repository}::${consumer.id}`;
    const existing = byIdentity.get(identity);
    byIdentity.set(identity, {
      id: consumer.id,
      repository: consumer.repository,
      evidencePaths: [...new Set([...(existing?.evidencePaths ?? []), ...consumer.evidencePaths])].sort(),
    });
  }
  return [...byIdentity.values()].sort((left, right) => `${left.repository}/${left.id}`.localeCompare(`${right.repository}/${right.id}`));
}
