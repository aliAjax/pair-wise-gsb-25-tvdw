// 示例数据：首次打开页面时载入，之后以浏览器本地存储为准

import type { EyeMeasure, LedgerState, ScreeningRecord } from "./types";

function eye(
  nakedVision: number | null,
  sphere: number | null = null,
  cylinder: number | null = null,
  axis: number | null = null,
  axialLength: number | null = null
): EyeMeasure {
  return { nakedVision, sphere, cylinder, axis, axialLength };
}

const seedRecords: ScreeningRecord[] = [
  {
    id: "rec-seed-1",
    studentId: "S20260301",
    studentName: "张小明",
    grade: "三年级",
    screeningDate: "2026-03-10",
    right: eye(4.9, -0.25, 0, 180, 23.1),
    left: eye(4.7, -0.75, -0.5, 175, 23.22),
    createdAt: "2026-03-10T09:12:00",
    updatedAt: "2026-03-10T09:12:00",
    version: 1,
  },
  {
    id: "rec-seed-2",
    studentId: "S20260301",
    studentName: "张小明",
    grade: "四年级",
    screeningDate: "2026-09-12",
    right: eye(4.8, -0.75, -0.25, 180, 23.34),
    left: eye(4.5, -1.25, -0.5, 175, 23.47),
    createdAt: "2026-09-12T10:03:00",
    updatedAt: "2026-09-12T10:03:00",
    version: 1,
  },
  {
    id: "rec-seed-3",
    studentId: "S20210507",
    studentName: "李思",
    grade: "五年级",
    screeningDate: "2026-09-15",
    right: eye(5.0, 0, 0, null, 22.4),
    left: eye(5.0, -0.25, 0, null, 22.38),
    createdAt: "2026-09-15T10:05:00",
    updatedAt: "2026-09-15T15:20:00",
    version: 2,
  },
  {
    id: "rec-seed-4",
    studentId: "S20240933",
    studentName: "王浩",
    grade: "初一",
    screeningDate: "2026-09-18",
    right: eye(4.6, -1.25, -0.5, 10, 24.1),
    left: eye(4.9, -0.5, 0, null, 23.85),
    createdAt: "2026-09-18T08:47:00",
    updatedAt: "2026-09-18T08:47:00",
    version: 1,
  },
  {
    id: "rec-seed-5",
    studentId: "S20250211",
    studentName: "陈果",
    grade: "二年级",
    screeningDate: "2026-09-18",
    right: eye(5.0, 0, 0, null, 22.1),
    left: eye(5.0, 0, 0, null, 22.12),
    createdAt: "2026-09-18T09:26:00",
    updatedAt: "2026-09-18T09:26:00",
    version: 1,
  },
];

export function seedState(): LedgerState {
  return {
    records: seedRecords.map((r) => ({ ...r })),
    amendments: [
      {
        id: "amd-seed-1",
        recordId: "rec-seed-3",
        studentLabel: "李思（S20210507）",
        amendedAt: "2026-09-15T15:20:00",
        reason: "现场复测左眼裸眼为 5.0，更正录入笔误",
        changes: [{ field: "左眼·裸眼视力", oldValue: "4.9", newValue: "5.0" }],
      },
    ],
    rejections: [],
  };
}
