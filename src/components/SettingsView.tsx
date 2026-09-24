import { useState } from "react";
import type { Thresholds } from "../screening/thresholds";
import { DEFAULT_THRESHOLDS, thresholdText } from "../screening/thresholds";

interface Props {
  thresholds: Thresholds;
  onSave: (t: Thresholds) => void;
  onSeedDemo: () => void;
  onClearAll: () => void;
}

const fields: { key: keyof Thresholds; label: string; step: string; hint: string }[] = [
  { key: "nakedVisionBelow", label: "裸眼视力阈值（低于即命中）", step: "0.1", hint: "标准对数视力，默认 4.8" },
  { key: "seBelowD", label: "等效球镜阈值 D（低于即命中）", step: "0.05", hint: "SE = 球镜 + 柱镜/2，默认 -0.50" },
  { key: "axialWindowDays", label: "眼轴复查窗口（天）", step: "1", hint: "默认 183 天（约半年）" },
  { key: "axialGrowthMm", label: "眼轴增长阈值 mm（超过即命中）", step: "0.01", hint: "默认 0.20" },
];

export default function SettingsView({ thresholds, onSave, onSeedDemo, onClearAll }: Props) {
  const [draft, setDraft] = useState<Thresholds>(thresholds);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (key: keyof Thresholds, value: string) => {
    const n = Number(value);
    if (Number.isFinite(n)) setDraft((d) => ({ ...d, [key]: n }));
  };

  const save = () => {
    if (draft.nakedVisionBelow < 3 || draft.nakedVisionBelow > 5.3)
      return setMsg("裸眼视力阈值应在 3.0–5.3 之间");
    if (draft.axialWindowDays <= 0 || draft.axialGrowthMm <= 0)
      return setMsg("窗口天数与眼轴阈值必须为正数");
    onSave(draft);
    setMsg(`已保存：${thresholdText(draft)}。台账按新阈值重新判定，测量数据与留档不变。`);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>阈值与数据管理</h2>
          <p className="hint">阈值单独存放，修改后全部记录按新阈值重新判定；不影响测量数据与留档。</p>
        </div>
      </div>

      <div className="settings-grid">
        {fields.map((f) => (
          <label className="field" key={f.key}>
            {f.label}
            <input
              type="number"
              step={f.step}
              value={draft[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
            <span style={{ color: "#94a3b8" }}>{f.hint}</span>
          </label>
        ))}
      </div>

      <div className="form-actions">
        <button className="primary" onClick={save}>保存阈值</button>
        <button onClick={() => { setDraft(DEFAULT_THRESHOLDS); setMsg(null); }}>
          恢复默认值
        </button>
      </div>
      {msg && <div className="flash ok">{msg}</div>}

      <hr style={{ margin: "22px 0", border: 0, borderTop: "1px solid var(--border)" }} />

      <div className="form-actions">
        <button onClick={onSeedDemo}>载入演示数据（5 条，含 3 名待转诊）</button>
        <button className="danger" onClick={onClearAll}>
          清空全部数据与留档
        </button>
        <span className="hint">演示数据走正常录入流程；清空为本地操作，请先导出留档。</span>
      </div>
    </section>
  );
}
