# Python project setup

Python style rules are in `rule://python`.

## pyproject.toml

Use dependency groups for 'dev' dependencies, not 'project.optional-dependencies'

```
[tool.uv]
exclude-newer = "3 days"

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
  "PLC", # pylint conventions
]
```

Use Mypy for type checking with these rules:

```
[tool.mypy]
ignore_missing_imports = true
warn_unused_ignores = true
exclude = ["migrations/"]  # Add this exclude to Django projects
```
