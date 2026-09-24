import type { AuditEntry } from "../screening/types";
import { auditToCsv, downloadCsv } from "../screening/csv";

interface Props {
  entries: AuditEntry[];
}

const fmt = (at: string): string => at.slice(0, 19).replace("T", " ");

export default function AuditView({ entries }: Props) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>操作留档（{entries.length} 条，只追加）</h2>
          <p className="hint">
            记录录入、重复提交与修改；修改附原因并逐项保留旧值，任何人都不能删除留档。
          </p>
        </div>
        <button
          disabled={entries.length === 0}
          onClick={() => downloadCsv(`视力筛查留档_${Date.now()}.csv`, auditToCsv(entries))}
        >
          导出留档 CSV
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">尚无操作记录</div>
      ) : (
        entries.map((e) => (
          <article key={e.seq} className="audit-item">
            <div className="meta">
              <span className="kind" data-action={e.action}>
                {e.action}
              </span>
              <span>{fmt(e.at)}</span>
              <span>操作人：{e.operator}</span>
              <span>记录：{e.recordKey}</span>
            </div>
            {e.reason && (
              <div className="meta" style={{ marginTop: 6 }}>
                <span>原因：{e.reason}</span>
              </div>
            )}
            {e.changes && e.changes.length > 0 && (
              <table className="change-table">
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>旧值</th>
                    <th>新值</th>
                  </tr>
                </thead>
                <tbody>
                  {e.changes.map((c) => (
                    <tr key={c.field}>
                      <td>{c.field}</td>
                      <td className="old-val">{c.old}</td>
                      <td className="new-val">{c.next}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {e.action === "重复提交" && e.snapshot && (
              <div className="meta" style={{ marginTop: 6, color: "#64748b" }}>
                <span>
                  重复提交内容：{e.snapshot.name}（{e.snapshot.grade}），双眼数据与已有记录一致，未覆盖最早记录。
                </span>
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
}
