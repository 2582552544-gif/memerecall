#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mac/PycharmProjects/ai_music_2025/memerecall"
HERMES_HOME_DIR="$ROOT/.hermes"

if [ ! -x "$HERMES_HOME_DIR/venv/bin/hermes" ]; then
  echo "Hermes is not installed for this project. Run: bun run hermes:setup" >&2
  exit 1
fi

export HERMES_HOME="$HERMES_HOME_DIR"
export MESSAGING_CWD="$ROOT"
source "$HERMES_HOME_DIR/venv/bin/activate"
cd "$ROOT"
exec hermes "$@"
