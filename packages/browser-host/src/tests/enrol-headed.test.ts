import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { FluxIQHostLaunchRequest } from "fluxiq/server";
import { launchHost } from "../launch-host.js";
import { listProcesses } from "../reaper/index.js";
import { startFakeGateway } from "./fake-gateway.js";

const EXTENSION = fileURLToPath(new URL("../../../../apps/extension/dist/chrome", import.meta.url));

/** The extension build must forward an enrolment ticket (`enrolmentTicket` in its bundle); an older build cannot take part. */
function skipReason(): string | false {
  try {
    if (!statSync(EXTENSION).isDirectory()) return `no extension build at ${EXTENSION}`;
  } catch {
    return `no extension build at ${EXTENSION}`;
  }
  return bundleMentions(EXTENSION, "enrolmentTicket") ? false : "the extension build does not forward enrolmentTicket yet";
}

function bundleMentions(directory: string, needle: string): boolean {
  return readdirSync(directory, { withFileTypes: true }).some(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return bundleMentions(full, needle);
    return /\.(?:js|mjs)$/u.test(entry.name) && readFileSync(full, "utf8").includes(needle);
  });
}

test("a headed host sends its ticket in the hello exactly once and never on a command line", { skip: skipReason(), timeout: 120_000 }, async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "fx-host-headed-"));
  const ticket = `fxet_${"a".repeat(43)}`;
  let taken = 0;
  const gateway = await startFakeGateway(message => (message.type === "client.hello" ? { type: "server.error", payload: { code: "enrolment.unknown" } } : undefined));
  const request: FluxIQHostLaunchRequest = {
    hostId: "host-1", gatewayUrl: gateway.url, coreApiUrl: "http://127.0.0.1:1", dataDir, profile: { kind: "fresh" }, headless: false,
    takeEnrolmentTicket: () => {
      taken++;
      return ticket;
    },
    signal: new AbortController().signal
  };
  let commandLines: string[] = [];
  try {
    await assert.rejects(
      launchHost(request, { extensionPath: EXTENSION, connectTimeoutMs: 20_000, onContext: async () => {
          commandLines = (await listProcesses()).map(entry => entry.commandLine).filter(line => line.includes("fluxiq-host-host-1-"));
        }
      }),
      { code: "enrolment.unknown" }
    );
    const hellos = gateway.received.filter(message => message.type === "client.hello");
    assert.equal(hellos.length, 1, "one hello");
    assert.equal(hellos[0]?.payload?.["enrolmentTicket"], ticket, "the hello carries the ticket");
    assert.equal(taken, 1, "one ticket was taken");
    assert.equal(commandLines.some(line => line.includes(ticket)), false, "no command line carries the ticket");
    assert.ok(commandLines.length > 0, "the browser's command lines were inspected");
  } finally {
    await gateway.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
