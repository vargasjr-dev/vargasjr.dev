# ---------------------------------------------------------------------------
# Sunday Fundsday finance tracking + the portfolio's Google integrations.
#
# The SA gets its spreadsheet access by being shared on the sheet (Google
# Drive-level grant, not IAM) — terraform can't do that part. Its key is
# also minted manually after apply (`gcloud iam service-accounts keys create`)
# and stored in the vault as `google-cloud:service_account_json` — a full
# SA private key must never land in terraform state.
#
# The old kinetic-bond-324620 custom role `vargasjr` was exactly one
# permission (resourcemanager.projects.get); recreated here for parity.
# ---------------------------------------------------------------------------

resource "google_service_account" "vargas_jr" {
  account_id   = "vargas-jr"
  display_name = "VargasJR (Google integrations)"
}

resource "google_project_iam_custom_role" "vargasjr" {
  role_id     = "vargasjr"
  title       = "Vargas JR"
  description = "Created on: 2026-10-02"
  permissions = ["resourcemanager.projects.get"]
}

resource "google_project_iam_member" "vargas_jr_custom_role" {
  project = "vargasjr-dev"
  role    = google_project_iam_custom_role.vargasjr.id
  member  = "serviceAccount:${google_service_account.vargas_jr.email}"
}

output "fundsday_sa" {
  description = "Share the Sunday Fundsday spreadsheet with this email."
  value       = google_service_account.vargas_jr.email
}
