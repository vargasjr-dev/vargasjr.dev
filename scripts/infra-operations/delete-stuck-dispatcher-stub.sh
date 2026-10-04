#!/usr/bin/env bash
set -euo pipefail

# One-time heal: the dispatcher's first creation never completed server-side
# (the pre-#866 denied image pull left a stub the console shows as stuck in
# "Creating service"). Terraform still tracks the service, so after this
# delete the next apply plans a clean CREATE with both service-agent grants
# (#866 AR reader, #867 secretAccessor) already in place. The Stripe endpoint
# URL is name-derived and survives the recreate. Never merge this PR.
gcloud run services delete stripe-dispatcher \
  --region us-central1 \
  --project vargasjr-dev \
  --quiet
