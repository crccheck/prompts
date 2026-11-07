---
description: Find simplifications in a scope of code
---

Review $ARGUMENTS. Evaluate it for simplicity, cognitive load, and technical debt.

Part 1. What simplifications can we make that keep behavior the same?

Part 2. What more simplifications can we make if we allow small behavior changes? For each one, state the behavior change.

Part 3. With hindsight, if we wrote this code from scratch, how would we design it differently?

If no scope is given, use the files changed on the current branch.

Give one numbered list for each part. For each item, give the full file path and line, the problem, the fix, the risk, and the size (small, medium, or large). Put the items with the most value first. Do not report items that are not actionable. Do not edit files.

End with this reminder to the user, word for word: Tell the other LLM "I will copy-paste some LLM generated suggestions. We don't have to do them. Feel free to contest."
