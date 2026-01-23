resource "alicloud_cms_alarm" "cpu_high" {
  count = length(var.alarm_contact_groups) > 0 ? 1 : 0

  name           = "${var.name}-cpu-high"
  project        = "acs_ecs_dashboard"
  metric         = "cpu_total"
  period         = 60
  contact_groups = var.alarm_contact_groups
  enabled        = true

  metric_dimensions = jsonencode({
    instanceId = alicloud_instance.this.id
  })

  escalations_critical {
    statistics          = "Average"
    comparison_operator = ">="
    threshold           = 80
    times               = 3
  }
}
