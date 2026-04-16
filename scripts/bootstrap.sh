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
echo "2. Edit .env and set DASHSCOPE_API_KEY plus BAILIAN_DOCS_KB_ID=zwb68dlfs9."
echo "3. Run ./scripts/ingest.sh and check knowledge/generated/manifests/bailian-import-checklist.md."
echo "4. Run ./scripts/run_demo.sh."
