import {
  admin,
  adminHash,
  adminTokens,
  body,
  db,
  hash,
  json,
  originOk,
  randomToken,
  setCookie,
} from "@/lib/server";
import { questions, endpoints } from "@/lib/bmti";
import { legacy } from "@/lib/legacy";
export async function GET(r: Request) {
  if (!(await admin(r))) return json({ authenticated: false }, 401);
  const setting = await db()
    .prepare("SELECT question_count,updated_at FROM settings WHERE id=1")
    .first<{ question_count: number; updated_at: number }>();
  return json({
    authenticated: true,
    questionCount: setting?.question_count ?? 32,
    updatedAt: setting?.updated_at ?? null,
    questions,
    bankCount: questions.length,
    endpoints: endpoints.map((e) => ({
      endpoint: e,
      count: questions.filter((q) => q.endpoint === e).length,
    })),
  });
}
export async function POST(r: Request) {
  if (!originOk(r)) return json({ error: "请求来源不符" }, 403);
  let b: Record<string, unknown>;
  try {
    b = await body(r);
  } catch {
    return json({ error: "请求格式不正确" }, 400);
  }
  if (b.action === "login") {
    const expected = adminHash();
    if (!expected) return json({ error: "管理口令尚未配置" }, 503);
    const ip = r.headers.get("cf-connecting-ip") || "local";
    const key = await hash("login:" + ip),
      now = Date.now();
    await db()
      .prepare(
        "INSERT INTO admin_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END",
      )
      .bind(key, now + 900000, now, now, now + 900000)
      .run();
    const limit = await db()
      .prepare("SELECT count FROM admin_limits WHERE key=?")
      .bind(key)
      .first<{ count: number }>();
    if ((limit?.count ?? 0) > 8)
      return json({ error: "尝试较多，请15分钟后再试" }, 429);
    if (
      typeof b.password !== "string" ||
      b.password.length > 200 ||
      (await hash(b.password)) !== expected
    )
      return json({ error: "管理口令不正确" }, 401);
    const token = randomToken();
    await db().batch([
      db().prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(now),
      db()
        .prepare("DELETE FROM admin_limits WHERE expires_at<=? OR key=?")
        .bind(now, key),
      db()
        .prepare(
          "INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)",
        )
        .bind(await hash(token), now + 8 * 3600000),
    ]);
    return json({ ok: true }, 200, {
      "Set-Cookie": setCookie(r, "bmti_admin", token, 8 * 3600),
    });
  }
  if (!(await admin(r))) return json({ error: "请先登录管理端" }, 401);
  if (b.action === "logout") {
    const hashes = await Promise.all(adminTokens(r).map(hash));
    await db().batch(hashes.map((value) => db()
      .prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(value)));
    const response = json({ ok: true }, 200, {
      "Set-Cookie": setCookie(r, "bmti_admin", "", 0),
    });
    response.headers.append("Set-Cookie", setCookie(r, legacy.adminCookie, "", 0));
    return response;
  }
  if (b.action === "settings") {
    if (
      typeof b.questionCount !== "number" ||
      !Number.isInteger(b.questionCount) ||
      b.questionCount < 8 ||
      b.questionCount > 32
    )
      return json({ error: "抽题数量须为8至32之间的整数" }, 422);
    await db()
      .prepare(
        "INSERT INTO settings(id,question_count,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET question_count=excluded.question_count,updated_at=excluded.updated_at",
      )
      .bind(b.questionCount, Date.now())
      .run();
    return json({ ok: true, questionCount: b.questionCount });
  }
  return json({ error: "未知操作" }, 400);
}
