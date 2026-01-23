variable "region" {
  type        = string
  description = "阿里云地域，例如 cn-hangzhou"
}

variable "name" {
  type        = string
  default     = "swoopkeep"
  description = "资源名前缀"
}

variable "allowed_ssh_cidr" {
  type        = string
  default     = "0.0.0.0/0"
  description = "允许 SSH(22) 的来源 CIDR，建议改为你本机公网IP/32"
}

variable "instance_password" {
  type        = string
  sensitive   = true
  description = "ECS 登录密码（至少 8 位，包含大小写字母、数字、特殊字符）"
}

variable "deepseek_api_key" {
  type        = string
  sensitive   = true
  description = "DeepSeek API Key（仅写入服务器环境变量，不进入前端构建）"
}

variable "deepseek_base_url" {
  type        = string
  default     = "https://api.deepseek.com/v1"
}

variable "deepseek_chat_model" {
  type        = string
  default     = "deepseek-chat"
}

variable "api_image" {
  type        = string
  default     = "swoopkeep-api:latest"
  description = "API 镜像名（推荐用 ACR：registry.cn-xxx.aliyuncs.com/ns/swoopkeep-api:tag）"
}

variable "domain" {
  type        = string
  default     = ""
  description = "可选：用于自动 HTTPS 的域名（需提前把 A 记录指向实例公网 IP）"
}

variable "alarm_contact_groups" {
  type        = list(string)
  default     = []
  description = "可选：云监控告警联系人组（需提前在控制台创建）。为空则不创建告警。"
}

