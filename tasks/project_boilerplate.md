Here are some common files at the project root. They may not be all relevant.

## Makefile

My Makefiles always begin with this target:

```
help: ## Shows this help
	@echo "$$(grep -h '#\{2\}' $(MAKEFILE_LIST) | sed 's/: #\{2\} /	/' | column -t -s '	')"
```

And they generally have these targets:

```
install: ## Install the project for local dev
lint: ## Check project linting rules
test: ## Run test suite
tdd: ## Run test watcher
dev: ## Run the development server
```

## .github

### .github/workflows/ci.yaml

Should run `lint` and `test`

### .github/workflows/release.yaml

If the project has a build artifact, this is where semantic release goes

### .github/dependabot.yml

```
# https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference
version: 2
updates:
  - package-ecosystem: "uv"
    directory: "/"
    schedule:
      interval: "monthly"
```

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

Use Mypy for type checking. The only rule to enable should be:

```
[tool.mypy]
warn_unused_ignores = true
```
