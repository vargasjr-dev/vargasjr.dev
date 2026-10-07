# Modules must declare the source address of every provider they use —
# without this, Terraform guesses hub defaults (hashicorp/stripe,
# hashicorp/vercel) and the root's provider mappings fail with a type
# mismatch. Constraints mirror the root's providers.tf.

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
