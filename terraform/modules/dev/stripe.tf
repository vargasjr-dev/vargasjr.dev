locals {
  dispatcher_service_name = "stripe-dispatcher-dev"
  dispatcher_service_url  = "https://${local.dispatcher_service_name}-${data.google_project.portfolio.number}.us-central1.run.app"
  service_agent           = "serviceAccount:service-${data.google_project.portfolio.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

data "google_project" "portfolio" {
  project_id = var.portfolio_project_id
}

# ---------------------------------------------------------------------------
# The DEV dispatcher serves Stripe TEST mode: the test webhook endpoint
# fires here, and the dispatcher routes by metadata.project with the dev
# route table. Same image as prod (DISPATCHER_MODE selects the routes) —
# each instance reads a single STRIPE_WEBHOOK_SECRET env var; terraform
# passes this one the test endpoint's signing secret.
# ---------------------------------------------------------------------------

resource "stripe_webhook_endpoint" "dispatcher_dev" {
  provider = stripe-test

  url            = "${local.dispatcher_service_url}/api/stripe/webhook"
  enabled_events = var.webhook_events
}

resource "google_service_account" "stripe_dispatcher_dev" {
  account_id   = "stripe-dispatcher-dev"
  display_name = "Stripe dispatcher (dev)"
}

resource "google_secret_manager_secret" "dispatcher_webhook_secret_dev" {
  secret_id = "STRIPE_WEBHOOK_SECRET_DEV"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "dispatcher_webhook_secret_dev" {
  secret      = google_secret_manager_secret.dispatcher_webhook_secret_dev.name
  secret_data = stripe_webhook_endpoint.dispatcher_dev.secret
}

resource "google_secret_manager_secret_iam_member" "dispatcher_read_webhook_secret_dev" {
  secret_id = google_secret_manager_secret.dispatcher_webhook_secret_dev.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.stripe_dispatcher_dev.email}"
}

resource "google_secret_manager_secret_iam_member" "run_agent_read_webhook_secret_dev" {
  secret_id = google_secret_manager_secret.dispatcher_webhook_secret_dev.id
  role      = "roles/secretmanager.secretAccessor"
  member    = local.service_agent
}

resource "google_cloud_run_v2_service" "stripe_dispatcher_dev" {
  name     = local.dispatcher_service_name
  location = "us-central1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Same DRS pattern as the prod dispatcher (#879): no invoker binding —
  # the Stripe signature check in code is the auth.
  invoker_iam_disabled = true

  template {
    service_account = google_service_account.stripe_dispatcher_dev.email

    containers {
      # Same portfolio AR repo the prod dispatcher pulls from (modules/shared).
      image = "us-central1-docker.pkg.dev/${var.portfolio_project_id}/portfolio/stripe-dispatcher:latest"

      env {
        name  = "STRIPE_API_KEY"
        value = var.stripe_api_key
      }

      env {
        name  = "DISPATCHER_MODE"
        value = "dev"
      }

      env {
        name = "STRIPE_WEBHOOK_SECRET"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.dispatcher_webhook_secret_dev.secret_id
            version = google_secret_manager_secret_version.dispatcher_webhook_secret_dev.version
          }
        }
      }
    }
  }
}
