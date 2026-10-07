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
