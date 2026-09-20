# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues at `Penn-Lam/CoFounder`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, including labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments` with appropriate label and state filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- **Close an issue**: `gh issue close <number> --comment "..."`.

Infer the repository from the Git remote when running inside this checkout.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#<number>` with `gh pr view <number>` and fall back to `gh issue view <number>`.

## Skill operations

- When a skill says **publish to the issue tracker**, create a GitHub issue.
- When a skill says **fetch the relevant ticket**, read the GitHub issue with comments and labels.
- Use GitHub sub-issues and native issue dependencies for wayfinding when available. If unavailable, fall back to task lists and explicit `Blocked by: #<number>` lines.
