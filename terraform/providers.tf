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
