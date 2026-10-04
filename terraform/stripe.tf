provider "stripe" {
  api_token = data.google_secret_manager_secret_version.stripe_api_key.secret_data
}

locals {
  stripe_secret_name = terraform.workspace == "default" ? "STRIPE_API_KEY" : "TEST_STRIPE_API_KEY"

  # Cloud Build buildpack builds run as the project's default compute service
  # account — it needs Artifact Registry write to push service images.
  compute_default_sa = "${data.google_project.portfolio.number}-compute@developer.gserviceaccount.com"
}

data "google_project" "portfolio" {}

data "google_secret_manager_secret_version" "stripe_api_key" {
  secret = local.stripe_secret_name
}

# The endpoint's URL points at the Cloud Run service's own URI output, which
# means the service cannot also depend on the endpoint (cycle). The signing
# secret therefore reaches the service through Secret Manager by reference —
# the version lands after the endpoint exists and the service reads "latest"
# at revision deployment.
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

# The dispatcher runs as its own identity with no project roles — it only
# serves public Stripe posts and makes outbound fetches to project handlers.
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

resource "google_project_iam_member" "builds_push_images" {
  project = data.google_project.portfolio.project_id
  role    = "roles/artifactregistry.writer"
  member = "serviceAccount:${local.compute_default_sa}"
}

resource "google_cloud_run_v2_service" "stripe_dispatcher" {
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
