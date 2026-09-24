// 数据模型：筛查台账的核心数据结构

export interface EyeMeasure {
  nakedVision: number | null; // 裸眼视力（5分记录法，如 4.9）
  sphere: number | null; // 球镜（D）
  cylinder: number | null; // 柱镜（D）
  axis: number | null; // 轴位（°，0-180）
  axialLength: number | null; // 眼轴（mm）
}

export interface ScreeningRecord {
  id: string;
  studentId: string; // 学号（与筛查日一起判重）
  studentName: string;
  grade: string; // 年级
  screeningDate: string; // 筛查日 YYYY-MM-DD
  right: EyeMeasure; // 右眼
  left: EyeMeasure; // 左眼
  createdAt: string; // 首次提交时间（重复提交保留最早记录，此时间不变）
  updatedAt: string;
  version: number; // 修改次数 +1
}

export type RecordInput = Omit<ScreeningRecord, "id" | "createdAt" | "updatedAt" | "version">;

// 留档：一次字段变更的旧值与新值
export interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

// 留档：修改记录（必须带原因）
export interface Amendment {
  id: string;
  recordId: string;
  studentLabel: string;
  amendedAt: string;
  reason: string;
  changes: FieldChange[];
}

// 留档：被拦截的重复提交
export interface RejectionLog {
  id: string;
  rejectedAt: string;
  studentId: string;
  studentName: string;
  screeningDate: string;
  note: string;
}

export interface LedgerState {
  records: ScreeningRecord[];
  amendments: Amendment[];
  rejections: RejectionLog[];
}
