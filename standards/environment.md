# Development Environment

## Operating System & Shell

- **OS:** macOS (Darwin)
- **Shell:** zsh

## GNU Utilities

GNU versions of core utilities are available and should be used instead of OSX:

- `sed` → `gsed` (GNU sed)
- `grep` → `ggrep` (GNU grep)
- `find` → `gfind` (GNU find)
- `awk` → `gawk` (GNU awk)

If you are going to recursive grep or find + grep, use `ag` instead.

## Shell Command Preferences

- Prefer simple, linear commands over complex pipes when possible. Avoid nesting
- For complex bash operations with multiple pipes/subshells, test incrementally
- macOS `zsh` has different evaluation rules than bash for certain constructs
