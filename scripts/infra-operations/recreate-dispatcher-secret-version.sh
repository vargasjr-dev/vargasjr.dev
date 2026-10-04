#!/usr/bin/env bash
set -euo pipefail

# One-off heal: the STRIPE_WEBHOOK_SECRET secret has zero enabled versions.
# The version was destroyed by an apply that aborted mid-flight and was never
# recreated; terraform state still tracks the version resource, so a plain
# apply is a no-op. -replace forces terraform to drop the stale state entry
# and create a fresh version from the endpoint's current secret.
cd terraform
terraform init -input=false
terraform apply -input=false -auto-approve \
  -replace=google_secret_manager_secret_version.dispatcher_webhook_secret
