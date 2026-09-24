// 筛查台账的领域类型定义
// 数据结构只描述“是什么”，不含阈值、存储与界面逻辑。

export type EyeSide = "R" | "L";

/** 单眼检查数据；空字符串表示该次筛查未测量 / 未提供 */
export interface EyeData {
  /** 裸眼视力，标准对数视力表 5 分记录，如 4.8 */
  nakedVA: string;
  /** 球镜（D），如 -1.25 */
  sphere: string;
  /** 柱镜（D），如 -0.50 */
  cylinder: string;
  /** 轴位（°），0–180 整数 */
  axis: string;
  /** 眼轴长度（mm），如 23.50 */
  axialLength: string;
}

export interface ScreeningInput {
  studentId: string;
  name: string;
  grade: string;
  /** 筛查日 YYYY-MM-DD */
  date: string;
  right: EyeData;
  left: EyeData;
}

export type ReferralStatus = "待转诊" | "正常";

/** 台账存储的记录本体：只含测量数据与建档时间，不含任何阈值判定结果 */
export interface ScreeningRecord extends ScreeningInput {
  /** 由“学号 + 筛查日”生成的稳定编号 */
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** 界面使用：在记录上叠加当前阈值下的判定结果 */
export interface EvaluatedRecord extends ScreeningRecord {
  hits: string[];
  status: ReferralStatus;
}

export interface FieldChange {
  /** 字段全名，如“右眼 · 球镜” */
  field: string;
  old: string;
  next: string;
}

export type AuditAction = "录入" | "重复提交" | "修改";

/** 留档：只允许追加的操作痕迹 */
export interface AuditEntry {
  seq: number;
  at: string;
  action: AuditAction;
  operator: string;
  /** 学号@筛查日，便于按学生筛查事件追溯 */
  recordKey: string;
  /** 修改时必填的原因 */
  reason?: string;
  /** 修改时逐字段的旧值 → 新值 */
  changes?: FieldChange[];
  /** 重复提交被忽略时，保留本次提交的原始输入 */
  snapshot?: ScreeningInput;
}

export const emptyEye = (): EyeData => ({
  nakedVA: "",
  sphere: "",
  cylinder: "",
  axis: "",
  axialLength: "",
});

export const emptyInput = (): ScreeningInput => ({
  studentId: "",
  name: "",
  grade: "",
  date: "",
  right: emptyEye(),
  left: emptyEye(),
});
