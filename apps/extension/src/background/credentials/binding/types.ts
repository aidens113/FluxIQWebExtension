declare const checked: unique symbol;

export type HostedCredentialAudience = Readonly<{
  origin: string;
  instanceId: string;
  gatewayUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl: string;
}>;

export type HostedCredentialBinding = HostedCredentialAudience & { readonly [checked]: true };
