// 操作层：提交、修改、查询、待转诊名单。
// 界面只调用这里的函数，不直接拼装存储与规则。

import type {
  AuditEntry,
  EvaluatedRecord,
  ScreeningInput,
  ScreeningRecord,
} from "./types";
import type { Thresholds } from "./thresholds";
import type { ValidationError } from "./validation";
import { validateInput } from "./validation";
import {
  applyChanges,
  diffRecords,
  evaluate,
  findSameDay,
  isDuplicateSubmission,
} from "./rules";
import {
  appendAudit,
  loadAudit,
  loadRecords,
  makeRecord,
  saveRecords,
} from "./storage";

export type SubmitOutcome =
  | { kind: "created"; record: ScreeningRecord }
  | { kind: "duplicate"; record: ScreeningRecord; audit: AuditEntry }
  | { kind: "conflict"; existing: ScreeningRecord }
  | { kind: "invalid"; errors: ValidationError[] };

export const submit = (
  input: ScreeningInput,
  operator: string,
): SubmitOutcome => {
  const errors = validateInput(input);
  if (errors.length) return { kind: "invalid", errors };

  const records = loadRecords();
  const sameDay = findSameDay(input, records);
  if (sameDay) {
    if (isDuplicateSubmission(sameDay, input)) {
      // 重复提交：保留最早记录，只留痕不覆盖数据
      const audit = appendAudit({
        action: "重复提交",
        operator,
        recordKey: sameDay.id,
        snapshot: input,
      });
      return { kind: "duplicate", record: sameDay, audit };
    }
    return { kind: "conflict", existing: sameDay };
  }

  const record = makeRecord(input);
  saveRecords([...records, record]);
  appendAudit({ action: "录入", operator, recordKey: record.id });
  return { kind: "created", record };
};

export type AmendOutcome =
  | { kind: "amended"; record: ScreeningRecord; audit: AuditEntry }
  | { kind: "missing" }
  | { kind: "invalid"; errors: ValidationError[] }
  | { kind: "nochange" };

export const amend = (
  recordId: string,
  next: ScreeningInput,
  reason: string,
  operator: string,
): AmendOutcome => {
  if (!reason.trim())
    return { kind: "invalid", errors: [{ field: "reason", message: "修改必须填写原因" }] };

  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx < 0) return { kind: "missing" };

  const errors = validateInput(next);
  if (errors.length) return { kind: "invalid", errors };

  const old = records[idx];
  const changes = diffRecords(old, next);
  if (!changes.length) return { kind: "nochange" };

  const updated: ScreeningRecord = {
    ...applyChanges(old, next),
    updatedAt: new Date().toISOString(),
  };
  const nextRecords = records.slice();
  nextRecords[idx] = updated;
  saveRecords(nextRecords);

  const audit = appendAudit({
    action: "修改",
    operator,
    recordKey: old.id,
    reason: reason.trim(),
    changes,
  });
  return { kind: "amended", record: updated, audit };
};

const byDateAsc = (a: ScreeningRecord, b: ScreeningRecord) =>
  a.date.localeCompare(b.date) || a.studentId.localeCompare(b.studentId);

/** 当前阈值下，对全部记录重新计算命中项（阈值变化无需迁移数据） */
export const evaluatedList = (t: Thresholds): EvaluatedRecord[] => {
  const records = loadRecords().slice().sort(byDateAsc);
  return records.map((r) => {
    const { hits, status } = evaluate(r, records, t);
    return { ...r, hits, status };
  });
};

/** 待转诊名单：按筛查日倒序，最近的待处理项在前 */
export const referralList = (t: Thresholds): EvaluatedRecord[] =>
  evaluatedList(t)
    .filter((r) => r.status === "待转诊")
    .sort((a, b) =>
      b.date.localeCompare(a.date) || a.studentId.localeCompare(b.studentId),
    );

export const auditTrail = (): AuditEntry[] =>
  loadAudit().sort((a, b) => b.seq - a.seq);
