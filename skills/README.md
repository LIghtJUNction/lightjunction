# LIghtJUNction Agent Skills

Reusable agent workflows, operating preferences, and project-specific
knowledge, kept host-neutral so they work the same whether the runtime is
Claude Code, Codex, or another agent host.

Install globally:

```bash
npx skills add LIghtJUNction/lightjunction -g
```

Each skill lives in its own subdirectory with a `SKILL.md` and, where useful,
a `references/` or `scripts/` folder. A `SKILL.md` should explain when to use
it, what context it assumes, which commands are safe to run, and what output
style is expected — the goal is to make repeat work cheaper without hiding
important decisions.

## Included skills

| Skill | Purpose |
| --- | --- |
| `agentmail-email` | AgentMail mailbox workflow for the assistant's email address. |
| `auto-cleanup` | Archive completed sessions, prune scratch state, close no-op runs safely. |
| `bilibili-social` | Read/post Bilibili comments and private messages. |
| `git-workflow-standards` | Trunk-based branching, Conventional Commits, PR and release rules. |
| `lmm-best-service-page` | lmm.best static profile-page product workflow. |
| `obscura-browser` | Lightweight headless browser for page visits and scraping without heavyweight browser caches. |
| `opensource-small-pr` | Low-star open-source contribution workflow: candidate queues, small PRs, maintainer follow-up. |
| `python-code-standards` | Python organization, typing, testing, and tooling conventions. |
| `share-file-handoff` | Deliver files to customers via share.lmm.best. |
| `skill-improvement` | Meta workflow for turning recurring work into a new or improved skill. |
| `user-project-maintenance` | Scheduled maintenance of the owner's own GitHub repositories. |
