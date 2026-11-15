import type { ClientGatewayCredentialWriteMetadata } from "@fluxiq/client-gateway-websocket";
import type { HostedCredentialRepository, HostedCredentialSnapshot } from "../model";

export type HostedCredentialTokenStorage = {
  read(): Promise<string>;
  write(token: string, metadata?: ClientGatewayCredentialWriteMetadata): Promise<void>;
};

export type HostedCredentialTokenStorageInput = {
  repository: HostedCredentialRepository;
  snapshot: HostedCredentialSnapshot;
  isCurrent: () => boolean;
};
