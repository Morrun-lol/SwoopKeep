output "public_ip" {
  value       = alicloud_instance.this.public_ip
  description = "ECS 公网 IP"
}

output "health_url" {
  value       = "http://${alicloud_instance.this.public_ip}/api/ai/health"
  description = "健康检查 URL（HTTP，经 Caddy 转发）"
}

output "ssh" {
  value       = "ssh root@${alicloud_instance.this.public_ip}"
  description = "SSH 登录命令"
}

