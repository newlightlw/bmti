"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Compass,
  Download,
  RotateCcw,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import {
  endpointNames,
  type Answer,
  type Endpoint,
  type Report,
} from "@/lib/hgp";
type Item = { id: string; text: string };
type Attempt = {
  id: string;
  nickname: string;
  questions: Item[];
  report?: Report | null;
};
const options = [
  { value: 0, label: "完全不符合" },
  { value: 1, label: "较不符合" },
  { value: 2, label: "部分符合" },
  { value: 3, label: "比较符合" },
  { value: 4, label: "非常符合" },
  { value: "unable", label: "无法判断" },
  { value: "skipped", label: "跳过这题" },
] as const;
async function api<T>(data: unknown): Promise<T> {
  const r = await fetch("/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const b = (await r.json()) as T & { error?: string };
  if (!r.ok) throw Error(b.error || "暂时没有成功，请再试一次");
  return b;
}
function Orbit({ small = false }: { small?: boolean }) {
  return (
    <div className={`orbit ${small ? "small" : ""}`} aria-hidden="true">
      <div className="orbit-line one" />
      <div className="orbit-line two" />
      <div className="orbit-axis" />
      <span className="orbit-north">每一种走法，都有自己的光</span>
      <div className="orbit-center">
        <Compass strokeWidth={1} />
        <b>HGP</b>
        <span>YOUR INNER COMPASS</span>
      </div>
      <i className="orbit-dot dot-one" />
      <i className="orbit-dot dot-two" />
      <i className="orbit-dot dot-three" />
      <span className="orbit-south">从认识自己，走向自己的方向</span>
    </div>
  );
}
export default function Experience() {
  const [count, setCount] = useState<number | null>(null),
    [nickname, setNickname] = useState(""),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [answers, setAnswers] = useState<Record<string, Answer["value"]>>({}),
    [index, setIndex] = useState(0),
    [report, setReport] = useState<Report | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const r = await fetch("/api/test");
        if (!r.ok) throw Error("暂时无法读取测试，请刷新重试");
        const b = (await r.json()) as { questionCount: number };
        if (live) setCount(b.questionCount);
        const id = new URL(location.href).searchParams.get("attempt");
        if (id) {
          const res = await fetch("/api/test?id=" + encodeURIComponent(id));
          const a = (await res.json()) as Attempt & { error?: string };
          if (!res.ok) throw Error(a.error || "无法读取测试");
          if (live) {
            setAttempt(a);
            setNickname(a.nickname);
            if (a.report) setReport(a.report);
            else {
              try {
                const draft = JSON.parse(
                  sessionStorage.getItem("hgp-draft-" + id) || "{}",
                );
                setAnswers(draft);
                const next = a.questions.findIndex(
                  (q) => draft[q.id] === undefined,
                );
                setIndex(next < 0 ? a.questions.length - 1 : next);
              } catch {
                setAnswers({});
              }
            }
          }
        }
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "连接失败，请刷新重试");
      } finally {
        if (live) setReady(true);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (attempt && !report) {
      try {
        sessionStorage.setItem(
          "hgp-draft-" + attempt.id,
          JSON.stringify(answers),
        );
      } catch {
        /* Draft storage is optional. */
      }
    }
  }, [attempt, answers, report]);
  useEffect(() => {
    heading.current?.focus();
  }, [index, report, attempt?.id]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const a = await api<Attempt>({ action: "start", nickname });
      setAttempt(a);
      setAnswers({});
      setReport(null);
      setIndex(0);
      history.replaceState(null, "", "?attempt=" + a.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法开始，请重试");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const b = await api<{ report: Report }>({
        action: "submit",
        id: attempt.id,
        answers: attempt.questions.map((q) => ({
          id: q.id,
          value: answers[q.id],
        })),
      });
      setReport(b.report);
      sessionStorage.removeItem("hgp-draft-" + attempt.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "报告生成失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!attempt || !confirm("删除这次测试与报告？此操作无法恢复。")) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/test?id=" + attempt.id, { method: "DELETE" });
      if (!r.ok) throw Error("暂时未能删除，请重试");
      sessionStorage.removeItem("hgp-draft-" + attempt.id);
      setReport(null);
      setAttempt(null);
      setAnswers({});
      history.replaceState(null, "", "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }
  const current = attempt?.questions[index];
  const completed = attempt
    ? attempt.questions.filter((q) => answers[q.id] !== undefined).length
    : 0;
  return (
    <div className="site">
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Compass size={22} />
          </span>
          <span>
            HereToo<span className="brand-divider">/</span>
            <b>同行画像</b>
          </span>
        </a>
        <span className="edition">HGP · EXPLORATION 01</span>
        <a href="/admin" className="admin-link">
          管理端 <ArrowRight size={14} />
        </a>
      </header>
      <main>
        {!ready ? (
          <div className="loading">
            <LoaderCircle className="spin" /> 正在准备你的探索…
          </div>
        ) : report ? (
          <>
            <div className="report-top">
              <span className="eyebrow">YOUR GROWTH PORTRAIT</span>
              <p>{report.nickname}，这是你的本次同行画像</p>
              <h1 ref={heading} tabIndex={-1}>
                {report.role || "不止一种可能的自己"}
              </h1>
              <div className="code-tag">
                {report.code}{" "}
                <span>{report.role ? "偏好组合" : "暂不确定完整角色"}</span>
              </div>
              <p className="report-summary">{report.summary}</p>
              <div className="report-meta">
                <span>
                  {report.total} 道题 · {report.valid} 道有效回答
                </span>
                <span>
                  {new Date(report.createdAt).toLocaleDateString("zh-CN")} ·{" "}
                  {report.version}
                </span>
              </div>
            </div>
            <div className="report-body">
              <div className="section-label">
                <span>01 / PREFERENCE MAP</span>
                <h2>你的四个成长坐标</h2>
                <p>每一端分别计分。得分表示认同程度，不代表能力高低。</p>
              </div>
              <div className="dimension-grid">
                {report.dimensions.map((d, i) => (
                  <section className="dimension-card" key={d.name}>
                    <div className="dimension-heading">
                      <span className="dimension-index">0{i + 1}</span>
                      <h3>{d.name}</h3>
                      <span className="status-pill">{d.status}</span>
                    </div>
                    <div className="score-pair">
                      {d.pair.map((e: Endpoint) => {
                        const s = report.scores[e];
                        return (
                          <div key={e}>
                            <div className="score-label">
                              <b>
                                {endpointNames[e]} <small>{e}</small>
                              </b>
                              <span>
                                {s.mean === null ? "—" : s.mean.toFixed(2)}
                                <small> / 4</small>
                              </span>
                            </div>
                            <div className="score-track">
                              <span
                                style={{
                                  width: ((s.mean ?? 0) / 4) * 100 + "%",
                                }}
                              />
                            </div>
                            <p className="score-note">
                              有效 {s.valid} / 抽取 {s.drawn} 题
                              {s.mean === null ? " · 不足3题，暂不计均值" : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="dimension-description">{d.description}</p>
                  </section>
                ))}
              </div>
              <section className="companion-note">
                <div>
                  <span className="eyebrow">A FRIEND'S FIELD NOTES</span>
                  <h2>如果朋友想更懂你</h2>
                  <p>
                    下面是可以商量着尝试的方式。
                    <br />
                    你的本轮感受，永远比一个类型更重要。
                  </p>
                </div>
                <ol>
                  {report.dimensions.map((d) => (
                    <li key={d.name}>
                      <span>{d.name}</span>
                      {d.suggestion}
                    </li>
                  ))}
                </ol>
              </section>
              <div className="report-disclaimer">
                <b>这是一次认识自己的起点。</b>
                <p>
                  HGP
                  是尚待验证的原创偏好模型，不是心理诊断，也不测执行力或决定命运。并重、接近和信息不足都是真实可保留的结果；朋友怎样陪你，还需要你亲自确认。
                </p>
              </div>
              <div className="report-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void start()}
                >
                  <RotateCcw size={17} /> 换一组题，重新探索
                </button>
                <button className="secondary" onClick={() => window.print()}>
                  <Download size={17} /> 保存 / 打印报告
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  <Trash2 size={15} /> 删除这次记录
                </button>
              </div>
            </div>
          </>
        ) : attempt && current ? (
          <section className="test-shell">
            <div className="test-intro">
              <span className="eyebrow">A LITTLE CLOSER TO YOURSELF</span>
              <p>{attempt.nickname}，按自己的感觉来。</p>
              <span>没有标准答案，也不用成为更“正确”的人。</span>
            </div>
            <div className="progress-label">
              <b>
                问题 {String(index + 1).padStart(2, "0")}{" "}
                <span>/ {attempt.questions.length}</span>
              </b>
              <span>已回答 {completed} 题</span>
            </div>
            <div className="progress">
              <span
                style={{
                  width: (completed / attempt.questions.length) * 100 + "%",
                }}
              />
            </div>
            <div className="question-card">
              <span className="question-overline">
                回顾近三个月，有选择时的通常偏好
              </span>
              <h1 ref={heading} tabIndex={-1}>
                {current.text}
              </h1>
              <fieldset disabled={busy}>
                <legend className="sr-only">选择你的符合程度</legend>
                <div className="answer-scale">
                  {options.slice(0, 5).map((o) => (
                    <label
                      className={
                        "answer-option " +
                        (answers[current.id] === o.value ? "selected" : "")
                      }
                      key={o.value}
                    >
                      <input
                        type="radio"
                        name={current.id}
                        checked={answers[current.id] === o.value}
                        onChange={() => {
                          setAnswers((a) => ({ ...a, [current.id]: o.value }));
                          setError("");
                        }}
                        value={o.value}
                      />
                      <span className="answer-circle">
                        {answers[current.id] === o.value ? (
                          <Check size={20} />
                        ) : (
                          o.value
                        )}
                      </span>
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
                <div className="answer-extra">
                  {options.slice(5).map((o) => (
                    <label
                      className={
                        answers[current.id] === o.value ? "chosen" : ""
                      }
                      key={o.value}
                    >
                      <input
                        type="radio"
                        name={current.id}
                        checked={answers[current.id] === o.value}
                        onChange={() =>
                          setAnswers((a) => ({ ...a, [current.id]: o.value }))
                        }
                        value={o.value}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="question-nav">
                <button
                  className="text-button"
                  disabled={index === 0 || busy}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ArrowLeft size={16} /> 上一题
                </button>
                {index < attempt.questions.length - 1 ? (
                  <button
                    className="primary"
                    disabled={answers[current.id] === undefined || busy}
                    onClick={() => setIndex((i) => i + 1)}
                  >
                    下一题 <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={completed !== attempt.questions.length || busy}
                    onClick={() => void submit()}
                  >
                    {busy ? <LoaderCircle size={16} className="spin" /> : null}{" "}
                    生成我的画像 <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="question-dots" aria-label="题目导航">
              {attempt.questions.map((q, i) => (
                <button
                  aria-label={`跳到第${i + 1}题${answers[q.id] !== undefined ? "，已回答" : ""}`}
                  aria-current={index === i ? "step" : undefined}
                  className={
                    (answers[q.id] !== undefined ? "answered " : "") +
                    (index === i ? "current" : "")
                  }
                  key={q.id}
                  onClick={() => setIndex(i)}
                  disabled={busy}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p className="test-footnote">
              你可以返回修改答案。无法判断和跳过不会当成零分。
              <br />
              同一标签页刷新可继续；关闭标签页后，未提交答案可能不会保留。
            </p>
            <button
              className="text-button restart"
              disabled={busy}
              onClick={() => {
                if (confirm("重新开始会清空这次未提交的答案，确定吗？"))
                  void start();
              }}
            >
              <RotateCcw size={14} /> 重新开始
            </button>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <i /> HERE TOO, WITH YOU
                </span>
                <h1>
                  世界很大，
                  <br />
                  先认识<span className="serif-word">自己。</span>
                </h1>
                <p className="hero-description">
                  你从哪里找到动力，又喜欢怎样迈出第一步？
                  <br />
                  用一段安静的时间，找到属于你的同行画像。
                </p>
                <form
                  className="start-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void start();
                  }}
                >
                  <label htmlFor="nickname">怎么称呼你？</label>
                  <div className="nickname-row">
                    <input
                      id="nickname"
                      value={nickname}
                      maxLength={24}
                      autoComplete="nickname"
                      placeholder="输入你的昵称"
                      required
                      disabled={busy}
                      onChange={(e) => setNickname(e.target.value)}
                    />
                    <button
                      className="primary"
                      disabled={busy || !nickname.trim() || count === null}
                    >
                      {busy ? (
                        <LoaderCircle size={18} className="spin" />
                      ) : (
                        <>
                          开始探索 <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                  <p>
                    {count ?? "—"} 道题 · 可跳过 · 可重做
                    {count !== null && count < 24
                      ? " · 精简探索，仅展示可判断部分"
                      : ""}
                  </p>
                </form>
                <div className="hero-bottom">
                  <span className="tiny-dot" />
                  不是给你贴标签，是多一种理解自己的方式。
                </div>
              </div>
              <div className="hero-art">
                <div className="art-caption">
                  <span>FIELD GUIDE / 001</span>
                  <span>GROW AT YOUR OWN PACE</span>
                </div>
                <Orbit />
                <div className="art-bottom">
                  <span>你的世界，我也在。</span>
                  <b>HereToo</b>
                </div>
              </div>
            </section>
            <section className="coordinates">
              <div className="coordinates-title">
                <span className="eyebrow">FOUR WAYS TO KNOW YOU</span>
                <h2>
                  四个坐标，
                  <br />
                  理解你的成长方式。
                </h2>
              </div>
              <div className="coordinate-items">
                {[
                  ["01", "动力来源", "意义与愿景，或具体改善。"],
                  ["02", "启动路径", "先想明白，或先试一点。"],
                  ["03", "推进节奏", "清晰的安排，或调整的余地。"],
                  ["04", "支持方式", "独自整理，或可信的交流。"],
                ].map(([n, title, text]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="landing-note">
              <b>陪你看世界，也陪你走过自己的低谷。</b>
              <p>
                HGP
                为待验证的原创偏好模型。昵称和本次答案用于生成报告，报告30天内可访问，过期记录会在后续开测时清理，可由本浏览器删除；昵称不是账号，不支持通过昵称检索他人报告。
              </p>
            </section>
          </>
        )}
        {error && (
          <div role="alert" className="error-message">
            {error}
          </div>
        )}
      </main>
      <footer>
        <span>HereToo · 同行画像</span>
        <span>每一种走法，都值得被认真理解。</span>
        <span>HGP / 0.2</span>
      </footer>
    </div>
  );
}
