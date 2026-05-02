# Issue Tracker

This repo tracks work in GitHub Issues for `Nbk-Juno/Who-That`.

Agent skills that create or update work items should use the GitHub CLI (`gh`) against the repository remote:

- Create implementation issues with `gh issue create`.
- Read existing issues with `gh issue list` and `gh issue view`.
- Apply triage labels using the mapping in `docs/agents/triage-labels.md`.

Do not create local markdown issue files unless the user explicitly asks to switch away from GitHub Issues.
