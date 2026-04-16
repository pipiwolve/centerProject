#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/.venv/bin/activate"

cd "$ROOT_DIR/backend"
python manage.py ingest

echo
echo "Ingest complete."
echo "Review Bailian import checklist at:"
echo "  $ROOT_DIR/knowledge/generated/manifests/bailian-import-checklist.md"
