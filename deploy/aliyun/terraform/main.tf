data "alicloud_zones" "default" {
  available_resource_creation = "VSwitch"
}

data "alicloud_images" "ubuntu" {
  owners      = "system"
  most_recent = true
  name_regex  = "ubuntu_22_04"
}

data "alicloud_instance_types" "default" {
  availability_zone    = data.alicloud_zones.default.zones[0].id
  image_id             = data.alicloud_images.ubuntu.images[0].id
  cpu_core_count       = 2
  memory_size          = 4
  instance_charge_type = "PostPaid"
}

resource "alicloud_vpc" "this" {
  vpc_name   = "${var.name}-vpc"
  cidr_block = "10.10.0.0/16"
}

resource "alicloud_vswitch" "this" {
  vpc_id       = alicloud_vpc.this.id
  vswitch_name = "${var.name}-vsw"
  cidr_block   = "10.10.1.0/24"
  zone_id      = data.alicloud_zones.default.zones[0].id
}

resource "alicloud_security_group" "this" {
  name        = "${var.name}-sg"
  description = "swoopkeep api"
  vpc_id      = alicloud_vpc.this.id
}

resource "alicloud_security_group_rule" "ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 1
  security_group_id = alicloud_security_group.this.id
  cidr_ip           = var.allowed_ssh_cidr
}

resource "alicloud_security_group_rule" "http" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "80/80"
  priority          = 1
  security_group_id = alicloud_security_group.this.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_security_group_rule" "https" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "443/443"
  priority          = 1
  security_group_id = alicloud_security_group.this.id
  cidr_ip           = "0.0.0.0/0"
}

locals {
  user_data = <<-EOF
  #!/bin/bash
  set -euo pipefail

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl

  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker

  mkdir -p /opt/swoopkeep
  cat >/opt/swoopkeep/.env <<ENV
  DEEPSEEK_API_KEY=${var.deepseek_api_key}
  DEEPSEEK_BASE_URL=${var.deepseek_base_url}
  DEEPSEEK_CHAT_MODEL=${var.deepseek_chat_model}
  SWOOPKEEP_API_IMAGE=${var.api_image}
  CADDY_DOMAIN=${var.domain}
  ENV

  cat >/opt/swoopkeep/docker-compose.yml <<'YAML'
  services:
    swoopkeep-api:
      image: ${SWOOPKEEP_API_IMAGE}
      restart: unless-stopped
      environment:
        - PORT=3001
        - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
        - DEEPSEEK_BASE_URL=${DEEPSEEK_BASE_URL}
        - DEEPSEEK_CHAT_MODEL=${DEEPSEEK_CHAT_MODEL}
      ports:
        - "127.0.0.1:3001:3001"
      healthcheck:
        test: ["CMD", "sh", "-lc", "wget -q -O - http://127.0.0.1:3001/api/ai/health | grep -q success" ]
        interval: 10s
        timeout: 3s
        retries: 10

    caddy:
      image: caddy:2
      restart: unless-stopped
      depends_on:
        - swoopkeep-api
      ports:
        - "80:80"
        - "443:443"
      environment:
        - CADDY_DOMAIN=${CADDY_DOMAIN}
      volumes:
        - caddy_data:/data
        - caddy_config:/config
      command: ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
      configs:
        - source: caddyfile
          target: /etc/caddy/Caddyfile

  volumes:
    caddy_data:
    caddy_config:

  configs:
    caddyfile:
      content: |
        {$CADDY_DOMAIN:}:80 {
          reverse_proxy swoopkeep-api:3001
        }

        {$CADDY_DOMAIN:} {
          reverse_proxy swoopkeep-api:3001
        }
  YAML

  cd /opt/swoopkeep
  docker compose up -d
  EOF
}

resource "alicloud_instance" "this" {
  instance_name              = "${var.name}-api"
  host_name                  = "${var.name}-api"
  image_id                   = data.alicloud_images.ubuntu.images[0].id
  instance_type              = data.alicloud_instance_types.default.instance_types[0].id
  vswitch_id                 = alicloud_vswitch.this.id
  security_groups            = [alicloud_security_group.this.id]
  internet_max_bandwidth_out = 10
  system_disk_category       = "cloud_efficiency"
  system_disk_size           = 40
  password                   = var.instance_password
  user_data                  = base64encode(local.user_data)
}
