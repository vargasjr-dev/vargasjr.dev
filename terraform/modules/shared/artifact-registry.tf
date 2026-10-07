# The portfolio's image registry — one repo, pulled by both the prod and
# dev dispatchers (same image; CI pushes before apply).
resource "google_artifact_registry_repository" "portfolio" {
  location      = "us-central1"
  repository_id = "portfolio"
  format        = "DOCKER"
  description   = "Portfolio service images"
}

locals {
  # One webhook endpoint per dispatcher; both subscribe to the same events.
  webhook_events = [
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]
}
