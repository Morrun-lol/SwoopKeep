## SwoopKeep AI API（阿里云部署）

目标：把 `api/app.js` 这套 DeepSeek 代理 API 部署到阿里云（中国网络更稳定），并尽量做到“一键创建/销毁”。

### 方式 A（推荐）：Terraform 一键创建 ECS + 自动装 Docker + 自动启动

前置条件：
- 已安装 Terraform
- 已安装并配置阿里云 CLI：`aliyun configure`

最少命令：
```bash
cd deploy/aliyun/terraform
terraform init
terraform apply \
  -var region=cn-hangzhou \
  -var allowed_ssh_cidr=你的公网IP/32 \
  -var instance_password='StrongPassw0rd!' \
  -var deepseek_api_key='你的DeepSeekKey' \
  -var api_image='swoopkeep-api:latest'
```

可选：启用 CPU 告警（需要你先在控制台创建联系人组）：
```bash
terraform apply \
  -var alarm_contact_groups='["你的联系人组名"]' \
  ...
```

完成后会输出：
- ECS 公网 IP
- `health_url`（用于 App 网络诊断）
- SSH 命令

验证：
```bash
curl -s http://<ECS公网IP>/api/ai/health
curl -s http://<ECS公网IP>/api/ai/usage
curl -s http://<ECS公网IP>/api/ai/metrics
```

### 方式 B：仅用 Docker Compose（适合你已经有 ECS）

在服务器创建 `/opt/swoopkeep/.env`：
```bash
DEEPSEEK_API_KEY=你的真实key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_CHAT_MODEL=deepseek-chat
SWOOPKEEP_API_IMAGE=swoopkeep-api:latest
```

把本仓库上传到服务器（或直接 `git clone`），然后：
```bash
cd deploy/aliyun
docker compose up -d --build
```

### 配置 App 指向阿里云 API

在 App 的“配置页”把 `AI API Base URL` 设置为：
- `http://你的ECS公网IP`
或域名（推荐）:
- `https://api.你的域名`

如需故障转移，可填多个，用英文逗号分隔：
- `https://api.你的域名,https://api2.你的域名`

### 监控建议
- 应用内网络诊断：`/api/ai/health`
- 调用统计：`/api/ai/usage`
- Prometheus 指标：`/api/ai/metrics`

### CI/CD（GitHub Actions 自动发布到 ECS）
已提供工作流：[aliyun-api-deploy.yml](file:///d:/Trea%20项目/.github/workflows/aliyun-api-deploy.yml)

你只需要在 GitHub 仓库配置 Secrets：
- `ALIYUN_ACR_REGISTRY`：例如 `registry.cn-hangzhou.aliyuncs.com`
- `ALIYUN_ACR_USERNAME` / `ALIYUN_ACR_PASSWORD`
- `ALIYUN_ACR_IMAGE`：完整镜像名，例如 `registry.cn-hangzhou.aliyuncs.com/ns/swoopkeep-api:latest`
- `ALIYUN_ECS_HOST`：ECS 公网 IP
- `ALIYUN_ECS_USER`：建议 `root`
- `ALIYUN_ECS_SSH_KEY`：私钥（只读权限即可）
