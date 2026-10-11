---
description: Python style for writing or editing Python code
globs: ["**/*.py", "**/pyproject.toml"]
---

# Python style

Projects use modern `pyproject.toml` with 'uv' for package management, 'ruff'
for linting and formatting, and 'mypy' for type checking.

Projects will always use a virtual environments stored in `./.venv`. Remember to
use the virtualenv when running Python.

New code should have type annotations. Old code will gradually get typed as it's
iterated upon.

Add thousands separators to numbers over 9999 that end in "000" (e.g., 10_000)

## Imports

Do not attempt to remove imports. 'ruff' will fix them later.
