import { execFile } from "node:child_process";
import path from "node:path";

export type PrivatePathKind = "directory" | "file";
export type NativeExec = (file: string, args: readonly string[]) => Promise<{ stdout: string; stderr: string }>;

let processIdentity: Promise<{ account: string; sid: string }> | undefined;

export type WindowsAclOptions = {
  platform?: NodeJS.Platform;
  systemRoot?: string;
  exec?: NativeExec;
};

/**
 * Removes inherited ACLs, grants only the current SID, removes every other
 * principal the path still names, then verifies and inspects the resulting ACL.
 */
export async function hardenWindowsPrivatePath(target: string, kind: PrivatePathKind, options: WindowsAclOptions = {}): Promise<void> {
  if ((options.platform ?? process.platform) !== "win32") return;
  const resolvedTarget = path.resolve(target);
  const systemRoot = options.systemRoot ?? process.env.SystemRoot ?? "C:\\Windows";
  if (!path.win32.isAbsolute(systemRoot)) throw new Error("Windows SystemRoot must be absolute for ACL hardening");
  const execute = options.exec ?? nativeExec;
  const whoami = path.win32.join(systemRoot, "System32", "whoami.exe");
  const icacls = path.win32.join(systemRoot, "System32", "icacls.exe");
  // The account a process runs as does not change while it runs, so the real
  // lookup is made once; an injected `exec` is asked every time.
  const identity = options.exec === undefined
    ? await (processIdentity ??= execute(whoami, ["/user", "/fo", "csv", "/nh"]).then(parseWhoami).catch((error: unknown) => { processIdentity = undefined; throw error; }))
    : parseWhoami(await execute(whoami, ["/user", "/fo", "csv", "/nh"]));
  const grant = `*${identity.sid}:${kind === "directory" ? "(OI)(CI)F" : "F"}`;
  await execute(icacls, [resolvedTarget, "/inheritance:r", "/grant:r", grant]);
  // `/inheritance:r` drops only inherited entries. A path created under a
  // directory whose own entries are explicit (this machine's %TEMP% names
  // SYSTEM and Administrators explicitly) is born with explicit copies of
  // them, which survive it; each is removed by name, and the check below
  // still refuses anything left.
  const strays = aclPrincipals((await execute(icacls, [resolvedTarget])).stdout, resolvedTarget).filter(principal => !isCurrentUser(principal, identity));
  if (strays.length > 0) await execute(icacls, [resolvedTarget, "/remove", ...strays]);
  await execute(icacls, [resolvedTarget, "/verify"]);
  const listing = await execute(icacls, [resolvedTarget]);
  verifyExclusiveAcl(listing.stdout, resolvedTarget, identity);
}

function parseWhoami(result: { stdout: string; stderr: string }): { account: string; sid: string } {
  const match = /^"((?:[^"]|"")*)","(S-1-(?:\d+-)+\d+)"\s*$/iu.exec(result.stdout.trim());
  if (!match?.[1] || !match[2]) throw new Error("Unable to resolve the current Windows account SID for ACL hardening");
  return { account: match[1].replaceAll('""', '"'), sid: match[2] };
}

function verifyExclusiveAcl(output: string, target: string, identity: { account: string; sid: string }): void {
  const principals = aclPrincipals(output, target);
  if (principals.length === 0 || principals.some(principal => !isCurrentUser(principal, identity))) {
    throw new Error("Windows auth-cache ACL verification did not prove exclusive current-user access");
  }
}

/** The principals an `icacls <path>` listing names, spelled as it spells them. */
function aclPrincipals(output: string, target: string): string[] {
  return output.split(/\r?\n/u).flatMap((line, index) => {
    const acl = index === 0 && line.toLowerCase().startsWith(target.toLowerCase()) ? line.slice(target.length) : line;
    const marker = acl.indexOf(":(");
    return marker < 0 ? [] : [acl.slice(0, marker).trim()];
  }).filter(Boolean);
}

function isCurrentUser(principal: string, identity: { account: string; sid: string }): boolean {
  const spelled = principal.toLowerCase();
  return spelled === identity.account.toLowerCase() || spelled === identity.sid.toLowerCase() || spelled === `*${identity.sid}`.toLowerCase();
}

function nativeExec(file: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, [...args], { encoding: "utf8", windowsHide: true, shell: false }, (error, stdout, stderr) => {
      if (error) reject(new Error(`Native Windows ACL command failed (${path.win32.basename(file)})`, { cause: error }));
      else resolve({ stdout, stderr });
    });
  });
}
