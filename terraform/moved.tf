# ---------------------------------------------------------------------------
# State moves for the module split. The modules here are UNCOUNTED (this
# repo has a single workspace — no cadet-style gating), so addresses carry
# no instance suffix and every move is exact. Review `terraform plan` and
# confirm ZERO destroys before applying: the cadet restructure (#57) taught
# us index-less vs indexed mismatches silently turn moves into
# destroy+create.
# ---------------------------------------------------------------------------

# --- enablements → modules/shared ---

moved {
  from = google_project_service.storage
  to   = module.shared.google_project_service.storage
}

moved {
  from = google_project_service.iam
  to   = module.shared.google_project_service.iam
}

moved {
  from = google_project_service.iamcredentials
  to   = module.shared.google_project_service.iamcredentials
}

moved {
  from = google_project_service.sts
  to   = module.shared.google_project_service.sts
}

moved {
  from = google_project_service.serviceusage
  to   = module.shared.google_project_service.serviceusage
}

moved {
  from = google_project_service.cloudresourcemanager
  to   = module.shared.google_project_service.cloudresourcemanager
}

moved {
  from = google_project_service.secretmanager
  to   = module.shared.google_project_service.secretmanager
}

moved {
  from = google_project_service.run
  to   = module.shared.google_project_service.run
}

moved {
  from = google_project_service.artifactregistry
  to   = module.shared.google_project_service.artifactregistry
}

moved {
  from = google_project_service.cloudbuild
  to   = module.shared.google_project_service.cloudbuild
}

moved {
  from = google_project_service.sheets
  to   = module.shared.google_project_service.sheets
}

moved {
  from = google_project_service.gmail
  to   = module.shared.google_project_service.gmail
}

# --- Vargas JR identity → modules/shared ---

moved {
  from = google_service_account.vargas_jr
  to   = module.shared.google_service_account.vargas_jr
}

moved {
  from = google_project_iam_custom_role.vargasjr
  to   = module.shared.google_project_iam_custom_role.vargasjr
}

moved {
  from = google_project_iam_member.vargas_jr_custom_role
  to   = module.shared.google_project_iam_member.vargas_jr_custom_role
}

# --- dispatcher stack + webhooks + vercel envs → modules/prod ---

moved {
  from = stripe_webhook_endpoint.dispatcher
  to   = module.prod.stripe_webhook_endpoint.dispatcher
}

moved {
  from = google_service_account.stripe_dispatcher
  to   = module.prod.google_service_account.stripe_dispatcher
}

moved {
  from = google_artifact_registry_repository.portfolio
  to   = module.shared.google_artifact_registry_repository.portfolio
}

moved {
  from = google_secret_manager_secret.dispatcher_webhook_secret
  to   = module.prod.google_secret_manager_secret.dispatcher_webhook_secret
}

moved {
  from = google_secret_manager_secret_version.dispatcher_webhook_secret
  to   = module.prod.google_secret_manager_secret_version.dispatcher_webhook_secret
}

moved {
  from = google_secret_manager_secret_iam_member.dispatcher_read_webhook_secret
  to   = module.prod.google_secret_manager_secret_iam_member.dispatcher_read_webhook_secret
}

moved {
  from = google_secret_manager_secret_iam_member.run_agent_read_webhook_secret
  to   = module.prod.google_secret_manager_secret_iam_member.run_agent_read_webhook_secret
}

moved {
  from = google_cloud_run_v2_service.stripe_dispatcher
  to   = module.prod.google_cloud_run_v2_service.stripe_dispatcher
}

moved {
  from = vercel_project_environment_variable.google_client_id
  to   = module.prod.vercel_project_environment_variable.google_client_id
}

moved {
  from = vercel_project_environment_variable.google_client_secret
  to   = module.prod.vercel_project_environment_variable.google_client_secret
}
