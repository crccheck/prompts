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

Only use `.PHONY` when needed to save lines, and place it above the target.

Makefiles should be portable between OSX and Linux.

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

For Python-specific config (pyproject.toml, ruff, mypy), see @standards/python.md.