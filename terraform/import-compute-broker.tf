# One-shot import: the compute-broker service predates its terraform
# management (the module landed in 7722086 while the service was already
# live), so every apply died with `Error 409: Resource 'compute-broker'
# already exists`. This block adopts the existing service into state; the
# first apply reconciles any drift. Delete the file after that apply goes
# green — same convention as import-records.sh's generated blocks.
import {
  to = module.shared.google_cloud_run_v2_service.compute_broker
  id = "projects/vargasjr-dev/locations/us-central1/services/compute-broker"
}
