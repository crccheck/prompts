# Upgrade GitHub Workflows

Check and upgrade GitHub Actions in `.github/workflows/` to their latest versions.

## Instructions

1. Find all workflow files in `.github/workflows/` (both .yml and .yaml)

2. Read all workflow files and extract all action uses (lines with `uses:`)

3. For each unique action found, check the latest version:
   - For `actions/*` actions: Check releases page
   - For all other actions: Check releases page (should already have comment links)

4. Report findings in a table format:

   ```
   | Action | Current | Latest | Status |
   |--------|---------|--------|--------|
   | actions/checkout | v5 | v6 | Outdated |
   | actions/setup-python | v6 | v6 | Up to date |
   ```

5. For any outdated actions, report the changes from release notes:
   - Breaking changes
   - New features
   - Bug fixes
   - Any other notable changes

6. Ask user if they want to proceed with updates

7. If yes:
   - Update all outdated actions to latest versions
   - Pin every action (including `actions/*`) to the full 40-character commit
     SHA of the exact release tag, with the exact version in a trailing comment:
     ```yaml
     uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
     ```
   - Get the SHA with `git ls-remote https://github.com/owner/repo "refs/tags/vX.Y.Z*"`.
     If the output has a `refs/tags/vX.Y.Z^{}` line, use that SHA (annotated
     tag: the other line is the tag object, not the commit).
   - For non-`actions/*` actions that don't have release page comments, add them above the `uses:` line:
     ```yaml
     # https://github.com/owner/repo/releases
     uses: owner/repo@<sha> # vX.Y.Z
     ```

8. Ensure consistency: All instances of the same action should use the same SHA and version comment

## Tips

- Use WebSearch to find latest versions efficiently
- Use WebFetch to get detailed release notes for all changes
- Look for version comments/links that may already exist in workflows
- Check that release page comments follow the pattern: `# https://github.com/owner/repo/releases`
