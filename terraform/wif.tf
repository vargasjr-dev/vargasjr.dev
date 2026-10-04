# Portfolio CI identity: one identical terraform-apply SA per (repo, project), provisioned here so child repos carry zero root references.

locals {
  portfolio = [
    { repo = "vargasjr-dev/vargasjr.dev",     project = "vargasjr-dev" },
    { repo = "vargasjr-dev/mycadet-platform", project = "mycadet" },
  ]

  pairs = { for p in local.portfolio : p.project => p }
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions pool"
}

resource "google_iam_workload_identity_pool_provider" "github_oidc" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # Google's STS API rejects GitHub-issuer providers with no attribute
  # condition (HTTP 400). This one is tautological by design — repo
  # restriction is enforced by the bindings below. Don't remove it.
  attribute_condition = "attribute.repository == assertion.repository"
}

resource "google_service_account" "ci" {
  for_each = local.pairs

  project      = each.value.project
  account_id   = "terraform-apply"
  display_name = "Terraform CI (${each.value.repo})"
}

# One binding per pair: only that repo's Actions tokens may impersonate it.
resource "google_service_account_iam_member" "ci_impersonation" {
  for_each = local.pairs

  service_account_id = google_service_account.ci[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${each.value.repo}"
}

# Each CI SA administers its own project's infrastructure.
resource "google_project_iam_member" "ci_project" {
  for_each = local.pairs

  project = each.value.project
  role    = "roles/editor"
  member  = "serviceAccount:${google_service_account.ci[each.key].email}"
}

# Explicit secretmanager.admin on its own project — even though Editor
# normally covers it, CI plans 403'd on secretmanager.versions.access with
# Editor verified live. Explicit grant sidesteps org-policy/basic-role
# edge cases on secret data.
resource "google_project_iam_member" "ci_secret_admin" {
  for_each = local.pairs

  project = each.value.project
  role    = "roles/secretmanager.admin"
  member  = "serviceAccount:${google_service_account.ci[each.key].email}"
}

# The root pair's CI SA maintains this loop from CI: project IAM bindings
# plus SA lifecycle (incl. the workloadIdentityUser grants) in every pair
# project. First apply must be local; afterwards CI is self-sufficient.
resource "google_project_iam_member" "root_ci_project_admin" {
  for_each = local.pairs

  project = each.value.project
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = "serviceAccount:${google_service_account.ci["vargasjr-dev"].email}"
}

resource "google_project_iam_member" "root_ci_sa_admin" {
  for_each = local.pairs

  project = each.value.project
  role    = "roles/iam.serviceAccountAdmin"
  member  = "serviceAccount:${google_service_account.ci["vargasjr-dev"].email}"
}

resource "google_storage_bucket_iam_member" "ci_state" {
  for_each = local.pairs

  bucket = "vargasjr-dev-tfstate"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.ci[each.key].email}"
}

moved {
  from = google_service_account.terraform_apply
  to   = google_service_account.ci["vargasjr-dev"]
}
moved {
  from = google_project_iam_member.terraform_apply_editor
  to   = google_project_iam_member.ci_project["vargasjr-dev"]
}
moved {
  from = google_storage_bucket_iam_member.tfstate_object_admin
  to   = google_storage_bucket_iam_member.ci_state["vargasjr-dev"]
}
moved {
  from = google_service_account_iam_member.ci_impersonation["vargasjr-dev/vargasjr.dev"]
  to   = google_service_account_iam_member.ci_impersonation["vargasjr-dev"]
}
