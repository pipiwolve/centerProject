#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

if [ ! -d "$ROOT_DIR/.venv" ]; then
  python3 -m venv "$ROOT_DIR/.venv"
fi

source "$ROOT_DIR/.venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install -r "$ROOT_DIR/backend/requirements.txt"

npm install --prefix "$ROOT_DIR/frontend"

echo "Bootstrap complete."
echo "Next:"
echo "1. Rotate any previously exposed DashScope API key."
echo "2. Edit .env and fill DASHSCOPE_API_KEY, BAILIAN_APP_ID, BAILIAN_DOCS_KB_ID."
echo "3. If you want one-click Bailian sync, also fill DASHSCOPE_WORKSPACE_ID, ALIBABA_CLOUD_ACCESS_KEY_ID, ALIBABA_CLOUD_ACCESS_KEY_SECRET, and set ENABLE_CLOUD_SYNC=true."
echo "4. Run ./scripts/ingest.sh and check knowledge/generated/manifests/bailian-sync.json plus bailian-import-checklist.md."
echo "5. Run ./scripts/run_demo.sh."
