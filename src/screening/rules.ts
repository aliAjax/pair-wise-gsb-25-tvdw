// 判定规则（纯函数）：输入与既往记录 → 命中项。
// 不接触存储与 DOM，便于单测；阈值全部由参数传入。

import type {
  EyeData,
  FieldChange,
  ScreeningInput,
  ScreeningRecord,
} from "./types";
import type { Thresholds } from "./thresholds";

export const EYE_LABEL: Record<"R" | "L", string> = {
  R: "右眼",
  L: "左眼",
};

const EYE_FIELDS: { key: keyof EyeData; label: string }[] = [
  { key: "nakedVA", label: "裸眼视力" },
  { key: "sphere", label: "球镜(D)" },
  { key: "cylinder", label: "柱镜(D)" },
  { key: "axis", label: "轴位(°)" },
  { key: "axialLength", label: "眼轴(mm)" },
];

export const recordKeyOf = (studentId: string, date: string): string =>
  `${studentId.trim()}@${date.trim()}`;

const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** 等效球镜 SE = 球镜 + 柱镜/2；任一缺失则无法计算 */
export const sphericalEquivalent = (eye: EyeData): number | null => {
  const sphere = parseNum(eye.sphere);
  const cylinder = parseNum(eye.cylinder);
  if (sphere === null || cylinder === null) return null;
  return sphere + cylinder / 2;
};

const daysBetween = (from: string, to: string): number | null => {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
};

/** 同一学生在窗口内、且早于本次筛查日的记录，按日期升序 */
const priorRecords = (
  input: ScreeningInput,
  history: ScreeningRecord[],
  windowDays: number,
): ScreeningRecord[] => {
  const sid = input.studentId.trim();
  return history
    .filter((r) => {
      if (r.studentId.trim() !== sid) return false;
      const d = daysBetween(r.date, input.date);
      return d !== null && d > 0 && d <= windowDays;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

export interface EvaluateResult {
  hits: string[];
  status: "待转诊" | "正常";
}

/** 依据阈值计算命中项；任一眼命中任一条即进入待转诊名单 */
export const evaluate = (
  input: ScreeningInput,
  history: ScreeningRecord[],
  t: Thresholds,
): EvaluateResult => {
  const hits: string[] = [];

  (["R", "L"] as const).forEach((side) => {
    const eye = side === "R" ? input.right : input.left;
    const label = EYE_LABEL[side];

    const va = parseNum(eye.nakedVA);
    if (va !== null && va < t.nakedVisionBelow) {
      hits.push(
        `${label}裸眼视力 ${va.toFixed(1)} 低于 ${t.nakedVisionBelow.toFixed(1)}`,
      );
    }

    const se = sphericalEquivalent(eye);
    if (se !== null && se < t.seBelowD) {
      hits.push(
        `${label}等效球镜 ${se.toFixed(2)}D 低于 ${t.seBelowD.toFixed(2)}D`,
      );
    }
  });

  // 眼轴：以窗口内最早一次（约半年前）为基线，逐眼比较增长量
  const priors = priorRecords(input, history, t.axialWindowDays);
  const baseline = priors[0];
  if (baseline) {
    const interval = daysBetween(baseline.date, input.date);
    (["R", "L"] as const).forEach((side) => {
      const cur = parseNum(
        (side === "R" ? input.right : input.left).axialLength,
      );
      const base = parseNum(
        (side === "R" ? baseline.right : baseline.left).axialLength,
      );
      if (cur !== null && base !== null) {
        const delta = cur - base;
        if (delta > t.axialGrowthMm) {
          hits.push(
            `${EYE_LABEL[side]}眼轴 ${base.toFixed(2)}→${cur.toFixed(
              2,
            )}mm，${interval}天增长 ${delta.toFixed(
              2,
            )}mm 超过 ${t.axialGrowthMm.toFixed(2)}mm（基线 ${baseline.date}）`,
          );
        }
      }
    });
  }

  return { hits, status: hits.length > 0 ? "待转诊" : "正常" };
};

/** 数值字段规范化：4.80 与 4.8 视为同值；无法解析的按去空文本比较 */
const norm = (s: string): string => {
  const t = s.trim();
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? String(n) : t;
};

const eyeEqual = (a: EyeData, b: EyeData): boolean =>
  EYE_FIELDS.every((f) => norm(a[f.key]) === norm(b[f.key]));

/** 是否为完全重复的提交（同学号、同筛查日、同全部测量值） */
export const isDuplicateSubmission = (
  existing: ScreeningRecord,
  input: ScreeningInput,
): boolean =>
  existing.studentId.trim() === input.studentId.trim() &&
  existing.date.trim() === input.date.trim() &&
  existing.grade.trim() === input.grade.trim() &&
  existing.name.trim() === input.name.trim() &&
  eyeEqual(existing.right, input.right) &&
  eyeEqual(existing.left, input.left);

export const findSameDay = (
  input: ScreeningInput,
  history: ScreeningRecord[],
): ScreeningRecord | undefined =>
  history.find(
    (r) => recordKeyOf(r.studentId, r.date) ===
      recordKeyOf(input.studentId, input.date),
  );

/** 逐字段比对，生成修改留档所需的旧值 → 新值清单 */
export const diffRecords = (
  old: ScreeningInput,
  next: ScreeningInput,
): FieldChange[] => {
  const changes: FieldChange[] = [];
  const push = (field: string, a: string, b: string) => {
    if (norm(a) !== norm(b)) changes.push({ field, old: a || "空", next: b || "空" });
  };
  push("姓名", old.name, next.name);
  push("年级", old.grade, next.grade);
  (["R", "L"] as const).forEach((side) => {
    const oe = side === "R" ? old.right : old.left;
    const ne = side === "R" ? next.right : next.left;
    EYE_FIELDS.forEach((f) =>
      push(`${EYE_LABEL[side]} · ${f.label}`, oe[f.key], ne[f.key]),
    );
  });
  return changes;
};

/** 把 diff 的新值应用到记录对象（保持不可变写法由仓储层负责） */
export const applyChanges = (
  record: ScreeningRecord,
  next: ScreeningInput,
): ScreeningRecord => ({
  ...record,
  name: next.name,
  grade: next.grade,
  right: { ...next.right },
  left: { ...next.left },
});
