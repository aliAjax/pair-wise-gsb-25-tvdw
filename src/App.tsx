import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "./styles.css";
import type { EyeMeasure, RecordInput, ScreeningRecord } from "./types";
import { THRESHOLDS, evaluateRecord, findPreviousRecord, sphericalEquivalent } from "./thresholds";
import type { ReferralHit } from "./thresholds";
import { amendRecord, submitRecord, useLedger } from "./ledger";

const GRADES = [
  "一年级",
  "二年级",
  "三年级",
  "四年级",
  "五年级",
  "六年级",
  "初一",
  "初二",
  "初三",
  "高一",
  "高二",
  "高三",
];

interface EyeForm {
  nakedVision: string;
  sphere: string;
  cylinder: string;
  axis: string;
  axialLength: string;
}

interface FormState {
  studentId: string;
  studentName: string;
  grade: string;
  screeningDate: string;
  right: EyeForm;
  left: EyeForm;
}

const emptyEye = (): EyeForm => ({
  nakedVision: "",
  sphere: "",
  cylinder: "",
  axis: "",
  axialLength: "",
});

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const emptyForm = (): FormState => ({
  studentId: "",
  studentName: "",
  grade: GRADES[0],
  screeningDate: todayStr(),
  right: emptyEye(),
  left: emptyEye(),
});

function fmtTime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function fmtD(v: number | null): string {
  return v == null ? "—" : v.toFixed(2);
}

function parseEye(raw: EyeForm, label: string, errors: string[]): EyeMeasure {
  const num = (v: string, field: string, min: number, max: number, required = false): number | null => {
    const t = v.trim();
    if (!t) {
      if (required) errors.push(`${label}·${field}必填`);
      return null;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < min || n > max) {
      errors.push(`${label}·${field}需在 ${min}~${max} 之间`);
      return null;
    }
    return n;
  };
  return {
    nakedVision: num(raw.nakedVision, "裸眼视力", 3.0, 5.3, true),
    sphere: num(raw.sphere, "球镜", -30, 15),
    cylinder: num(raw.cylinder, "柱镜", -10, 10),
    axis: num(raw.axis, "轴位", 0, 180),
    axialLength: num(raw.axialLength, "眼轴", 15, 35),
  };
}

function validate(form: FormState): { input: RecordInput | null; errors: string[] } {
  const errors: string[] = [];
  if (!form.studentId.trim()) errors.push("请填写学号");
  if (!form.studentName.trim()) errors.push("请填写姓名");
  if (!form.screeningDate) errors.push("请选择筛查日");
  const right = parseEye(form.right, "右眼", errors);
  const left = parseEye(form.left, "左眼", errors);
  if (errors.length > 0) return { input: null, errors };
  return {
    errors,
    input: {
      studentId: form.studentId.trim(),
      studentName: form.studentName.trim(),
      grade: form.grade,
      screeningDate: form.screeningDate,
      right,
      left,
    },
  };
}

function EyeFieldset({
  title,
  value,
  onChange,
}: {
  title: string;
  value: EyeForm;
  onChange: (eye: EyeForm) => void;
}) {
  const set =
    (key: keyof EyeForm) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: e.target.value });
  return (
    <fieldset className="eye-fieldset">
      <legend>{title}</legend>
      <div className="eye-grid">
        <label>
          <span>裸眼视力 *</span>
          <input
            type="number"
            step="0.1"
            min="3"
            max="5.3"
            placeholder="如 4.9"
            value={value.nakedVision}
            onChange={set("nakedVision")}
          />
        </label>
        <label>
          <span>球镜 DS</span>
          <input
            type="number"
            step="0.25"
            placeholder="如 -1.00"
            value={value.sphere}
            onChange={set("sphere")}
          />
        </label>
        <label>
          <span>柱镜 DC</span>
          <input
            type="number"
            step="0.25"
            placeholder="如 -0.50"
            value={value.cylinder}
            onChange={set("cylinder")}
          />
        </label>
        <label>
          <span>轴位 °</span>
          <input
            type="number"
            step="1"
            min="0"
            max="180"
            placeholder="0-180"
            value={value.axis}
            onChange={set("axis")}
          />
        </label>
        <label>
          <span>眼轴 mm</span>
          <input
            type="number"
            step="0.01"
            placeholder="如 23.45"
            value={value.axialLength}
            onChange={set("axialLength")}
          />
        </label>
      </div>
    </fieldset>
  );
}

function EyeCell({ eye }: { eye: EyeMeasure }) {
  const se = sphericalEquivalent(eye);
  return (
    <div className="eye-cell">
      <span>裸眼 {eye.nakedVision != null ? eye.nakedVision.toFixed(1) : "—"}</span>
      <span>
        S {fmtD(eye.sphere)} · C {fmtD(eye.cylinder)} · A {eye.axis ?? "—"}
      </span>
      <span>等效 {se != null ? `${se.toFixed(2)}D` : "—"}</span>
      <span>眼轴 {eye.axialLength != null ? eye.axialLength.toFixed(2) : "—"}</span>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tone} />
    </article>
  );
}

function App() {
  const { state, setState } = useLedger();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("全部年级");
  const [onlyReferral, setOnlyReferral] = useState(false);
  const entryRef = useRef<HTMLElement>(null);

  // 待转诊名单由台账数据 + 阈值实时推导，命中记录照常保留
  const referrals = useMemo(
    () =>
      state.records.map((record) => ({
        record,
        hits: evaluateRecord(record, findPreviousRecord(state.records, record)),
      })),
    [state.records]
  );
  const hitsById = useMemo(() => {
    const m = new Map<string, ReferralHit[]>();
    referrals.forEach((r) => m.set(r.record.id, r.hits));
    return m;
  }, [referrals]);
  const flagged = referrals
    .filter((r) => r.hits.length > 0)
    .sort((a, b) => b.record.screeningDate.localeCompare(a.record.screeningDate));

  const amendCount = useMemo(() => {
    const m = new Map<string, number>();
    state.amendments.forEach((a) => m.set(a.recordId, (m.get(a.recordId) ?? 0) + 1));
    return m;
  }, [state.amendments]);

  const studentTotal = new Set(state.records.map((r) => r.studentId)).size;
  const referralStudentTotal = new Set(flagged.map((f) => f.record.studentId)).size;

  const sortedRecords = [...state.records].sort(
    (a, b) =>
      b.screeningDate.localeCompare(a.screeningDate) || b.createdAt.localeCompare(a.createdAt)
  );
  const filteredRecords = sortedRecords.filter((r) => {
    if (gradeFilter !== "全部年级" && r.grade !== gradeFilter) return false;
    if (onlyReferral && (hitsById.get(r.id)?.length ?? 0) === 0) return false;
    const q = query.trim();
    if (q && !r.studentName.includes(q) && !r.studentId.includes(q)) return false;
    return true;
  });

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
    setReason("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const { input, errors } = validate(form);
    if (!input) {
      setMessage({ kind: "error", text: errors.join("；") });
      return;
    }
    if (editingId) {
      const { next, result } = amendRecord(state, editingId, input, reason);
      setState(next);
      setMessage({ kind: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) resetForm();
      return;
    }
    const { next, result } = submitRecord(state, input);
    setState(next);
    if (result.ok) {
      const saved = next.records[next.records.length - 1];
      const hits = evaluateRecord(saved, findPreviousRecord(next.records, saved));
      setMessage({
        kind: "ok",
        text: hits.length
          ? `${result.message} 命中 ${hits.length} 项转诊规则，记录已保留并进入待转诊名单。`
          : `${result.message} 未命中转诊规则。`,
      });
      resetForm();
    } else {
      setMessage({ kind: "error", text: result.message });
    }
  }

  function startEdit(record: ScreeningRecord) {
    const toEye = (eye: EyeMeasure): EyeForm => ({
      nakedVision: eye.nakedVision != null ? String(eye.nakedVision) : "",
      sphere: eye.sphere != null ? String(eye.sphere) : "",
      cylinder: eye.cylinder != null ? String(eye.cylinder) : "",
      axis: eye.axis != null ? String(eye.axis) : "",
      axialLength: eye.axialLength != null ? String(eye.axialLength) : "",
    });
    setForm({
      studentId: record.studentId,
      studentName: record.studentName,
      grade: record.grade,
      screeningDate: record.screeningDate,
      right: toEye(record.right),
      left: toEye(record.left),
    });
    setEditingId(record.id);
    setReason("");
    setMessage(null);
    entryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-11 · 校园视力筛查</p>
          <h1>视力筛查台账</h1>
          <p className="subtitle">
            按学生、年级、筛查日录入双眼裸眼视力、球镜、柱镜、轴位与眼轴；命中转诊规则的记录照常保留并自动进入待转诊名单。重复提交保留最早记录，修改必须填原因并留旧值。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>数据保存在本机浏览器 localStorage，未引入新依赖</span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="筛查记录" value={state.records.length} tone="status-ok" />
        <MetricCard label="覆盖学生" value={studentTotal} tone="status-ok" />
        <MetricCard label="待转诊学生" value={referralStudentTotal} tone="status-danger" />
        <MetricCard
          label="留档条目"
          value={state.amendments.length + state.rejections.length}
          tone="status-watch"
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="zone-tag zone-threshold">阈值区</span>
            <h2>转诊规则</h2>
          </div>
        </div>
        <div className="threshold-grid">
          <article className="threshold-card">
            <h3>裸眼视力</h3>
            <strong>&lt; {THRESHOLDS.nakedVisionMin.toFixed(1)}</strong>
            <p>任一眼裸眼视力低于 {THRESHOLDS.nakedVisionMin.toFixed(1)} 即命中。</p>
          </article>
          <article className="threshold-card">
            <h3>等效球镜</h3>
            <strong>&lt; {THRESHOLDS.sphericalEquivalentMin.toFixed(2)}D</strong>
            <p>等效球镜 = 球镜 + 柱镜 ÷ 2，任一眼低于 {THRESHOLDS.sphericalEquivalentMin.toFixed(2)}D 即命中。</p>
          </article>
          <article className="threshold-card">
            <h3>眼轴增长</h3>
            <strong>&gt; {THRESHOLDS.axialGrowthHalfYearMax.toFixed(2)}mm/半年</strong>
            <p>与本人上一次筛查对比，按间隔天数折算半年增速，超过即命中。</p>
          </article>
        </div>
        <p className="threshold-note">阈值集中定义在 src/thresholds.ts，调整只改这一处。</p>
      </section>

      <section className="panel" ref={entryRef}>
        <div className="section-heading">
          <div>
            <span className="zone-tag zone-ops">操作区</span>
            <h2>{editingId ? "修改筛查记录" : "筛查录入"}</h2>
          </div>
        </div>
        {editingId && (
          <div className="editing-banner">
            正在修改已有记录：学号与筛查日不可改，保存时必须填写修改原因，旧值会一并留档。
          </div>
        )}
        {message && <div className={`form-message ${message.kind}`}>{message.text}</div>}
        <form className="entry-form" onSubmit={handleSubmit}>
          <div className="identity-grid">
            <label>
              <span>学号 *</span>
              <input
                placeholder="如 S20260301"
                value={form.studentId}
                disabled={editingId != null}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              />
            </label>
            <label>
              <span>姓名 *</span>
              <input
                placeholder="学生姓名"
                value={form.studentName}
                onChange={(e) => setForm({ ...form, studentName: e.target.value })}
              />
            </label>
            <label>
              <span>年级 *</span>
              <select
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>筛查日 *</span>
              <input
                type="date"
                value={form.screeningDate}
                disabled={editingId != null}
                onChange={(e) => setForm({ ...form, screeningDate: e.target.value })}
              />
            </label>
          </div>
          <div className="eyes-row">
            <EyeFieldset
              title="右眼"
              value={form.right}
              onChange={(right) => setForm({ ...form, right })}
            />
            <EyeFieldset
              title="左眼"
              value={form.left}
              onChange={(left) => setForm({ ...form, left })}
            />
          </div>
          {editingId && (
            <label>
              <span>修改原因 *（随旧值一起留档）</span>
              <input
                placeholder="如：现场复测更正录入笔误"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="form-actions">
            <button type="submit" className="primary-action">
              {editingId ? "保存修改并留档" : "提交筛查记录"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm}>
                取消修改
              </button>
            ) : (
              <button type="button" onClick={resetForm}>
                清空表单
              </button>
            )}
          </div>
          <p className="form-hint">
            裸眼视力为必填（5分记录法）；球镜、柱镜、轴位、眼轴可后续补录。同一学生同一筛查日重复提交时只保留最早记录。
          </p>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="zone-tag zone-referral">待转诊名单</span>
            <h2>命中转诊规则的学生（{flagged.length} 条记录）</h2>
          </div>
        </div>
        {flagged.length === 0 ? (
          <p className="empty-tip">当前没有命中转诊规则的记录。</p>
        ) : (
          <div className="referral-list">
            {flagged.map(({ record, hits }) => (
              <article key={record.id} className="referral-card">
                <header>
                  <strong>
                    {record.studentName}（{record.studentId}）
                  </strong>
                  <span>
                    {record.grade} · 筛查日 {record.screeningDate}
                  </span>
                </header>
                <div className="hit-chips">
                  {hits.map((h) => (
                    <span key={`${record.id}-${h.ruleId}-${h.eye}`} className="hit-chip">
                      {h.label}：{h.detail}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="zone-tag zone-data">数据区</span>
            <h2>筛查台账（{filteredRecords.length} 条）</h2>
          </div>
        </div>
        <div className="filter-row">
          <input
            className="grow"
            type="text"
            placeholder="按姓名或学号搜索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
            <option>全部年级</option>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyReferral}
              onChange={(e) => setOnlyReferral(e.target.checked)}
            />
            仅看待转诊
          </label>
        </div>
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>年级</th>
                <th>筛查日</th>
                <th>右眼</th>
                <th>左眼</th>
                <th>转诊命中</th>
                <th>留痕</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const hits = hitsById.get(r.id) ?? [];
                const amendTimes = amendCount.get(r.id) ?? 0;
                return (
                  <tr key={r.id}>
                    <td className="student-cell">
                      <strong>{r.studentName}</strong>
                      <span>{r.studentId}</span>
                    </td>
                    <td>{r.grade}</td>
                    <td>{r.screeningDate}</td>
                    <td>
                      <EyeCell eye={r.right} />
                    </td>
                    <td>
                      <EyeCell eye={r.left} />
                    </td>
                    <td>
                      {hits.length > 0 ? (
                        <span className="badge badge-danger">{hits.length} 项命中</span>
                      ) : (
                        <span className="badge badge-ok">未命中</span>
                      )}
                    </td>
                    <td className="meta-cell">
                      <span>v{r.version} · 更新 {r.updatedAt.slice(0, 10)}</span>
                      {amendTimes > 0 && <span>修改留档 {amendTimes} 次</span>}
                    </td>
                    <td>
                      <button type="button" onClick={() => startEdit(r)}>
                        修改
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <p className="empty-tip">没有符合条件的记录。</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="zone-tag zone-archive">留档区</span>
            <h2>修改留档与重复提交拦截</h2>
          </div>
        </div>
        <div className="archive-grid">
          <div className="archive-col">
            <h3>修改留档（{state.amendments.length}）</h3>
            {state.amendments.length === 0 ? (
              <p className="empty-tip">暂无修改留档。</p>
            ) : (
              <div className="archive-list">
                {state.amendments.map((a) => (
                  <article key={a.id} className="archive-item">
                    <header>
                      <span className="badge badge-muted">修改</span>
                      <time>{fmtTime(a.amendedAt)}</time>
                    </header>
                    <p>
                      <strong>{a.studentLabel}</strong> · 原因：{a.reason}
                    </p>
                    <ul>
                      {a.changes.map((c) => (
                        <li key={`${a.id}-${c.field}`}>
                          {c.field}：{c.oldValue} → {c.newValue}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="archive-col">
            <h3>重复提交拦截（{state.rejections.length}）</h3>
            {state.rejections.length === 0 ? (
              <p className="empty-tip">暂无重复提交拦截。</p>
            ) : (
              <div className="archive-list">
                {state.rejections.map((r) => (
                  <article key={r.id} className="archive-item">
                    <header>
                      <span className="badge badge-muted">重复拦截</span>
                      <time>{fmtTime(r.rejectedAt)}</time>
                    </header>
                    <p>
                      <strong>
                        {r.studentName}（{r.studentId}）
                      </strong>{" "}
                      · 筛查日 {r.screeningDate}
                    </p>
                    <p>{r.note}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
