provider "stripe" {
  api_token = data.google_secret_manager_secret_version.stripe_api_key.secret_data
}

locals {
  stripe_secret_name = terraform.workspace == "default" ? "STRIPE_API_KEY" : "TEST_STRIPE_API_KEY"

  # run.app URLs are deterministic: service + project number + region.
  webhook_url = terraform.workspace == "default" ? "https://stripe-dispatcher-411402639456.us-central1.run.app/api/stripe/webhook" : local.sandbox_webhook_url

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
        name  = "STRIPE_WEBHOOK_SECRET"
        value = stripe_webhook_endpoint.dispatcher.secret
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

# CI applies this stack as terraform-apply@ — it needs Run + Registry admin
# and the right to attach the dispatcher SA to the service.
resource "google_project_iam_member" "ci_run_admin" {
  project = "vargasjr-dev"
  role    = "roles/run.admin"
  member  = "serviceAccount:terraform-apply@vargasjr-dev.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "ci_artifactregistry_admin" {
  project = "vargasjr-dev"
  role    = "roles/artifactregistry.admin"
  member  = "serviceAccount:terraform-apply@vargasjr-dev.iam.gserviceaccount.com"
}

resource "google_service_account_iam_member" "ci_dispatcher_sa_user" {
  service_account_id = google_service_account.stripe_dispatcher.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:terraform-apply@vargasjr-dev.iam.gserviceaccount.com"
}
