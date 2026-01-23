# 可行性分析报告：登录扩展与家庭组邀请/权限

本文基于当前仓库实现现状（Supabase Auth + RLS、多端：Web/移动端直连 Supabase；Electron 桌面端存在本地 SQLite 模式）给出两项功能扩展的可行性结论、技术选型建议、风险矩阵与粗略排期。

## 一、现状摘要（与本次评估强相关）

### 1) 认证与会话
- 现有登录/注册为 **Supabase Auth 邮箱+密码**；前端通过 `session` 做路由守卫。
- 未发现自建 JWT/Passport/Session 的后端认证体系；`api/routes/auth.ts` 明确提示“客户端用 Supabase Auth”。

关键位置：
- 登录：`src/renderer/pages/auth/Login.tsx`
- 会话：`src/renderer/context/AuthContext.tsx`
- 路由守卫：`src/renderer/App.tsx`

### 2) 数据隔离策略（RLS）
- Supabase 侧迁移已将核心业务表增加 `user_id default auth.uid()` 并启用 RLS：**按用户隔离**。
- `families` 表有 `owner_id default auth.uid()`；`members` 仅允许 owner 查看/写入。

关键迁移：
- `supabase/migrations/unify_supabase_auth_rls.sql`

### 3) 家庭/成员当前语义
- 当前的 `families/members` 更偏向“**账本内的家庭/成员管理**”，并非“多个登录用户共享同一家庭组”。
- `expense_records` 只有 `member_id`，没有 `family_id`；因此家庭更多是展示/录入维度，数据层面无法用 family 做隔离/授权。

## 二、功能一：增加微信登录与短信验证码登录

### 2.1 目标与边界
- 保留现有邮箱密码登录。
- 新增两种登录入口：
  - 微信登录（Web 扫码/APP SDK/小程序）
  - 手机短信验证码登录（发送验证码、校验、登录/注册）

### 2.2 技术可行性分析

#### A. 与现有架构的兼容性
现状为“前端直连 Supabase Auth + RLS”。新增登录方式的关键约束是：
- 登录完成后必须拿到 **Supabase session**（access token/refresh token），否则现有基于 RLS 的数据访问无法复用；
- 或者反过来：引入自建后端统一鉴权并代理所有数据访问（架构变化显著）。

因此可行路径存在明显分叉：

**路径 1（推荐优先评估）：仍以 Supabase Auth 为唯一身份源**
- 短信登录：优先使用 Supabase Auth 的 Phone OTP 能力（前提：可使用 Supabase 支持的短信服务商）。
- 微信登录：只有在 Supabase 可配置“通用 OIDC/OAuth provider”且微信侧能提供兼容的 OIDC `id_token` 时才能无缝接入。

**路径 2：自建“登录聚合服务”（微信+短信），再与 Supabase 打通**
- 新增后端/Edge Function 负责：
  1) 微信 `code -> openid/unionid` 交换
  2) 短信发送与 OTP 校验
  3) 生成/获取 Supabase session（或改为后端代理数据访问）
- 优点：能用阿里云/腾讯云短信、能做微信全形态登录
- 代价：需要新增服务端可信执行环境与更复杂的安全体系，且很可能需要调整数据访问模型。

#### B. 微信登录的技术路径

微信登录分三种常见形态，接口不同：

1) **Web 扫码登录（微信开放平台网站应用）**
- 前端：跳转 `https://open.weixin.qq.com/connect/qrconnect?...` 获取 `code`
- 后端：用 `code` + `appid/secret` 请求微信接口换取 `access_token/openid`（以及 `unionid`，取决于权限）
- 关键点：需要服务端保存 `appsecret`，不可在前端暴露。

2) **APP 登录（iOS/Android WeChat SDK）**
- 客户端通过微信 SDK 获取 `code`
- 后端同样做 `code -> openid` 交换
- 关键点：Capacitor/Ionic 场景通常需要引入原生插件或桥接 SDK。

3) **小程序登录（wx.login）**
- 小程序 `wx.login()` 得到 `code`
- 后端调用 `jscode2session` 换取 `openid/session_key`

与 Supabase 的衔接难点：
- 微信并不提供标准 OIDC `id_token`（通常只有 `openid` + `access_token`），因此 **无法直接使用“标准 OIDC 登录”拿到 Supabase session**。
- 若坚持“Supabase Auth 为唯一身份源”，通常需要：
  - 通过服务端把微信身份映射到 Supabase user（例如 `wechat_openid` 绑定到用户资料表）
  - 通过服务端完成 Supabase 登录态签发（这一步在 Supabase 托管模式下实现复杂度较高，往往需要边缘函数/自建 auth 服务）。

结论：
- **微信登录：技术上可行，但在当前“纯前端直连 Supabase Auth”架构下属于“部分可行需调整”**，需要引入可信后端组件来承载 `appid/secret` 与会话签发/绑定流程。

#### C. 短信验证码登录的技术路径

短信登录必须包含：
- 验证码生成（随机、长度、有效期）
- 发送（对接短信服务商）
- 校验（一次性、有效期、错误次数限制）
- 风控（频率限制、IP/设备指纹、黑名单/灰度）

两种实现选型：

**方案 1：使用 Supabase Auth Phone OTP**
- 优点：与现有 session/RLS 完全兼容，开发量小。
- 风险：短信服务商与区域可用性受限；如果必须使用阿里云/腾讯云 SMS，需要确认 Supabase 是否原生支持或可扩展。

**方案 2：自建短信服务（阿里云/腾讯云）+ 自建 OTP 表**
- 需要后端/Edge Function：
  - `POST /auth/sms/send`：生成 OTP（只存哈希）、调用短信服务商发送
  - `POST /auth/sms/verify`：校验 OTP，签发登录态
- 与现有系统集成存在两条路：
  1) 校验成功后再“换取 Supabase session”（难点同微信）
  2) 放弃前端直连 Supabase：由后端代理所有数据访问（改造大但可控）

结论：
- **短信登录：完全可行**。如果可使用 Supabase 支持的短信通道，推荐走方案 1；若强制阿里云/腾讯云，则需要方案 2 并带来架构改造成本。

### 2.3 对现有认证流程与安全体系的影响
- 需要扩展 `AuthContext`：
  - 增加“微信登录/短信登录”的 UI 状态与错误分支
  - 增加账号绑定信息展示（手机号、微信绑定状态）
- 需要新增“用户资料表”（若尚未存在）：存储 `phone`、`wechat_openid/unionid`、绑定时间、脱敏展示字段等。
- 如引入后端：需要重新定义“客户端可信边界”，并为短信/微信接口加：
  - 频率限制（每手机号、每 IP、每设备）
  - 失败次数限制、验证码一次性使用
  - 审计日志（发送、校验、绑定、解绑）

### 2.4 安全与合规可行性分析

#### 合规要点（PIPL/最小必要）
- 手机号、微信 `openid/unionid` 属于个人信息/标识符：
  - 明示授权与隐私政策更新（收集目的、使用范围、保存期限）
  - 允许用户解绑/注销并删除或匿名化相关标识
- 数据传输必须 HTTPS；敏感字段落库需加密/脱敏：
  - phone：展示脱敏（`138****1234`）
  - openid/unionid：建议按需加密存储或至少不可逆哈希用于去重（取决于业务是否需要原值）。

#### 主要安全风险与防护
- 短信劫持/转号：增加设备绑定、异常登录提醒、二次校验。
- 验证码爆破：
  - 6 位及以上随机码
  - 5 分钟有效期
  - 同手机号/同 IP 失败次数阈值（例如 5 次锁 10 分钟）
  - 图形验证码/滑块作为二道门槛（高风险时触发）
- 微信授权滥用：严格校验 `state` 防 CSRF；回调域名白名单；签名校验。
- 第三方依赖可用性：短信与微信接口故障需要降级（保留邮箱密码登录入口）。

### 2.5 用户体验与业务流程可行性分析

建议统一成“账号体系 + 多登录方式绑定”的体验：
- 新用户：
  - 短信登录首次验证后自动注册
  - 微信首次授权后提示绑定手机号（用于找回/风控）
- 老用户：
  - 允许在“账户与安全”里绑定/解绑手机号与微信
  - 避免产生重复账户：以“手机号优先”或“unionid 优先”做唯一映射策略

典型绑定/合并场景：
- 微信首次登录发现手机号已存在：提示“确认绑定到已有账号”并做二次校验
- 旧邮箱账号想绑定手机号：短信验证后绑定

异常分支：
- 短信发送失败：提示重试、切换邮箱登录
- 微信未安装/不可用：Web 用扫码；App 用 fallback（网页授权）

### 2.6 成本与资源可行性分析（粗估）

以“2 人开发 + 1 人测试”为参考：

**方案 1（Supabase Phone OTP + 微信暂不做或仅做 Web 扫码+后端绑定）**
- 开发：5–10 人日
- 测试：3–5 人日
- 上线与观测：2 人日

**方案 2（自建短信 + 全形态微信登录 + 会话签发/绑定）**
- 开发：15–30 人日（含安全、风控、审计）
- 测试：10–15 人日（含攻防用例、限流、异常）
- 运维：持续（短信成本、监控告警、密钥管理）

运营成本：
- 短信：按条计费（需结合 DAU/登录频率估算，且需做风控降低成本）
- 微信：开放平台认证费（按平台规则）
- 服务器：若引入后端/Edge Function，需额外计算调用与出网成本

### 2.7 可行性结论（功能一）
- **短信验证码登录：完全可行**。
  - 若可使用 Supabase 支持的短信通道：推荐直接集成，成本最低。
  - 若强制阿里云/腾讯云短信：可行但需要引入可信后端组件，整体工作量上升。
- **微信登录：部分可行需调整**。
  - 在当前“前端直连 Supabase Auth”架构下，微信登录需要新增服务端承载密钥与身份映射/会话签发流程。

推荐选型（按投入/收益排序）：
1) 先上短信 OTP（能用 Supabase 原生能力则优先），保留邮箱密码。
2) 微信登录作为第二阶段：优先 Web 扫码登录（最成熟），再扩展 App/小程序。

---

## 三、功能二：邀请加入家庭组及权限管理

### 3.1 目标与边界
- 多个“登录用户”可以加入同一个“家庭组”，共享/协作记账数据。
- 支持邀请（链接/二维码）、接受/拒绝、状态跟踪。
- 支持细粒度权限（至少：读/写/改/删），并可扩展到预算、成员管理等。

### 3.2 技术可行性分析

#### A. 与现有数据模型/RLS 的冲突点
现有 RLS 以 `user_id = auth.uid()` 隔离 `expense_records/year_goals/monthly_budgets/...`，意味着：
- **天然不支持“跨用户共享同一家庭的数据”**。

要实现家庭组共享，必须至少改造为“家庭维度隔离 + 成员权限控制”：
- 为核心业务表增加 `family_id`
- RLS 改为：当前用户在该 `family_id` 下有 membership（且满足权限）即可访问

#### B. 推荐的数据模型（RBAC）

建议新增/调整表（Supabase/Postgres）：

1) `family_groups`
- `id`
- `name`
- `owner_user_id`（户主）
- `created_at`

2) `family_memberships`
- `family_id`
- `user_id`
- `role`（owner/admin/editor/viewer）
- `status`（active/invited/left/removed）
- `created_at/updated_at`
- unique(`family_id`, `user_id`)

3) `family_invitations`
- `id`
- `family_id`
- `inviter_user_id`
- `token_hash`（只存哈希）
- `expires_at`
- `max_uses/used_count`
- `status`（pending/accepted/revoked/expired）
- 可选：`invitee_phone_hash`（定向邀请时使用）

4) 业务表增加 `family_id`（最少 `expense_records/year_goals/monthly_budgets/import_history`）
- 并保留 `created_by_user_id` 便于审计

关于现有 `families/members`：
- 现有 `families` 建议迁移/重命名为 `family_groups`（避免与“账本成员”概念混淆）。
- 现有 `members` 更像“账本内记账主体”，可保留为 `ledger_members`，并与 `family_id` 关联。

#### C. 权限系统实现方式

推荐 RBAC + 最小权限点扩展：
- 角色：`owner/admin/editor/viewer`
- 权限点（建议先内置，后续再自定义）：
  - `expense.read / expense.write / expense.update / expense.delete`
  - `member.manage`（账本成员管理）
  - `family.manage`（家庭组设置、邀请、角色变更）

实现策略：
- 在 Postgres 侧提供稳定函数：`has_family_permission(family_id, permission)`
- RLS policy 以该函数为判断条件，做到“数据层强制”。

#### D. 邀请流程实现

邀请链接/二维码典型流程：
1) 户主/管理员在客户端发起“生成邀请”
2) 由 **Edge Function/后端** 生成随机 token（仅返回明文一次），落库 `token_hash` + 有效期
3) 客户端展示链接/二维码：`app://join?family_invite=TOKEN` 或 `https://.../join?token=...`
4) 被邀请者打开后，若未登录先登录；登录后调用 `POST /family/invitations/accept` 完成加入
5) 后端校验：token 未过期、未超次、未撤销 → 写 `family_memberships`

为什么需要后端/Edge Function：
- token 生成与校验属于安全敏感逻辑，不应放到前端直连数据库；
- 需要隐藏 `token_hash` 计算细节、实现防重放与审计。

#### E. 实时通知可行性
最小可行：
- 以列表轮询/刷新实现邀请状态与成员变更。

增强方案：
- 使用 Supabase Realtime 订阅 `family_invitations` / `family_memberships` 变更推送。

### 3.3 安全与数据隔离可行性分析
- 数据隔离：以 `family_id` 为边界，RLS 确保“只允许家庭成员访问”。
- 越权风险：权限点必须在 RLS/函数层强制校验，前端仅做展示控制不作为安全边界。
- 邀请链接风险：
  - HTTPS
  - token 仅一次展示明文，库内只存哈希
  - 有效期 + 最大使用次数 + 可撤销
  - 高风险场景要求“定向邀请”（绑定手机号/用户）或二次确认
- 退出/解散：
  - 成员退出：移除 membership；其创建的数据归属仍在家庭组下（建议保留审计字段）
  - 家庭组解散：需策略选择（软删/导出后删除/仅 owner 可操作）

### 3.4 用户体验与社会可行性分析
- 邀请：一键生成链接/二维码，支持复制与分享。
- 权限：提供 3–4 个预置角色并可解释（避免复杂配置）；高级权限后续再开放。
- 复杂家庭关系：
  - 户主转移：需二次确认与强审计
  - 角色变更：实时提示受影响成员
- 产品粘性：家庭共享与协作记账通常能提升留存，但必须把“隐私边界”和“可见范围”讲清楚。

### 3.5 成本与实施可行性（粗估）

以“2 前端 + 1 后端/DB + 1 测试”为参考：
- 数据库迁移 + RLS 重构：8–15 人日
- 邀请机制（Edge Function + 前端页面/二维码）：6–10 人日
- 权限体系（RBAC + RLS + UI）：10–18 人日
- 测试（权限/越权/回归）：10–15 人日

性能影响：
- 主要来自 RLS 子查询与 `has_family_permission()` 计算。
- 可通过索引（`family_memberships(family_id,user_id)`）与缓存（role->permission 映射）控制。

迁移策略：
- 现有用户初始化：首次登录自动创建一个默认家庭组并把自己作为 owner 加入。
- 历史数据回填：将用户现有数据统一写入其默认家庭组（`family_id`）。

### 3.6 可行性结论（功能二）
- **完全可行，但必须进行数据库模型与 RLS 策略重构**（从 user 级隔离升级为 family 级隔离 + 权限控制）。
- Electron 本地 SQLite 模式下“多用户共享家庭组”在产品意义上有限（数据不天然共享），建议该功能先在 Supabase 云端模式落地。

---

## 四、整合风险评估矩阵（高优先级）

| 风险 | 优先级 | 发生概率 | 影响 | 主要应对 |
|---|---:|---:|---:|---|
| 短信被爆破/薅羊毛导致成本飙升 | 高 | 中 | 高 | 频率限制、失败次数锁定、图形验证码、黑名单、审计告警 |
| 微信/短信第三方服务不可用 | 高 | 中 | 中 | 多通道/降级策略（保留邮箱登录）、重试、熔断与告警 |
| 家庭组 RLS 改造造成越权或数据泄露 | 高 | 中 | 高 | 以 RLS 为唯一安全边界、增加安全测试用例、灰度发布 |
| 邀请链接泄露导致陌生人加入 | 高 | 中 | 中 | token 哈希存储、有效期/次数、可撤销、定向邀请（可选） |
| 账号合并/绑定逻辑导致重复账户与数据分叉 | 中 | 中 | 中 | 明确唯一标识策略（手机号/unionid）、提供合并确认流程 |
| 多端差异（Web/移动/Electron）导致实现分裂 | 中 | 中 | 中 | 先定义“云端模式为主”、Electron 本地模式延后或阉割 |

## 五、推荐高层技术方案概要

### 5.1 登录扩展（建议分阶段）
**阶段 1：短信 OTP（与 Supabase session 兼容）**
- 优先走 Supabase 原生 Phone OTP（若短信通道可用）。
- 若必须阿里云/腾讯云：引入 Edge Function/后端 `sms/send`+`sms/verify`，并评估“如何签发 Supabase session”或“数据访问改为后端代理”。

**阶段 2：微信登录（先 Web 扫码）**
- 引入后端/Edge Function 做 `code` 交换与身份映射；账号体系以 Supabase user 为主，微信身份绑定到 profile 表。

### 5.2 家庭组邀请与权限
- 数据模型：`family_groups` + `family_memberships` + `family_invitations`
- 权限：RBAC（owner/admin/editor/viewer）+ Postgres 函数 + RLS
- 邀请：Edge Function 生成 token、落库哈希、accept 时写 membership
- 通知：先列表刷新，后续接 Realtime

## 六、粗略阶段划分与时间规划（里程碑）

以 1 个版本 2 周节奏估算：

**M1（第 1–2 周）：短信 OTP 登录（最小可用）**
- 接入短信登录入口、风控与审计
- 保留邮箱密码登录

**M2（第 3–4 周）：家庭组数据模型 + RLS 重构（基础共享）**
- 上线 `family_id` 与 membership
- 核心业务表按家庭组隔离可访问

**M3（第 5–6 周）：邀请机制 + 角色权限 UI**
- 邀请链接/二维码
- 预置角色权限与管理界面

**M4（第 7–8 周）：微信登录（Web 扫码优先）+ 风险收敛**
- 微信绑定/解绑
- 安全测试、灰度、监控指标与告警

---

## 附：本报告结论汇总
- 功能一（登录扩展）：
  - 短信验证码登录：**完全可行**（推荐优先使用与 Supabase session 兼容的方案）。
  - 微信登录：**部分可行需调整**（需要新增可信后端组件做密钥与身份映射/会话签发）。
- 功能二（家庭邀请+权限）：**完全可行**（但需要数据库模型与 RLS 策略升级为家庭维度）。

