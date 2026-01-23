resource "alicloud_cms_alarm" "cpu_high" {
  count = length(var.alarm_contact_groups) > 0 ? 1 : 0

  name           = "${var.name}-cpu-high"
  project        = "acs_ecs_dashboard"
  metric         = "cpu_total"
  statistics     = "Average"
  period         = 60
  operator       = ">="
  threshold      = 80
  triggered_count = 3
  contact_groups = var.alarm_contact_groups
  enabled        = true

  dimensions = {
    instanceId = alicloud_instance.this.id
  }
}

