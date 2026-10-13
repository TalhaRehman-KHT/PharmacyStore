"""Tiny .env reader shared by the DB scripts (no extra dependency needed)."""

import os
from pathlib import Path


def load_dotenv(path: Path) -> None:
    """Put KEY=value lines from `path` into os.environ. Existing environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)
