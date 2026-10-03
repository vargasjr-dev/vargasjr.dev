terraform {
  # State lives in GCS (self-hosted replacement for Terraform Cloud).
  # The bucket is shared across the project portfolio; this repo's state
  # is namespaced under the prefix below.
  backend "gcs" {
    bucket = "vargasjr-dev-tfstate"
    prefix = "vargasjr-dev/prod"
  }
}
