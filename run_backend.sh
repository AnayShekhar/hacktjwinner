#!/bin/bash
# Run Fern AI backend from repo root. Usage: ./run_backend.sh
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
VENV="$ROOT/fernai/.venv"
REQ="$ROOT/fernai/backend/requirements.txt"

# Create venv if missing
if [ ! -d "$VENV" ]; then
  echo "Creating venv at $VENV..."
  python3 -m venv "$VENV"
fi
# Use venv's Python/pip explicitly (avoids broken system Python 2.7 pip on some Macs)
PY="$VENV/bin/python3"
PIP="$VENV/bin/python3 -m pip"

# Install deps and remove any Google Gemini package so only Groq is used
echo "Installing backend dependencies..."
$PIP uninstall -y google-generativeai 2>/dev/null || true
$PIP install -q -r "$REQ"

# Ensure .env exists
if [ ! -f "$ROOT/fernai/backend/.env" ]; then
  if [ -f "$ROOT/fernai/backend/.env.example" ]; then
    cp "$ROOT/fernai/backend/.env.example" "$ROOT/fernai/backend/.env"
    echo "Created fernai/backend/.env from .env.example - add your GEMINI_API_KEY"
  fi
fi

echo "Starting backend at http://0.0.0.0:8000"
echo "  Health: http://localhost:8000/health"
echo "  For physical device: set EXPO_PUBLIC_API_BASE_URL in fernai-mobile/.env to http://YOUR_IP:8000"
exec "$PY" "$ROOT/fernai/run_backend.py"
