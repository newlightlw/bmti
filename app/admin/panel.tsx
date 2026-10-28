"use client";
import { useEffect, useState } from "react";
import {
  Compass,
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  LogOut,
  Check,
  LoaderCircle,
  Shuffle,
} from "lucide-react";
import { endpointNames, type Endpoint } from "@/lib/hgp";
type AdminData = {
  questionCount: number;
  updatedAt: number | null;
  questions: { id: string; text: string; endpoint: Endpoint }[];
  bankCount: number;
};
export default function Admin() {
  const [data, setData] = useState<AdminData | null>(null),
    [loading, setLoading] = useState(true),
    [password, setPassword] = useState(""),
    [count, setCount] = useState(32),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState("all");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin");
      const b = (await r.json()) as AdminData & { error?: string };
      if (r.status === 401) {
        setData(null);
        return;
      }
      if (!r.ok) throw Error(b.error || "无法读取设置");
      setData(b);
      setCount(b.questionCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw Error(b.error || "操作失败，请重试");
      return b;
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (await action({ action: "login", password })) {
      setPassword("");
      await load();
    }
  }
  async function save() {
    if (await action({ action: "settings", questionCount: count })) {
      await load();
      setMessage("已保存。下一次新测试会使用这个题量，进行中的测试不受影响。");
    }
  }
  return (
    <div className="site admin-site">
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Compass size={22} />
          </span>
          <span>
            HereToo <span className="brand-divider">/</span>
            <b>研究工作台</b>
          </span>
        </a>
        <a href="/" className="admin-link">
          <ArrowLeft size={14} /> 返回用户端
        </a>
      </header>
      <main className="admin-main">
        {loading ? (
          <div className="loading">
            <LoaderCircle className="spin" /> 正在读取…
          </div>
        ) : !data ? (
          <section className="admin-login">
            <div className="login-icon">
              <LockKeyhole size={26} />
            </div>
            <span className="eyebrow">HGP / ADMINISTRATION</span>
            <h1>管理你的探索题库</h1>
            <p>使用独立管理口令登录。</p>
            <form onSubmit={login}>
              <label htmlFor="admin-password">管理口令</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <button className="primary" disabled={busy || !password}>
                {busy ? <LoaderCircle size={16} className="spin" /> : null}{" "}
                登录工作台 <ArrowRight size={16} />
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="admin-heading">
              <div>
                <span className="eyebrow">QUESTION BANK / HGP-0.2</span>
                <h1>
                  把探索的节奏，
                  <br />
                  交给你来安排。
                </h1>
                <p>设置每次测试随机抽取多少道题。</p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  if (await action({ action: "logout" })) setData(null);
                }}
              >
                <LogOut size={16} /> 退出登录
              </button>
            </div>
            <div className="admin-stats">
              <div>
                <span>题库总量</span>
                <b>
                  {data.bankCount}
                  <small>道</small>
                </b>
              </div>
              <div>
                <span>偏好维度</span>
                <b>
                  4<small>组 / 八端</small>
                </b>
              </div>
              <div>
                <span>当前抽题</span>
                <b>
                  {data.questionCount}
                  <small>道 / 次</small>
                </b>
              </div>
            </div>
            <section className="settings-panel">
              <div>
                <span className="eyebrow">01 / TEST SETTINGS</span>
                <h2>每次抽题数量</h2>
                <p>
                  从32题中按八个端点均衡随机抽取。
                  <br />
                  每次重做都会重新抽题并打乱顺序。
                </p>
              </div>
              <div className="count-controls">
                <label htmlFor="question-count">
                  选择题量 <output>{count} 道</output>
                </label>
                <input
                  id="question-count"
                  type="range"
                  min={8}
                  max={32}
                  step={1}
                  value={count}
                  disabled={busy}
                  onChange={(e) => {
                    setCount(Number(e.target.value));
                    setMessage("");
                  }}
                />
                <div className="count-presets">
                  {[8, 16, 24, 32].map((n) => (
                    <button
                      className={count === n ? "active" : ""}
                      key={n}
                      disabled={busy}
                      onClick={() => {
                        setCount(n);
                        setMessage("");
                      }}
                    >
                      {n} 题
                    </button>
                  ))}
                </div>
                <p className="sampling-note">
                  <Shuffle size={15} /> 每端抽取 {Math.floor(count / 8)}
                  {count % 8 ? "—" + Math.ceil(count / 8) : ""}{" "}
                  题；各端题量最多相差1题。
                </p>
                <div className={"count-warning " + (count < 24 ? "warn" : "")}>
                  {count < 24
                    ? "少于24题时，各端有效题量不足，不输出完整角色；报告会标明信息不足。"
                    : count === 24
                      ? "每端恰好3题，跳过任意题可能导致对应维度暂无法判定。"
                      : "达到有效题数仍可能出现并重或接近，不保证生成完整角色。"}
                </div>
                <button
                  className="primary"
                  disabled={busy || count === data.questionCount}
                  onClick={() => void save()}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Check size={16} />
                  )}{" "}
                  保存抽题设置
                </button>
                {message && (
                  <p role="status" className="save-success">
                    {message}
                  </p>
                )}
              </div>
            </section>
            <section className="bank-panel">
              <div className="bank-heading">
                <div>
                  <span className="eyebrow">02 / QUESTION LIBRARY</span>
                  <h2>题库预览</h2>
                </div>
                <label>
                  筛选端点{" "}
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">全部端点 · 32题</option>
                    {Object.entries(endpointNames).map(([e, name]) => (
                      <option value={e} key={e}>
                        {e} · {name} · 4题
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="bank-list">
                {data.questions
                  .filter((q) => filter === "all" || q.endpoint === filter)
                  .map((q) => (
                    <div key={q.id}>
                      <span className="bank-id">{q.id}</span>
                      <p>{q.text}</p>
                      <span className="endpoint-tag">
                        {q.endpoint} · {endpointNames[q.endpoint]}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
            <p className="admin-footnote">
              仅新测试读取最新题量。测试记录由独立浏览器凭据保护，管理端不展示用户昵称或私人答案。
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
      </main>
      <footer>
        <span>HereToo · 同行画像</span>
        <span>题库与计分版本 HGP-0.2</span>
      </footer>
    </div>
  );
}
