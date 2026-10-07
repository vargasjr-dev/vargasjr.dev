output "dispatcher_service_url" {
  description = "The dispatcher's Cloud Run URL (both webhook endpoints target it)."
  value       = local.dispatcher_service_url
}
