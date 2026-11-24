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
Do not use `docker compose exec web` to review a worktree unless `web` was restarted for that worktree. Run Python on the host instead.

OUTPUT THIS: What problem does this PR solve? Use both the PR description and
the change. For each material change that the description omits or describes
differently, explain what the code does and how it differs from the description.
Do not merely name the change you lazy ho.

## Commit history

Always review the PR's commits. First determine whether the commit sequence is
intentional. If it is, walk through each commit. Report a stack of commits that
appears unstructured or a single oversized commit.

Determine whether the author attempted to keep each commit CI-compatible and
usable with git bisect. Do not check CI results for every commit. Check that
commits are atomic: separate refactors from behavior changes, and separate test
changes from code changes where this verifies that the code preserves behavior.

## Code review

Review the change systematically. Examine each changed line in its surrounding code and compare it with the existing implementation and repository conventions. Verify your conclusions against the code before reporting them.

1. Correctness bugs. Say if they are pre-existing.
2. Performance issues, including N+1 queries, unindexed filters, unbounded queries, and query plans for changed database access
3. OUTPUT THIS: Is this easy to delete? (Not revert — assume it is deep in commit history and revert is not possible)
4. Unnecessary complexity: verify assumptions against documented contracts and
   report actionable simplifications, even without a demonstrated failure.

Do not invent failures that need a caller to break the API contract on purpose
just so you can report that a failure exists.

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

Omit empty groups. For each finding, start with the exact change needed: identify
the expression to replace and its replacement. Then explain the user-visible
failure and the conditions that cause it. Avoid naming an internal component as
the problem when the fix is in its caller.

Number findings consecutively across all priority groups. Never restart numbering
within a group.

Show only the priority label. Never show likelihood, blast radius, deploy risk
scores, or assessments in the review output.

## Reflect

- If your review was contested, don't save a memory, don't ignore it; if there's
  an actual non-specific, non-reactive change in
  `~/Sync/prompts/commands/myreview.md`, suggest it. And fucking get explicit
  permission before editing, you fucking idiot.
