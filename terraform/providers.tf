terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.22"
    }

    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }

    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.0"
    }

    stripe = {
      source  = "franckverrot/stripe"
      version = "~> 1.9"
    }
  }
}

provider "cloudflare" {
  # Token is read from the project's own Secret Manager vault (secrets.tf) —
  # it used to live in Terraform Cloud workspace variables. No credential is
  # stored in this repository.
  api_token = data.google_secret_manager_secret_version.cloudflare_api_token.secret_data
}

provider "google" {
  # The portfolio's infra-home project. Authentication is supplied at runtime
  # through Application Default Credentials (local) or the WIF identity below
  # (CI). No credential is stored in this repository.
  project = "vargasjr-dev"
}

provider "vercel" {
  # Token read from the project's own vault (secrets.tf). Vercel API tokens
  # are account-wide — no granular scopes exist — so it lives in the vault,
  # never in the repo or CI variables. (v5 renamed team_id → team; it takes
  # a team slug or ID.)
  api_token = data.google_secret_manager_secret_version.vercel_api_token.secret_data
  team      = "team_bhY6xQNSaDzgiVpXhdFPXvZL"
}

# Stripe: default = the live restricted key; the "test" alias = the test
# restricted key, used by the test-mode webhook endpoint (root-owned
# stripe-test.tf).
# Both keys are rk_* secrets in the vault with webhook_write (the
# dispatcher's endpoints are terraform-managed).
provider "stripe" {
  api_token = data.google_secret_manager_secret_version.stripe_api_key.secret_data
}

provider "stripe" {
  alias     = "test"
  api_token = data.google_secret_manager_secret_version.stripe_test_api_key.secret_data
}
