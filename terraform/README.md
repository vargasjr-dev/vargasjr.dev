# Terraform — vargasjr.dev infrastructure

State lives in a shared GCS bucket (`vargasjr-dev-tfstate`, prefix
`vargasjr-dev/prod`), which replaced Terraform Cloud. This directory starts
with a Cloudflare DNS import: the zone and all its records move from
dashboard-only to code.

**This repo is public.** DNS records are public anyway, but never commit
`*.tfstate` or real `*.tfvars` (already gitignored) — the day a sensitive
resource lands here, state becomes a secrets file. Tokens are supplied via
environment variables only.

## One-time setup (bucket)

```bash
gcloud storage buckets create gs://vargasjr-dev-tfstate \
  --location=us-east4 --uniform-bucket-level-access --public-access=off
gcloud storage buckets update gs://vargasjr-dev-tfstate --versioning
```

## Import runbook

Prereqs: Terraform >= 1.5, `gcloud auth application-default login`, and
`export CLOUDFLARE_API_TOKEN=...` (Zone:Read + DNS:Read to import; add
DNS:Edit for future applies).

```bash
cd terraform
terraform init

# Generate import blocks for the zone + every DNS record
./import-records.sh

# Let Terraform write the HCL for everything being imported
terraform plan -generate-config-out=generated.tf

# Review generated.tf, fold it into zone.tf / dns.tf, then:
terraform apply          # performs the imports, touches nothing live
rm import.tf generated.tf
terraform plan           # expect: "No changes." — state matches reality
```

Notes:

- Import is a state-only operation; no live DNS is modified until you
  explicitly change a record and apply.
- Proxied records will show their origin content in the committed config.
  Ours point at Vercel, which is not sensitive.
- Delete `import.tf` after the first successful apply; import blocks are
  consumed and become dead weight.
