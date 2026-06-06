# Python Code Standards

## 1. Code Organization

### 1.1 Module Design

- Keep each module focused on one responsibility.
- Avoid placing too many unrelated features in a single file.
- Split packages by feature rather than by vague buckets such as `util`,
  `common`, or `misc`.
- Keep closely related types and functions in the same module.
- Avoid circular imports.
- Mark private implementation details with a single leading underscore.

### 1.2 File Organization

Use this order inside Python files:

1. Shebang
2. Encoding declaration when needed
3. Module docstring
4. Imports
5. Constants
6. Module variables
7. Data types and classes that are used by public functions
8. Functions
9. Service classes or implementation classes

Keep one file centered on one core class or one cohesive feature group.

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""User service module with user business logic and data access."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from .repository import UserRepository

MAX_RETRY_COUNT = 3

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class User:
    """User domain model."""

    id: int
    name: str


def get_user(user_id: int, repository: UserRepository) -> User | None:
    """Return a user by ID."""
    for attempt in range(MAX_RETRY_COUNT):
        user = repository.find_by_id(user_id)
        if user is not None:
            return User(id=user.id, name=user.name)
        logger.debug("user lookup failed", extra={"attempt": attempt})
    return None
```

## 2. Naming

### 2.1 Basic Rules

- Modules and packages: short lowercase names, optionally separated by
  underscores, such as `user_service.py`.
- Classes: `PascalCase`, such as `UserService` or `OrderProcessor`.
- Functions, methods, and variables: `snake_case`, such as `get_user` or
  `item_count`.
- Constants: `UPPER_SNAKE_CASE`, such as `MAX_RETRY_COUNT` or `API_BASE_URL`.

### 2.2 Private Members

- Prefix non-public attributes and methods with one underscore, such as
  `_internal_method` or `_cache`.
- Avoid double-underscore prefixes unless name mangling is needed to prevent
  subclass conflicts.

### 2.3 Boolean Names

Use `is_`, `has_`, or `can_` prefixes for boolean values:

```python
is_active: bool
has_permission: bool
can_edit: bool
```

## 3. Type Annotations

### 3.1 Basic Requirements

- Add type annotations to all new code.
- Public interfaces must have complete function signature annotations.
- In Python 3.10+, use `X | None` instead of `Optional[X]`.
- In Python 3.9+, use built-in generics such as `list[X]` and `dict[K, V]`
  instead of `typing.List` and `typing.Dict`.

### 3.2 Complex Types

- Prefer `TypedDict`, `Protocol`, or `dataclass` for complex structures.
- Avoid broad `dict[str, Any]` when a structured type is practical.

```python
from dataclasses import dataclass
from typing import TypedDict


@dataclass(slots=True)
class User:
    id: int
    name: str


class UserDict(TypedDict):
    id: int
    name: str


def find_user_name(users: list[User], user_id: int) -> str | None:
    for user in users:
        if user.id == user_id:
            return user.name
    return None
```

### 3.3 Type Checking

Prefer strict type checking:

```bash
mypy --strict src/
```

Use `ty check` when the project has adopted `ty`.

## 4. Imports

### 4.1 Import Order

Group imports in this order, with blank lines between groups:

1. Standard library
2. Third-party packages
3. Local modules

Each import should occupy its own line.

```python
import os
import sys
from pathlib import Path

from pydantic import BaseModel
from sqlalchemy import select

from .models import User
from .service import UserService
```

### 4.2 Import Prohibitions

- Do not use `from module import *`, except in explicit public re-export modules
  that define `__all__`.
- Do not introduce circular imports.
- Do not use `..` relative imports to cross package boundaries.

## 5. Strings And Formatting

### 5.1 Strings

- Prefer f-strings for interpolation.
- Use triple quotes for multi-line strings.
- Avoid repeated string concatenation in loops; use `"".join()` or
  `io.StringIO`.

```python
name = "Alice"
msg = f"Hello, {name}!"

query = """
    SELECT id, name
    FROM users
    WHERE active = true
"""
```

### 5.2 Docstrings

- Modules, classes, and public functions must have docstrings.
- Use triple quotes.
- Start with a concise summary line; add details after a blank line when needed.
- Prefer Google or NumPy style.

```python
def get_user(user_id: int) -> User | None:
    """Return a user by ID.

    Args:
        user_id: Unique user identifier.

    Returns:
        The matching user, or None when no user is found.

    Raises:
        ValueError: Raised when user_id is not positive.
    """
    if user_id <= 0:
        raise ValueError("user_id must be positive")
    ...
```

## 6. Error Handling

### 6.1 Principles

- Catch specific exceptions.
- Do not use bare `except:` or broad `except Exception:` unless the code
  immediately logs context and re-raises or intentionally adapts an external
  boundary.
- Define custom exceptions with meaningful messages.
- Do not silently swallow exceptions.

### 6.2 Custom Exceptions

```python
class UserNotFoundError(Exception):
    """Raised when a user does not exist."""

    def __init__(self, user_id: int) -> None:
        self.user_id = user_id
        super().__init__(f"User {user_id} not found")


class ValidationError(Exception):
    """Raised when input data is invalid."""
```

### 6.3 Resource Management

Use context managers for files, connections, locks, and other resources.

```python
with open("data.txt", encoding="utf-8") as file:
    content = file.read()
```

## 7. Functions And Methods

### 7.1 Function Design

- Keep functions small; prefer functions under 50 lines.
- Make one function do one thing.
- Wrap large parameter groups in a `dataclass` or `TypedDict`.

### 7.2 Default Arguments

Use immutable default values. Do not use mutable defaults.

```python
def append_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```

Do not write:

```python
def append_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items
```

### 7.3 Function Style

- Use keyword arguments when they improve call-site readability.
- Prefer `def` for named functions.
- Do not assign `lambda` expressions to variables.

```python
def is_active(user: User) -> bool:
    return user.status == "active"
```

## 8. Class Design

### 8.1 Principles

- Use `@property` instead of Java-style getters and setters.
- Use `@dataclass` for simple data containers.
- Prefer composition over inheritance.
- Keep multiple inheritance rare and make the MRO easy to understand.

### 8.2 Special Methods

- `__str__` is for users and should return a readable description.
- `__repr__` is for developers and should preferably return a reconstructable
  expression.

```python
from dataclasses import dataclass


@dataclass(slots=True)
class User:
    id: int
    name: str
    email: str

    @property
    def display_name(self) -> str:
        return self.name or self.email

    def __str__(self) -> str:
        return f"User({self.display_name})"

    def __repr__(self) -> str:
        return f"User(id={self.id!r}, name={self.name!r}, email={self.email!r})"
```

## 9. Concurrency And Async

### 9.1 Async Programming

- Prefer `async` and `await` for IO-bound tasks.
- Use `asyncio.gather` for concurrent coroutine execution.
- Use `asyncio.to_thread` for synchronous blocking calls from async code.

```python
import asyncio


async def fetch_all(urls: list[str]) -> list[str]:
    async def fetch(url: str) -> str:
        ...
        return ""

    return await asyncio.gather(*(fetch(url) for url in urls))
```

### 9.2 Thread Safety

- Use `threading.Lock` to protect shared state in multi-threaded code.
- Use `queue.Queue` for communication between threads.
- Do not call `time.sleep` in async code; use `await asyncio.sleep`.

## 10. Testing

### 10.1 Framework And Organization

- Use pytest.
- Name test files `test_*.py`.
- Name test functions with a `test_` prefix.
- Make each test validate one primary behavior.
- Add regression tests for bug fixes.

### 10.2 Test Practices

- Use fixtures instead of `setUp` and `tearDown`.
- Use `pytest.mark.parametrize` for parameterized tests.
- Mock external dependencies with `unittest.mock` or `pytest-mock`.

```python
from unittest.mock import Mock

import pytest

from .service import UserService


@pytest.fixture
def user_service() -> UserService:
    repo = Mock()
    return UserService(repo)


def test_get_user_returns_none_when_not_found(user_service: UserService) -> None:
    user_service.repo.find_by_id.return_value = None
    assert user_service.get_user(1) is None


@pytest.mark.parametrize(
    ("user_id", "expected"),
    [(0, False), (-1, False), (1, True)],
)
def test_valid_user_id(user_id: int, expected: bool) -> None:
    assert is_valid_user_id(user_id) == expected
```

## 11. Tools And Formatting

### 11.1 Recommended Toolchain

- Python: 3.13+
- Package manager: `uv`
- Formatting and linting: `ruff`
- Type checking: `ty` or `mypy`
- Testing: `pytest`
- Commit hooks: `pre-commit`

### 11.2 Common Commands

```bash
ruff format
ruff check
ruff check --fix
ty check
pytest
```

- `ruff format` formats code.
- `ruff check` checks style and common defects.
- `ruff check --fix` automatically fixes safe issues.
- CI must pass all configured checks.

## 12. Prohibited Patterns

- No bare `except:`.
- No broad `except Exception:` without explicit boundary handling,
  contextual logging, and re-raise or conversion.
- No mutable default parameters such as `def f(x=[])`.
- No mutation of global variables inside functions.
- No hard-coded secrets, credentials, or tokens.
- No `assert` for business logic validation.
- No `from module import *`, except explicit `__all__` re-export modules.
- No circular imports.
- No assigning `lambda` to variables.
- No silently swallowed exceptions.
- No `time.sleep` in async code.
