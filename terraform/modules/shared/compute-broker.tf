# ---------------------------------------------------------------------------
# Disposable compute broker: a Cloud Run service that maps force-plugin
# execution profiles onto per-task GCE worker instances. Task + command
# state lives in a dedicated GCS bucket; workers pull work outbound-only
# (no inbound firewall exposure), and the broker's own runtime SA carries
# every compute call — no service-account keys anywhere.
# ---------------------------------------------------------------------------

resource "google_project_service" "compute" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_service_account" "compute_broker" {
  account_id   = "compute-broker"
  display_name = "Compute broker"
}

# Instance create/get/delete for QA workers (narrower than compute.admin).
resource "google_project_iam_member" "compute_broker_instance_admin" {
  project = var.portfolio_project_id
  role    = "roles/compute.instanceAdmin.v1"
  member  = "serviceAccount:${google_service_account.compute_broker.email}"
}

resource "google_storage_bucket" "compute_broker_state" {
  name                        = "${var.portfolio_project_id}-compute-broker-state"
  location                    = "us-central1"
  force_destroy               = true
  uniform_bucket_level_access = true
}

resource "google_storage_bucket_iam_member" "compute_broker_state_admin" {
  bucket = google_storage_bucket.compute_broker_state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.compute_broker.email}"
}

resource "random_password" "compute_broker_token" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "compute_broker_token" {
  secret_id = "COMPUTE_BROKER_TOKEN"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "compute_broker_token" {
  secret      = google_secret_manager_secret.compute_broker_token.name
  secret_data = random_password.compute_broker_token.result
}

# Optional fine-grained PAT for worker clones of private repos. Seeded by
# hand after apply (`gcloud secrets versions add COMPUTE_BROKER_GITHUB_TOKEN
# --project ... --data-file=-`); until then workers can only clone public
# repositories.
resource "google_secret_manager_secret" "compute_broker_github_token" {
  secret_id = "COMPUTE_BROKER_GITHUB_TOKEN"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "compute_broker_github_token" {
  secret      = google_secret_manager_secret.compute_broker_github_token.name
  secret_data = "unset"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

data "google_project" "broker_portfolio" {
  project_id = var.portfolio_project_id
}

locals {
  broker_run_agent = "serviceAccount:service-${data.google_project.broker_portfolio.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

resource "google_secret_manager_secret_iam_member" "compute_broker_token_accessor" {
  secret_id = google_secret_manager_secret.compute_broker_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.compute_broker.email}"
}

resource "google_secret_manager_secret_iam_member" "compute_broker_token_run_agent" {
  secret_id = google_secret_manager_secret.compute_broker_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = local.broker_run_agent
}

resource "google_secret_manager_secret_iam_member" "compute_broker_github_token_accessor" {
  secret_id = google_secret_manager_secret.compute_broker_github_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.compute_broker.email}"
}

resource "google_cloud_run_v2_service" "compute_broker" {
  name     = "compute-broker"
  location = "us-central1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  invoker_iam_disabled = true

  template {
    service_account = google_service_account.compute_broker.email
    timeout         = "660s"

    containers {
      image = "us-central1-docker.pkg.dev/${var.portfolio_project_id}/portfolio/compute-broker:latest"

      env {
        name = "BROKER_TOKEN"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.compute_broker_token.secret_id
            version = google_secret_manager_secret_version.compute_broker_token.version
          }
        }
      }

      env {
        name  = "GCP_PROJECT"
        value = var.portfolio_project_id
      }

      env {
        name  = "ZONE"
        value = "us-central1-a"
      }

      env {
        name  = "STATE_BUCKET"
        value = google_storage_bucket.compute_broker_state.name
      }

      env {
        name  = "BROKER_PUBLIC_URL"
        value = "https://compute-broker-${data.google_project.broker_portfolio.number}.us-central1.run.app"
      }
    }
  }

  depends_on = [
    google_project_service.compute,
    google_secret_manager_secret_version.compute_broker_token,
    google_secret_manager_secret_version.compute_broker_github_token,
  ]
}

output "compute_broker_url" {
  value = "https://compute-broker-${data.google_project.broker_portfolio.number}.us-central1.run.app"
}
