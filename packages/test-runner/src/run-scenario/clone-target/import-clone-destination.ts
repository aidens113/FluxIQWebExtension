import { assertClonePackage, canonicalClonePackageJson, type ClonePackage } from "@fluxiq-web-extension/test-contracts";
import { sha256 } from "@fluxiq-web-extension/test-evidence";
import { createDeterministicCloneIdMap } from "../../clone-policy.js";
import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import { createRunOwnedCloneFlowId, createRunOwnedCloneProject, importClonePackageIntoIsolatedDestination, type IsolatedDestinationControl } from "../../isolated-flow-importer.js";
import type { CloneRunState } from "../../run-manifest/index.js";
import { cloneDestinationAssessment } from "./clone-destination-assessment.js";

/** The destination Core's control, as much of it as the import uses. */
export type CloneDestinationControl = IsolatedDestinationControl & Pick<ExistingFluxIQControlClient, "listNativeNodeDefinitions" | "selectExistingContext">;

export type CloneDestinationImport = {
  control: CloneDestinationControl;
  /** The isolated Core's own project, whose node definitions the clone must find. */
  projectId: string | undefined;
  authorizationPin: string;
  runId: string;
  /** The run's clone record: the package is remapped for the destination and stored here, with its hash and the destination. */
  cloneState: CloneRunState;
  /** The package as the source export made it. */
  clonePackage: ClonePackage;
  bundle: { writeStructured(relativePath: string, value: unknown): Promise<unknown> };
  /** Called with the destination project as soon as the import holds and before it is selected, so the run's cleanup reads the destination even when what follows fails. */
  useDestinationProject(projectId: string): void;
};

/**
 * Brings the exported source Flow into this run's isolated Core: refuses a
 * destination that lacks a safe node definition the Flow needs, creates the
 * run-owned project and Flow id, remaps the package's ids onto them, imports
 * and attests it, hands the run the destination project, selects it, and
 * records the package and the import in the bundle.
 */
export async function importCloneDestination(input: CloneDestinationImport): Promise<void> {
  const { control, authorizationPin, runId, cloneState, clonePackage } = input;
  const destinationDefinitions = await control.listNativeNodeDefinitions(input.projectId ?? "");
  const destinationAssessment = cloneDestinationAssessment(clonePackage, destinationDefinitions);
  if (destinationAssessment.compatibility.verdict !== "compatible") {
    throw new RunnerFailure("environment.missing", "Isolated Core does not provide every safe node definition required by the cloned Flow");
  }
  const destinationProject = await createRunOwnedCloneProject(control, { runId, sourceContentHash: clonePackage.source.contentHash, authorizationPin });
  const destinationFlowId = createRunOwnedCloneFlowId({ runId, sourceProjectId: clonePackage.source.projectId, sourceFlowId: clonePackage.source.flowId, sourceContentHash: clonePackage.source.contentHash });
  const remapped: ClonePackage = {
    ...clonePackage,
    idMap: createDeterministicCloneIdMap(clonePackage.flowDocument, { projectId: destinationProject.projectId, flowId: destinationFlowId }),
  };
  cloneState.clonePackage = remapped;
  assertClonePackage(remapped);
  cloneState.clonePackageHash = sha256(canonicalClonePackageJson(remapped));
  const destination = await importClonePackageIntoIsolatedDestination(control, { clonePackage: remapped, destinationProjectId: destinationProject.projectId, authorizationPin });
  cloneState.destination = destination;
  input.useDestinationProject(destination.projectId);
  await control.selectExistingContext(destination.projectId);
  await input.bundle.writeStructured("snapshots/clone-package.json", remapped);
  await input.bundle.writeStructured("snapshots/clone-import.json", { projectId: destination.projectId, flowId: destination.flowId, contentHash: destination.contentHash, clonePackageHash: cloneState.clonePackageHash, attested: destination.attested });
}
