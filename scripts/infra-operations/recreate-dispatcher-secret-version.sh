#!/usr/bin/env bash
set -euo pipefail

cd terraform
terraform init -input=false

gcloud run services delete stripe-dispatcher \
  --region us-central1 --project vargasjr-dev --quiet || true

terraform state rm google_cloud_run_v2_service.stripe_dispatcher || true
terraform state rm google_secret_manager_secret_version.dispatcher_webhook_secret || true

WHSEC=$(terraform state pull | jq -r '.resources[] | select(.type=="stripe_webhook_endpoint" and .name=="dispatcher") | .instances[0].attributes.secret // empty')
if [ -z "$WHSEC" ]; then
  echo "whsec missing from state; endpoint state follows:" >&2
  terraform state pull | jq '.resources[] | select(.type=="stripe_webhook_endpoint") | .instances[0].attributes | {secret_set: has("secret")}' >&2
  exit 1
fi

printf '%s' "$WHSEC" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET \
  --project=vargasjr-dev --data-file=-

terraform import google_secret_manager_secret_version.dispatcher_webhook_secret \
  "projects/vargasjr-dev/secrets/STRIPE_WEBHOOK_SECRET/versions/1" || true

terraform apply -input=false -auto-approve

echo "--- verification ---"
gcloud secrets versions list STRIPE_WEBHOOK_SECRET --project vargasjr-dev
gcloud run services describe stripe-dispatcher --region us-central1 \
  --project vargasjr-dev --format 'value(status.url)'
