const hosts = new WeakSet<Node>();

/** Private identity of closed extension UI hosts; attributes and copied DOM never register ownership. */
export const ownedUiHosts = {
  registerClosed(host: Element, root: Pick<ShadowRoot, "host" | "mode">): void {
    if (root.host === host && root.mode === "closed") hosts.add(host);
  },
  ownsHost(node: Node): boolean {
    // Light DOM belongs to the site. A registered host carrying any of it is
    // no longer an exclusively extension-owned mutation surface.
    return hosts.has(node) && node.firstChild === null;
  }
};
