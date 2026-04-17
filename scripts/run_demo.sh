#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT_DIR/scripts/ingest.sh" "$@"

source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR/backend"
python manage.py serve
