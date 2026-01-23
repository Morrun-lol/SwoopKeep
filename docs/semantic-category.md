# 语义分类范围限定与同步

## 目标
- 语义分类的候选集合严格来自历史数据（`expense_records`）中出现过的 `project/category/sub_category` 组合。
- 当语义结果不匹配（相似度低于阈值）时，自动回落到默认分类：`日常开支 / 其他 / 其他`。
- UI 下拉选项只展示历史集合 + 默认分类，不展示“新增”。

## 数据源
- 历史分类集合：`expense_records(project, category, sub_category)` 去重得到。
- 默认分类：固定包含 `日常开支 / 其他 / 其他`。

## 前端行为
- `getExpenseStructure()` 动态拉取历史集合，用于三段下拉：项目/分类/子分类。
- 解析结果与手动选择均会被强制校验到允许集合内；不允许时回落到默认分类。
- 写入（创建/更新）时会校验分类是否在历史集合内，不合法则拒绝。

关键文件：
- `src/renderer/pages/Voice.tsx`
- `src/renderer/services/SupabaseApi.ts`
- `src/renderer/lib/expenseHierarchy.ts`

## 后端（AI API）行为

### `POST /api/ai/parse-expense`
请求体：
- `text`: 用户输入文本
- `context.hierarchy`: 分类层级数组（`{ project, category, sub_category }[]`）

响应：
- `expenses`: 解析后的账单数组，其中 `project/category/sub_category` 一定属于 `context.hierarchy` 或默认分类

匹配策略：
- 先做精确匹配。
- 再做相似度匹配（Dice 相似度），低于阈值回落默认分类。

可配置环境变量：
- `PARSE_MATCH_THRESHOLD`：相似度阈值，默认 `0.72`。

关键文件：
- `api/app.js`

## 测试
- 单元测试：`tests/unit/expense-hierarchy.test.ts`、`tests/unit/semantic-perf.test.ts`
- 端到端测试：`tests/e2e/category-scope.spec.ts`

