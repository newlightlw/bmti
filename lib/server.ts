import { env } from "cloudflare:workers";
export function db() {
  if (!env.DB) throw new Error("数据服务暂时不可用");
  return env.DB;
}
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export function cookie(request: Request, name: string) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + "="))
      ?.slice(name.length + 1) || ""
  );
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export function setCookie(
  request: Request,
  name: string,
  value: string,
  age: number,
) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function originOk(r: Request) {
  return r.headers.get("origin") === new URL(r.url).origin;
}
export async function body(r: Request) {
  const text = await r.text();
  if (text.length > 16000) throw new Error("请求过大");
  const result = JSON.parse(text);
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("无效请求");
  return result as Record<string, unknown>;
}
export async function admin(r: Request) {
  const token = cookie(r, "hgp_admin");
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return !!(await db()
    .prepare(
      "SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?",
    )
    .bind(await hash(token), Date.now())
    .first());
}
export async function owner(r: Request) {
  const token = cookie(r, "hgp_visitor");
  return /^[a-f0-9]{64}$/.test(token) ? hash(token) : null;
}
export function adminHash() {
  return (
    (env as unknown as { HGP_ADMIN_HASH?: string }).HGP_ADMIN_HASH ||
    process.env.HGP_ADMIN_HASH ||
    ""
  );
}
