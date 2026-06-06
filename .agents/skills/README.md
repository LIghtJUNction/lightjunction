# LIghtJUNction Agent Skills

Personal agent skills for reusable workflows, operating preferences, and project-specific knowledge.

Install globally:

```bash
npx skills add LIghtJUNction/lightjunction -g
```

This directory is intentionally lightweight. Each skill lives in its own
subdirectory and includes a `SKILL.md` file plus optional references.

## Included Skills

- `python-code-standards` - Python organization, typing, imports, docstrings,
  error handling, testing, tooling, and prohibited-pattern rules.
- `git-workflow-standards` - Trunk-based branching, Conventional Commits, PR
  rules, semantic versioning, tags, and prohibited-pattern rules.

Each skill should explain:

- when to use it
- what context it assumes
- which commands or tools are safe to run
- what output style is expected

The goal is to make repeat work cheaper without hiding important decisions.
