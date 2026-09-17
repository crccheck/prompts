---
name: monthly-maintenance
description: personal monthly maintenance
---

# Monthly Maintenance

Audit and update pinned tool versions in a personal project: pre-commit hooks,
GitHub Actions, Python version, Dockerfile base image, compiled
requirements / `uv.lock`, and npm dependencies.

## Workflow

### 1. Create a maintenance branch

```bash
git checkout main
```

```bash
git pull
```

```bash
git checkout -b chore/maintain-YYYY-MM
```

### 2. Identify pinned versions

Read the project's config files and note what's pinned and where:

- Pre-commit hooks: `.pre-commit-config.yaml` — `rev:` fields
- GitHub Actions: `.github/workflows/` — `uses:` version pins
- Python version: `pyproject.toml` (`requires-python`, tool config), `.python-version`
- Dockerfile base image: `Dockerfile` — `FROM` lines
- Compiled requirements: `uv.lock`, `requirements*.txt`
- npm dependencies: `package.json` — version ranges; check if `package-lock.json` is tracked or gitignored

### 3. Check for updates

- **Pre-commit hooks**: for each repo in `.pre-commit-config.yaml`, check its
  GitHub releases page for the latest tag.
- **GitHub Actions**: use the `upgrade-github-workflows` skill to audit
  `.github/workflows/`.
- **Python version**: latest stable is at https://www.python.org/downloads/ —
  only bump if there's a reason to (new minor release, current version nearing EOL).
- **Dockerfile base image**: for each `FROM` line, check the image's registry
  tags (e.g. Docker Hub, `ghcr.io`) for the latest matching tag. Keep the same
  tag scheme (e.g. `python:3.12-slim` stays on a `-slim` variant, digest pins
  stay digest-pinned).
- **npm dependencies**: if the project has a `package.json`, run `npm outdated`
  to see current/wanted/latest for each dependency. `wanted` updates are
  in-range and handled by `npm update`; `latest` versions past `wanted` need
  a manual `package.json` range bump (treat like a series boundary crossing).

### 4. Report findings

Before making any changes, present a summary table:

```
| Tool             | Current | Latest | Action     |
|------------------|---------|--------|------------|
| ruff-pre-commit  | v0.X.Y  | v0.A.B | bump       |
| pre-commit-hooks | v4.X.Y  | v5.A.B | bump       |
| actions/checkout | v4      | v5     | bump       |
| Python           | 3.12    | 3.13   | up to date |
| Dockerfile base  | 3.12-slim | 3.13-slim | bump |
```

Confirm with the user before applying any changes.

### 5. Apply updates

Edit each file directly. Pay attention to:

- Tag format conventions (some tools use `v1.2.3`, others `1.2.3` — check the repo's tag naming)
- Coupled versions that must stay in sync (e.g. `ruff-pre-commit` rev and the ruff version constraint in `pyproject.toml`)
- Range constraints (e.g. `>=0.12,<0.13`) need both bounds updated when crossing a series boundary

Commit the version bumps (mechanical, low-risk change — keep it separate per `standards/git.md`):

```bash
git commit -am 'chore: bump pre-commit hook and action versions'
```

### 6. Upgrade requirements

If the project has a `uv.lock`:

```bash
uv lock --upgrade
```

Run the test suite immediately — do not ask first. If anything fails, revert the offending package(s) and leave them for a dedicated PR.

Commit using the command itself as the message so it's self-documenting:

```bash
git commit -am 'uv lock --upgrade'
```

### 7. Upgrade npm dependencies

If the project has a `package.json`:

```bash
npm update
```

For any dependency where `latest` is past `wanted` (per step 3), bump the
range in `package.json` by hand, then rerun `npm update`.

Run `npm dedupe` after all updates to collapse duplicate package versions.

Run the test suite / linter immediately — do not ask first. If anything
fails, revert the offending package(s) and leave them for a dedicated PR.

```bash
git commit -am 'npm update'
```

### 8. Open a draft PR

Push the branch first, then create the PR:

```bash
git push -u origin chore/maintain-YYYY-MM
```

```bash
gh pr create --draft --title "chore: YYYY-MM maintenance" --body "..."
```
