output "dispatcher_service_url" {
  description = "The live dispatcher's Cloud Run URL (the live webhook endpoint targets it)."
  value       = local.dispatcher_service_url
}
