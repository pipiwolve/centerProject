#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/.venv/bin/activate"

USE_CLOUD_SYNC=1
if [[ "${1:-}" == "--local-only" ]]; then
  USE_CLOUD_SYNC=0
fi

cd "$ROOT_DIR/backend"
if [[ "$USE_CLOUD_SYNC" -eq 1 ]]; then
  python manage.py ingest --sync-cloud
else
  python manage.py ingest
fi

echo
echo "Ingest complete."
if [[ "$USE_CLOUD_SYNC" -eq 1 ]]; then
  echo "Cloud sync was attempted for this run."
  echo "Review sync status at:"
  echo "  $ROOT_DIR/knowledge/generated/manifests/bailian-sync.json"
else
  echo "Cloud sync was skipped for this run (--local-only)."
fi
echo "Review Bailian import checklist at:"
echo "  $ROOT_DIR/knowledge/generated/manifests/bailian-import-checklist.md"
