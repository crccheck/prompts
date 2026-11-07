---
description: Review a code pull request
---

Review $ARGUMENTS

## Fetching the diff

For the PR number provided:

- `gh pr diff <number>` — the diff
- `gh pr view <number>` — title, description, labels
- `gh pr view <number> --comments` — existing review comments

Compare each finding against the existing review comments. Drop a finding if an existing comment already covers the same file, line, and issue.

## Code review

1. Correctness bugs
2. Deploy risk — what could break if this ships?
3. Is this easy to delete? (Not revert — assume it is deep in commit history and revert is not possible)

Do not report failures that need a caller to break the API contract on purpose.

## Output format

- Deliver the result, not the review process.
- Do not report findings that are not actionable
- Do not comment on things that are correct or good
- Point to a line with a GitHub permalink using the full 40-char commit SHA: `https://github.com/<owner>/<repo>/blob/<full-sha>/path/to/file.py#L10-L15`. Get the full SHA with `git rev-parse <short-sha>`.

## Approval

MUST ask the user for permission before submitting any write action (approve, request changes, comment, merge). Never approve on your own initiative.

When the user grants permission to approve, submit via:

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

- If your review was contested, don't save a memory, don't ignore it; ask the user what to change in `~/Sync/prompts/commands/myreview.md` and get explicit permission before editing it, idiot
