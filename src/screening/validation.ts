// 输入校验：只判断格式与取值范围，不做转诊判定。

import type { EyeData, ScreeningInput } from "./types";

export interface ValidationError {
  field: string;
  message: string;
}

const num = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const validateEye = (
  eye: EyeData,
  label: string,
  errors: ValidationError[],
): boolean => {
  let hasAny = false;
  const check = (
    key: keyof EyeData,
    name: string,
    test: (n: number) => boolean,
  ) => {
    const raw = eye[key];
    if (raw.trim() === "") return;
    hasAny = true;
    const n = num(raw);
    if (n === null || !test(n)) {
      errors.push({
        field: `${label}.${key}`,
        message: `${label}${name}取值无效：${raw || "空"}`,
      });
    }
  };

  check("nakedVA", "裸眼视力", (n) => n >= 3.0 && n <= 5.3);
  check("sphere", "球镜", (n) => n >= -20 && n <= 10);
  check("cylinder", "柱镜", (n) => n >= -10 && n <= 10);
  check("axis", "轴位", (n) => n >= 0 && n <= 180);
  check("axialLength", "眼轴", (n) => n >= 15 && n <= 35);
  return hasAny;
};

export const validateInput = (input: ScreeningInput): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!input.studentId.trim())
    errors.push({ field: "studentId", message: "学号必填" });
  if (!input.name.trim())
    errors.push({ field: "name", message: "姓名必填" });
  if (!input.grade.trim())
    errors.push({ field: "grade", message: "年级必填" });
  if (!ISO_DATE.test(input.date.trim()))
    errors.push({ field: "date", message: "筛查日需为 YYYY-MM-DD" });
  else if (Number.isNaN(Date.parse(`${input.date}T00:00:00`)))
    errors.push({ field: "date", message: "筛查日不是有效日期" });
  else if (input.date > new Date().toISOString().slice(0, 10))
    errors.push({ field: "date", message: "筛查日不能晚于今天" });

  const rAny = validateEye(input.right, "右眼", errors);
  const lAny = validateEye(input.left, "左眼", errors);
  if (!rAny && !lAny)
    errors.push({ field: "eyes", message: "左右眼至少填写一项测量数据" });

  return errors;
};
