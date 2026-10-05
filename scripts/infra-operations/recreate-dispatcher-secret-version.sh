#!/usr/bin/env bash
set -euo pipefail

cd terraform
terraform init -input=false

gcloud run services delete stripe-dispatcher \
  --region us-central1 --project vargasjr-dev --quiet || true

terraform state rm google_cloud_run_v2_service.stripe_dispatcher || true
terraform state rm google_secret_manager_secret_version.dispatcher_webhook_secret || true

KEY=$(gcloud secrets versions access latest --secret=STRIPE_API_KEY --project=vargasjr-dev)
WHSEC=$(curl -sS "https://api.stripe.com/v1/webhook_endpoints/we_1UMnjhGSojmfFLPRwm4yyS9N" \
  -H "Authorization: Bearer $KEY" | jq -r .secret)
if [ -z "$WHSEC" ] || [ "$WHSEC" = "null" ]; then
  echo "failed to fetch the endpoint secret from Stripe" >&2
  exit 1
fi
printf '%s' "$WHSEC" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET \
  --project=vargasjr-dev --data-file=-

terraform apply -input=false -auto-approve

echo "--- verification ---"
gcloud secrets versions list STRIPE_WEBHOOK_SECRET --project vargasjr-dev
gcloud run services describe stripe-dispatcher --region us-central1 \
  --project vargasjr-dev --format 'value(status.url)'
