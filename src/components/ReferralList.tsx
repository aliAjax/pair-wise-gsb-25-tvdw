import type { EvaluatedRecord } from "../screening/types";

interface Props {
  records: EvaluatedRecord[];
  onAmend: (record: EvaluatedRecord) => void;
}

/** 待转诊名单：按筛查日倒序，每条写明全部命中项，供核对不漏人 */
export default function ReferralList({ records, onAmend }: Props) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>待转诊名单（{records.length} 人）</h2>
          <p className="hint">
            命中任一条件即入列：裸眼视力低于阈值、等效球镜低于阈值、半年内眼轴增长超限。
          </p>
        </div>
      </div>
      {records.length === 0 ? (
        <div className="empty">当前没有待转诊学生</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>筛查日</th>
                <th>学号</th>
                <th>姓名</th>
                <th>年级</th>
                <th>命中项</th>
                <th>右眼 裸眼/球/柱/轴/眼轴</th>
                <th>左眼 裸眼/球/柱/轴/眼轴</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.studentId}</td>
                  <td>{r.name}</td>
                  <td>{r.grade}</td>
                  <td className="hits-cell">
                    {r.hits.map((h) => (
                      <span key={h} className="hit-tag">{h}</span>
                    ))}
                  </td>
                  <td>
                    {[r.right.nakedVA, r.right.sphere, r.right.cylinder, r.right.axis, r.right.axialLength]
                      .map((v) => v || "—").join(" / ")}
                  </td>
                  <td>
                    {[r.left.nakedVA, r.left.sphere, r.left.cylinder, r.left.axis, r.left.axialLength]
                      .map((v) => v || "—").join(" / ")}
                  </td>
                  <td>
                    <button onClick={() => onAmend(r)}>修改</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
