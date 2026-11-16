# DNS-only: ngrok terminates TLS for the assistant's custom domain.
data "cloudflare_zone" "vargasjr_dev" {
  filter = {
    zone_name = "vargasjr.dev"
  }
}

resource "cloudflare_dns_record" "assistant" {
  zone_id = data.cloudflare_zone.vargasjr_dev.id
  name    = "assistant.vargasjr.dev"
  type    = "CNAME"
  content = "zqnewatwwrjhytn7.4qjaxzk1mbwt7wbuh.ngrok-cname.com"
  proxied = false
  ttl     = 1
}
