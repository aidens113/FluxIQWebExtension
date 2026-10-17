/**
 * The visitor's account as the fixture starts it, written out by hand from
 * `data/` rather than read off the renderer, in the shape and key order of
 * `qualification/facts.ts`: every collection's posts and every list sorted.
 * Each breadth oracle states its final account as this with only what its
 * task changes, so an act the task never asked for fails it.
 */
export const UNTOUCHED_ACCOUNT = {
  saved: ["D1AanlGg31e", "DFEmtZWQbTS", "DP26z3OqTzW", "DP4wrRICNBO", "DdAML7AgNTw", "Dk0dRQu1fso", "DkQbRmqBxeu", "Dn6ixXoKbtq", "DwKlfYmpVyk", "DzQUdZCuBtE"],
  collections: [
    { name: "Kitchen", slug: "kitchen", codes: ["DFEmtZWQbTS", "DP26z3OqTzW", "DzQUdZCuBtE"] },
    { name: "Studio inspo", slug: "studio-inspo", codes: ["D1AanlGg31e", "DP4wrRICNBO", "DdAML7AgNTw", "DkQbRmqBxeu", "Dn6ixXoKbtq"] },
  ],
  liked: [] as string[],
  following: ["harbourlight.studio", "ines.vidal", "kiln.theory", "kofi.ade", "lena.moss", "maya.hollis", "priya.nair", "saltmarsh.goods", "sofia.lindqvist", "theo.marchetti"],
  outbox: [] as Array<{ thread: string; count: number }>,
  blocked: false,
};
