#!/usr/bin/env sh
# Build the production image and check it (Linux / macOS / Git Bash / CI). Run inside medassist-api/:
#   sh scripts/check_image.sh [image] [port]      (WITH_RERANK=true sh ... checks the FlashRank build)
# Uses a FAKE test env only (no real keys), so /health must be 200 and /ready must be 503
# (the fake database cannot be reached: the container fails closed instead of claiming ready).
set -u  # no -e: a failed check is counted, not fatal
IMAGE="${1:-medassist-api:check}"
PORT="${2:-18000}"
NAME="medassist-api-check"
WITH_RERANK="${WITH_RERANK:-false}"
FAILED=0

result() { # label ok(0/1) detail
    if [ "$2" = 0 ]; then echo "PASS  $1 $3"; else echo "FAIL  $1 $3"; FAILED=$((FAILED + 1)); fi
}
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1" || true; }

echo "== build $IMAGE"
docker build --build-arg "WITH_RERANK=$WITH_RERANK" -t "$IMAGE" . || exit 1

SIZE=$(docker image inspect "$IMAGE" --format '{{.Size}}')
echo "== image size: $((SIZE / 1048576)) MB"
echo "== top 5 layers"
docker history "$IMAGE" --format '{{.Size}}\t{{.CreatedBy}}' \
    | awk -F'\t' '{ s=$1; m=1; if (s ~ /GB$/) m=1e9; else if (s ~ /MB$/) m=1e6; else if (s ~ /kB$/) m=1e3;
                    gsub(/[A-Za-z]/, "", s); printf "%015.0f\t%s\t%.90s\n", s*m, $1, $2 }' \
    | sort -r | head -5 | cut -f2-

echo "== static checks"
UID_IN=$(docker run --rm --entrypoint id "$IMAGE" -u | tr -d '\r')
[ "$UID_IN" != "0" ]; result "runs as non-root" $? "(uid $UID_IN)"

ENV_FILES=$(docker run --rm --entrypoint sh "$IMAGE" -c "find / -xdev -name '.env' -not -path '/proc/*' 2>/dev/null" || true)
[ -z "$ENV_FILES" ]; result ".env not in image" $? "$ENV_FILES"

UNWANTED=$(docker run --rm --entrypoint sh "$IMAGE" -c "ls -d /srv/scripts /srv/prompts /srv/.local /srv/tests /srv/sql 2>/dev/null" || true)
[ -z "$UNWANTED" ]; result "no scripts/prompts/tests in /srv" $? "$UNWANTED"

RERANK=$(docker run --rm --entrypoint sh "$IMAGE" -c "python -c 'import flashrank' 2>/dev/null && echo yes; ls /srv/data/flashrank 2>/dev/null" | tr -d '\r' | paste -sd ' ' -)
if [ "$WITH_RERANK" = true ]; then
    case "$RERANK" in "yes "?*) OK=0 ;; *) OK=1 ;; esac; result "flashrank installed + model baked" $OK "$RERANK"
else
    [ -z "$RERANK" ]; result "no flashrank, no /srv/data" $? "$RERANK"
fi

# Secret-shaped values or KEY=value assignments in any layer command.
# GPG_KEY is the base image's public Python release-signing fingerprint, not a secret.
if docker history --no-trunc "$IMAGE" --format '{{.CreatedBy}}' | sed -E 's/GPG_KEY=[0-9A-F]+//g' \
    | grep -Eq 'gsk_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_[A-Za-z0-9]{10,}|(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)=[^ ]+'; then
    result "docker history has no secret values" 1 ""
else
    result "docker history has no secret values" 0 ""
fi

echo "== run with a fake test env on port $PORT"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p "$PORT:8000" \
    -e APP_ENV=prod \
    -e 'CORS_ORIGINS=["https://example.com"]' \
    -e SUPABASE_URL=https://check.invalid \
    -e SUPABASE_SERVICE_KEY=fake-service-key \
    -e GROQ_API_KEY=fake-groq-key \
    -e GEMINI_API_KEY=fake-gemini-key \
    -e "RERANK_ENABLED=$WITH_RERANK" \
    "$IMAGE" >/dev/null || exit 1
trap 'echo "== stop and remove"; docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

HEALTH=000
i=0
while [ $i -lt 30 ] && [ "$HEALTH" != 200 ]; do
    sleep 1; i=$((i + 1)); HEALTH=$(status "http://127.0.0.1:$PORT/health")
done
[ "$HEALTH" = 200 ]; result "/health 200" $? "(got $HEALTH)"
READY=$(status "http://127.0.0.1:$PORT/ready")
[ "$READY" = 503 ]; result "/ready 503 with the fake database" $? "(got $READY)"
STATE=$(docker inspect "$NAME" --format '{{.State.Health.Status}}')
case "$STATE" in starting | healthy) OK=0 ;; *) OK=1 ;; esac
result "HEALTHCHECK defined" $OK "(state $STATE)"

if [ "$FAILED" -gt 0 ]; then echo "$FAILED check(s) FAILED"; exit 1; fi
echo "ALL PASS"
