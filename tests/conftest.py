"""pytest configuration - make scripts importable as modules."""

import importlib
import importlib.machinery
import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parent.parent / "scripts"

# Register scripts as importable modules using importlib
for path in SCRIPTS.glob("*.py"):
    name = path.stem  # e.g. "fetch-github-data"
    spec = importlib.util.spec_from_loader(
        name, importlib.machinery.SourceFileLoader(name, str(path))
    )
    if spec and spec.loader:
        mod = importlib.util.module_from_spec(spec)
        sys.modules[name] = mod
        spec.loader.exec_module(mod)
