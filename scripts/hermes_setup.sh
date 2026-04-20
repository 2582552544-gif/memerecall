#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mac/PycharmProjects/ai_music_2025/memerecall"
HERMES_SRC="$ROOT/vendor/hermes-agent"
HERMES_HOME_DIR="$ROOT/.hermes"

if [ ! -d "$HERMES_SRC" ]; then
  echo "Hermes source not found: $HERMES_SRC" >&2
  exit 1
fi

mkdir -p "$HERMES_HOME_DIR" "$HERMES_HOME_DIR/memories" "$HERMES_HOME_DIR/skills"
cp "$ROOT/hermes/config.yaml" "$HERMES_HOME_DIR/config.yaml"
if [ ! -f "$HERMES_HOME_DIR/.env" ]; then
  cp "$ROOT/hermes/.env.example" "$HERMES_HOME_DIR/.env"
fi

python3 -m venv "$HERMES_HOME_DIR/venv"
source "$HERMES_HOME_DIR/venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install -e "$HERMES_SRC[cron,cli,mcp]"

echo "Hermes deployed for MemeRecall."
echo "Hermes home: $HERMES_HOME_DIR"
echo "Run: HERMES_HOME=$HERMES_HOME_DIR hermes"
