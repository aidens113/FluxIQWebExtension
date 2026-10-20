// The session the runtime adapter drives, by the one web session rule
// (`../web-sessions/pick-web-session.ts`): an action and a snapshot go to the
// only ready, idle extension; a second session that is unpaired, merely
// connected or recording no longer blocks the choice and is never chosen; a
// requested session is used only when it is eligible.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { FluxIQRuntimeCommand } from "fluxiq/runtime";
import { createWebAutomationRuntimeAdapter } from "../adapter";

function session(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    clientId: `client-${sessionId}`,
    status: "ready",
    clientType: "extension",
    capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"], metadata: { domainId: "web-automation" } }],
    ...overrides
  };
}

const unpaired = session("unpaired", { status: "pairing_required" });
const connectedOnly = session("connected-only", { status: "connected" });
const recording = session("recording", { activeRecordingId: "rec-1" });

function adapterOver(sessions: unknown[]) {
  const driven: string[] = [];
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({ sessions }),
        captureSnapshot: async (sessionId: string) => {
          driven.push(`snapshot ${sessionId}`);
        }
      },
      automationStudioClientGateway: {
        executeAction: async (sessionId: string) => {
          driven.push(`action ${sessionId}`);
          return { commandId: "client.command", status: "succeeded" };
        }
      }
    }
  } as unknown as FluxIQ;
  return { adapter: createWebAutomationRuntimeAdapter({ fluxiq }), driven };
}

const click: FluxIQRuntimeCommand = { kind: "execute_action", commandId: "command.click", outputId: "web.dom.click", parameters: { selector: "#save" } };
const look = (metadata?: Record<string, string>): FluxIQRuntimeCommand => ({ kind: "capture_snapshot", commandId: "command.look", ...(metadata ? { metadata } : {}) });

test("an unpaired, merely connected or recording second session neither blocks nor receives an action or a snapshot", async () => {
  const { adapter, driven } = adapterOver([unpaired, connectedOnly, recording, session("ready")]);
  assert.equal((await adapter.execute(click, {})).status, "succeeded");
  assert.equal((await adapter.captureSnapshot!(look(), {})).status, "succeeded");
  assert.deepEqual(driven, ["action ready", "snapshot ready"]);
});

test("with only sessions a build may not drive, nothing is sent", async () => {
  const { adapter, driven } = adapterOver([unpaired, connectedOnly, recording]);
  assert.notEqual((await adapter.execute(click, {})).status, "succeeded");
  assert.equal((await adapter.captureSnapshot!(look(), {})).status, "rejected");
  assert.deepEqual(driven, []);
});

test("a requested session is used only when it is eligible", async () => {
  const { adapter, driven } = adapterOver([session("one"), session("two"), unpaired]);
  assert.equal((await adapter.captureSnapshot!(look({ sessionId: "two" }), {})).status, "succeeded");
  assert.equal((await adapter.captureSnapshot!(look({ sessionId: "unpaired" }), {})).status, "rejected");
  assert.equal((await adapter.captureSnapshot!(look(), {})).status, "rejected", "two eligible and no request is a choice, never a guess");
  assert.deepEqual(driven, ["snapshot two"]);
});
