---
name: Python Code Standards
description: This skill should be used when the user asks to "write Python code", "add Python code standards", "review Python code", "fix Python style", "refactor Python", "run Python checks", or mentions ruff, ty, mypy, pytest, uv, type annotations, docstrings, exceptions, async Python, or Python project structure.
version: 0.1.0
---

# Python Code Standards

Apply this skill when editing, reviewing, or creating Python code. Keep changes
small, typed, testable, and aligned with the local project structure.

## Workflow

1. Inspect the existing Python package layout, `pyproject.toml`, tests, and
   current toolchain before changing files.
2. Load `references/python-code-standards.md` before making non-trivial Python
   edits or reviewing Python code.
3. Prefer existing local patterns when they are stricter than the reference.
   When local patterns conflict with the reference, keep behavior stable and
   call out the tradeoff.
4. Add or update focused pytest coverage for new behavior and regressions.
5. Run the narrowest useful validation first, then broader checks when the
   change affects shared behavior.

## Required Defaults

- Use Python 3.13+ conventions when project constraints allow it.
- Use `uv` for environment and dependency workflows.
- Use `ruff format` for formatting and `ruff check` for linting.
- Use `ty check` or `mypy --strict` for type checking when configured.
- Use `pytest` for tests.
- Add complete type annotations for all new code.
- Add docstrings for modules, classes, and public functions.

## Validation

Prefer commands already defined by the project. When no project command exists,
use these direct checks where applicable:

```bash
ruff format
ruff check
ty check
pytest
```

If `ty` is not configured or unavailable, use:

```bash
mypy --strict src/
```

Report any check that could not be run and why.

## Reference Files

- `references/python-code-standards.md` - Detailed Python organization,
  typing, imports, docstrings, exceptions, functions, classes, async, testing,
  tooling, and prohibited-pattern rules.
