# DNS for the compute broker's custom domain (mapped in
# modules/shared/compute-broker.tf). Root-owned because the cloudflare
# provider's token comes from a data source that depends on module.shared —
# a cloudflare resource inside shared would cycle the graph. DNS-only so
# Google's managed cert for the mapping can issue.
data "cloudflare_zone" "vargasjr_dev" {
  filter = {
    zone_name = "vargasjr.dev"
  }
}

resource "cloudflare_dns_record" "compute_broker" {
  zone_id = data.cloudflare_zone.vargasjr_dev.id
  name    = "broker.vargasjr.dev"
  type    = "CNAME"
  content = "ghs.googlehosted.com"
  proxied = false
  ttl     = 1
}
