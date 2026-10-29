import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env";
import * as test from "../app/api/test/route";
import * as admin from "../app/api/admin/route";

process.umask(0o077);
const directory = dirname(fileURLToPath(import.meta.url));
const origin = process.env.HGP_PUBLIC_ORIGIN;
if (!origin || new URL(origin).origin !== origin || !/^https?:/.test(origin))
  throw new Error("HGP_PUBLIC_ORIGIN must be an exact http(s) origin");
if (!/^[a-f0-9]{64}$/.test(process.env.HGP_ADMIN_HASH || ""))
  throw new Error("HGP_ADMIN_HASH must be configured");
const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT is invalid");
const types: Record<string, string> = {
  js: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  woff2: "font/woff2",
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url || "/", origin);
    if (url.pathname === "/api/health") {
      if (incoming.method !== "GET") {
        outgoing.writeHead(405).end();
        return;
      }
      await env.DB.prepare("SELECT 1").first();
      outgoing
        .writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        })
        .end(
          JSON.stringify({
            status: "ok",
            runtime: "node-sqlite",
            version: "HGP-0.2",
          }),
        );
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const routes =
        url.pathname === "/api/test"
          ? test
          : url.pathname === "/api/admin"
            ? admin
            : null;
      const handler = routes?.[incoming.method as keyof typeof routes];
      if (typeof handler !== "function") {
        outgoing
          .writeHead(routes ? 405 : 404, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          })
          .end(
            JSON.stringify({ error: routes ? "不支持此操作" : "接口不存在" }),
          );
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of incoming) {
        bytes += chunk.length;
        if (bytes > 16384) {
          outgoing
            .writeHead(413, { "Content-Type": "application/json" })
            .end(JSON.stringify({ error: "请求过大" }));
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined)
          headers.set(name, Array.isArray(value) ? value.join(",") : value);
      }
      // Nginx overwrites this header with the direct client address; the app only binds loopback.
      if (!headers.has("cf-connecting-ip"))
        headers.set(
          "cf-connecting-ip",
          incoming.socket.remoteAddress || "local",
        );
      const request = new Request(url, {
        method: incoming.method,
        headers,
        ...(bytes > 0 ? { body: Buffer.concat(chunks) } : {}),
      });
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      outgoing.writeHead(405).end();
      return;
    }
    let file: string;
    if (url.pathname === "/") file = join(directory, "client/index.html");
    else if (url.pathname === "/admin" || url.pathname === "/admin/")
      file = join(directory, "client/admin/index.html");
    else if (/^\/assets\/[a-zA-Z0-9._-]+$/.test(url.pathname))
      file = join(directory, "client", url.pathname);
    else {
      outgoing.writeHead(404).end("Not found");
      return;
    }
    let data: Buffer;
    try {
      data = await readFile(file);
    } catch {
      outgoing.writeHead(404).end("Not found");
      return;
    }
    const ext = file.split(".").pop()!;
    const headers = {
      "Content-Type":
        ext === "html"
          ? "text/html; charset=utf-8"
          : types[ext] || "application/octet-stream",
      "Cache-Control":
        ext === "html" ? "no-store" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
    };
    outgoing.writeHead(200, headers);
    outgoing.end(incoming.method === "HEAD" ? undefined : data);
  } catch (error) {
    console.error(
      "HGP request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    if (!outgoing.headersSent)
      outgoing.writeHead(500, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
    outgoing.end(JSON.stringify({ error: "服务暂时不可用，请稍后重试" }));
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, "127.0.0.1", () =>
  console.log(`HGP listening on 127.0.0.1:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    server.close(() => {
      env.DB.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
