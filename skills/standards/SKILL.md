---
name: standards
description: My coding standards. Manual only; load when the user explicitly invokes /skill:standards or asks for "my standards".
disable-model-invocation: true
hide: false
---

# Standards

Topic files are in this skill directory. Read only the files that apply.

| File                  | Applies to                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `django.md`           | Django projects; test rules apply to `**/tests/**/*.py`, `**/test_*.py` |
| `github-workflows.md` | GitHub Actions and GitHub workflows (`.github/workflows`)               |
| `makefile.md`         | Every project with a `Makefile`                                         |
| `python.md`           | Python project setup: `pyproject.toml`, uv, ruff, mypy                  |
| `review-standards.md` | Code reviews, PR reviews, commit-range reviews                          |
| `scrapers.md`         | Scrapers, ingesters, downloaders that fetch from a 3rd party            |

## Start a new project

1. Read `github-workflows.md`, `makefile.md`, and each language or framework file that applies.
2. Make the scaffold follow those files (config, layout, tooling, tests).

## Upgrade an existing project

1. Read the files that apply to the project.
2. Compare the project to them. Give a numbered list of differences.
3. Fix the differences the user approves.

## Update a standard

1. Edit the real files in `~/Sync/prompts/skills/standards/`. Find them with `realpath skill://standards`.
2. Rewrite the affected section to show the current rule. Do not append history or reasons for the change.
3. Add a new topic file only for a new area, and add a row for it to the table above.
