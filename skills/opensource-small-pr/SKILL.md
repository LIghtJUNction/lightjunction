---
name: opensource-small-pr
repo: LIghtJUNction/lightjunction
description: >
  Low-star open-source contribution workflow. Use this when preparing or doing
  small, low-risk PRs/issues, candidate queues, or maintainer follow-up for
  early-stage active repositories.
---

# Open-Source Small PR Workflow

Use this skill for recurring open-source contribution windows. The goal is one
small, useful contribution at a time, or a quiet local candidate note when no
safe public action exists.

## Required First Step

Before searching GitHub, posting publicly, or editing an external checkout, run
from the `lightjunction` project root:

```bash
./scripts/opensource-contrib-context.sh
```

Use the output as the source of truth for:

- China-time agenda
- state log path
- lock path
- recently explored repositories
- JSONL logging format

If the script says another run is active, stop immediately, write a short skip
summary, and archive/stop if this is an automated no-op run.

## Safety Rules

- Do not prioritize high-star repositories.
- Do not create mechanical PR spam, weak issues, or generic review comments.
- Do not do broad formatting, big refactors, dependency churn, or architecture rewrites.
- Do not touch authentication, payments, crypto, security policy, licenses, privacy-sensitive code, or production deployment paths.
- Prefer no PR over a weak PR.
- Skip recently explored repositories unless following up on an existing PR, issue, or maintainer reply.

## Candidate Criteria

Prefer repositories that match most of these:

- 2 to 80 stars by default, up to 150 only for an unusually clear small issue.
- Pushed within the last 30 to 60 days.
- Maintainer activity is visible in commits, issues, releases, or merged PRs.
- The project purpose is understandable within a few minutes.
- The fix can be reviewed quickly.

Prefer work types in this order:

- Broken links or stale docs links.
- Typos that affect commands, examples, or clarity.
- README/docs clarification tied to an existing issue.
- Small regression test for a clear bug.
- One-line or localized bug fix with a test.
- A real issue only when the bug or docs gap is verified.

## State And Logging

Local state stays under `.kimaki/` and must not be committed:

```text
.kimaki/opensource-contrib-log.jsonl
.kimaki/opensource-contrib.lock
```

Record every explored repository before the run ends:

```bash
printf '%s\n' '{"at":"2026-06-13T14:00:00Z","runId":"RUN_ID","repo":"owner/repo","action":"reviewed-skipped","url":"https://github.com/owner/repo","notes":"why skipped"}' >> .kimaki/opensource-contrib-log.jsonl
```

Useful actions:

- `candidate-recorded`
- `explored-skipped`
- `reviewed-skipped`
- `reviewed-no-comment`
- `issue-skipped`
- `opened-pr`
- `pr-followup-no-change`
- `notification-triage`

## Public Quality Bar

Before opening a PR, issue, or review comment:

- Read the full issue, PR, and relevant maintainer comments.
- Verify the problem still exists on the current branch or latest docs.
- Make the smallest correct change.
- Run the narrowest relevant validation command.
- Run an automatic diff review with the configured review model before any public PR or review comment:

```bash
opencode run -m custom/codex-auto-review 'Review only the current git diff for correctness, regressions, missing tests, maintainability risks, and accidental broad changes. Return findings first with file/line references. If there are no blocking findings, say so explicitly.'
```

Run review-model checks sequentially. Parallel `opencode run` calls can contend on
the local opencode SQLite session database.

- Treat blocking review findings like failing tests: fix them or skip the public action.
- Record the review outcome in the final report.
- If validation cannot run, explain exactly why.

When passing PR bodies through shell, use single quotes around the body so
Markdown backticks are not executed by the shell.

## Final Report

Report compactly:

- current China time and agenda
- repositories skipped and why
- selected repository with URL and star count
- issue URL, if any
- PR URL, if opened
- validation commands and results
- `custom/codex-auto-review` result summary
- local log update status

If no useful contribution was found, say that directly. Do not invent a PR
target.
