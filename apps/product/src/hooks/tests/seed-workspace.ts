import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { FluxIQ, initializeFluxIQStorage } from "fluxiq";
import { IdentityAccessService } from "fluxiq/auth";
import { AUTOMATION_STUDIO_ENDPOINTS, type AutomationStudioProject } from "fluxiq/automation-studio";
import { SQLiteRepository } from "fluxiq/database-manager";
import { createPlatformServices, iamPrincipalFrn, MemoryEmailSender, MemoryIamAuditSink } from "fluxiq/platform";
import type { PlatformHookPayloads } from "fluxiq/platform/panel";
import type { ProgramApiActor } from "fluxiq/programs";

/** Real provisioned people and workspace IAM; every path stays in this test's temporary root. */
export async function createSeedWorkspace(context: Pick<TestContext, "after">) {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-product-seed-"));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(root).startsWith("fluxiq-product-seed-"));
  let fluxiq: FluxIQ | undefined;
  context.after(async () => {
    try {
      await fluxiq?.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const identity = new IdentityAccessService({ passwordKdf: { testOnlyWeakParameters: { N: 2 ** 10, r: 8, p: 1, keyLength: 32 } } });
  const audit = new MemoryIamAuditSink();
  const services = await createPlatformServices({
    repository: new SQLiteRepository({ rootDir: path.join(root, "platform"), kind: "platform.store", layoutVersion: 2 }),
    iamRepository: new SQLiteRepository({ rootDir: path.join(root, "platform"), kind: "platform.iam", layoutVersion: 2 }),
    identity,
    auditSink: audit,
    email: new MemoryEmailSender(),
    publicOrigin: "https://app.example.test/",
    tenancy: { mode: "multi" }
  });

  async function provision(label: string) {
    const answer = await services.provisioning.run("createAccount", {
      requestId: `create-${label}`,
      email: `${label}@example.test`,
      displayName: label,
      policies: ["FluxIQUserAccess"],
      workspace: "new"
    }, services.provisionerCaller());
    assert.ok(answer.ok, "real account provisioning succeeds");
    assert.equal(answer.result.status, "created");
    if (answer.result.status !== "created") throw new Error("Expected a newly provisioned account.");
    const session = await identity.createSession(answer.result.userId);
    const authenticated = await identity.validateSession(session.id);
    assert.ok(authenticated);
    const actor: ProgramApiActor = {
      sessionId: session.id,
      userId: authenticated.user.id,
      roleId: authenticated.role.id,
      permissions: [...authenticated.role.permissions],
      channel: "panel"
    };
    return { ...answer.result, actor };
  }

  const owner = await provision("owner");
  const other = await provision("other");
  const iam = services.workspaceIam(owner.workspaceId);
  // The non-owner has the same policy here: a refusal must test ownership, not an absent policy.
  await iam.attachPolicy(iamPrincipalFrn("user", owner.workspaceId, other.userId), "FluxIQUserAccess", {
    actor: "in-process",
    origin: "provisioning",
    requestId: "attach-non-owner"
  });
  const workspaceRoot = path.join(root, "workspace");
  await initializeFluxIQStorage(path.join(workspaceRoot, ".fluxiq"));
  fluxiq = FluxIQ.create({
    rootDir: workspaceRoot,
    loadEnv: false,
    modelProvidersEnabled: false,
    iam: { profile: "service", workspaceId: owner.workspaceId, source: iam, audit }
  });
  const instance = fluxiq;
  const fallbackAdmin = (await instance.programs.identityAccess.snapshot()).users.find((user) => user.enabled && user.roleId === "admin");
  assert.ok(fallbackAdmin);
  assert.notEqual(owner.userId, fallbackAdmin.id);
  assert.equal(owner.actor.roleId, "viewer");
  const payload: PlatformHookPayloads["workspace.created"] = {
    accountId: owner.userId,
    workspaceId: owner.workspaceId,
    ownerUserId: owner.userId,
    fluxiq: instance
  };

  async function projects(actor = owner.actor) {
    const response = await instance.programs.api.call<undefined, { projects: AutomationStudioProject[] }>({
      programId: "automation-studio", endpoint: AUTOMATION_STUDIO_ENDPOINTS.projects, scope: {}, actor
    });
    assert.ok(response.ok, response.error);
    assert.ok(response.payload);
    return response.payload.projects;
  }

  async function createOwnedProject(name: string, actor = owner.actor) {
    const response = await instance.programs.api.call<{ name: string }, { project: AutomationStudioProject }>({
      programId: "automation-studio", endpoint: AUTOMATION_STUDIO_ENDPOINTS.createProject, scope: {}, actor, payload: { name }
    });
    assert.ok(response.ok, response.error);
    assert.ok(response.payload);
    return response.payload.project;
  }

  async function readProject(projectId: string, actor = owner.actor) {
    return instance.programs.api.call({
      programId: "automation-studio", endpoint: AUTOMATION_STUDIO_ENDPOINTS.getProjectHierarchy, scope: {}, actor, payload: { projectId }
    });
  }

  return { payload, studio: instance.programs.automationStudio, owner, other, fallbackAdmin, projects, createOwnedProject, readProject };
}
