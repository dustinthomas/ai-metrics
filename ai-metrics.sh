#!/usr/bin/env bash
# Convenience wrapper for ai-metrics (Grok token + HEHS + ROI)
# Runs inside Docker per workspace policy.
set -euo pipefail

IMAGE="ai-metrics"
DATA_DIR="${HOME}/.ai-metrics"
GROK_LOGS="${HOME}/.grok"

mkdir -p "$DATA_DIR"

# Build if image missing (quiet)
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building $IMAGE (one time)..."
  docker build -t "$IMAGE" . --quiet
fi

# Pass through all args
docker run --rm \
  -v "$(pwd)":/app \
  -v /app/node_modules \
  -v "$GROK_LOGS":/root/.grok:ro \
  -v "$DATA_DIR":/root/.ai-metrics \
  "$IMAGE" \
  node dist/src/cli.js "$@"
