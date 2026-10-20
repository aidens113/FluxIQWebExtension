// The session an output is sent to, by the one web session rule
// (`../../runtime/web-sessions/pick-web-session.ts`): an unpaired, merely
// connected or recording second session no longer blocks the dispatch and is
// never sent to; a requested session is used only when it is eligible.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";

function session(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    clientId: `client-${sessionId}`,
    status: "ready",
    clientType: "extension",
    capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"], metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID } }],
    ...overrides
  };
}

const unpaired = session("unpaired", { status: "pairing_required" });
const connectedOnly = session("connected-only", { status: "connected" });
const recording = session("recording", { activeRecordingId: "rec-1" });

async function dispatchTo(sessions: unknown[], metadata?: JsonObject): Promise<{ ok: boolean; sentTo: string[] }> {
  const sentTo: string[] = [];
  const fluxiq = {
    programs: {
      clientGateway: { snapshot: () => ({ sessions }) },
      automationStudioClientGateway: {
        executeAction: async (sessionId: string) => {
          sentTo.push(sessionId);
          return { commandId: "client.command", status: "succeeded" };
        }
      }
    }
  } as unknown as FluxIQ;
  const result = await dispatchWebAutomationOutput(fluxiq, {
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    outputId: "web.dom.click",
    payload: { selector: "#save" },
    ...(metadata ? { metadata } : {})
  });
  return { ok: result.ok, sentTo };
}

test("an unpaired, merely connected or recording second session neither blocks the dispatch nor receives it", async () => {
  assert.deepEqual(await dispatchTo([unpaired, connectedOnly, recording, session("ready")]), { ok: true, sentTo: ["ready"] });
});

test("only sessions a build may not drive is a refusal, and nothing is sent", async () => {
  assert.deepEqual(await dispatchTo([unpaired, connectedOnly, recording]), { ok: false, sentTo: [] });
});

test("a requested session is used only when it is eligible", async () => {
  const sessions = [session("one"), session("two"), unpaired];
  assert.deepEqual(await dispatchTo(sessions, { sessionId: "two" }), { ok: true, sentTo: ["two"] });
  assert.deepEqual(await dispatchTo(sessions, { sessionId: "unpaired" }), { ok: false, sentTo: [] });
  assert.deepEqual(await dispatchTo(sessions), { ok: false, sentTo: [] }, "two eligible and no request is a choice, never a guess");
});
