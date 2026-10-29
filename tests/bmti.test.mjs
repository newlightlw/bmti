import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "bmti-test-"));
buildSync({
  entryPoints: ["lib/bmti.ts"],
  outfile: join(dir, "bmti.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
});
buildSync({
  entryPoints: ["lib/portrait.ts"],
  outfile: join(dir, "portrait.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
});
const { presentPortrait } = await import(join(dir, "portrait.mjs"));
const { questions, drawQuestions, makeReport, endpoints, roles } = await import(
  join(dir, "bmti.mjs")
);
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
const answers = (values = {}) =>
  questions.map((q) => ({ id: q.id, value: values[q.endpoint] ?? 2 }));
test("subthreshold means produce a personal portrait without forcing a role", () => {
  const totals = { V: 11, R: 9, T: 11, A: 13, S: 12, F: 11, I: 12, C: 9 };
  const counts = {};
  const input = questions.map((q) => {
    const index = counts[q.endpoint] || 0;
    counts[q.endpoint] = index + 1;
    const total = totals[q.endpoint];
    return { id: q.id, value: Math.floor(total / 4) + (index < total % 4 ? 1 : 0) };
  });
  const report = makeReport("合成回归", questions, input);
  const before = JSON.stringify(report);
  const portrait = presentPortrait(JSON.parse(before));
  assert.equal(report.code, "????");
  assert.equal(report.role, null);
  assert.deepEqual(portrait.dimensions.map((d) => d.status), [
    "愿景分数略高", "试做分数略高", "有序分数略高", "自主分数略高",
  ]);
  assert.match(portrait.summary, /愿景略高；试做略高；有序略高；自主略高/);
  assert.match(portrait.dimensions[2].description, /0.25分/);
  assert.match(portrait.dimensions[3].description, /0.75分/);
  assert.equal(portrait.badge.includes("?"), false);
  assert.equal(portrait.summary.includes("????"), false);
  assert.equal(JSON.stringify(report), before);
});
test("portrait distinguishes ties, dual endorsement, low fit, missing and clear roles", () => {
  for (const [value, status] of [[0, "两端较少符合"], [2, "两端得分相同"], [3, "两端都认同"]]) {
    const report = makeReport("合成", questions, questions.map((q) => ({ id: q.id, value })));
    assert.equal(presentPortrait(report).dimensions[0].status, status);
    assert.equal(report.role, null);
  }
  const input = answers();
  input.filter((a) => ["N01", "N09"].includes(a.id)).forEach((a) => { a.value = "skipped"; });
  const missing = presentPortrait(makeReport("合成", questions, input));
  assert.equal(missing.dimensions[0].status, "信息不足");
  assert.match(missing.dimensions[0].description, /另一端不足3道/);
  const allMissing = presentPortrait(makeReport("合成", questions, questions.map((q) => ({ id: q.id, value: "unable" }))));
  assert.match(allMissing.dimensions[0].description, /两端均不足/);
  const clear = makeReport("合成", questions, answers({ V: 4, T: 4, F: 4, I: 4 }));
  assert.equal(presentPortrait(clear).title, "旷野哲思者");
  assert.equal(presentPortrait(clear).badge, "VTFI");
});
test("all draw counts are unique and balanced across eight endpoints", () => {
  for (let n = 8; n <= 32; n++) {
    for (let run = 0; run < 20; run++) {
      const selected = drawQuestions(n);
      assert.equal(selected.length, n);
      assert.equal(new Set(selected.map((q) => q.id)).size, n);
      const counts = endpoints.map(
        (e) => selected.filter((q) => q.endpoint === e).length,
      );
      assert.equal(Math.min(...counts), Math.floor(n / 8));
      assert.equal(Math.max(...counts), Math.ceil(n / 8));
    }
  }
  for (const n of [0, 7, 33, 24.5, NaN]) assert.throws(() => drawQuestions(n));
});
test("all sixteen combinations map to the documented names", () => {
  for (const [code, role] of Object.entries(roles)) {
    const values = Object.fromEntries(
      endpoints.map((e) => [e, code.includes(e) ? 4 : 2]),
    );
    const report = makeReport("旅人", questions, answers(values));
    assert.equal(report.code, code);
    assert.equal(report.role, role);
  }
});
test("all high / low / neutral values do not invent a type", () => {
  for (const n of [0, 2, 4]) {
    const r = makeReport(
      "旅人",
      questions,
      questions.map((q) => ({ id: q.id, value: n })),
    );
    assert.equal(r.code, "????");
    assert.equal(r.role, null);
    assert.equal(
      r.dimensions[0].status,
      n === 0 ? "较少符合" : n === 4 ? "两端并重" : "暂无明显侧重",
    );
  }
});
test("high and low priorities take precedence over the one-point difference", () => {
  assert.equal(
    makeReport("a", questions, answers({ V: 3, R: 4 })).dimensions[0].status,
    "两端并重",
  );
  assert.equal(
    makeReport("a", questions, answers({ V: 1, R: 0 })).dimensions[0].status,
    "较少符合",
  );
  assert.equal(
    makeReport("a", questions, answers({ V: 2, R: 1 })).dimensions[0].code,
    "V",
  );
});
test("missing values are not zero; insufficient draws never get full roles", () => {
  const a = answers({ V: 0, R: 2 });
  a.find((q) => q.id === "N01").value = "unable";
  a.find((q) => q.id === "N09").value = "skipped";
  const r = makeReport("a", questions, a);
  assert.equal(r.scores.V.valid, 2);
  assert.equal(r.scores.V.mean, null);
  assert.equal(r.dimensions[0].status, "信息不足");
  const short = drawQuestions(23);
  assert.equal(
    makeReport(
      "a",
      short,
      short.map((q) => ({ id: q.id, value: 4 })),
    ).role,
    null,
  );
});
test("exact answer set, strict integer scores, no duplicates", () => {
  assert.throws(() => makeReport("a", questions, answers().slice(1)));
  const duplicated = answers();
  duplicated[0] = duplicated[1];
  assert.throws(() => makeReport("a", questions, duplicated));
  for (const v of [-1, 5, 2.5, true, null, "4"]) {
    const a = answers();
    a[0].value = v;
    assert.throws(() => makeReport("a", questions, a));
  }
  const extra = answers();
  extra[0].id = "injected";
  assert.throws(() => makeReport("a", questions, extra));
});
test("question wording is identical to the approved v0.2 document", () => {
  const source = readFileSync("tests/fixtures/approved-questions.md", "utf8");
  for (const q of questions)
    assert.ok(source.includes(`| ${q.id} | ${q.text} | ${q.endpoint} |`));
});
