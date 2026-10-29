import {
  body,
  db,
  hash,
  json,
  originOk,
  owner,
  randomToken,
  setCookie,
  visitorToken,
} from "@/lib/server";
import {
  drawQuestions,
  makeReport,
  questions,
  VERSION,
  type Answer,
} from "@/lib/bmti";
export async function GET(r: Request) {
  const url = new URL(r.url),
    id = url.searchParams.get("id");
  if (id) {
    const user = await owner(r);
    if (!user) return json({ error: "这份记录不存在或不属于当前浏览器" }, 404);
    const row = await db()
      .prepare("SELECT * FROM attempts WHERE id=? AND owner=? AND expires_at>?")
      .bind(id, user, Date.now())
      .first<{
        id: string;
        nickname: string;
        question_ids: string;
        answers: string | null;
        report: string | null;
      }>();
    if (!row) return json({ error: "记录已过期或不属于当前浏览器" }, 404);
    const ids = JSON.parse(row.question_ids) as string[];
    return json({
      id: row.id,
      nickname: row.nickname,
      questions: ids.map((i) => {
        const q = questions.find((q) => q.id === i)!;
        return { id: q.id, text: q.text };
      }),
      answers: row.answers ? JSON.parse(row.answers) : null,
      report: row.report ? JSON.parse(row.report) : null,
    });
  }
  const setting = await db()
    .prepare("SELECT question_count FROM settings WHERE id=1")
    .first<{ question_count: number }>();
  return json({
    questionCount: setting?.question_count ?? 32,
    version: VERSION,
    bankCount: questions.length,
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
  if (b.action === "start") {
    if (
      typeof b.nickname !== "string" ||
      b.nickname.trim().length < 1 ||
      b.nickname.trim().length > 24 ||
      /[\u0000-\u001f\u007f]/.test(b.nickname)
    )
      return json({ error: "请输入1—24个字符的昵称" }, 422);
    const existing = visitorToken(r);
    const token = /^[a-f0-9]{64}$/.test(existing) ? existing : randomToken();
    const user = await hash(token),
      now = Date.now();
    const count = await db()
      .prepare(
        "SELECT COUNT(*) AS n FROM attempts WHERE owner=? AND created_at>?",
      )
      .bind(user, now - 3600000)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 20)
      return json({ error: "测试次数较多，请稍后再试" }, 429);
    const setting = await db()
      .prepare("SELECT question_count FROM settings WHERE id=1")
      .first<{ question_count: number }>();
    const selected = drawQuestions(setting?.question_count ?? 32);
    const id = crypto.randomUUID();
    await db().batch([
      db().prepare("DELETE FROM attempts WHERE expires_at<?").bind(now),
      db()
        .prepare(
          "INSERT INTO attempts(id,owner,nickname,question_ids,created_at,expires_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          id,
          user,
          b.nickname.trim(),
          JSON.stringify(selected.map((q) => q.id)),
          now,
          now + 30 * 86400000,
        ),
    ]);
    return json(
      {
        id,
        nickname: b.nickname.trim(),
        questions: selected.map((q) => ({ id: q.id, text: q.text })),
      },
      200,
      { "Set-Cookie": setCookie(r, "bmti_visitor", token, 30 * 86400) },
    );
  }
  if (b.action === "submit") {
    const user = await owner(r);
    if (!user || typeof b.id !== "string")
      return json({ error: "记录不存在" }, 404);
    const row = await db()
      .prepare(
        "SELECT question_ids,nickname,report FROM attempts WHERE id=? AND owner=? AND expires_at>?",
      )
      .bind(b.id, user, Date.now())
      .first<{
        question_ids: string;
        nickname: string;
        report: string | null;
      }>();
    if (!row) return json({ error: "记录不存在或已过期" }, 404);
    if (row.report) return json({ report: JSON.parse(row.report) });
    if (
      !Array.isArray(b.answers) ||
      b.answers.some(
        (a) =>
          !a ||
          typeof a !== "object" ||
          Array.isArray(a) ||
          Object.keys(a).sort().join(",") !== "id,value" ||
          typeof a.id !== "string",
      )
    )
      return json({ error: "答案格式不正确" }, 422);
    let report;
    try {
      const ids = JSON.parse(row.question_ids) as string[];
      report = makeReport(
        row.nickname,
        ids.map((i) => questions.find((q) => q.id === i)!),
        b.answers as Answer[],
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "答案无效" }, 422);
    }
    await db()
      .prepare(
        "UPDATE attempts SET answers=?,report=? WHERE id=? AND owner=? AND report IS NULL",
      )
      .bind(JSON.stringify(b.answers), JSON.stringify(report), b.id, user)
      .run();
    const saved = await db()
      .prepare("SELECT report FROM attempts WHERE id=? AND owner=?")
      .bind(b.id, user)
      .first<{ report: string }>();
    return json({ report: JSON.parse(saved!.report) });
  }
  return json({ error: "未知操作" }, 400);
}
export async function DELETE(r: Request) {
  if (!originOk(r)) return json({ error: "请求来源不符" }, 403);
  const user = await owner(r),
    id = new URL(r.url).searchParams.get("id");
  if (!user || !id) return json({ error: "记录不存在" }, 404);
  await db()
    .prepare("DELETE FROM attempts WHERE id=? AND owner=?")
    .bind(id, user)
    .run();
  return json({ ok: true });
}
