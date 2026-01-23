## SwoopKeep AI API（阿里云部署）

目标：把 `api/app.js` 这套 DeepSeek 代理 API 部署到阿里云 ECS（中国网络更稳定），供 iOS/Web App 调用。

### 1) 准备 ECS
- 推荐：Ubuntu 22.04 / Debian 12
- 安全组放行：`TCP 3001`（或仅放行 `80/443`，用 Nginx 反代到 3001）

### 2) 安装 Docker
按阿里云文档安装 Docker 与 Compose（`docker compose`）。

### 3) 生成环境变量
在服务器创建目录：`/opt/swoopkeep`

创建 `/opt/swoopkeep/.env`：
```bash
DEEPSEEK_API_KEY=你的真实key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_CHAT_MODEL=deepseek-chat
```

### 4) 构建与启动
把本仓库上传到服务器（或直接 `git clone`），然后在仓库目录执行：
```bash
cd deploy/aliyun
docker compose up -d --build
```

验证：
```bash
curl -s http://127.0.0.1:3001/api/ai/health
```
期望输出里 `deepseekConfigured: true`。

### 5) 配置 App 指向阿里云 API

在 App 的“首次配置 / 配置页”把 `AI API Base URL` 设置为：
- `http://你的服务器IP:3001`
或（推荐）配置域名与 HTTPS 后：
- `https://api.你的域名`

### 6) 监控建议
- 应用内网络诊断使用 `/api/ai/health`
- 服务端调用统计使用 `/api/ai/usage`（成功率、均值耗时）
- Prometheus 拉取接口：`/api/ai/metrics`
