# AI agent work

- Default to ONE commit for a session's work. Only split into multiple commits
  when the user explicitly says to split them.
- If/when the user does ask for split commits, use these guidelines:
  - in refactors, separate code and test changes
  - separate low-risk changes (style/whitespace, pure renames, mechanical
    find-and-replace) from high-risk ones (logic changes, callsites needing
    new arguments, behavior changes)

## Git commits and GitHub pull requests

Never add, commit, or push without being explicitly asked.

When writing pull request descriptions and git commit messages:

For generated changes by tools, the commit message should be the command (e.g.
ruff --fix, make reports) to document the command and to signal it's generated.

1. Be concise, respect the reader's time and token use
2. Don't just summarize code changes. Focus on intent and outcomes
3. Don't just enumerate what changed. Same as #2 but you keep making this mistake.
4. Document architectural decisions made. Point out when you were corrected
5. Prefer conventional commits
6. Do not make "oops" commits. Amend oops to the right commit

For GitHub comments, always sign your messages "-- Claude <model>"

### Conventional commits

Never add a commit scope! Claude always picks horrible scopes!
If a scope is given, scopes must be tangible (e.g. a path), not conceptual.
And never use '/' in a scope!
Scopes should be broad and universal. A typical project should not use more than
8 scopes over its lifetime.
