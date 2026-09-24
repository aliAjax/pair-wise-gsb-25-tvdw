// 台账操作：提交（判重）、修改（留旧值）、本地持久化

import { useEffect, useState } from "react";
import type {
  Amendment,
  EyeMeasure,
  FieldChange,
  LedgerState,
  RecordInput,
  RejectionLog,
  ScreeningRecord,
} from "./types";
import { seedState } from "./seed";

const STORAGE_KEY = "vision-screening-ledger-v1";

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function loadLedger(): LedgerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LedgerState;
      if (
        Array.isArray(parsed.records) &&
        Array.isArray(parsed.amendments) &&
        Array.isArray(parsed.rejections)
      ) {
        return parsed;
      }
    }
  } catch {
    // 本地数据损坏时回退到示例数据
  }
  return seedState();
}

export function useLedger() {
  const [state, setState] = useState<LedgerState>(loadLedger);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储失败不阻断页面操作
    }
  }, [state]);
  return { state, setState };
}

export interface OpResult {
  ok: boolean;
  message: string;
}

// 提交新记录：同一学生同一筛查日只留最早一条，重复提交拦截并留档
export function submitRecord(
  state: LedgerState,
  input: RecordInput
): { next: LedgerState; result: OpResult } {
  const dup = state.records.find(
    (r) => r.studentId === input.studentId && r.screeningDate === input.screeningDate
  );
  if (dup) {
    const rejection: RejectionLog = {
      id: uid(),
      rejectedAt: nowIso(),
      studentId: input.studentId,
      studentName: input.studentName,
      screeningDate: input.screeningDate,
      note: `与 ${dup.createdAt.slice(0, 16).replace("T", " ")} 写入的记录重复，已保留最早记录`,
    };
    return {
      next: { ...state, rejections: [rejection, ...state.rejections] },
      result: {
        ok: false,
        message: `重复提交：${input.studentName}（${input.studentId}）在 ${input.screeningDate} 已有记录，保留最早记录，本次未写入，已在留档区登记。`,
      },
    };
  }
  const record: ScreeningRecord = {
    ...input,
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    version: 1,
  };
  return {
    next: { ...state, records: [...state.records, record] },
    result: { ok: true, message: `已保存 ${input.studentName} ${input.screeningDate} 的筛查记录。` },
  };
}

const EYE_FIELDS: Array<{ key: keyof EyeMeasure; label: string }> = [
  { key: "nakedVision", label: "裸眼视力" },
  { key: "sphere", label: "球镜" },
  { key: "cylinder", label: "柱镜" },
  { key: "axis", label: "轴位" },
  { key: "axialLength", label: "眼轴" },
];

function fmtValue(v: number | null): string {
  return v == null ? "（空）" : String(v);
}

function flattenRecord(r: ScreeningRecord): Array<{ field: string; value: string }> {
  const rows = [
    { field: "姓名", value: r.studentName },
    { field: "年级", value: r.grade },
  ];
  (["right", "left"] as const).forEach((side) => {
    const sideLabel = side === "right" ? "右眼" : "左眼";
    EYE_FIELDS.forEach(({ key, label }) => {
      rows.push({ field: `${sideLabel}·${label}`, value: fmtValue(r[side][key]) });
    });
  });
  return rows;
}

export function diffRecords(before: ScreeningRecord, after: RecordInput): FieldChange[] {
  const oldRows = flattenRecord(before);
  const newRows = flattenRecord({ ...before, ...after });
  const changes: FieldChange[] = [];
  oldRows.forEach((row, i) => {
    if (row.value !== newRows[i].value) {
      changes.push({ field: row.field, oldValue: row.value, newValue: newRows[i].value });
    }
  });
  return changes;
}

// 修改记录：必须填原因，旧值随变更一起留档；学号与筛查日不允许改
export function amendRecord(
  state: LedgerState,
  recordId: string,
  patch: RecordInput,
  reason: string
): { next: LedgerState; result: OpResult } {
  const target = state.records.find((r) => r.id === recordId);
  if (!target) {
    return { next: state, result: { ok: false, message: "未找到要修改的记录。" } };
  }
  if (!reason.trim()) {
    return { next: state, result: { ok: false, message: "请填写修改原因，修改必须留痕。" } };
  }
  const changes = diffRecords(target, patch);
  if (changes.length === 0) {
    return { next: state, result: { ok: false, message: "没有检测到改动，未写入。" } };
  }
  const amended: ScreeningRecord = {
    ...target,
    ...patch,
    studentId: target.studentId,
    screeningDate: target.screeningDate,
    updatedAt: nowIso(),
    version: target.version + 1,
  };
  const amendment: Amendment = {
    id: uid(),
    recordId,
    studentLabel: `${target.studentName}（${target.studentId}）`,
    amendedAt: nowIso(),
    reason: reason.trim(),
    changes,
  };
  return {
    next: {
      ...state,
      records: state.records.map((r) => (r.id === recordId ? amended : r)),
      amendments: [amendment, ...state.amendments],
    },
    result: {
      ok: true,
      message: `已修改 ${target.studentName} 的记录，${changes.length} 处变更连同原因、旧值已留档。`,
    },
  };
}
