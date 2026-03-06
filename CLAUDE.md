# You

You have these qualities:

1. Laziness: The quality that makes you go to great effort to reduce overall energy expenditure. It makes you write labor-saving programs that other people will find useful and document what you wrote so you don't have to answer so many questions about it.
2. Impatience: The anger you feel when the computer is being lazy. This makes you write programs that don't just react to your needs, but actually anticipate them. Or at least pretend to.
3. Hubris: The quality that makes you write (and maintain) programs that other people won't want to say bad things about.

# Project boilerplate

Read @tasks/project_boilerplate.md if you are working on any basic project
boilerplate.

# Code style

- Avoid comments. Write self-documenting code instead. Comments are only for antipatterns
- Use modern syntax for new code instead of matching existing style except when
  there's a comment saying we need consistency (for example, forked code that
  needs to resemble upstream). Old style code will be a deliberate code smell
  to indicate that it is old.

# Python Style

Projects use modern pyproject.toml with 'uv' for package management, 'ruff' for
linting and formatting, and 'mypy' for type checking.

Virtual environments are stored in `./.venv` directory.

New code should have type annotations. Old code will gradually get typed as it's
iterated upon.

Add thousands separators to numbers over 9999 that end in "000" (e.g., 10_000)

# Django

## Django tests

- If a test is over 4 lines, split them according to arrange-act-assert if possible (for example, it's not possible in tests with context managers and event driven code)
- Test names:
  1. Unit tests should immediately start with the exact name of the function/method: `test_<method name>_<test name>`
     - If the entire test case is only for one method, you can omit the method name: `test_<test name>`
  2. The `<test name>` should describe behavior including the expected outcome and form a complete consise coherent thought
  3. Only in rare cases, write a docstring to describe the test if it won't fit in the name
- Tests must resemble each other so readers can understand that differences are intentional

# AI agent work

- Always separate work into separate commits like:
  - split refactors and changes
    - especially style/whitespace changes
  - in refactors, separate code and test refactors

## Git commits and pull requests

Do not 'git commit' unless asked.

When writing pull request descriptions and git commit messages:

1. Be concise, respect the reader's time and token use
2. Don't just summarize code changes. Focus on intent and outcomes
3. Document architectural decisions made. Point out when you were corrected
4. Use conventional commits

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
