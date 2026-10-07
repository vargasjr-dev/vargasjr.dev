# ---------------------------------------------------------------------------
# The portfolio's MAIN service account for Google integrations — everything
# that talks to Google as "Vargas JR" runs as this identity. First consumer:
# Sunday Fundsday finance tracking (Sheets).
#
# The SA gets spreadsheet access by being shared on the sheet (Google
# Drive-level grant, not IAM) — terraform can't do that part. Its key is
# also minted manually after apply (`gcloud iam service-accounts keys create`)
# and stored in the vault as `google-cloud:service_account_json` — a full
# SA private key must never land in terraform state.
# ---------------------------------------------------------------------------

resource "google_service_account" "vargas_jr" {
  account_id   = "vargas-jr"
  display_name = "Vargas JR"
}

resource "google_project_iam_custom_role" "vargasjr" {
  role_id     = "vargasjr"
  title       = "Vargas JR"
  description = "Created on: 2026-10-03"
  permissions = ["resourcemanager.projects.get"]
}

resource "google_project_iam_member" "vargas_jr_custom_role" {
  project = data.google_project.portfolio.project_id
  role    = google_project_iam_custom_role.vargasjr.id
  member  = "serviceAccount:${google_service_account.vargas_jr.email}"
}

data "google_project" "portfolio" {
  project_id = var.portfolio_project_id
}
