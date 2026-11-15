---
description: Find simplifications in a scope of code
---

Spawn one `simplifier` subagent. Give it this scope: $ARGUMENTS (if empty, tell it to use the files changed on the current branch).

Right after spawning, tell the user: Press Alt-A to view the agent.

When it finishes, print its report to the user unchanged. Do not summarize, reorder, or edit it.
