import { rename, mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertEvidenceEvent, assertEvidencePolicy, type EvidencePolicy } from "@fluxiq-web-extension/test-contracts";
import { DEFAULT_EVIDENCE_POLICY, toContractEvidenceEvent, toContractEvidencePolicy } from "./contracts.js";
import { sha256 } from "./hash.js";
import { assertNoSensitiveText, redactStructured, redactText, type RedactionOptions } from "./redaction.js";
import { createTimeline, renderContactSheet, renderReport } from "./report.js";
import type { ArtifactEntry, ArtifactIndex, CapturedEvidenceEvent, CaptureEvidenceEventInput, CapturePolicy, CaptureScreenshot, EvidenceSummary, FinalizeInput, VerifiedArtifact, VerifiedVisual } from "./types.js";

const MEDIA_TYPES: Record<string, string> = { ".json": "application/json", ".ndjson": "application/x-ndjson", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".zip": "application/zip", ".webm": "video/webm", ".log": "text/plain" };

function safeRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized === ".." || /^[A-Za-z]:/.test(normalized)) throw new Error(`Unsafe artifact path: ${relativePath}`);
  return normalized;
}

async function walkFiles(root: string, relative = ""): Promise<string[]> {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walkFiles(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files.sort();
}

export type EvidenceBundleOptions = {
  rootDirectory: string;
  runId: string;
  scenarioId: string;
  startedAt?: string;
  now?: () => Date;
  redaction?: RedactionOptions;
  evidencePolicy?: CapturePolicy;
};

export class EvidenceBundle {
  readonly finalPath: string;
  readonly stagingPath: string;
  private readonly now: () => Date;
  private readonly redaction: RedactionOptions;
  private readonly startedAt: string;
  private events: CapturedEvidenceEvent[] = [];
  private evidencePolicy: EvidencePolicy;
  private readonly artifactMetadata = new Map<string, Pick<ArtifactEntry, "mediaType" | "redaction">>();
  private initialized = false;
  private finalized = false;

  constructor(private readonly options: EvidenceBundleOptions) {
    safeRelativePath(options.runId);
    if (options.runId.includes("/")) throw new Error("runId must be a single path segment");
    this.finalPath = path.join(options.rootDirectory, options.runId);
    this.stagingPath = path.join(options.rootDirectory, `.staging-${options.runId}`);
    this.now = options.now ?? (() => new Date());
    this.startedAt = options.startedAt ?? this.now().toISOString();
    this.redaction = options.redaction ?? {};
    this.evidencePolicy = toContractEvidencePolicy(options.evidencePolicy ?? DEFAULT_EVIDENCE_POLICY);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.options.rootDirectory, { recursive: true });
    try {
      await stat(this.finalPath);
      throw new Error(`Evidence bundle already exists: ${this.finalPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await mkdir(this.stagingPath, { recursive: false });
    this.initialized = true;
  }

  async appendEvent(input: CaptureEvidenceEventInput & { screenshot?: CaptureScreenshot }): Promise<CapturedEvidenceEvent> {
    this.assertWritable();
    const redacted = redactStructured(input, this.redaction);
    const sequence = this.events.length + 1;
    const timestamp = this.now().toISOString();
    const published = toContractEvidenceEvent(redacted, { sequence, timestamp, ...(redacted.screenshot ? { screenshot: redacted.screenshot } : {}) });
    assertEvidenceEvent(published);
    const event: CapturedEvidenceEvent = { ...redacted, schemaVersion: "0.1", sequence, timestamp, published };
    const serialized = `${JSON.stringify(published)}\n`;
    assertNoSensitiveText(serialized, this.redaction.secrets);
    const handle = await open(path.join(this.stagingPath, "events.ndjson"), "a");
    try {
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    this.events.push(event);
    return event;
  }

  registerEvidencePolicy(policy: CapturePolicy): EvidencePolicy {
    if (this.finalized) throw new Error("Evidence bundle is already finalized");
    this.evidencePolicy = toContractEvidencePolicy(policy);
    return this.evidencePolicy;
  }

  async writeStructured(relativePath: string, value: unknown): Promise<void> {
    const redacted = redactStructured(value, this.redaction);
    const serialized = `${JSON.stringify(redacted, null, 2)}\n`;
    assertNoSensitiveText(serialized, this.redaction.secrets);
    await this.writeBytes(relativePath, Buffer.from(serialized), true);
    this.artifactMetadata.set(safeRelativePath(relativePath), { mediaType: "application/json", redaction: "applied" });
  }

  async writeText(relativePath: string, value: string): Promise<void> {
    const redacted = redactText(value, this.redaction);
    assertNoSensitiveText(redacted, this.redaction.secrets);
    await this.writeBytes(relativePath, Buffer.from(redacted), true);
    this.artifactMetadata.set(safeRelativePath(relativePath), { mediaType: MEDIA_TYPES[path.extname(relativePath).toLowerCase()] ?? "text/plain", redaction: "applied" });
  }

  async writeVerifiedVisual(relativePath: string, visual: VerifiedVisual): Promise<{ sha256: string; bytes: number; path: string }> {
    if (visual.redactionVerified !== true) throw new Error("Visual artifact must be redaction verified");
    this.assertBinaryContainsNoConfiguredSecret(visual.bytes);
    await this.writeBytes(relativePath, visual.bytes, false);
    this.artifactMetadata.set(safeRelativePath(relativePath), { mediaType: visual.mediaType, redaction: "verified" });
    return { sha256: sha256(visual.bytes), bytes: visual.bytes.byteLength, path: safeRelativePath(relativePath) };
  }

  async writeVerifiedArtifact(relativePath: string, artifact: VerifiedArtifact): Promise<void> {
    if (artifact.redactionVerified !== true) throw new Error("Binary artifact must be redaction verified");
    this.assertBinaryContainsNoConfiguredSecret(artifact.bytes);
    await this.writeBytes(relativePath, artifact.bytes, false);
    this.artifactMetadata.set(safeRelativePath(relativePath), { mediaType: artifact.mediaType, redaction: artifact.redaction });
  }

  getEvents(): readonly CapturedEvidenceEvent[] { return this.events; }

  async finalize(input: FinalizeInput): Promise<{ path: string; summary: EvidenceSummary; index: ArtifactIndex }> {
    this.assertWritable();
    const finishedAt = this.now().toISOString();
    const firstFailureEvent = this.events.find((event) => event.trigger === "error");
    const summary: EvidenceSummary = {
      schemaVersion: "0.1",
      runId: this.options.runId,
      scenarioId: this.options.scenarioId,
      verdict: input.verdict,
      startedAt: this.startedAt,
      finishedAt,
      eventCount: this.events.length,
      screenshotCount: this.events.filter((event) => event.screenshot?.path).length,
      duplicateScreenshotCount: this.events.filter((event) => event.screenshot?.duplicateOfSha256).length,
    };
    if (firstFailureEvent) {
      summary.firstFailure = { sequence: firstFailureEvent.sequence, summary: firstFailureEvent.summary };
      if (firstFailureEvent.correlation.stepId !== undefined) summary.firstFailure.stepId = firstFailureEvent.correlation.stepId;
    }
    if (input.metrics !== undefined) summary.metrics = input.metrics;
    const publicationPolicy = redactStructured(this.evidencePolicy, this.redaction);
    assertEvidencePolicy(publicationPolicy);
    await this.writeStructured("evidence-policy.json", publicationPolicy);
    await this.writeStructured("summary.json", summary);
    await this.writeText("report.html", renderReport(summary, this.events));
    await this.writeStructured("review/timeline.json", createTimeline(this.events));
    await this.writeText("review/contact-sheet.html", renderContactSheet(this.events));
    const index = await this.buildArtifactIndex(finishedAt);
    await this.writeBytes("artifact-index.json", Buffer.from(`${JSON.stringify(index, null, 2)}\n`), true);
    const indexBytes = await readFile(path.join(this.stagingPath, "artifact-index.json"));
    await this.writeBytes("bundle.complete.json", Buffer.from(`${JSON.stringify({ schemaVersion: "0.1", artifactIndexSha256: sha256(indexBytes) }, null, 2)}\n`), true);
    await rename(this.stagingPath, this.finalPath);
    this.finalized = true;
    return { path: this.finalPath, summary, index };
  }

  async abort(): Promise<void> {
    if (this.finalized) throw new Error("Cannot abort a finalized evidence bundle");
    if (this.initialized) await rm(this.stagingPath, { recursive: true, force: true });
    this.initialized = false;
  }

  private assertWritable(): void {
    if (!this.initialized) throw new Error("Evidence bundle is not initialized");
    if (this.finalized) throw new Error("Evidence bundle is already finalized");
  }

  private async writeBytes(relativePath: string, bytes: Uint8Array, replace: boolean): Promise<void> {
    this.assertWritable();
    const safePath = safeRelativePath(relativePath);
    const target = path.join(this.stagingPath, ...safePath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: replace ? "w" : "wx" });
  }

  private async buildArtifactIndex(generatedAt: string): Promise<ArtifactIndex> {
    const files = (await walkFiles(this.stagingPath)).filter((file) => file !== "artifact-index.json" && file !== "bundle.complete.json");
    const artifacts: ArtifactEntry[] = [];
    for (const relativePath of files) {
      const bytes = await readFile(path.join(this.stagingPath, ...relativePath.split("/")));
      const extension = path.extname(relativePath).toLowerCase();
      const metadata = this.artifactMetadata.get(relativePath);
      artifacts.push({ path: relativePath, mediaType: metadata?.mediaType ?? MEDIA_TYPES[extension] ?? "application/octet-stream", bytes: bytes.byteLength, sha256: sha256(bytes), redaction: metadata?.redaction ?? "applied" });
    }
    return { schemaVersion: "0.1", generatedAt, artifacts };
  }

  private assertBinaryContainsNoConfiguredSecret(bytes: Uint8Array): void {
    if (!(this.redaction.secrets?.length)) return;
    assertNoSensitiveText(Buffer.from(bytes).toString("utf8"), this.redaction.secrets);
  }
}
