# ---------------------------------------------------------------------------
# Keyless CI identity: GitHub Actions → GCP via Workload Identity Federation.
# Replaces long-lived SA JSON keys (the ones we're deleting in
# kinetic-bond-324620) with per-run OIDC tokens.
#
# The pool is deliberately NOT restricted to one repo — the IAM bindings
# below are the actual gate. New portfolio repos join by adding another
# google_service_account_iam_member with their own attribute.repository
# principalSet.
#
# Until this is applied, the mycadet-platform GHA workflow self-skips.
# ---------------------------------------------------------------------------

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions pool"
}

resource "google_iam_workload_identity_pool_provider" "github_oidc" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"
  issuer_uri                         = "https://token.actions.githubusercontent.com"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
}

resource "google_service_account" "terraform_apply" {
  account_id   = "terraform-apply"
  display_name = "Terraform apply (GitHub Actions)"
}

# Which repos may impersonate the CI service account.
resource "google_service_account_iam_member" "terraform_apply_impersonation" {
  service_account_id = google_service_account.terraform_apply.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/vargasjr-dev/mycadet-platform"
}

# What the CI identity may touch (bucket is created manually — bootstrap rule):
#   1. terraform state
resource "google_storage_bucket_iam_member" "tfstate_object_admin" {
  bucket = "vargasjr-dev-tfstate"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.terraform_apply.email}"
}

#   2. mycadet's Stripe key (cross-project grant — the secret stays at home)
resource "google_secret_manager_secret_iam_member" "mycadet_stripe_key" {
  secret_id = "projects/mycadet/secrets/STRIPE_API_KEY"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.terraform_apply.email}"
}

output "wif_provider" {
  description = "Value for the terraform workflow's workload_identity_provider."
  value       = google_iam_workload_identity_pool_provider.github_oidc.name
}

output "ci_sa" {
  description = "Value for the terraform workflow's service_account."
  value       = google_service_account.terraform_apply.email
}
