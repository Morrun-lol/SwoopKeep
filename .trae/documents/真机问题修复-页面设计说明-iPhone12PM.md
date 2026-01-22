# 真机问题修复：页面设计说明（iPhone 12 Pro Max）

## Global Styles（全局样式/Design Tokens）
- 设计原则：移动端优先（Mobile-first），同时不破坏桌面端布局。
- Safe Area（安全区）：顶部使用 `env(safe-area-inset-top)`（pt-safe），底部使用 `env(safe-area-inset-bottom)`（pb-safe）。
- Typography：标题 18–20px（font-semibold）；正文 14–16px；辅助说明 12px。
- 颜色：主色 emerald；错误 red；警告 orange；信息 blue。
- 反馈：Toast/Inline message（提示）支持多行、可复制；按钮禁用态 opacity 50%。

## Page 1：咻记一下（/voice）
### Meta Information
- Title：咻记一下 - 语音记账
- Description：语音录入账单并查看识别结果

### Layout
- 主体：纵向栈式布局（Flex Column）。
- 响应：
  - iPhone：单列卡片；主按钮区域居中。
  - 桌面：沿用现有 md: 栅格/边距。

### Page Structure
1. 顶部区域（Top Safe Area）
   - 在页面容器最外层增加 `pt-safe` 或等效 padding-top。
   - 标题与右侧功能按钮（如“网络诊断/模式切换/信息”）不与刘海区域重叠。
2. 主要卡片（语音/图片入口）
   - 麦克风按钮：三态（待机/录音中/处理中）。
   - 错误条（Error Banner）：在卡片内靠近按钮下方，展示“可理解的中文错误”，避免仅出现“Load failed”。
3. 日志与重试（Logs/Retry）
   - 当失败出现时：显示两个操作入口：
     - 重试（Retry）：再次发起同一次识别流程。
     - 查看日志（Logs）：打开底部弹层/对话框，展示时间戳+阶段+baseUrl+错误。

4. 图片识别上传（Upload Receipt / Camera OCR）
   - 失败提示：明确区分“权限未授予/文件读取失败/图片过大/网络错误/服务端错误”。
   - 重试策略：网络/超时允许立即重试；图片过大提示自动压缩或更换图片。
   - 日志字段：阶段（选图/拍照/压缩/上传/返回）、图片大小（字节）、mimeType、baseUrl、错误信息。

### Interaction States
- 权限未授予：展示“去系统设置开启麦克风权限”的提示（含 iOS 文案）。
- 网络/服务不可达：提示“无法连接语音识别服务（baseUrl）”，并给出重试。

## Page 2：设置（/settings）
### Meta Information
- Title：设置 - 数据导入与清除
- Description：导入历史数据、查看导入记录并管理数据

### Layout
- 主体：纵向分区卡片（Card Sections）。
- 列表：移动端表格允许横向滚动（已存在 overflow-x-auto），但需确保底部不被 TabBar 遮挡。

### Sections & Components
1. 数据导入（Import）
   - 上传后立即出现“导入中”卡片：
     - 进度条（Progress bar）
     - 计数：已处理/总行数、成功/失败/跳过
     - 可取消（Cancel，若实现）
   - 完成后提示：汇总结果 + 失败明细（前 5 条：行号+原因）。
2. 导入记录（Import History）
   - 每条记录显示：导入时间、类型、数据量；若处理中显示“处理中 xx%”。
   - 删除按钮：点击后二次确认（Confirm），成功后提示“删除成功并已清除该批次账单”。
3. 数据清除（Clear Data）
   - 清理重复数据：保持现有入口；成功提示包含“删除条数”。
   - 一键清空所有数据：双重确认；成功后提示并刷新页面。

## Global：底部导航（Layout / TabBar）
- 固定底部导航（fixed bottom）必须包含 `pb-safe`；同时页面主滚动容器需要预留底部空间（例如 pb-20）保证最后一屏内容可见。
- 建议新增/启用 `pt-safe`：保证顶部内容在 iPhone 12 Pro Max 上不贴边。

## Global：App 命名（Branding）
- iOS 主屏显示名：咻记
- App 英文名：SwoopKeep
- 页面标题/Logo：按产品文档统一（避免出现 TraeExpenseTracker 等旧命名）
