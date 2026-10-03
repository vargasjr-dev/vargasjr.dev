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
