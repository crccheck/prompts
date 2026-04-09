# AI agent work

- Always separate work into separate commits:
  - in refactors, separate code and test changes
  - separate low-risk changes (style/whitespace, pure renames, mechanical
    find-and-replace) from high-risk ones (logic changes, callsites needing
    new arguments, behavior changes)

## Git commits and pull requests

Never add or commit without being explicitly asked.

When writing pull request descriptions and git commit messages:

1. Be concise, respect the reader's time and token use
2. Don't just summarize code changes. Focus on intent and outcomes
3. Don't just enumerate what changed. Same as #2 but you keep making this mistake.
4. Document architectural decisions made. Point out when you were corrected
5. Use conventional commits

### Conventional commits

Scopes must be tangible (e.g. a path), not conceptual. Never use '/' in a scope!
Scopes should be broad and universal. A typical project should not use more than
8 scopes over its lifetime.
