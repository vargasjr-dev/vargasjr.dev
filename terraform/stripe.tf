terraform {
  required_providers {
    stripe = {
      source  = "franckverrot/stripe"
      version = "~> 1.9"
    }
  }
}

provider "stripe" {
  api_token = data.google_secret_manager_secret_version.stripe_api_key.secret_data
}

resource "stripe_webhook_endpoint" "dispatcher" {
  url = "https://vargasjr.dev/api/stripe/webhook"
  enabled_events = [
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]
}

data "google_secret_manager_secret_version" "stripe_api_key" {
  project = "mycadet"
  secret  = "STRIPE_API_KEY"
}

resource "vercel_project_environment_variable" "stripe_api_key" {
  project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"
  key        = "STRIPE_API_KEY"
  value      = data.google_secret_manager_secret_version.stripe_api_key.secret_data
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "stripe_webhook_secret" {
  project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"
  key        = "STRIPE_WEBHOOK_SECRET"
  value      = stripe_webhook_endpoint.dispatcher.secret
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "route_mycadet_url" {
  project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"
  key        = "ROUTE_MYCADET_URL"
  value      = "https://mycadet.ai/api/stripe/webhook"
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "route_piro_url" {
  project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"
  key        = "ROUTE_PIRO_URL"
  value      = "https://trainpiro.app/api/stripe/webhook"
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "route_vellymon_url" {
  project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"
  key        = "ROUTE_VELLYMON_URL"
  value      = "https://vellymon.game/api/webhooks/stripe"
  target     = ["production"]
  sensitive  = true
}
