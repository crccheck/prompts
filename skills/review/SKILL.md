---
name: review
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

Detect by author (`dependabot[bot]`) or title pattern (`Bump <package>`). If this is a dependabot PR, also report:

1. What does this package do?
2. Is it a direct or transitive dependency?
3. What changed? (summarize the version diff — breaking changes, deprecations, security fixes)
4. How is it used in this codebase?

## Output format

- Do not report findings that are not actionable
- Do not comment on things that are correct or good
- Point to a line with a GitHub permalink using the full 40-char commit SHA: `https://github.com/<owner>/<repo>/blob/<full-sha>/path/to/file.py#L10-L15`. Get the full SHA with `git rev-parse <short-sha>`.

## Approval format

IFF you are asked to approve, approve with a horizontal rule then the comment. Use the format:

```
<human comment if given>
----

<comment body>
```

## Reflect

- If your review was contested, don't save a memory, don't ignore it; fix the fucking skill, idiot
