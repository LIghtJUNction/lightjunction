"""Wrapper so scripts can be imported with underscores (e.g. import fetch_github_data)."""

import importlib
import importlib.machinery
import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parent.parent / "scripts"

# Map underscore name -> hyphenated filename
_ALIASES = {
    "fetch_github_data": "fetch-github-data.py",
    "update_readme": "update-readme.py",
}

# Load and re-export each aliased script
for underscore_name, filename in _ALIASES.items():
    script_path = SCRIPTS / filename
    if not script_path.exists():
        continue
    spec = importlib.util.spec_from_loader(
        underscore_name, importlib.machinery.SourceFileLoader(underscore_name, str(script_path))
    )
    if spec and spec.loader:
        mod = importlib.util.module_from_spec(spec)
        sys.modules[underscore_name] = mod
        spec.loader.exec_module(mod)
        # Re-export all public names so `import fetch_github_data as mod` works
        globals().update({k: v for k, v in vars(mod).items() if not k.startswith("_")})
