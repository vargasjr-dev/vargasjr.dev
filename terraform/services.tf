# ---------------------------------------------------------------------------
# Service enablement for the vargasjr-dev project.
#
# (The project itself + billing link are created manually — a project cannot
# manage its own existence. Same one-time bootstrap rule as the state bucket,
# which also lives here and stays manual: state can't manage its own home.)
# ---------------------------------------------------------------------------

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
