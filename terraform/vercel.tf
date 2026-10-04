# ---------------------------------------------------------------------------
# Vercel env-var replicas. The site deploys on Vercel, but its runtime
# secrets live in THIS project's vault (secrets.tf convention). Terraform
# reads the vault at apply time and converges the Vercel project's
# environment variables — rotation is: new SM version → `terraform apply`
# → one manual redeploy (Vercel env changes never trigger deploys).
#
# The project id is hardcoded from .vercel/project.json on the machine
# that linked the deployment — the project predates terraform and its
# creation stays manual (bootstrap rule).
# ---------------------------------------------------------------------------

resource "vercel_project_environment_variable" "google_client_id" {
  project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"
  key        = "GOOGLE_CLIENT_ID"
  value      = data.google_secret_manager_secret_version.google_client_id.secret_data
  target     = ["production", "preview"]

  # Vercel requires the flag explicitly; sensitive vars can't be read back
  # via API/dashboard once set — the vault stays the only source of truth.
  sensitive = true
}

resource "vercel_project_environment_variable" "google_client_secret" {
  project_id = "prj_qMPM1ihlNlPbkUYPm0rMUuCsZguI"
  key        = "GOOGLE_CLIENT_SECRET"
  value      = data.google_secret_manager_secret_version.google_client_secret.secret_data
  target     = ["production", "preview"]
  sensitive  = true
}

# The mycadet app stamps Stripe checkout metadata with its GCP project id —
# the portfolio dispatcher routes webhook events on this field.
resource "vercel_project_environment_variable" "mycadet_project_id" {
  project_id = "prj_FWyaJ9sfVoye6oIer0RmM75L3FqH"
  key        = "PROJECT_ID"
  value      = "mycadet"
  target     = ["production", "preview"]
}
