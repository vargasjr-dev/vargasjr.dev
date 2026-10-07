# ---------------------------------------------------------------------------
# Secrets convention (portfolio-wide):
#
#   GCP Secret Manager is the single source of truth. Everything else
#   (GH Actions secrets, Vercel env vars, ...) is a replica that terraform
#   converges. Rotation: write a new version in Secret Manager, then
#   `terraform apply` — nothing else to touch.
#
# This repo's own secrets live in the vargasjr-dev project and are read
# directly — same pattern as mycadet's STRIPE_API_KEY. The Cloudflare API
# token used to live in Terraform Cloud workspace variables; this replaces
# that as we leave TFC.
# ---------------------------------------------------------------------------

data "google_secret_manager_secret_version" "cloudflare_api_token" {
  project = "vargasjr-dev"
  secret  = "CLOUDFLARE_API_TOKEN"

  # Same-apply ordering: the vault API must be on before we read from it.
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret_version" "vercel_api_token" {
  project    = "vargasjr-dev"
  secret     = "VERCEL_API_TOKEN"
  depends_on = [google_project_service.secretmanager]
}

# The Gmail OAuth client for this app (cloned into this project during the
# GCP home migration). Consumed by the deployed site via Vercel env vars.
data "google_secret_manager_secret_version" "google_client_id" {
  project    = "vargasjr-dev"
  secret     = "GOOGLE_CLIENT_ID"
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret_version" "google_client_secret" {
  project    = "vargasjr-dev"
  secret     = "GOOGLE_CLIENT_SECRET"
  depends_on = [google_project_service.secretmanager]
}

# The CI identity reads this repo's vault directly at apply time — same
# values the providers and resources above consume. (Other repos' secrets
# are granted from their own repos; the owner grants, nobody else bleeds in.)
resource "google_secret_manager_secret_iam_member" "ci_secret_reader" {
  for_each = toset([
    "CLOUDFLARE_API_TOKEN",
    "VERCEL_API_TOKEN",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "TEST_STRIPE_API_KEY",
  ])

  secret_id = "projects/vargasjr-dev/secrets/${each.key}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:terraform-apply@vargasjr-dev.iam.gserviceaccount.com"
}

# The test-mode restricted Stripe key (rk_test_) for the test webhook
# endpoint's provider alias. Seeded in this project's vault.
data "google_secret_manager_secret_version" "stripe_test_api_key" {
  project    = "vargasjr-dev"
  secret     = "TEST_STRIPE_API_KEY"
  depends_on = [google_project_service.secretmanager]
}
