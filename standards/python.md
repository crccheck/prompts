# Python style

Projects use modern pyproject.toml with 'uv' for package management, 'ruff' for
linting and formatting, and 'mypy' for type checking.

Projects will always use a virtual environments stored in `./.venv`. Remember to
use the virtualenv when running Python.

New code should have type annotations. Old code will gradually get typed as it's
iterated upon.

Add thousands separators to numbers over 9999 that end in "000" (e.g., 10_000)

## Imports

Do not attempt to remove imports. 'ruff' will fix them later.

## pyproject.toml

Use dependency groups for 'dev' dependencies, not 'project.optional-dependencies'

```
[dependency-groups]
dev = [...]
```

Use Ruff for formatting and linting. Use a minimal config with defaults with the
addition of these Ruff rules:

```
[tool.ruff.lint]
extend-select = [
  "A",   # flake8-builtins
  "B",   # flake8-bugbear
  "G",   # flake8-logging-format
  "I",   # isort
  "N",   # pep8-naming
  "RET", # flakes8-return
  "RUF", # Ruff-specific rules
  "UP",  # pyupgrade
]
```

Use Mypy for type checking with these rules:

```
[tool.mypy]
ignore_missing_imports = true
warn_unused_ignores = true
exclude = ["migrations/"]  # Add this exclude to Django projects
```
