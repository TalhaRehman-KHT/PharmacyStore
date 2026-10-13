"""Shared file-system paths (one place, so rag/ does not import from ingest/)."""

from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
