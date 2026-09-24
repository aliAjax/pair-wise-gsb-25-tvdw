# 学生视力筛查台账

替代手抄表格的单页应用：按学生、年级、筛查日录入双眼裸眼视力、球镜、柱镜、轴位与眼轴，自动判定转诊并生成只追加的操作留档。纯前端实现，**不引入任何新依赖**（沿用现有 React + Vite + TypeScript）。

## 本地运行

```bash
npm install
npm run dev        # 端口 5111
npm run build      # 生产构建
```

逻辑层测试（零依赖断言，经 esbuild 打包在 Node 运行）：

```bash
node_modules/.bin/esbuild tests/screening.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/t.cjs && node /tmp/t.cjs
```

## 转诊规则（默认阈值，可在“阈值与数据”页调整）

满足任一项即进入**待转诊名单**，名单逐条写明命中项：

1. 任一眼裸眼视力 **低于 4.8**（等于 4.8 不命中）；
2. 任一眼等效球镜 SE = 球镜 + 柱镜/2 **低于 -0.50D**（等于 -0.50 不命中）；
3. 与约半年（183 天窗口）内最早一次筛查相比，任一眼眼轴增长**超过 0.20mm**（等于 0.20 不命中）。

判定结果不写库，每次按当前阈值实时计算，调整阈值无需迁移数据。

## 业务规则

- **重复提交留最早记录**：同学号 + 同筛查日且全部测量值相同（数值等价，如 4.80 = 4.8）时，不新增、不覆盖，仅在留档记一条“重复提交”及原始内容。
- **同日数据不一致即冲突**：不静默覆盖，自动转入修改流程，必须填写修改原因。
- **修改带原因并留旧值**：逐字段记录旧值 → 新值、原因、操作人、时间；留档只追加，界面无删除入口。
- 未测量项目留空；左右眼至少填一项；轴位 0–180、日期不得晚于今天等做了录入校验。

## 分层结构（数据 / 阈值 / 留档 / 操作 分离）

| 模块 | 职责 |
| --- | --- |
| `src/screening/types.ts` | 领域类型 |
| `src/screening/thresholds.ts` | 阈值定义与文案（策略） |
| `src/screening/rules.ts` | 判定、查重、字段 diff（纯函数） |
| `src/screening/validation.ts` | 录入格式校验 |
| `src/screening/storage.ts` | localStorage 读写（记录与留档分键） |
| `src/screening/settings.ts` | 阈值与操作人配置（独立键） |
| `src/screening/ledger.ts` | 操作层：提交 / 修改 / 名单 / 查询 |
| `src/screening/csv.ts` | 台账与留档 CSV 导出（带 BOM） |
| `src/components/*` | 界面：录入、名单、台账、留档、设置 |

存储键互相隔离：`vision-ledger:records:v1`（数据）、`vision-ledger:audit:v1`（留档）、`vision-ledger:settings:v1`（阈值）、`vision-ledger:operator:v1`（操作人）。

## 页面

- **筛查录入**：双眼五项测量值；冲突时切换为修改模式并要求原因。
- **待转诊名单**：按筛查日倒序，每条列出全部命中项，避免漏人。
- **筛查台账**：全部记录、搜索 / 年级筛选、CSV 导出。
- **操作留档**：录入 / 重复提交 / 修改流水，含原因与旧值，可单独导出。
- **阈值与数据**：调整阈值、一键载入 5 条演示数据（含 3 名待转诊）、清空本地数据。
