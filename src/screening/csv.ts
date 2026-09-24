// 导出：把记录或留档转成带 BOM 的 CSV 文本（Excel 可直接打开）。纯字符串处理，无依赖。

import type { AuditEntry, EvaluatedRecord } from "./types";

const esc = (v: string | number | undefined): string => {
  const s = v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const RECORD_HEADER = [
  "学号",
  "姓名",
  "年级",
  "筛查日",
  "右眼裸眼视力",
  "右眼球镜D",
  "右眼柱镜D",
  "右眼轴位",
  "右眼眼轴mm",
  "左眼裸眼视力",
  "左眼球镜D",
  "左眼柱镜D",
  "左眼轴位",
  "左眼眼轴mm",
  "判定状态",
  "命中项",
  "建档时间",
  "最后修改时间",
];

export const recordsToCsv = (records: EvaluatedRecord[]): string => {
  const lines = [RECORD_HEADER.join(",")];
  for (const r of records) {
    lines.push(
      [
        r.studentId,
        r.name,
        r.grade,
        r.date,
        r.right.nakedVA,
        r.right.sphere,
        r.right.cylinder,
        r.right.axis,
        r.right.axialLength,
        r.left.nakedVA,
        r.left.sphere,
        r.left.cylinder,
        r.left.axis,
        r.left.axialLength,
        r.status,
        r.hits.join("；"),
        r.createdAt,
        r.updatedAt,
      ]
        .map(esc)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
};

const AUDIT_HEADER = [
  "序号",
  "时间",
  "操作",
  "操作人",
  "记录",
  "原因",
  "变更明细",
];

export const auditToCsv = (entries: AuditEntry[]): string => {
  const lines = [AUDIT_HEADER.join(",")];
  for (const e of entries) {
    const changes = (e.changes ?? [])
      .map((c) => `${c.field}: ${c.old} → ${c.next}`)
      .join("；");
    lines.push(
      [e.seq, e.at, e.action, e.operator, e.recordKey, e.reason ?? "", changes]
        .map(esc)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
};

export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
