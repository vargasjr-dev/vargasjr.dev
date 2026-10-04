# ---------------------------------------------------------------------------
# Keyless CI identity for the whole PORTFOLIO: GitHub Actions → GCP via
# Workload Identity Federation.
#
# One CI service account per (repo, gcp project) pair, all living HERE in
# the root project, all provisioned by this one loop. This is deliberate:
# child repos contain ZERO references to the root's identity — no grants,
# no IAM resources for our SAs. A child's CI identity and its permissions
# on its own project are decided here, in one place, so chicken-and-egg
# bootstrapping never happens twice.
#
# Adding a portfolio project = one map entry + a local apply (the only
# human step; CI can't grant the cross-project roles on first sight).
#
# The pool is shared; the workloadIdentityUser bindings are the actual
# per-repo gate.
# ---------------------------------------------------------------------------

locals {
  # Key = CI SA account_id (in THIS project). repo = the GitHub repo whose
  # Actions may impersonate it; project = the GCP project it administers.
  portfolio = {
    "terraform-apply" = {
      repo    = "vargasjr-dev/vargasjr.dev"
      project = "vargasjr-dev"
    }
    "terraform-apply-mycadet" = {
      repo    = "vargasjr-dev/mycadet-platform"
      project = "mycadet"
    }
  }
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

  # Google's STS API rejects GitHub-issuer providers that have no attribute
  # condition: "The attribute condition must reference one of the provider's
  # claims" (HTTP 400). This one is deliberately tautological — the mapping
  # derives attribute.repository from assertion.repository, so it always
  # holds — because repo restriction is enforced by the IAM principalSet
  # bindings below, not here. Don't "simplify" it away; the apply breaks.
  attribute_condition = "attribute.repository == assertion.repository"
}

resource "google_service_account" "ci" {
  for_each = local.portfolio

  account_id   = each.key
  display_name = "Terraform CI — ${each.value.repo}"
}

# Which repo may impersonate which CI SA — one binding per pair, gated to
# that repo's tokens only.
resource "google_service_account_iam_member" "ci_impersonation" {
  for_each = local.portfolio

  service_account_id = google_service_account.ci[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${each.value.repo}"
}

# Each CI SA administers its pair's own project (cross-project for children;
# child terraform never manages identity grants itself — this loop does).
resource "google_project_iam_member" "ci_project" {
  for_each = local.portfolio

  project = each.value.project
  role    = "roles/editor"
  member  = "serviceAccount:${google_service_account.ci[each.key].email}"
}

# The ROOT pair's CI SA manages THIS loop's bindings (refresh + re-apply of
# the project_iam_member resources above) — without it, CI applies of this
# stack die on IAM_PERMISSION_DENIED the first time a binding churns.
# First grant must be applied locally (owner); afterwards CI is self-sufficient.
resource "google_project_iam_member" "root_ci_iam_admin" {
  for_each = local.portfolio

  project = each.value.project
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = "serviceAccount:${google_service_account.ci["terraform-apply"].email}"
}

# State access (bucket is created manually — bootstrap rule):
resource "google_storage_bucket_iam_member" "ci_state" {
  for_each = local.portfolio

  bucket = "vargasjr-dev-tfstate"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.ci[each.key].email}"
}

# --- moves from the pre-loop one-SA-per-everything shape (state-only
# remaps; the duplicate mycadet-repo binding on the shared SA is simply
# retired — the child SA binding replaces it).
moved {
  from = google_service_account.terraform_apply
  to   = google_service_account.ci["terraform-apply"]
}
moved {
  from = google_project_iam_member.terraform_apply_editor
  to   = google_project_iam_member.ci_project["terraform-apply"]
}
moved {
  from = google_storage_bucket_iam_member.tfstate_object_admin
  to   = google_storage_bucket_iam_member.ci_state["terraform-apply"]
}
moved {
  from = google_service_account_iam_member.ci_impersonation["vargasjr-dev/vargasjr.dev"]
  to   = google_service_account_iam_member.ci_impersonation["terraform-apply"]
}

output "wif_provider" {
  description = "Value for every terraform workflow's workload_identity_provider."
  value       = google_iam_workload_identity_pool_provider.github_oidc.name
}

output "ci_identities" {
  description = "Per-pair CI identity: SA email for the workflow's service_account + project it administers."
  value = {
    for k, sa in google_service_account.ci : k => {
      repo             = local.portfolio[k].repo
      project          = local.portfolio[k].project
      service_account  = sa.email
      wif_provider     = google_iam_workload_identity_pool_provider.github_oidc.name
    }
  }
}

output "ci_sa" {
  description = "Value for THIS repo's terraform workflow's service_account."
  value       = google_service_account.ci["terraform-apply"].email
}
