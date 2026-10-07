output "vargas_jr_sa" {
  description = "Share Sheets/spreadsheets (and future Google resources) with this email."
  value       = google_service_account.vargas_jr.email
}

output "webhook_events" {
  description = "The event list both dispatcher endpoints subscribe to."
  value       = local.webhook_events
}
