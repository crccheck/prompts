# Project boilerplate

Read `tasks/project_boilerplate.md` if you are working on any basic project
boilerplate.

# Python

Projects use modern pyproject.toml with 'uv' for package management, 'ruff' for
linting and formatting, and 'mypy' for type checking.

Virtual environments are stored in `./.venv` directory.

New code should have type annotations. Old code will gradually get typed as it's
iterated upon.
