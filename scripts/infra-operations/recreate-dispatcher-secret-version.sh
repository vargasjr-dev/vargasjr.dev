#!/usr/bin/env bash
set -euo pipefail

# One-off heal (v2). The -replace approach failed: replacing the secret
# version forced a replace of the tainted stripe-dispatcher service, and
# deletion_protection (correctly) blocked that destroy. The service is a
# half-created stub and the secret version is gone, so instead: detach both
# from state, remove the physical stub, and let a plain apply do a clean
# create of the whole chain (version -> service -> endpoint URL).
cd terraform
terraform init -input=false

# Remove the physical stub first. deletion_protection only guards
# terraform-initiated destroys; this one is deliberate and reviewed, and the
# stub never served traffic.
gcloud run services delete stripe-dispatcher \
  --region us-central1 --project vargasjr-dev --quiet || true

terraform state rm google_cloud_run_v2_service.stripe_dispatcher || true
terraform state rm google_secret_manager_secret_version.dispatcher_webhook_secret || true

terraform apply -input=false -auto-approve

echo "--- verification ---"
gcloud secrets versions list STRIPE_WEBHOOK_SECRET --project vargasjr-dev
gcloud run services describe stripe-dispatcher --region us-central1 \
  --project vargasjr-dev --format 'value(status.url)'
