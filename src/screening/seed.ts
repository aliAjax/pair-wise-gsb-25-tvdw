// 演示数据：供首次使用时一键载入，便于核对判定与留档。不自动写入。

import type { ScreeningInput } from "./types";
import { submit } from "./ledger";

export const SEED_INPUTS: ScreeningInput[] = [
  {
    // 正常基线：半年后眼轴快速增长（右眼）
    studentId: "S2026001",
    name: "王小明",
    grade: "三年级",
    date: "2026-03-20",
    right: { nakedVA: "5.0", sphere: "-0.25", cylinder: "0", axis: "180", axialLength: "23.20" },
    left: { nakedVA: "5.0", sphere: "0", cylinder: "0", axis: "180", axialLength: "23.10" },
  },
  {
    // 右眼眼轴半年 +0.31mm 命中；其余正常
    studentId: "S2026001",
    name: "王小明",
    grade: "三年级",
    date: "2026-09-18",
    right: { nakedVA: "5.0", sphere: "-0.25", cylinder: "0", axis: "180", axialLength: "23.51" },
    left: { nakedVA: "5.0", sphere: "0", cylinder: "0", axis: "180", axialLength: "23.15" },
  },
  {
    // 裸眼 + 等效球镜双命中（左眼散光轴位记录）
    studentId: "S2026002",
    name: "李思雨",
    grade: "五年级",
    date: "2026-09-18",
    right: { nakedVA: "4.7", sphere: "-1.00", cylinder: "-0.50", axis: "175", axialLength: "24.10" },
    left: { nakedVA: "4.6", sphere: "-1.25", cylinder: "-0.75", axis: "10", axialLength: "24.05" },
  },
  {
    // 左眼裸眼 4.7 命中
    studentId: "S2026003",
    name: "张小宇",
    grade: "一年级",
    date: "2026-09-19",
    right: { nakedVA: "4.9", sphere: "0", cylinder: "0", axis: "90", axialLength: "22.40" },
    left: { nakedVA: "4.7", sphere: "0", cylinder: "0", axis: "90", axialLength: "22.45" },
  },
  {
    // 完全正常
    studentId: "S2026004",
    name: "陈一一",
    grade: "二年级",
    date: "2026-09-19",
    right: { nakedVA: "5.1", sphere: "+0.25", cylinder: "0", axis: "180", axialLength: "22.80" },
    left: { nakedVA: "5.1", sphere: "+0.25", cylinder: "0", axis: "180", axialLength: "22.75" },
  },
];

/** 按筛查日顺序逐条走正常录入流程；已存在数据时不做任何写入 */
export const seedDemoData = ():
  | { ok: true; added: number }
  | { ok: false; reason: string } => {
  let added = 0;
  for (const input of SEED_INPUTS.slice().sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const r = submit(input, "演示数据");
    if (r.kind === "created") added += 1;
    else if (r.kind === "conflict" || r.kind === "duplicate") {
      return { ok: false, reason: "台账已有数据，演示数据未载入" };
    } else return { ok: false, reason: "演示数据未通过校验" };
  }
  return { ok: true, added };
};
