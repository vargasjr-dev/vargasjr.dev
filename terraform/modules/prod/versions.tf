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

    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.0"
    }

    stripe = {
      source  = "franckverrot/stripe"
      version = "~> 1.9"
    }

    # The test endpoint's provider alias — the dotted local name must be
    # declared explicitly for the root's stripe.test mapping to be accepted.
    "stripe.test" = {
      source = "franckverrot/stripe"
    }
  }
}
