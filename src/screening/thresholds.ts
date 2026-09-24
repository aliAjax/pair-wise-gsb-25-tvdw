// 转诊阈值：集中一处，便于按政策调整，不与判定流程或界面耦合。
// 所有数值单位在字段名中显式标出。

export interface Thresholds {
  /** 裸眼视力低于该值即命中（标准对数 5 分记录，不含等于） */
  nakedVisionBelow: number;
  /** 等效球镜（D）低于该值即命中（不含等于） */
  seBelowD: number;
  /** 眼轴复查窗口长度（天） */
  axialWindowDays: number;
  /** 窗口内眼轴增长超过该值即命中（mm，不含等于） */
  axialGrowthMm: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  nakedVisionBelow: 4.8,
  seBelowD: -0.5,
  axialWindowDays: 183, // 约半年，允许取“半年内最近一次”作基线
  axialGrowthMm: 0.2,
};

/** 阈值文案，供命中项与界面提示复用，避免数字散落 */
export const thresholdText = (t: Thresholds): string =>
  `裸眼<${t.nakedVisionBelow.toFixed(1)}｜等效球镜<${t.seBelowD.toFixed(
    2,
  )}D｜${Math.round(t.axialWindowDays / 30.4)}个月眼轴增长>${t.axialGrowthMm.toFixed(2)}mm`;
