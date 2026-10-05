#!/usr/bin/env bash
set -euo pipefail

cd terraform
terraform init -input=false

gcloud run services delete stripe-dispatcher \
  --region us-central1 --project vargasjr-dev --quiet || true

terraform state rm google_cloud_run_v2_service.stripe_dispatcher || true
terraform state rm google_secret_manager_secret_version.dispatcher_webhook_secret || true

terraform apply -input=false -auto-approve \
  -exclude=google_cloud_run_v2_service.stripe_dispatcher \
  -exclude=google_cloud_run_v2_service_iam_member.public \
  -exclude=stripe_webhook_endpoint.dispatcher

terraform apply -input=false -auto-approve

echo "--- verification ---"
gcloud secrets versions list STRIPE_WEBHOOK_SECRET --project vargasjr-dev
gcloud run services describe stripe-dispatcher --region us-central1 \
  --project vargasjr-dev --format 'value(status.url)'
