import { useState } from "react";
import type { ScreeningInput, ScreeningRecord } from "../screening/types";
import { emptyEye } from "../screening/types";
import { submit, amend } from "../screening/ledger";
import type { ValidationError } from "../screening/validation";

interface AmendTarget {
  record: ScreeningRecord;
  next: ScreeningInput;
}

interface Props {
  operator: string;
  amendTarget: AmendTarget | null;
  onConsumed: () => void;
  onChange: () => void;
}

type Flash = { kind: "ok" | "warn"; text: string } | null;

const blankInput = (): ScreeningInput => ({
  studentId: "",
  name: "",
  grade: "",
  date: new Date().toISOString().slice(0, 10),
  right: emptyEye(),
  left: emptyEye(),
});

const eyeFields: { key: keyof ScreeningInput["right"]; label: string; placeholder: string }[] = [
  { key: "nakedVA", label: "裸眼视力", placeholder: "如 4.8" },
  { key: "sphere", label: "球镜(D)", placeholder: "如 -1.25" },
  { key: "cylinder", label: "柱镜(D)", placeholder: "如 -0.50" },
  { key: "axis", label: "轴位(°)", placeholder: "0–180" },
  { key: "axialLength", label: "眼轴(mm)", placeholder: "如 23.50" },
];

function ScreeningForm({ operator, amendTarget, onConsumed, onChange }: Props) {
  const [form, setForm] = useState<ScreeningInput>(
    amendTarget ? structuredClone(amendTarget.next) : blankInput(),
  );
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [localAmend, setLocalAmend] = useState<AmendTarget | null>(amendTarget);
  const target = localAmend;

  const setCommon = (key: keyof ScreeningInput, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const setEye = (side: "right" | "left", key: string, value: string) => {
    setForm((f) => ({ ...f, [side]: { ...f[side], [key]: value } }));
  };

  const invalidFields = new Set(errors.map((e) => e.field));

  const handleSubmit = () => {
    setErrors([]);
    setFlash(null);
    if (!operator.trim()) {
      setFlash({ kind: "warn", text: "请先在右上角填写操作人姓名" });
      return;
    }

    if (target) {
      const result = amend(target.record.id, form, reason, operator);
      if (result.kind === "invalid") {
        setErrors(result.errors);
        return;
      }
      if (result.kind === "nochange") {
        setFlash({ kind: "warn", text: "与原记录没有任何差异，未生成修改。" });
        return;
      }
      if (result.kind === "missing") {
        setFlash({ kind: "warn", text: "原记录不存在，无法修改。" });
        return;
      }
      const detail = (result.audit.changes ?? [])
        .map((c) => `${c.field}（${c.old}→${c.next}）`)
        .join("、");
      setFlash({
        kind: "ok",
        text: `已修改并留档：${target.record.id}，共 ${result.audit.changes?.length ?? 0} 项：${detail}`,
      });
      setLocalAmend(null);
      setReason("");
      setForm(blankInput());
      onChange();
      return;
    }

    const result = submit(form, operator);
    if (result.kind === "invalid") {
      setErrors(result.errors);
      return;
    }
    if (result.kind === "duplicate") {
      setFlash({
        kind: "warn",
        text: `重复提交：${result.record.id} 已有完全相同的记录，已保留最早记录（建档于 ${result.record.createdAt.slice(0, 16).replace("T", " ")}），本次仅记入留档。`,
      });
      onChange();
      return;
    }
    if (result.kind === "conflict") {
      // 同一学生同一天但数据不同：不静默覆盖，转修改流程并强制填写原因
      setLocalAmend({ record: result.existing, next: structuredClone(form) });
      setErrors([]);
      setFlash({
        kind: "warn",
        text: `该生在 ${result.existing.date} 已有记录但数据不同。如需更正，请填写修改原因后提交，旧值会写入留档；如系误录请取消。`,
      });
      return;
    }
    setFlash({
      kind: "ok",
      text: `已录入：${result.record.name}（${result.record.id}），可到“待转诊名单”查看命中项。`,
    });
    setForm(blankInput());
    onChange();
  };

  const cancelAmend = () => {
    setLocalAmend(null);
    setReason("");
    setErrors([]);
    setForm(blankInput());
    setFlash(null);
    onConsumed();
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>{target ? "修改记录（需原因，旧值留档）" : "筛查录入"}</h2>
          {target && (
            <p className="hint">
              正在修改 {target.record.id}（{target.record.name}），原始建档时间{" "}
              {target.record.createdAt.slice(0, 16).replace("T", " ")}
            </p>
          )}
        </div>
        {target && <button onClick={cancelAmend}>取消修改</button>}
      </div>

      <div className="form-grid">
        <label className="field">
          学号
          <input
            className={invalidFields.has("studentId") ? "invalid" : ""}
            value={form.studentId}
            disabled={!!target}
            placeholder="如 S2026001"
            onChange={(e) => setCommon("studentId", e.target.value)}
          />
        </label>
        <label className="field">
          姓名
          <input
            className={invalidFields.has("name") ? "invalid" : ""}
            value={form.name}
            onChange={(e) => setCommon("name", e.target.value)}
          />
        </label>
        <label className="field">
          年级
          <input
            className={invalidFields.has("grade") ? "invalid" : ""}
            value={form.grade}
            placeholder="如 三年级"
            onChange={(e) => setCommon("grade", e.target.value)}
          />
        </label>
        <label className="field">
          筛查日
          <input
            type="date"
            className={invalidFields.has("date") ? "invalid" : ""}
            value={form.date}
            disabled={!!target}
            onChange={(e) => setCommon("date", e.target.value)}
          />
        </label>
      </div>

      <div className="eyes-row">
        {(["right", "left"] as const).map((side) => (
          <div key={side} className={`eye-block ${side}`}>
            <h3>{side === "right" ? "右眼（OD）" : "左眼（OS）"}</h3>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              {eyeFields.map((f) => (
                <label className="field" key={f.key}>
                  {f.label}
                  <input
                    className={invalidFields.has(`${side === "right" ? "右" : "左"}眼.${f.key}`) ? "invalid" : ""}
                    value={form[side][f.key]}
                    placeholder={f.placeholder}
                    inputMode="decimal"
                    onChange={(e) => setEye(side, f.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {target && (
        <div className="reason-box">
          <label className="field">
            修改原因（必填，会与旧值一并留档）
            <textarea
              className={invalidFields.has("reason") ? "invalid" : ""}
              value={reason}
              rows={2}
              placeholder="如：原表抄写错误，经复核验光单更正球镜"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
      )}

      {errors.length > 0 && (
        <div className="error-list">
          {errors.map((e, i) => (
            <div key={i}>· {e.message}</div>
          ))}
        </div>
      )}
      {flash && <div className={`flash ${flash.kind}`}>{flash.text}</div>}

      <div className="form-actions">
        <button className="primary" onClick={handleSubmit}>
          {target ? "确认修改并留档" : "提交筛查记录"}
        </button>
        {!target && (
          <button
            onClick={() => {
              setForm(blankInput());
              setErrors([]);
              setFlash(null);
            }}
          >
            清空
          </button>
        )}
        <span className="hint">未测量项目留空即可；左右眼至少填写一项。</span>
      </div>
    </section>
  );
}

export default ScreeningForm;
