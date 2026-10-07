# ---------------------------------------------------------------------------
# Root wiring. The configuration is split into three modules (cadet-style
# layout, minus the workspaces — this repo has a single workspace and a
# single project, so each module below is instantiated exactly once):
#
#   modules/shared — account-level resources (API enablements, the Vargas
#                    JR service account identity, the AR repo both
#                    dispatchers pull from, the webhook event list)
#   modules/prod   — the prod stack (live Stripe dispatcher + its live
#                    webhook endpoint, Vercel env replicas)
#   modules/dev    — the sandbox stack (dev Stripe dispatcher + its
#                    test-mode webhook endpoint)
#
# Root-owned (ungated, both here and in cadet's convention): the WIF
# portfolio loop, the CI secret-reader grants, the vault SM data the
# providers and modules consume, and the run service agent's AR reader.
# ---------------------------------------------------------------------------

locals {
  portfolio_project_id = "vargasjr-dev"
}

# Enablements + identity + shared registry — everything account-level.
module "shared" {
  source = "./modules/shared"

  portfolio_project_id = local.portfolio_project_id
}

# The run service agent pulls images from the portfolio AR repo on deploy.
# Root-owned like cadet's, so it survives any future module reshuffles.
resource "google_project_iam_member" "run_service_agent_ar_reader" {
  project = local.portfolio_project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:service-${data.google_project.portfolio.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

data "google_project" "portfolio" {
  project_id = local.portfolio_project_id
}

module "prod" {
  source = "./modules/prod"

  portfolio_project_id = local.portfolio_project_id
  stripe_api_key       = data.google_secret_manager_secret_version.stripe_api_key.secret_data
  google_client_id     = data.google_secret_manager_secret_version.google_client_id.secret_data
  google_client_secret = data.google_secret_manager_secret_version.google_client_secret.secret_data
  webhook_events       = module.shared.webhook_events

  # A providers argument on a module block disables default inheritance
  # entirely, so every provider the prod stack touches is passed here.
  providers = {
    google = google
    vercel = vercel
    stripe = stripe
  }

  depends_on = [module.shared]
}

# The dev dispatcher serves Stripe TEST mode — the test webhook endpoint
# lives here with it. Same image as prod (DISPATCHER_MODE selects the
# route table), one signing secret, its own SA.
module "dev" {
  source = "./modules/dev"

  portfolio_project_id = local.portfolio_project_id
  stripe_api_key       = data.google_secret_manager_secret_version.stripe_test_api_key.secret_data
  webhook_events       = module.shared.webhook_events

  providers = {
    google      = google
    stripe-test = stripe.test
  }

  depends_on = [module.shared]
}

output "vargas_jr_sa" {
  description = "Share Sheets/spreadsheets (and future Google resources) with this email."
  value       = module.shared.vargas_jr_sa
}
