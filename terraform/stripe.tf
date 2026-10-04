provider "stripe" {
  api_token = data.google_secret_manager_secret_version.stripe_api_key.secret_data
}

locals {
  vercel_project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"

  stripe_secret_name = terraform.workspace == "default" ? "STRIPE_API_KEY" : "TEST_STRIPE_API_KEY"

  webhook_url = terraform.workspace == "default" ? "https://vargasjr.dev/api/stripe/webhook" : local.sandbox_webhook_url

  sandbox_webhook_url = "https://vargasjr.dev/api/stripe/webhook"

  webhook_secret_target = terraform.workspace == "default" ? ["production"] : ["preview"]
}

data "google_secret_manager_secret_version" "stripe_api_key" {
  project = "vargasjr-dev"
  secret  = local.stripe_secret_name
}

resource "stripe_webhook_endpoint" "dispatcher" {
  url = local.webhook_url
  enabled_events = [
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]
}

resource "vercel_project_environment_variable" "stripe_api_key" {
  project_id = local.vercel_project_id
  key        = "STRIPE_API_KEY"
  value      = data.google_secret_manager_secret_version.stripe_api_key.secret_data
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "stripe_webhook_secret" {
  project_id = local.vercel_project_id
  key        = "STRIPE_WEBHOOK_SECRET"
  value      = stripe_webhook_endpoint.dispatcher.secret
  target     = local.webhook_secret_target
  sensitive  = true
}
