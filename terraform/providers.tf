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
  # Authentication is supplied through the CLOUDFLARE_API_TOKEN environment
  # variable. No credential is stored in this repository.
}

provider "google" {
  # The portfolio's infra-home project. Authentication is supplied at runtime
  # through Application Default Credentials (local) or the WIF identity below
  # (CI). No credential is stored in this repository.
  project = "vargasjr-dev"
}
