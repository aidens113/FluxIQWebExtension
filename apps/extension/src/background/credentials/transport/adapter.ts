import type { ClientGatewayCredentialWriteMetadata } from "@fluxiq/client-gateway-websocket";
import type { BoundHostedCredentials, HostedCredentialSnapshot } from "../model";
import { hostedCredentialTransportBoundary } from "./boundary";
import { HostedCredentialTransportError } from "./failure";
import { hostedCredentialOperationId } from "./operation";
import { hostedReadyResponse } from "./ready";
import { matchesHostedCredentialResponse } from "./replay";
import { scopedCredentialSnapshot, type HostedCredentialScope } from "./scope";
import type { HostedCredentialTokenStorage } from "./types";

export class HostedCredentialTokenStorageAdapter implements HostedCredentialTokenStorage {
  private generation = 0;
  private hello: { generation: number; snapshot: HostedCredentialSnapshot } | undefined;

  constructor(private readonly port: BoundHostedCredentials, private readonly scope: HostedCredentialScope, private readonly isCurrent: () => boolean) {
    this.requireCurrent();
  }

  read(): Promise<string> {
    return hostedCredentialTransportBoundary(async () => {
      this.requireCurrent();
      const generation = ++this.generation;
      this.hello = undefined;
      const loaded = await this.port.read();
      this.requireCurrent(generation);
      const snapshot = scopedCredentialSnapshot(this.scope, loaded);
      this.hello = { generation, snapshot };
      return snapshot.credential;
    });
  }

  write(token: string, metadata?: ClientGatewayCredentialWriteMetadata): Promise<void> {
    return hostedCredentialTransportBoundary(async () => {
      this.requireCurrent();
      const hello = this.hello;
      if (!hello) throw new HostedCredentialTransportError("hello_required");
      this.requireCurrent(hello.generation);
      const { messageId, response } = hostedReadyResponse(this.scope, token, metadata);
      this.requireCurrent(hello.generation);
      const operationId = await hostedCredentialOperationId(messageId);
      this.requireCurrent(hello.generation);
      const loaded = await this.port.read();
      this.requireCurrent(hello.generation);
      const current = scopedCredentialSnapshot(this.scope, loaded);
      // N-1 cannot write over N: only an existing exact receipt can confirm this replay.
      const expectedRevision = matchesHostedCredentialResponse(current, response) ? current.revision - 1 : hello.snapshot.revision;
      this.requireCurrent(hello.generation);
      const committed = await this.port.commit({ expectedRevision, operationId, kind: "rotation", response });
      this.requireCurrent(hello.generation);
      scopedCredentialSnapshot(this.scope, committed);
      this.requireCurrent(hello.generation);
      const reloaded = await this.port.read();
      this.requireCurrent(hello.generation);
      const latest = scopedCredentialSnapshot(this.scope, reloaded);
      if (latest.revision !== committed.revision || !matchesHostedCredentialResponse(latest, response)) throw new HostedCredentialTransportError("credential_changed");
    });
  }

  private requireCurrent(generation?: number): void {
    try {
      if (typeof this.isCurrent !== "function" || this.isCurrent() !== true || generation !== undefined && generation !== this.generation) throw new HostedCredentialTransportError("selection_changed");
    } catch {
      throw new HostedCredentialTransportError("selection_changed");
    }
  }
}
