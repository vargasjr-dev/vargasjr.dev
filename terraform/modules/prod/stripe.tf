locals {
  dispatcher_service_name = "stripe-dispatcher"
  dispatcher_service_url  = "https://${local.dispatcher_service_name}-${data.google_project.portfolio.number}.us-central1.run.app"
  service_agent           = "serviceAccount:service-${data.google_project.portfolio.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

data "google_project" "portfolio" {
  project_id = var.portfolio_project_id
}

# ---------------------------------------------------------------------------
# The LIVE webhook endpoint points at the live dispatcher. The test-mode
# stack lives root-owned in terraform/stripe-test.tf: one dispatcher
# service per mode, same image, each reading a single signing secret.
# The dispatcher relays by metadata.project regardless of mode — cadet's
# handler is mode-agnostic (mode is decided at checkout by the
# environment).
# ---------------------------------------------------------------------------

resource "stripe_webhook_endpoint" "dispatcher" {
  url = "${local.dispatcher_service_url}/api/stripe/webhook"
  enabled_events = [
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]
}

resource "google_service_account" "stripe_dispatcher" {
  account_id   = "stripe-dispatcher"
  display_name = "Stripe dispatcher"
}

resource "google_artifact_registry_repository" "portfolio" {
  location      = "us-central1"
  repository_id = "portfolio"
  format        = "DOCKER"
  description   = "Portfolio service images"
}

# The live endpoint's signing secret, read by the dispatcher through the
# single STRIPE_WEBHOOK_SECRET env var.
resource "google_secret_manager_secret" "dispatcher_webhook_secret" {
  secret_id = "STRIPE_WEBHOOK_SECRET"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "dispatcher_webhook_secret" {
  secret      = google_secret_manager_secret.dispatcher_webhook_secret.name
  secret_data = stripe_webhook_endpoint.dispatcher.secret
}

resource "google_secret_manager_secret_iam_member" "dispatcher_read_webhook_secret" {
  secret_id = google_secret_manager_secret.dispatcher_webhook_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.stripe_dispatcher.email}"
}

resource "google_secret_manager_secret_iam_member" "run_agent_read_webhook_secret" {
  secret_id = google_secret_manager_secret.dispatcher_webhook_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = local.service_agent
}

resource "google_cloud_run_v2_service" "stripe_dispatcher" {
  name     = local.dispatcher_service_name
  location = "us-central1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  invoker_iam_disabled = true

  template {
    service_account = google_service_account.stripe_dispatcher.email

    containers {
      image = "us-central1-docker.pkg.dev/${var.portfolio_project_id}/portfolio/stripe-dispatcher:latest"

      env {
        name  = "STRIPE_API_KEY"
        value = var.stripe_api_key
      }

      env {
        name = "STRIPE_WEBHOOK_SECRET"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.dispatcher_webhook_secret.secret_id
            version = google_secret_manager_secret_version.dispatcher_webhook_secret.version
          }
        }
      }
    }
  }
}
