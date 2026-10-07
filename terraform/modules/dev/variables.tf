variable "portfolio_project_id" {
  type = string
}

variable "stripe_api_key" {
  type      = string
  sensitive = true
}

variable "webhook_events" {
  type = list(string)
}
