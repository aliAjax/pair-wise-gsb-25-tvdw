import { useMemo, useState } from "react";
import "./styles.css";
import ScreeningForm from "./components/ScreeningForm";
import RecordTable, { toAmendInput } from "./components/RecordTable";
import ReferralList from "./components/ReferralList";
import AuditView from "./components/AuditView";
import SettingsView from "./components/SettingsView";
import type { EvaluatedRecord, ScreeningRecord } from "./screening/types";
import type { Thresholds } from "./screening/thresholds";
import { thresholdText } from "./screening/thresholds";
import { evaluatedList, referralList, auditTrail } from "./screening/ledger";
import { recordsToCsv, downloadCsv } from "./screening/csv";
import { seedDemoData } from "./screening/seed";
import { loadOperator, loadThresholds, saveOperator, saveThresholds } from "./screening/settings";

type Tab = "entry" | "referral" | "ledger" | "audit" | "settings";

interface AmendTarget {
  record: ScreeningRecord;
  next: ReturnType<typeof toAmendInput>;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "entry", label: "筛查录入" },
  { key: "referral", label: "待转诊名单" },
  { key: "ledger", label: "筛查台账" },
  { key: "audit", label: "操作留档" },
  { key: "settings", label: "阈值与数据" },
];

function App() {
  const [tab, setTab] = useState<Tab>("entry");
  const [operator, setOperator] = useState(loadOperator());
  const [thresholds, setThresholds] = useState<Thresholds>(loadThresholds());
  const [version, setVersion] = useState(0);
  const [amendTarget, setAmendTarget] = useState<AmendTarget | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const all: EvaluatedRecord[] = useMemo(
    () => evaluatedList(thresholds),
    // version 变化后重新读取 localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thresholds, version],
  );
  const pending = useMemo(
    () => referralList(thresholds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thresholds, version],
  );
  const audit = useMemo(
    () => auditTrail(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const studentCount = new Set(all.map((r) => r.studentId)).size;

  const refresh = () => setVersion((v) => v + 1);

  const startAmend = (record: ScreeningRecord) => {
    setAmendTarget({ record, next: toAmendInput(record) });
    setFormKey((k) => k + 1);
    setTab("entry");
  };

  const handleSeed = () => {
    const r = seedDemoData();
    if (r.ok) {
      setNotice(`已载入 ${r.added} 条演示数据`);
      refresh();
    } else setNotice(r.reason);
  };

  const handleClear = () => {
    if (!window.confirm("将清空全部筛查记录与操作留档（保留阈值设置）。确定继续？")) return;
    localStorage.removeItem("vision-ledger:records:v1");
    localStorage.removeItem("vision-ledger:audit:v1");
    setAmendTarget(null);
    setFormKey((k) => k + 1);
    setNotice("已清空全部数据与留档");
    refresh();
  };

  const saveT = (t: Thresholds) => {
    saveThresholds(t);
    setThresholds(t);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>学生视力筛查台账</h1>
          <p className="rule-line">
            转诊规则：{thresholdText(thresholds)}（阈值可在“阈值与数据”中调整）
          </p>
        </div>
        <div className="operator-box">
          <label className="field" style={{ margin: 0 }}>
            操作人
            <input
              value={operator}
              placeholder="验光师姓名"
              onChange={(e) => {
                setOperator(e.target.value);
                saveOperator(e.target.value);
              }}
            />
          </label>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat-card"><span>筛查记录</span><strong>{all.length}</strong></div>
        <div className="stat-card"><span>覆盖学生</span><strong>{studentCount}</strong></div>
        <div className="stat-card alert"><span>待转诊</span><strong>{pending.length}</strong></div>
        <div className="stat-card">
          <span>待转诊占比</span>
          <strong>{all.length ? `${Math.round((pending.length / all.length) * 100)}%` : "—"}</strong>
        </div>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "referral" && pending.length > 0 ? `（${pending.length}）` : ""}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="flash ok" onClick={() => setNotice(null)}>{notice}（点击关闭）</div>
      )}

      {tab === "entry" && (
        <ScreeningForm
          key={formKey}
          operator={operator}
          amendTarget={amendTarget}
          onConsumed={() => setAmendTarget(null)}
          onChange={refresh}
        />
      )}

      {tab === "referral" && <ReferralList records={pending} onAmend={startAmend} />}

      {tab === "ledger" && (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>数据导出</h2>
                <p className="hint">导出的是测量数据与当前判定；修改痕迹请到“操作留档”导出。</p>
              </div>
              <button
                disabled={all.length === 0}
                onClick={() =>
                  downloadCsv(`视力筛查台账_${Date.now()}.csv`, recordsToCsv(all))
                }
              >
                导出台账 CSV（全部）
              </button>
            </div>
          </section>
          <RecordTable records={all} onAmend={startAmend} />
        </>
      )}

      {tab === "audit" && <AuditView entries={audit} />}

      {tab === "settings" && (
        <SettingsView
          thresholds={thresholds}
          onSave={saveT}
          onSeedDemo={handleSeed}
          onClearAll={handleClear}
        />
      )}
    </main>
  );
}

export default App;
