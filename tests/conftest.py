"""Register the explicitly tested hyphenated script module."""

import importlib.machinery
import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def register_script(module_name: str, filename: str) -> None:
    """Load one named script without importing unrelated executable scripts."""
    path = SCRIPTS / filename
    loader = importlib.machinery.SourceFileLoader(module_name, str(path))
    spec = importlib.util.spec_from_loader(module_name, loader)
    if spec is None:
        raise RuntimeError(f"could not create module spec for {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    loader.exec_module(module)


register_script("fetch_github_data", "fetch-github-data.py")
register_script("plan_daily_commits", "plan-daily-commits.py")
