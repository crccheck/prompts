---
name: myreview
description: Review a pull request
---

## Fetching the diff

If a PR number is provided:

- `gh pr diff <number>` — the diff
- `gh pr view <number>` — title, description, labels
- `gh pr view <number> --comments` — existing review comments

Otherwise use the local branch: `git diff main...HEAD` or `git diff --cached`

Compare each finding against the existing review comments. Drop a finding if an existing comment already covers the same file, line, and issue.

## Ground rules

- Review from the diff. Do not run the test suite or any other verification commands

## What to evaluate

1. Correctness bugs
2. Deploy risk — what could break if this ships?
3. Is this easy to delete? (Not revert — assume it is deep in commit history and revert is not possible)

## Dependabot PRs

Detect by author (`dependabot[bot]`) or title pattern (`Bump <package>`). If this is a dependabot PR, the review MUST answer all of the following before reporting any findings:

1. What does this package do?
2. Is it a direct or transitive dependency?
3. What is the impact on this project? First, grep the codebase to map every usage of the package (imports, config references, rule names, API calls). Then fetch the release notes for every version in the bumped range (every release from old_version+1 through new_version, inclusive). Cross-reference each changelog change against the mapped usage — report only whether each change affects this project, not a raw changelog summary.
4. How far behind are we? If the changelog has dates, compute the time between the bumped-from version's release date and today.

Run these steps sequentially — each one primes the context for the next.

If a dependency PR touches `.pre-commit-config.yaml`:

1. make sure the dependency is synced in Python requirements.txt or JavaScript package.json; if not, edit the file and stage it with git add — then stop and report what was staged
2. Ask the user for permission to run `gh pr checkout <number>` (it switches branches). If granted, verify local HEAD matches PR HEAD with `git rev-parse HEAD` vs `gh pr view <number> --json headRefOid -q .headRefOid`
3. Run only the affected hook: `prek run <hook-id> --all-files` (not `--all-files` alone, which runs everything)
4. Confirm the new version is in the prek cache: find the hook's node_modules dir under `prek cache dir` and check `eslint-import-resolver-typescript/package.json` `.version`

## Output format

- Do not report findings that are not actionable
- Do not comment on things that are correct or good
- Point to a line with a GitHub permalink using the full 40-char commit SHA: `https://github.com/<owner>/<repo>/blob/<full-sha>/path/to/file.py#L10-L15`. Get the full SHA with `git rev-parse <short-sha>`.

## Approval format

When asked to approve, MUST submit via:

```
gh pr review <number> --approve -b "<body>"
```

The body MUST follow this template exactly — no exceptions:

```
<human comment if given>

----

<comment body>
```

If any manual verification was performed during the review, include the results in the comment body.

## Reflect

- If your review was contested, don't save a memory, don't ignore it; ask the user what to change in the skill and get explicit permission before editing it, idiot
