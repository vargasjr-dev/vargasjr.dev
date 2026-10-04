provider "stripe" {
  api_token = data.google_secret_manager_secret_version.stripe_api_key.secret_data
}

locals {
  stripe_secret_name = terraform.workspace == "default" ? "STRIPE_API_KEY" : "TEST_STRIPE_API_KEY"

data "google_secret_manager_secret_version" "stripe_api_key" {
  secret = local.stripe_secret_name
}

resource "stripe_webhook_endpoint" "dispatcher" {
  url = "${google_cloud_run_v2_service.stripe_dispatcher.uri}/api/stripe/webhook"
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
  depends_on = [google_project_service.iam]

  account_id   = "stripe-dispatcher"
  display_name = "Stripe dispatcher"
}

resource "google_artifact_registry_repository" "portfolio" {
  depends_on = [google_project_service.artifactregistry]

  location      = "us-central1"
  repository_id = "portfolio"
  format        = "DOCKER"
  description   = "Portfolio service images"
}

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

}

resource "google_cloud_run_v2_service" "stripe_dispatcher" {
  depends_on = [google_project_service.run]

  name     = "stripe-dispatcher"
  location = "us-central1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.stripe_dispatcher.email

    containers {
      image = "us-central1-docker.pkg.dev/vargasjr-dev/portfolio/stripe-dispatcher:latest"

      env {
        name  = "STRIPE_API_KEY"
        value = data.google_secret_manager_secret_version.stripe_api_key.secret_data
      }

      env {
        name = "STRIPE_WEBHOOK_SECRET"

        value_source {
          secret_key_ref {
            secret = google_secret_manager_secret.dispatcher_webhook_secret.secret_id
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.stripe_dispatcher.name
  location = "us-central1"
  role     = "roles/run.invoker"
  member   = "allUsers"
}
