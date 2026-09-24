// 阈值与转诊规则：所有判定标准集中在这里，调整阈值只改这一个文件

import type { EyeMeasure, ScreeningRecord } from "./types";

export const THRESHOLDS = {
  nakedVisionMin: 4.8, // 裸眼视力低于 4.8 → 转诊
  sphericalEquivalentMin: -0.5, // 等效球镜低于 -0.50D → 转诊
  axialGrowthHalfYearMax: 0.2, // 半年眼轴增长超过 0.20mm → 转诊
  halfYearDays: 182.5, // 半年折算天数（用于把两次筛查间隔折算成半年增速）
} as const;

export type EyeSide = "right" | "left";

export const EYE_LABEL: Record<EyeSide, string> = { right: "右眼", left: "左眼" };

export interface ReferralHit {
  eye: string;
  ruleId: "naked" | "se" | "axial";
  label: string; // 命中项名称
  detail: string; // 命中项说明（含实际值与阈值）
}

// 等效球镜 = 球镜 + 柱镜 / 2（柱镜缺省按 0 计）
export function sphericalEquivalent(eye: EyeMeasure): number | null {
  if (eye.sphere == null) return null;
  return eye.sphere + (eye.cylinder ?? 0) / 2;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

// 找同一学生在该记录之前最近一次筛查记录（用于眼轴增长对比）
export function findPreviousRecord(
  records: ScreeningRecord[],
  record: ScreeningRecord
): ScreeningRecord | null {
  let best: ScreeningRecord | null = null;
  for (const r of records) {
    if (r.studentId !== record.studentId || r.id === record.id) continue;
    if (r.screeningDate >= record.screeningDate) continue;
    if (!best || r.screeningDate > best.screeningDate) best = r;
  }
  return best;
}

// 评估一条记录命中哪些转诊规则；命中只进名单，不影响保存
export function evaluateRecord(
  record: ScreeningRecord,
  previous: ScreeningRecord | null
): ReferralHit[] {
  const hits: ReferralHit[] = [];
  (["right", "left"] as EyeSide[]).forEach((side) => {
    const eye = record[side];
    const eyeLabel = EYE_LABEL[side];

    if (eye.nakedVision != null && eye.nakedVision < THRESHOLDS.nakedVisionMin) {
      hits.push({
        eye: eyeLabel,
        ruleId: "naked",
        label: "裸眼视力偏低",
        detail: `${eyeLabel}裸眼视力 ${eye.nakedVision.toFixed(1)} < ${THRESHOLDS.nakedVisionMin.toFixed(1)}`,
      });
    }

    const se = sphericalEquivalent(eye);
    if (se != null && se < THRESHOLDS.sphericalEquivalentMin) {
      hits.push({
        eye: eyeLabel,
        ruleId: "se",
        label: "等效球镜超标",
        detail: `${eyeLabel}等效球镜 ${se.toFixed(2)}D < ${THRESHOLDS.sphericalEquivalentMin.toFixed(2)}D`,
      });
    }

    if (previous) {
      const prevEye = previous[side];
      if (eye.axialLength != null && prevEye.axialLength != null) {
        const days = daysBetween(previous.screeningDate, record.screeningDate);
        if (days > 0) {
          const growth = eye.axialLength - prevEye.axialLength;
          const halfYear = (growth * THRESHOLDS.halfYearDays) / days;
          if (halfYear > THRESHOLDS.axialGrowthHalfYearMax) {
            hits.push({
              eye: eyeLabel,
              ruleId: "axial",
              label: "眼轴增长过快",
              detail: `${eyeLabel}眼轴 ${days} 天增长 ${growth.toFixed(2)}mm，折算半年 ${halfYear.toFixed(2)}mm > ${THRESHOLDS.axialGrowthHalfYearMax.toFixed(2)}mm`,
            });
          }
        }
      }
    }
  });
  return hits;
}
