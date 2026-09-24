// 手工断言测试：经 esbuild 打包后在 Node 运行，不引入测试框架。
// 覆盖：三条转诊规则、重复提交留最早、冲突需修改原因、旧值留档、CSV 导出。

import { DEFAULT_THRESHOLDS } from "../src/screening/thresholds";
import {
  evaluate,
  sphericalEquivalent,
  isDuplicateSubmission,
  diffRecords,
} from "../src/screening/rules";
import { validateInput } from "../src/screening/validation";
import { submit, amend, referralList, auditTrail, evaluatedList } from "../src/screening/ledger";
import { recordsToCsv } from "../src/screening/csv";
import type { ScreeningInput, ScreeningRecord } from "../src/screening/types";
import { emptyEye } from "../src/screening/types";

// ---- 极简 localStorage 桩 ----
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

let passed = 0;
let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error("FAIL:", msg);
  }
};
const eq = <T,>(a: T, b: T, msg: string) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const eye = (p: Partial<ScreeningInput["right"]> = {}) => ({ ...emptyEye(), ...p });
const baseInput = (p: Partial<ScreeningInput> = {}): ScreeningInput => ({
  studentId: "S1",
  name: "张三",
  grade: "三年级",
  date: "2026-09-20",
  right: eye(),
  left: eye(),
  ...p,
});

// 1. 等效球镜计算
eq(sphericalEquivalent(eye({ sphere: "-1.00", cylinder: "-0.50" })), -1.25, "SE = 球镜+柱镜/2");
eq(sphericalEquivalent(eye({ sphere: "-1.00", cylinder: "" })), null, "柱镜缺失时 SE 为 null");

// 2. 裸眼低于 4.8 命中（等于 4.8 不命中）
ok(
  evaluate(baseInput({ right: eye({ nakedVA: "4.7" }) }), [], DEFAULT_THRESHOLDS).status === "待转诊",
  "右眼裸眼 4.7 待转诊",
);
ok(
  evaluate(baseInput({ right: eye({ nakedVA: "4.8" }) }), [], DEFAULT_THRESHOLDS).hits.length === 0,
  "裸眼 4.8 为临界，不命中",
);

// 3. SE 低于 -0.50 命中；-0.50 本身不命中
ok(
  evaluate(
    baseInput({ left: eye({ sphere: "-0.75", cylinder: "-0.50" }) }), // SE -1.00
    [],
    DEFAULT_THRESHOLDS,
  ).hits[0].includes("左眼"),
  "左眼 SE -1.00 命中且标注左眼",
);
ok(
  evaluate(
    baseInput({ right: eye({ sphere: "-0.50", cylinder: "0" }) }),
    [],
    DEFAULT_THRESHOLDS,
  ).hits.length === 0,
  "SE = -0.50 临界不命中",
);

// 4. 半年眼轴增长超 0.20
const baselineRec: ScreeningRecord = {
  ...baseInput({
    studentId: "S2",
    date: "2026-03-25",
    right: eye({ axialLength: "23.20" }),
    left: eye({ axialLength: "23.00" }),
  }),
  id: "S2@2026-03-25",
  createdAt: "2026-03-25T08:00:00.000Z",
  updatedAt: "2026-03-25T08:00:00.000Z",
};
const growthInput = baseInput({
  studentId: "S2",
  date: "2026-09-20",
  right: eye({ axialLength: "23.41" }), // +0.21 命中
  left: eye({ axialLength: "23.20" }),  // +0.20 临界不命中
});
const g = evaluate(growthInput, [baselineRec], DEFAULT_THRESHOLDS);
eq(g.hits.length, 1, "仅右眼眼轴增长命中");
ok(g.hits[0].includes("右眼") && g.hits[0].includes("23.20→23.41"), "命中文案含基线与数值");

// 4b. 超窗口不作基线
const oldBaseline: ScreeningRecord = {
  ...baselineRec,
  date: "2025-09-01",
  id: "S2@2025-09-01",
};
ok(
  evaluate(growthInput, [oldBaseline], DEFAULT_THRESHOLDS).hits.length === 0,
  "超过半年窗口的记录不作为眼轴基线",
);

// 5. 校验
ok(validateInput(baseInput({ right: eye(), left: eye() })).some((e) => e.field === "eyes"), "双眼全空报错");
ok(validateInput(baseInput({ date: "2026-13-01" })).some((e) => e.field === "date"), "非法日期报错");
ok(validateInput(baseInput({ right: eye({ axis: "200" }) })).length > 0, "轴位超范围报错");
ok(validateInput(baseInput({ studentId: " " })).some((e) => e.field === "studentId"), "学号必填");

// ---- 用例层：存储 + 留档 ----
mem.clear();

// 6. 正常录入
const r1 = submit(baseInput({ studentId: "S3", right: eye({ nakedVA: "4.6" }) }), "验光师甲");
eq(r1.kind, "created", "首次录入成功");

// 7. 完全重复提交：保留最早记录
const dup = submit(baseInput({ studentId: "S3", right: eye({ nakedVA: "4.6" }) }), "验光师乙");
eq(dup.kind, "duplicate", "完全重复识别为 duplicate");
const afterDup = evaluatedList(DEFAULT_THRESHOLDS).filter((r) => r.studentId === "S3");
eq(afterDup.length, 1, "重复提交不新增记录");
ok(auditTrail().some((a) => a.action === "重复提交" && a.operator === "验光师乙"), "重复提交留痕含操作人与快照键");

// 8. 同日不同数据：冲突，不静默覆盖
const conflict = submit(
  baseInput({ studentId: "S3", right: eye({ nakedVA: "4.5" }) }),
  "验光师甲",
);
eq(conflict.kind, "conflict", "同日数据不一致返回 conflict");

// 9. 无原因修改被拒
if (r1.kind === "created") {
  const noReason = amend(r1.record.id, baseInput({ studentId: "S3", right: eye({ nakedVA: "4.5" }) }), "  ", "验光师甲");
  eq(noReason.kind, "invalid", "修改无原因被拒绝");

  // 10. 正常修改：旧值留档
  const changed = amend(
    r1.record.id,
    baseInput({ studentId: "S3", right: eye({ nakedVA: "4.5" }) }),
    "原表抄写错误，复核验光单更正",
    "验光师甲",
  );
  eq(changed.kind, "amended", "带原因修改成功");
  if (changed.kind === "amended") {
    const c = changed.audit.changes ?? [];
    ok(c.some((x) => x.field === "右眼 · 裸眼视力" && x.old === "4.6" && x.next === "4.5"), "留档逐项记录旧值→新值");
  }
}

// 11. 待转诊名单只含命中项且按日期倒序
const pending = referralList(DEFAULT_THRESHOLDS);
ok(pending.every((r) => r.status === "待转诊"), "名单全部待转诊");
ok(pending.every((r) => r.hits.length > 0), "名单每条写明命中项");

// 12. 修改不存在的记录
eq(amend("nope@x", baseInput({ studentId: "x" }), "原因", "甲").kind, "missing", "缺失记录返回 missing");

// 13. 重复判定数值等价：4.60 与 4.6
if (r1.kind === "created") {
  const rec = evaluatedList(DEFAULT_THRESHOLDS).find((x) => x.id === r1.record.id)!;
  ok(
    isDuplicateSubmission(
      rec,
      baseInput({ studentId: "S3", right: eye({ nakedVA: "4.50" }) }),
    ),
    "数值等价（4.50=4.5）视为重复",
  );
}

// 14. diff 只记录变化字段
const d = diffRecords(
  baseInput({ right: eye({ nakedVA: "4.8", sphere: "-1.00" }) }),
  baseInput({ right: eye({ nakedVA: "4.7", sphere: "-1.00" }) }),
);
eq(d.length, 1, "diff 仅含变化项");
eq(d[0]?.field, "右眼 · 裸眼视力", "diff 字段名正确");

// 15. CSV 转义与表头
const csv = recordsToCsv(evaluatedList(DEFAULT_THRESHOLDS));
ok(csv.startsWith("﻿"), "CSV 带 BOM");
ok(csv.includes("待转诊") && csv.includes("学号"), "CSV 含状态与表头");

// 16. 阈值边界：4.79 视力 < 4.8 命中
ok(
  evaluate(baseInput({ right: eye({ nakedVA: "4.79" }) }), [], DEFAULT_THRESHOLDS).status === "待转诊",
  "4.79 < 4.8 命中",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
