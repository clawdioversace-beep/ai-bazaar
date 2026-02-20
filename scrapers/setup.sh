#!/usr/bin/env bash
# Setup script for Crawl4AI Python scrapers.
# Creates a venv, installs deps, and sets up browser binaries.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

# Use python3.11 if available, fall back to python3
PYTHON=""
for candidate in python3.11 python3; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "ERROR: No python3 found. Install Python 3.11+."
  exit 1
fi

echo "Using: $PYTHON ($($PYTHON --version))"

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating venv at $VENV_DIR..."
  "$PYTHON" -m venv "$VENV_DIR"
fi

# Activate and install
source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q
pip install -r "$SCRIPT_DIR/requirements.txt" -q

# Install Playwright browsers for Crawl4AI
echo "Running crawl4ai-setup (installs browser binaries)..."
crawl4ai-setup

echo ""
echo "Setup complete. Activate with: source $VENV_DIR/bin/activate"
