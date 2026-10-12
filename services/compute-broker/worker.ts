// The worker agent is a bash script delivered to each VM as its
// startup-script metadata: install docker/git/jq, clone the task's
// repository at the requested base ref, arm a hard lifetime poweroff, then
// long-poll the broker for exec work. The VM only ever makes OUTBOUND
// requests — no inbound firewall exposure, no SSH.

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export interface WorkerSpec {
  brokerUrl: string;
  taskId: string;
  agentToken: string;
  repository: string;
  baseRef: string;
  branch: string;
  maxLifetimeMinutes: number;
  githubToken?: string;
}

export function workerStartupScript(spec: WorkerSpec): string {
  const cloneUrl = spec.githubToken
    ? `https://x-access-token:${spec.githubToken}@github.com/${spec.repository}.git`
    : `https://github.com/${spec.repository}.git`;

  return `#!/bin/bash
# compute-broker worker agent (task ${spec.taskId})
set -uo pipefail
exec >> /var/log/compute-broker-worker.log 2>&1
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io git jq ca-certificates >/dev/null
systemctl enable --now docker || true

WORKSPACE=/workspace
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"
git clone ${shellQuote(cloneUrl)} repo || echo "compute-broker: git clone failed" >&2
if cd repo 2>/dev/null; then
  git fetch origin ${shellQuote(spec.baseRef)} && \\
    git checkout -B ${shellQuote(spec.branch)} FETCH_HEAD || \\
    git checkout -B ${shellQuote(spec.branch)}
fi

# Hard lifetime TTL: the instance powers off even if the broker is gone.
systemd-run --on-active=${spec.maxLifetimeMinutes * 60} --unit=broker-ttl poweroff || true

BROKER=${shellQuote(spec.brokerUrl)}
TOKEN=${shellQuote(spec.agentToken)}
TASK=${shellQuote(spec.taskId)}
while true; do
  code=$(curl -s -o /tmp/work.json -w '%{http_code}' --max-time 40 \\
    -H "Authorization: Bearer $TOKEN" "$BROKER/v1/agent/work?taskId=$TASK")
  if [ "$code" = "200" ]; then
    commandId=$(jq -r .commandId /tmp/work.json)
    cwd=$(jq -r '.cwd // empty' /tmp/work.json)
    t=$(jq -r '.timeoutSeconds' /tmp/work.json)
    mapfile -t ARGV < <(jq -r '.argv[]' /tmp/work.json)
    cd "$WORKSPACE/repo" 2>/dev/null || cd "$WORKSPACE"
    if [ -n "$cwd" ]; then cd "$cwd" 2>/dev/null || true; fi
    startedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    timeout "$t" "\${ARGV[@]}" >/tmp/out 2>/tmp/err
    rc=$?
    if [ "$rc" = "124" ]; then rc=-1; fi
    head -c 1048576 /tmp/out >/tmp/out.c && mv /tmp/out.c /tmp/out
    head -c 1048576 /tmp/err >/tmp/err.c && mv /tmp/err.c /tmp/err
    finishedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    jq -n --arg task "$TASK" --arg cmd "$commandId" --argjson exit "$rc" \\
      --rawfile out /tmp/out --rawfile err /tmp/err \\
      --arg st "$startedAt" --arg en "$finishedAt" \\
      '{apiVersion:"v1",taskId:$task,commandId:$cmd,exitCode:$exit,stdout:$out,stderr:$err,startedAt:$st,finishedAt:$en}' \\
      >/tmp/result.json
    curl -s --max-time 30 -X POST -H "Authorization: Bearer $TOKEN" \\
      -H 'content-type: application/json' --data-binary @/tmp/result.json \\
      "$BROKER/v1/agent/result" >/dev/null
    cd "$WORKSPACE/repo" 2>/dev/null || cd "$WORKSPACE"
  fi
  sleep 2
done
`;
}
