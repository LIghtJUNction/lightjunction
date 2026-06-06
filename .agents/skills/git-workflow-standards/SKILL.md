---
name: Git Workflow Standards
description: This skill should be used when the user asks to "add Git standards", "create a branch", "commit changes", "write a commit message", "open a PR", "review a PR", "prepare a release", "tag a version", or mentions trunk-based development, Conventional Commits, branch naming, PR checklist, semantic versioning, or release tags.
version: 0.1.0
---

# Git Workflow Standards

Apply this skill when planning, committing, reviewing, merging, or releasing
changes with Git.

## Workflow

1. Inspect `git status --short` before making Git decisions.
2. Keep unrelated user changes intact. Do not revert changes that were not made
   for the current task.
3. Load `references/git-workflow-standards.md` before creating branches,
   commits, pull requests, tags, or release branches.
4. Keep each branch, commit, and PR small enough to review and validate.
5. Run relevant checks before committing or requesting review.
6. Use Conventional Commits for commits and PR titles.

## Defaults

- Use trunk-based development.
- Treat `main` as the only long-lived branch.
- Create short-lived `feature/`, `bugfix/`, `hotfix/`, or `release/` branches
  from `main`.
- Avoid force pushing `main`.
- Prefer feature flags for large features that cannot be completed quickly.
- Use squash merge for pull requests unless the project explicitly requires a
  different merge strategy.

## Commit Message Shape

Use:

```text
<type>(<scope>): <subject>

[body]

[footer]
```

Use types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

## Release Shape

Use semantic version tags:

```text
v<major>.<minor>.<patch>[-prerelease]
```

Examples: `v1.2.3`, `v2.0.0-rc.1`.

## Reference Files

- `references/git-workflow-standards.md` - Detailed branch, commit, pull
  request, versioning, tag, and prohibited-pattern rules.
