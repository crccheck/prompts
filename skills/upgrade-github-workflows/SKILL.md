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
   - For non-`actions/*` actions that don't have release page comments, add them above the `uses:` line:
     ```yaml
     # https://github.com/owner/repo/releases
     uses: owner/repo@version
     ```

8. Ensure consistency: All instances of the same action should use the same version

## Tips

- Use WebSearch to find latest versions efficiently
- Use WebFetch to get detailed release notes for all changes
- Look for version comments/links that may already exist in workflows
- Check that release page comments follow the pattern: `# https://github.com/owner/repo/releases`
