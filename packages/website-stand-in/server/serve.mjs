// The stand-in HTTP server: static pages plus the sign-up API.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createSignupHandler } from "./signup/index.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon",
  ".webp": "image/webp", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff"
};
const MAX_BODY = 32 * 1024;

function send(res, r) {
  res.writeHead(r.status, { "cache-control": "no-store", ...r.headers });
  res.end(r.body);
}

function notFound(res) {
  send(res, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Not found" });
}

function readBody(req) {
  return new Promise((done) => {
    const chunks = [];
    let size = 0;
    let over = false;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) over = true;
      else chunks.push(c);
    });
    req.on("end", () => done(over ? null : Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => done(null));
  });
}

async function serveStatic(root, req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://x.invalid").pathname); } catch { return notFound(res); }
  if (pathname.includes("\0") || pathname.includes("\\")) return notFound(res);
  if (pathname.split("/").some((s) => s.startsWith("."))) return notFound(res);
  let file = resolve(root, "." + pathname);
  if (file !== root && !file.startsWith(root + sep)) return notFound(res);
  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      if (!pathname.endsWith("/")) return send(res, { status: 301, headers: { location: pathname + "/" }, body: "" });
      file = resolve(file, "index.html");
      info = await stat(file);
    }
    if (!info.isFile()) return notFound(res);
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    notFound(res);
  }
}

export function createSiteServer({ config, publicDir, log = () => {}, fetchImpl = fetch, now = Date.now }) {
  const root = resolve(publicDir);
  const handler = createSignupHandler({ config, log, fetchImpl, now });
  return createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/api/signup/config" && req.method === "GET") return send(res, handler.config());
    if ((path === "/api/signup" || path === "/api/signup/resend") && req.method === "POST") {
      const rawBody = await readBody(req);
      if (rawBody === null) return send(res, { status: 413, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false }) });
      const request = { headers: req.headers, remoteAddress: req.socket.remoteAddress, rawBody };
      return send(res, await (path === "/api/signup" ? handler.signup(request) : handler.resend(request)));
    }
    if (path.startsWith("/api/")) return send(res, { status: 404, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false }) });
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, { status: 405, headers: { allow: "GET, HEAD, POST" }, body: "" });
    return serveStatic(root, req, res);
  });
}
