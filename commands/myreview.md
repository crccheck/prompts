---
description: Review a code pull request
---

Review $ARGUMENTS

## Fetching the diff

For the PR number provided:

- `gh pr diff <number>` — the diff
- `gh pr view <number>` — title, description, labels
- `gh pr view <number> --comments` — existing review comments

Compare each finding against the existing review comments. Drop a finding only
if an existing comment identifies the exact issue. A generic concern, question,
or whisper is not blanket permission to ignore a finding. The user is extremely
angry and frustrated with you because you consistently fail to give a thorough,
correct review. Try harder.

Do not create a git worktree, you fucking idiot. Use the current checkout if its HEAD matches the PR’s head SHA; otherwise, review the PR diff without changing checkouts.
When the change is local, inspect the changed code in context, navigate definitions and references, and run targeted checks. You may edit the checkout to investigate, but do not commit changes unless explicitly instructed.

## Code review

Review the change systematically. Examine each changed line in its surrounding code and compare it with the existing implementation and repository conventions. Verify your conclusions against the code before reporting them.

1. Correctness bugs. Say if they are pre-existing.
2. Performance issues, including N+1 queries, unindexed filters, unbounded queries, and query plans for changed database access
3. Is this easy to delete? (Not revert — assume it is deep in commit history and revert is not possible)
4. Unnecessary complexity: verify assumptions against documented contracts and
   report actionable simplifications, even without a demonstrated failure.

Do not report failures that need a caller to break the API contract on purpose.

## Output format

- Deliver the result, not the review process.
- If a term is ambiguous, include the namespace you fucking idiot
- Do not report findings that are not actionable
- Do not comment on things that are correct or good
- Use GitHub permalinks to reference code
  - For PR files, use the full 40-char commit SHA: `https://github.com/<owner>/<repo>/blob/<full-sha>/path/to/file#L10-L15`
  - For reference files: `https://github.com/<owner>/<repo>/blob/main/path/to/file#L10-L15`

Group findings by priority:

- **Must Fix (P1)**: high deployment risk, security issues, or irreversible data loss
- **Should Fix (P2)**: moderate deployment risk
- **Low Priority**: low deployment risk

Omit empty groups. For each finding, state what is wrong, why it matters, and how to fix it.

Number findings consecutively across all priority groups. Never restart numbering
within a group.

Show only the priority label. Never show likelihood, blast radius, deploy risk
scores, or assessments in the review output.

## Reflect

- If your review was contested, don't save a memory, don't ignore it; ask the
  user what to change in `~/Sync/prompts/commands/myreview.md` and get explicit
  permission before editing it, idiot
