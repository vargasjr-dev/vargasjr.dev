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

    # Second local name for the SAME stripe provider, dedicated to the
    # test-mode endpoint: the root maps it to the aliased stripe.test
    # configuration (the test restricted key). required_providers keys
    # must be bare identifiers, so the alias rides in via this rename.
    stripe-test = {
      source  = "franckverrot/stripe"
      version = "~> 1.9"
    }
  }
}
