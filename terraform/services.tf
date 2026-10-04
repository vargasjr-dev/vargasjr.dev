resource "google_project_service" "storage" {
  service = "storage.googleapis.com"
}

resource "google_project_service" "iam" {
  service = "iam.googleapis.com"
}

# Mints the short-lived tokens the WIF identity exchange produces —
# required for the terraform-apply SA impersonation flow.
resource "google_project_service" "iamcredentials" {
  service = "iamcredentials.googleapis.com"
}

# The token-exchange endpoint Workload Identity Federation talks to.
resource "google_project_service" "sts" {
  service = "sts.googleapis.com"
}

# Default-on APIs that some of the above depend on; declared for clarity
# so a fresh project converges even if defaults drift.
resource "google_project_service" "serviceusage" {
  service = "serviceusage.googleapis.com"
}

resource "google_project_service" "cloudresourcemanager" {
  service = "cloudresourcemanager.googleapis.com"
}

# The portfolio's secrets vault lives here — this project is the source of
# truth for secrets (see secrets.tf). Enablement of its API in MYCADET
# already exists (STRIPE_API_KEY was created there).
resource "google_project_service" "secretmanager" {
  service = "secretmanager.googleapis.com"
}

# Stripe webhook dispatcher (services/stripe-dispatcher) — Cloud Run host
# plus the registry its image pushes to from CI.
resource "google_project_service" "run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "artifactregistry" {
  service = "artifactregistry.googleapis.com"
}

# Buildpack builds for portfolio service images — dispatcher.yml submits them,
# so repos carry no Dockerfiles.
resource "google_project_service" "cloudbuild" {
  service = "cloudbuild.googleapis.com"
}
