output "dispatcher_service_url" {
  description = "The dev dispatcher's Cloud Run URL (the test-mode webhook endpoint targets it)."
  value       = local.dispatcher_service_url
}
