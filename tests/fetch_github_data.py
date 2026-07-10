"""Import adapter for the hyphenated project-card generator script."""

from __future__ import annotations

import importlib.machinery
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

SCRIPT_PATH = Path(__file__).parent.parent / "scripts" / "fetch-github-data.py"
MODULE_NAME = "fetch_github_data"


def _load_script() -> ModuleType:
    loader = importlib.machinery.SourceFileLoader(MODULE_NAME, str(SCRIPT_PATH))
    spec = importlib.util.spec_from_loader(MODULE_NAME, loader)
    if spec is None:
        raise ImportError(f"Unable to load {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[MODULE_NAME] = module
    loader.exec_module(module)
    return module


_SCRIPT = _load_script()


def __getattr__(name: str) -> Any:
    """Proxy public attributes to the loaded script module."""
    return getattr(_SCRIPT, name)
