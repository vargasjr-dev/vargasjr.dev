# ---------------------------------------------------------------------------
# Test-mode dispatcher stack — root-owned on purpose: test-mode routing is
# portfolio-wide sandbox plumbing, not prod traffic, and root ownership
# lets the endpoint use the stripe.test alias directly. One dispatcher
# service per mode (this one is stripe-dispatcher-test), same image as
# prod, each instance reads a single STRIPE_WEBHOOK_SECRET env var —
# terraform passes each the right signing secret.
#
# depends_on module.prod: the image lives in the portfolio AR repo the
# prod module owns, so a fresh apply creates the repo before this service
# resolves its image.
# ---------------------------------------------------------------------------

resource "stripe_webhook_endpoint" "dispatcher_test" {
  provider = stripe.test

  url = "https://stripe-dispatcher-test-${data.google_project.portfolio.number}.us-central1.run.app/api/stripe/webhook"
  enabled_events = [
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]
}

resource "google_service_account" "stripe_dispatcher_test" {
  account_id   = "stripe-dispatcher-test"
  display_name = "Stripe dispatcher (test mode)"
}

resource "google_secret_manager_secret" "dispatcher_webhook_secret_test" {
  secret_id = "STRIPE_WEBHOOK_SECRET_TEST"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "dispatcher_webhook_secret_test" {
  secret      = google_secret_manager_secret.dispatcher_webhook_secret_test.name
  secret_data = stripe_webhook_endpoint.dispatcher_test.secret
}

resource "google_secret_manager_secret_iam_member" "dispatcher_read_webhook_secret_test" {
  secret_id = google_secret_manager_secret.dispatcher_webhook_secret_test.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.stripe_dispatcher_test.email}"
}

resource "google_secret_manager_secret_iam_member" "run_agent_read_webhook_secret_test" {
  secret_id = google_secret_manager_secret.dispatcher_webhook_secret_test.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:service-${data.google_project.portfolio.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

resource "google_cloud_run_v2_service" "stripe_dispatcher_test" {
  name     = "stripe-dispatcher-test"
  location = "us-central1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Same DRS pattern as the live dispatcher (#879): no invoker binding —
  # the Stripe signature check in code is the auth.
  invoker_iam_disabled = true

  depends_on = [module.prod]

  template {
    service_account = google_service_account.stripe_dispatcher_test.email

    containers {
      image = "us-central1-docker.pkg.dev/${local.portfolio_project_id}/portfolio/stripe-dispatcher:latest"

      env {
        name  = "STRIPE_API_KEY"
        value = data.google_secret_manager_secret_version.stripe_api_key.secret_data
      }

      env {
        name = "STRIPE_WEBHOOK_SECRET"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.dispatcher_webhook_secret_test.secret_id
            version = google_secret_manager_secret_version.dispatcher_webhook_secret_test.version
          }
        }
      }
    }
  }
}
