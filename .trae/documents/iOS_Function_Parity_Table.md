# Windows vs iOS 功能对照表

本表详细列出了 Windows 桌面版应用的所有功能模块，以及在 iOS 平台上的对应实现方案和当前状态。目标是确保 100% 的功能迁移和业务逻辑一致性。

## 1. 核心记账功能

| 功能模块 | Windows 实现 (SQLite + Electron) | iOS 实现 (LeanCloud + Capacitor) | 一致性策略 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **创建账单** | SQL `INSERT`，自动生成 ID | LeanCloud `AV.Object.save` | 使用原子计数器或时间戳模拟自增 ID，确保 ID 类型兼容 | ✅ 已规划 |
| **查询账单** | SQL `SELECT` + `WHERE` (日期范围) | LeanCloud `AV.Query` (Date Range) | 字段名映射保持一致，返回数据结构完全相同 | ✅ 已规划 |
| **更新/删除** | SQL `UPDATE` / `DELETE` | LeanCloud `save` / `destroy` | 权限控制通过 ACL 实现 | ✅ 已规划 |
| **分类管理** | 预置 SQL 数据，支持层级 | LeanCloud `Category` 表 | 初始化时检查并创建默认分类，支持自定义 | ⚠️ 需完善初始化逻辑 |
| **多成员/家庭** | `families` / `members` 表关联 | LeanCloud `Family` / `Member` 表 | 使用 Pointer 建立关联，客户端模拟 Join 查询 | ✅ 已规划 |

## 2. 语音与智能解析

| 功能模块 | Windows 实现 | iOS 实现 | 一致性策略 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **语音录制** | Electron `AudioWorklet` 获取 Buffer | Capacitor `SpeechRecognition` / `VoiceRecorder` | iOS 端需适配麦克风权限，优先使用系统级语音识别，或录制后上传 | ⚠️ 需解决 Buffer 差异 |
| **语音转文字** | 科大讯飞 WebSocket (Node.js) | Web Speech API / 讯飞 WebSocket (Browser) | 优先使用 iOS 原生听写 (Web Speech API)，备选讯飞 JS SDK | ⚠️ 需验证浏览器兼容性 |
| **语义解析** | 本地 LLM 调用 / OpenAI API (Node.js) | 客户端直接调用 OpenAI / DeepSeek API | 需注意 API Key 安全，建议通过 LeanCloud 云函数中转 (可选) 或客户端直接请求 (简易) | ✅ 已规划 |

## 3. 数据统计与可视化

| 功能模块 | Windows 实现 | iOS 实现 | 一致性策略 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **收支趋势** | SQL `GROUP BY` 日期聚合 | 客户端 JS 聚合 / LeanCloud 聚合查询 | 在客户端获取原始数据后，使用相同的算法进行聚合计算，确保图表一致 | ⚠️ 需完善 JS 聚合逻辑 |
| **分类构成** | SQL `GROUP BY` 分类聚合 | 客户端 JS 聚合 | 同上 | ⚠️ 需完善 JS 聚合逻辑 |
| **月度预算** | SQL 关联查询 `monthly_budgets` | 独立查询 `Budget` 表后在内存比对 | 保持前端计算逻辑不变，仅替换数据源 | ✅ 已规划 |
| **年度目标** | SQL 关联查询 `year_goals` | 独立查询 `YearGoal` 表 | 同上 | ✅ 已规划 |

## 4. 系统与工具

| 功能模块 | Windows 实现 | iOS 实现 | 一致性策略 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **Excel 导入** | `node-xlsx` 读取本地文件 | `xlsx` 库读取 ArrayBuffer | 前端文件选择器获取 File 对象，转 ArrayBuffer 处理，逻辑复用 | ✅ 已实现 |
| **模板下载** | Electron `dialog.showSaveDialog` + `fs` | 浏览器 `XLSX.writeFile` 下载 | 利用浏览器原生下载能力 | ✅ 已实现 |
| **OCR 识别** | 本地 Tesseract / 在线 API | 拍照 -> 在线 API / 云函数 | 调用手机摄像头拍照，上传图片至 OCR 服务 | ⚠️ 需对接 Camera 插件 |
| **网络检测** | Node.js `http.request` | `fetch` API | 使用 `no-cors` 模式检测连通性 | ✅ 已实现 |

## 5. 数据模型映射 (Schema Mapping)

| Windows Table | LeanCloud Class | 关键字段差异处理 |
| :--- | :--- | :--- |
| `expense_records` | `Expense` | `id` (AutoInc) -> `local_id` (Number), `objectId` (String) |
| `expense_categories` | `Category` | 保持一致 |
| `monthly_budgets` | `Budget` | 联合唯一索引需在代码层面控制 (`checkBeforeSave`) |
| `year_goals` | `YearGoal` | 同上 |
| `members` | `Member` | `family_id` (Int) -> `family` (Pointer) / `family_local_id` |

## 6. 待办事项 (Next Steps)

1.  **完善 `LeanCloudApi.ts`**: 补充所有统计类接口的客户端聚合逻辑，确保与 SQL 结果一致。
2.  **数据初始化**: 实现 `checkAndInitDefaults`，确保新用户首次打开 App 时有默认分类和配置。
3.  **语音模块适配**: 解决 Windows `Buffer` 传输与 iOS `SpeechRecognition` 的差异，确保 `Voice.tsx` 页面无需修改即可运行。
4.  **端到端测试**: 在 iOS 模拟器/真机上验证核心流程。
