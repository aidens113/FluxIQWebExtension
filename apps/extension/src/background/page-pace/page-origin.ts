/** The origin of an http or https document address, which is what the pace keys a load by; `undefined` for anything else, which is not paced. */
export function originOf(address: string | undefined): string | undefined {
  if (address === undefined || !URL.canParse(address)) return undefined;
  const url = new URL(address);
  return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
}
