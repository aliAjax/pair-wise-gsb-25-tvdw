// 阈值配置：独立命名空间，改动阈值不会触碰测量数据与留档。

import type { Thresholds } from "./thresholds";
import { DEFAULT_THRESHOLDS } from "./thresholds";

const SETTINGS_KEY = "vision-ledger:settings:v1";
const OPERATOR_KEY = "vision-ledger:operator:v1";

export const loadThresholds = (): Thresholds => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };
    const parsed = JSON.parse(raw) as Partial<Thresholds>;
    return { ...DEFAULT_THRESHOLDS, ...parsed };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
};

export const saveThresholds = (t: Thresholds): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(t));
};

export const loadOperator = (): string =>
  localStorage.getItem(OPERATOR_KEY) ?? "";

export const saveOperator = (name: string): void => {
  localStorage.setItem(OPERATOR_KEY, name);
};
