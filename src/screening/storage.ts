// 数据层（localStorage 持久化）：只管读写，不含规则与界面。
// 数据、留档、配置使用各自独立的命名空间键，互不覆盖。

import type { AuditEntry, ScreeningInput, ScreeningRecord } from "./types";
import { recordKeyOf } from "./rules";

const RECORDS_KEY = "vision-ledger:records:v1";
const AUDIT_KEY = "vision-ledger:audit:v1";

export interface StoredData {
  records: ScreeningRecord[];
}

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const loadRecords = (): ScreeningRecord[] =>
  safeParse<ScreeningRecord[]>(localStorage.getItem(RECORDS_KEY), []);

export const saveRecords = (records: ScreeningRecord[]): void => {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};

export const loadAudit = (): AuditEntry[] =>
  safeParse<AuditEntry[]>(localStorage.getItem(AUDIT_KEY), []);

const saveAudit = (entries: AuditEntry[]): void => {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
};

/** 留档只追加，任何操作都不删除既有痕迹 */
export const appendAudit = (
  entry: Omit<AuditEntry, "seq" | "at">,
): AuditEntry => {
  const entries = loadAudit();
  const full: AuditEntry = {
    seq: entries.length
      ? Math.max(...entries.map((e) => e.seq)) + 1
      : 1,
    at: new Date().toISOString(),
    ...entry,
  };
  entries.push(full);
  saveAudit(entries);
  return full;
};

export const nowStamp = (): string => new Date().toISOString();

export const makeRecord = (input: ScreeningInput): ScreeningRecord => ({
  ...input,
  right: { ...input.right },
  left: { ...input.left },
  id: recordKeyOf(input.studentId, input.date),
  createdAt: nowStamp(),
  updatedAt: nowStamp(),
});
