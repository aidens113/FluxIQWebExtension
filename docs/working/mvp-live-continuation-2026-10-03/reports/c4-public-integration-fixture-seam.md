# C4 public integration fixture seam

Status: read-only preflight COMPLETE; twelve approved setup owners inspected. Existing public Core APIs are sufficient; no new export or generic public seam required. Worker resume-cd. No source/test/build/provider/browser/state/environment/key/shared-document changes. Sketch below has NOT been compiled or executed.

## Public setup confirmed

`fluxiq/automation-studio` publicly exports AutomationStudioService and AutomationStudioNativeNodeRuntime through its runtime barrel. The package also exposes `fluxiq/automation-studio/nodes`, `fluxiq/io`, and `fluxiq/core`; downstream must use those public package imports, never Core internal source/test paths.

Service construction accepts typed dataDir/storageRootDir, llmProviderResolver and llmEvidenceRuntime. It creates its own default memory repositories and, with a storage root, project SQLite storage. Therefore the fixture needs no public storage factory and no new export. A temporary fixture root plus ordinary public project/Flow save APIs suffices; service.close() owns closure.

AutomationStudioNativeNodeRuntime.register(manifest, bundle) validates manifest/bundle identity and implementation keys, installs node definitions and parameter contracts, and supplies registry resolution from explicit grants. Service.bindNativeNodeRuntime binds this library/execution runtime; bindIoRuntime binds the IO registry. Existing public API is sufficient for library installation; exact downstream ordinary saved-run implementation setup is the remaining read.

The actual downstream createWebAutomationLlmEvidenceRuntime(gateway) accepts WebLlmEvidenceGateway with eligibleSessionIds() and typed executeAction(sessionId,{actionType,parameters,metadata}). All commands pass through its normal check-wait wrapper. Its native runsNodes path uses the domain node catalog and ordinary permissions; scripted gateway support may record/mutate authored fixture state but must never bypass the actual adapter.

## Captured start and actual dispatch

Service reauthoring forwards captured repairStartPages to extend-subject. The reauthor owner calls automationStudioRunNodeStartPages(detail). No fake ranWith/start token or unchecked result is proposed.

The approved expansions now establish the actual chain: the downstream native manifest/bundle factories emit policy.output.dispatch; ordinary domain IO uses real manifest output definitions, including elementTarget and recordsPath metadata. Host runtime capture requests capture_snapshot with node/attempt/point metadata and reads the dispatched payload.result.snapshot. Its resetToken produces {location} only for a whole screened HTTP(S) URL with no credentials/withheld components. Core captures this boundary at before_action; run-start-pages extracts ONLY metadata.stateRefs.beforeAction.from from each node's FIRST attempt, cloning the token, and reauthor forwards it to extend seeding. A failed first capture cannot borrow a later retry's start.

The host factory accepts an injected typed dispatch callback, and evidence factory an injected typed gateway. Both can share one authored state-changing page fixture. This avoids constructing a FluxIQ client gateway while exercising the actual host capture and actual evidence adapter. Initial saved execution uses the actual native bundle plus normal policy output dispatch. Public fluxiq/io exports IoRegistry, defineDomainIo, defineOutput, OutputAdapter and typed requests/results. IoRegistry.register accepts the resulting registration. Fixture IO registration must retain actual manifest metadata and target policy.

## Smallest typed setup sketch

Place the combined test at `domain/src/runtime/llm-evidence/tests/carried-service-repair.test.ts`, with local typed support at that owner only if size warrants a separately released helper. Imports from Core must be public package imports. Local factory imports should use existing nearest barrels where available; no Core source/test paths.

```ts
import {
  AutomationStudioService, AutomationStudioNativeNodeRuntime,
  type AutomationStudioServiceOptions
} from "fluxiq/automation-studio";
import { IoRegistry, defineDomainIo, defineOutput } from "fluxiq/io";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, type WebLlmEvidenceGateway } from "../index";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeGateway } from "../../host-runtime";
import {
  createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS, WEB_AUTOMATION_RUNTIME_CAPABILITIES
} from "../../../output-nodes";
import { webAutomationManifestOutputs } from "../../../io/manifest-definitions";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../constants";

type ScriptedClientResult = Awaited<ReturnType<WebLlmEvidenceGateway["executeAction"]>>;
type FixtureCommand = (actionType: string, parameters: JsonObject) => Promise<ScriptedClientResult>;
type FixtureSetup = {
  dataDir: string;
  command: FixtureCommand;
  resolveProvider: NonNullable<AutomationStudioServiceOptions["llmProviderResolver"]>;
};

function setup({ dataDir, command, resolveProvider }: FixtureSetup) {
  const io = new IoRegistry();
  const hostGateway: WebAutomationHostRuntimeGateway = {
    dispatch: async ({ outputId, payload }) => {
      const result = await command(outputId, payload);
      return {
        ok: result.status === "succeeded", outputId,
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        payload: { result: result.payload ?? {} },
        ...(result.error === undefined ? {} : { error: result.error })
      };
    }
  };
  io.register(defineDomainIo({
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    outputs: webAutomationManifestOutputs.map((definition) =>
      defineOutput<JsonObject, JsonObject>({
        definition, mode: "request",
        dispatch: ({ outputId, payload, metadata }) =>
          hostGateway.dispatch({ outputId, payload, ...(metadata ? { metadata } : {}) })
      }))
  }));
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["fixture.session"],
    executeAction: (_sessionId, request) => command(request.actionType, request.parameters)
  };
  const native = new AutomationStudioNativeNodeRuntime({
    permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS,
    runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES
  }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  return new AutomationStudioService({
    dataDir, seedFixture: false, llmProviderResolver: resolveProvider,
    llmEvidenceRuntime: createWebAutomationLlmEvidenceRuntime(gateway),
    hostRuntime: createWebAutomationHostRuntime(hostGateway)
  }).bindIoRuntime(io, WEB_AUTOMATION_DOMAIN_ID).bindNativeNodeRuntime(native);
}
```

This sketch deliberately uses a scripted successful command client for the positive fixture, while dispatching through the REAL native implementations/IO policy/host capture/authoring adapter. It is not a replacement production gateway adapter: failed-command status/failure promotion should use the existing actual dispatcher in any fixture exercising command transport failures. Permission-denial tests must assert refusal before command invocation, not rely on the sketch's success wrapper. It has no inputs because the fixture tests saved native output execution, not recording/input confirmation.

The command function must record every call, mutate authored page state for navigation/click/type, and return current snapshots for capture. Snapshot returns `payload.snapshot`; native IO/host wrap that under `payload.result.snapshot`, while evidence adapter receives the ordinary client payload directly. An authored fixture HTTP(S) address yields the actual host-produced reset token; never write metadata.stateRefs or ranWith by hand. For selector-required actions include valid authored fingerprint/target data alongside the canonical selector and use real webAutomationManifestOutputs metadata. Do not delete elementTarget, skip permission validation, or add host capability merely to obtain a passing fixture.

## Exact regression sequence and evidence boundary

Create project/parent/primary graph/instruction through public service APIs, using their parameter types directly. Persist canonical unchanged click then faulty binding-bearing read/type, explicit consequences, provenance and routing. Register the actual domain library above. Ordinary saved execution produces beforeAction.from on its first attempts and a wrong authored output. The scripted provider/judge refutes this actual output and asks for ordinary extend repair. Provider edits only the faulty step; NO proactive rerun/check of the untouched click.

Before implementation, completion must fail full_run_required with no qualifying untouched replay. After implementation, recorded commands must prove a fresh reset/navigation followed by unchanged canonical click and repaired step in order before accepting judge; binding fallback/row mapping is resolved through ordinary Core mapping, not inside the fake client. Assert actual changed fixture output, accepted/apply/persisted declarations and unchanged provider-free reuse. Negative cases: changed candidate invalidates old arguments, absent first captured start cannot borrow later capture, unresolved binding refuses, permission refusal sends no action, lasting verify performs no mutation and creates no historical proof.

This settles setup availability, not test behavior: no compilation or fail-first run occurred. Scripted page state proves real dispatcher/adapter plumbing against an authored fixture, not browser DOM semantics. Later supervisor live testing remains necessary. No new public Core export is needed. The only outstanding release is the exact combined test/support file partition plus the C4 implementation owners, after current live freeze/gates.

## Read budget

Initial six files: Core packages/fluxiq/package.json; runtime/index.ts; runtime/service.ts (options/constructor/bind and named start forwarding sections only); runtime/native-node-runtime.ts; downstream domain/src/runtime/llm-evidence/capture.ts (gateway contract); tools.ts (factory/catalog/setup sections). Public nodes barrel export lines and filename/content discovery were bounded rg checks. One PowerShell brace-list parser rejection was corrected before source reading; no mutation occurred.

Approved expansion six: Core runtime/llm/node-tools/run-start-pages.ts; Core src/io/index.ts (public registration/type section only); downstream output-nodes/native-runtime.ts, io/manifest-definitions.ts, runtime/host-runtime.ts and io/web-automation-io.ts. Exact path existence checked by bounded discovery. No additional source owner read. A mistaken nonnumeric Select-Object Skip was corrected before host source inspection; no mutation occurred. Report/source investigation now frozen.
