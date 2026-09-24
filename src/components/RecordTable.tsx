import { useMemo, useState } from "react";
import type { EvaluatedRecord, ScreeningRecord, ScreeningInput } from "../screening/types";

interface Props {
  records: EvaluatedRecord[];
  onAmend: (record: ScreeningRecord) => void;
}

const eyeCell = (r: EvaluatedRecord, side: "right" | "left") => {
  const e = r[side];
  return [e.nakedVA, e.sphere, e.cylinder, e.axis, e.axialLength]
    .map((v) => v || "—")
    .join(" / ");
};

export default function RecordTable({ records, onAmend }: Props) {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("全部");

  const grades = useMemo(
    () => ["全部", ...Array.from(new Set(records.map((r) => r.grade)))],
    [records],
  );

  const filtered = records.filter((r) => {
    if (grade !== "全部" && r.grade !== grade) return false;
    const t = q.trim();
    if (!t) return true;
    return [r.studentId, r.name, r.grade, r.date, ...r.hits]
      .join(" ")
      .toLowerCase()
      .includes(t.toLowerCase());
  });

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>全部筛查记录（{filtered.length}/{records.length}）</h2>
          <p className="hint">按筛查日升序；命中项按当前阈值实时计算，修改后历史判定不留痕。</p>
        </div>
      </div>
      <div className="toolbar">
        <input
          type="search"
          placeholder="搜索学号 / 姓名 / 年级 / 命中项"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>学号</th>
              <th>姓名</th>
              <th>年级</th>
              <th>筛查日</th>
              <th>右眼 裸眼/球/柱/轴/眼轴</th>
              <th>左眼 裸眼/球/柱/轴/眼轴</th>
              <th>状态</th>
              <th>命中项</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  暂无记录
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.studentId}</td>
                <td>{r.name}</td>
                <td>{r.grade}</td>
                <td>{r.date}</td>
                <td>{eyeCell(r, "right")}</td>
                <td>{eyeCell(r, "left")}</td>
                <td>
                  <span className={`badge ${r.status === "待转诊" ? "refer" : "normal"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="hits-cell">
                  {r.hits.length ? r.hits.map((h) => (
                    <span key={h} className="hit-tag">{h}</span>
                  )) : <span style={{ color: "#64748b" }}>—</span>}
                </td>
                <td>
                  <button onClick={() => onAmend(r)}>
                    修改
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// 供父组件构造修改目标
export const toAmendInput = (r: ScreeningRecord): ScreeningInput => ({
  studentId: r.studentId,
  name: r.name,
  grade: r.grade,
  date: r.date,
  right: { ...r.right },
  left: { ...r.left },
});
