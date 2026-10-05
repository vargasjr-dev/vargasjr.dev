# One-time production infra operations

Put one-off production infrastructure repairs (GCP, Cloud Run, Terraform state surgery) in this directory and run them through the consolidated **Run PR Operation** workflow (`.github/workflows/run-operation.yml`).

## Workflow

1. Add a narrowly scoped `.sh` script in this directory in its own PR.
2. Open the PR against `main` in this repository. Fork PRs are intentionally rejected because the workflow executes PR code with production GCP access.
3. Manually dispatch **Run PR Operation** from the PR's branch. No inputs are needed: the PR is inferred from the dispatched branch, and the script is inferred as the only operation script added in the PR's diff from `main`.
4. The script runs with `bash` under the production GCP workload identity (WIF), with Terraform available on the runner.
5. Review the workflow log.

## Boundaries

- Keep each script focused on one repair and leave it in the repository as an audit record after execution.
- Never commit secrets or generated state. Prefer printing the intended change before mutating, then verifying the result before exiting.
