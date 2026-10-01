import { parsedUrl } from "../../shared/parsed-url";

/** The origin of an http or https document address, which is what the pace keys a load by; `undefined` for anything else, which is not paced. */
export function originOf(address: string | undefined): string | undefined {
  const url = address === undefined ? undefined : parsedUrl(address);
  return url === undefined ? undefined : url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
}
