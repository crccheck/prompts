# Makefile

My Makefiles always begin with this target:

```
help: ## Shows this help
	@echo "$$(grep -h '#\{2\}' $(MAKEFILE_LIST) | sed 's/: #\{2\} /	/' | column -t -s '	')"
```

And they generally have these targets:

```
install: ## Install the project for local dev
lint: ## Check project linting rules
delint: ## Fix fixable linting errors
test: ## Run test suite
tdd: ## Run test watcher
dev: ## Run the development server
```

Leave out a target when the project has nothing for it to do (for example, no
`dev` target when there is no development server).

Every target that a person runs has a `##` help comment.

## install

`install` also upgrades the dependencies to their newest allowed versions.

Example for a uv project:

```
install: ## Install the project for local dev
	uv sync --upgrade
```

Example for a uv project that is also a command line tool:

```
install: ## Install the project for local dev
	uv sync --upgrade
	uv tool install --editable --reinstall .
```

## lint and delint

`lint` runs every check and does not change files. `delint` fixes what the
tools can fix.

Example for a Python project:

```
lint: ## Check project linting rules
	uv run ruff format --check .
	uv run ruff check .
	uv run mypy .

delint: ## Fix fixable linting errors
	uv run ruff format .
	uv run ruff check . --fix
```

Example for a Django project:

```
dev: ## Run the development server
test: ## Run test suite
tdd: ## Run test watcher
```


## Other rules

Only use `.PHONY` when needed to save lines, and place it above the target.

Makefiles should be portable between OSX and Linux.
