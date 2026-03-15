#!/usr/bin/env bash
set -e

VENV_DIR="venv"

if [ -d "$VENV_DIR" ]; then
    echo "Virtual environment '$VENV_DIR' already exists."
    echo "To recreate, remove it first: rm -rf $VENV_DIR"
    exit 1
fi

echo "Creating virtual environment in '$VENV_DIR'..."
python3 -m venv "$VENV_DIR"

echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

echo "Upgrading pip..."
pip install --upgrade pip

echo "Installing requirements..."
pip install -r requirements.txt

echo ""
echo "Done! Activate the environment with:"
echo "  source $VENV_DIR/bin/activate"
